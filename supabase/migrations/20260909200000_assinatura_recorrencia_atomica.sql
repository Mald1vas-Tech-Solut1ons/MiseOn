-- Sprint 15C: o histórico da notificação Efí é cumulativo. Cada item precisa
-- ter efeito único e cobrança/entitlement/fatura precisam mudar na mesma
-- transação; um HTTP 200 sem persistência faria a Efí parar de reenviar.

alter table public.assinatura_eventos_efi
  add column if not exists evento_chave text,
  add column if not exists provider_event_id bigint,
  add column if not exists tipo_evento text,
  add column if not exists ocorrido_em timestamptz,
  add column if not exists processado_em timestamptz;

update public.assinatura_eventos_efi
set evento_chave = 'legado:' || id::text
where evento_chave is null;

alter table public.assinatura_eventos_efi
  alter column evento_chave set not null;

create unique index if not exists uq_assinatura_eventos_efi_token_chave
  on public.assinatura_eventos_efi (notification_token, evento_chave);

alter table public.lojas
  add column if not exists assinatura_efi_status text,
  add column if not exists assinatura_efi_evento_em timestamptz;

create table if not exists public.assinatura_notificacoes_efi (
  notification_token text primary key,
  estado text not null default 'recebida'
    check (estado in ('recebida', 'processando', 'concluida', 'erro')),
  tentativas integer not null default 0,
  recebida_em timestamptz not null default now(),
  ultima_tentativa_em timestamptz,
  concluida_em timestamptz,
  ultimo_erro text
);

alter table public.assinatura_notificacoes_efi enable row level security;
drop policy if exists superadmin_ve_notificacoes_assinatura on public.assinatura_notificacoes_efi;
create policy superadmin_ve_notificacoes_assinatura on public.assinatura_notificacoes_efi
  for select using (public.fn_sou_superadmin());
revoke all on public.assinatura_notificacoes_efi from public, anon, authenticated;
grant all on public.assinatura_notificacoes_efi to service_role;

alter table public.faturas_assinatura
  drop constraint if exists faturas_assinatura_status_cobranca_check;

alter table public.faturas_assinatura
  add constraint faturas_assinatura_status_cobranca_check
  check (status_cobranca in ('pendente', 'pago', 'recusado', 'cancelado', 'estornado', 'contestado'));

create or replace function public.fn_assinatura_processar_evento_efi(
  p_notification_token text,
  p_evento_chave text,
  p_provider_event_id bigint,
  p_payload jsonb,
  p_tipo_evento text,
  p_subscription_id text,
  p_charge_id text,
  p_status text,
  p_valor_centavos bigint,
  p_ocorrido_em text
)
returns table(situacao text, fatura_id uuid, acionar_nfse boolean, observacao text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_evento_id uuid;
  v_evento_situacao text;
  v_ocorrido_em timestamptz := now();
  v_anterior public.faturas_assinatura%rowtype;
  v_fatura public.faturas_assinatura%rowtype;
  v_loja public.lojas%rowtype;
  v_status_fatura text;
  v_valor numeric(10,2);
  v_novo_vencimento timestamptz;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Somente service_role pode processar evento de assinatura';
  end if;
  if nullif(trim(p_notification_token), '') is null or nullif(trim(p_evento_chave), '') is null then
    raise exception 'Token e chave do evento são obrigatórios';
  end if;

  begin
    if nullif(trim(p_ocorrido_em), '') is not null then
      v_ocorrido_em := p_ocorrido_em::timestamptz;
    end if;
  exception when others then
    v_ocorrido_em := now();
  end;

  insert into public.assinatura_eventos_efi (
    notification_token, evento_chave, provider_event_id, payload_bruto,
    tipo_evento, subscription_id, charge_id, status_lido, ocorrido_em, situacao
  ) values (
    p_notification_token, p_evento_chave, p_provider_event_id, coalesce(p_payload, '{}'::jsonb),
    nullif(p_tipo_evento, ''), nullif(p_subscription_id, ''), nullif(p_charge_id, ''),
    nullif(p_status, ''), v_ocorrido_em, 'ignorado'
  )
  on conflict (notification_token, evento_chave) do nothing
  returning id into v_evento_id;

  if v_evento_id is null then
    select id, assinatura_eventos_efi.situacao into v_evento_id, v_evento_situacao
    from public.assinatura_eventos_efi
    where notification_token = p_notification_token and evento_chave = p_evento_chave
    for update;
    -- Um callback pode chegar entre a aprovação na Efí e o INSERT da fatura
    -- inicial. O evento fica não reconhecido, mas precisa poder ser retomado
    -- quando o vínculo existir. Eventos já resolvidos continuam efeito único.
    if v_evento_situacao <> 'nao_reconhecido' then
      return query select 'duplicado'::text, null::uuid, false, 'Evento já processado.'::text;
      return;
    end if;
    update public.assinatura_eventos_efi set situacao = 'ignorado', processado_em = null,
      observacao = 'Reconciliação retomou evento antes não reconhecido.' where id = v_evento_id;
  end if;

  if nullif(p_subscription_id, '') is null then
    update public.assinatura_eventos_efi set situacao = 'nao_reconhecido', processado_em = now(),
      observacao = 'Evento sem subscription_id; nenhum efeito aplicado.' where id = v_evento_id;
    return query select 'nao_reconhecido'::text, null::uuid, false, 'Evento sem subscription_id.'::text;
    return;
  end if;

  -- Serializa todos os eventos da mesma assinatura, inclusive tokens
  -- diferentes e callbacks concorrentes.
  perform pg_advisory_xact_lock(hashtextextended(p_subscription_id, 1503));

  select * into v_anterior
  from public.faturas_assinatura
  where efi_subscription_id = p_subscription_id
  order by created_at desc
  limit 1;

  if v_anterior.id is null then
    update public.assinatura_eventos_efi set situacao = 'nao_reconhecido', processado_em = now(),
      observacao = 'Assinatura sem fatura anterior vinculada; exige reconciliação.' where id = v_evento_id;
    return query select 'nao_reconhecido'::text, null::uuid, false, 'Assinatura sem vínculo com loja.'::text;
    return;
  end if;

  -- Evento da assinatura controla recorrência, não comprova dinheiro. Cancelar
  -- preserva o período já pago; a avaliação de acesso usa trial_termina_em.
  if p_tipo_evento = 'subscription' then
    if p_status in ('active', 'new', 'new_charge', 'canceled', 'expired') then
      update public.lojas
      set assinatura_efi_status = p_status,
          assinatura_efi_evento_em = v_ocorrido_em,
          status_assinatura = case
            when p_status in ('canceled', 'expired') and status_assinatura <> 'vitalicio' then 'cancelada'
            else status_assinatura
          end
      where id = v_anterior.loja_id
        and (assinatura_efi_evento_em is null or assinatura_efi_evento_em <= v_ocorrido_em);
      update public.assinatura_eventos_efi set situacao = 'reconhecido', processado_em = now(),
        fatura_id = v_anterior.id, observacao = 'Estado da assinatura registrado sem inferir pagamento.' where id = v_evento_id;
      return query select 'reconhecido'::text, v_anterior.id, false, 'Estado da assinatura registrado.'::text;
    else
      update public.assinatura_eventos_efi set situacao = 'ignorado', processado_em = now(),
        fatura_id = v_anterior.id, observacao = 'Estado de assinatura sem efeito financeiro.' where id = v_evento_id;
      return query select 'ignorado'::text, v_anterior.id, false, 'Estado sem efeito financeiro.'::text;
    end if;
    return;
  end if;

  if p_tipo_evento not in ('subscription_charge', 'charge') or nullif(p_charge_id, '') is null then
    update public.assinatura_eventos_efi set situacao = 'nao_reconhecido', processado_em = now(),
      observacao = 'Evento de cobrança sem tipo/charge_id reconhecível.' where id = v_evento_id;
    return query select 'nao_reconhecido'::text, null::uuid, false, 'Cobrança sem identificador.'::text;
    return;
  end if;

  select * into v_fatura from public.faturas_assinatura where efi_charge_id = p_charge_id for update;
  v_valor := case when p_valor_centavos is not null and p_valor_centavos > 0
    then p_valor_centavos::numeric / 100 else null end;

  if p_status in ('paid', 'settled') then
    if v_fatura.id is not null and v_fatura.status_cobranca = 'pago' then
      update public.assinatura_eventos_efi set situacao = 'duplicado', processado_em = now(),
        fatura_id = v_fatura.id, observacao = 'Cobrança já estava paga.' where id = v_evento_id;
      return query select 'duplicado'::text, v_fatura.id, false, 'Cobrança já paga.'::text;
      return;
    end if;

    if v_valor is null or abs(v_valor - coalesce(v_fatura.valor_cobrado, v_anterior.valor_cobrado)) > 0.009 then
      update public.assinatura_eventos_efi set situacao = 'nao_reconhecido', processado_em = now(),
        observacao = 'Pagamento sem valor ou divergente do contrato; acesso e fatura não alterados.' where id = v_evento_id;
      return query select 'nao_reconhecido'::text, null::uuid, false, 'Valor divergente; exige reconciliação.'::text;
      return;
    end if;

    if v_fatura.id is null then
      insert into public.faturas_assinatura (
        loja_id, ciclo, parcelas, forma_pagamento, valor_cobrado,
        efi_subscription_id, efi_charge_id, status_cobranca, data_pagamento,
        tomador_cpf_cnpj, tomador_razao_social, tomador_logradouro, tomador_numero,
        tomador_complemento, tomador_bairro, tomador_cidade, tomador_uf,
        tomador_cep, tomador_email
      ) values (
        v_anterior.loja_id, 'mensal', 1, 'cartao', v_valor,
        p_subscription_id, p_charge_id, 'pago', v_ocorrido_em,
        v_anterior.tomador_cpf_cnpj, v_anterior.tomador_razao_social,
        v_anterior.tomador_logradouro, v_anterior.tomador_numero,
        v_anterior.tomador_complemento, v_anterior.tomador_bairro,
        v_anterior.tomador_cidade, v_anterior.tomador_uf,
        v_anterior.tomador_cep, v_anterior.tomador_email
      ) returning * into v_fatura;
    else
      update public.faturas_assinatura set status_cobranca = 'pago', data_pagamento = v_ocorrido_em
      where id = v_fatura.id and status_cobranca <> 'pago' returning * into v_fatura;
    end if;

    select * into v_loja from public.lojas where id = v_anterior.loja_id for update;
    v_novo_vencimento := greatest(coalesce(v_loja.trial_termina_em, now()), now()) + interval '1 month';
    update public.lojas set
      status_assinatura = case when status_assinatura = 'vitalicio' then 'vitalicio' else 'ativa' end,
      trial_termina_em = v_novo_vencimento,
      assinatura_efi_status = 'active',
      assinatura_efi_evento_em = greatest(coalesce(assinatura_efi_evento_em, v_ocorrido_em), v_ocorrido_em)
    where id = v_anterior.loja_id;

    update public.assinatura_eventos_efi set situacao = 'reconhecido', processado_em = now(),
      fatura_id = v_fatura.id, observacao = 'Pagamento conciliado atomicamente; NFS-e pendente de acionamento.' where id = v_evento_id;
    return query select 'reconhecido'::text, v_fatura.id, true, 'Renovação conciliada.'::text;
    return;
  end if;

  if p_status in ('unpaid', 'expired', 'canceled', 'refunded', 'contested') then
    if v_fatura.id is not null and v_fatura.status_cobranca = 'pago' then
      update public.assinatura_eventos_efi set situacao = 'ignorado', processado_em = now(),
        fatura_id = v_fatura.id, observacao = 'Evento negativo anterior/terminal não rebaixa cobrança já paga.' where id = v_evento_id;
      return query select 'ignorado'::text, v_fatura.id, false, 'Cobrança paga preservada.'::text;
      return;
    end if;

    v_status_fatura := case p_status
      when 'canceled' then 'cancelado'
      when 'refunded' then 'estornado'
      when 'contested' then 'contestado'
      else 'recusado' end;
    if v_fatura.id is null then
      insert into public.faturas_assinatura (
        loja_id, ciclo, parcelas, forma_pagamento, valor_cobrado,
        efi_subscription_id, efi_charge_id, status_cobranca,
        tomador_cpf_cnpj, tomador_razao_social, tomador_logradouro, tomador_numero,
        tomador_complemento, tomador_bairro, tomador_cidade, tomador_uf,
        tomador_cep, tomador_email
      ) values (
        v_anterior.loja_id, 'mensal', 1, 'cartao', coalesce(v_valor, v_anterior.valor_cobrado),
        p_subscription_id, p_charge_id, v_status_fatura,
        v_anterior.tomador_cpf_cnpj, v_anterior.tomador_razao_social,
        v_anterior.tomador_logradouro, v_anterior.tomador_numero,
        v_anterior.tomador_complemento, v_anterior.tomador_bairro,
        v_anterior.tomador_cidade, v_anterior.tomador_uf,
        v_anterior.tomador_cep, v_anterior.tomador_email
      ) returning * into v_fatura;
    else
      update public.faturas_assinatura set status_cobranca = v_status_fatura
      where id = v_fatura.id returning * into v_fatura;
    end if;

    update public.lojas set status_assinatura = case when status_assinatura = 'vitalicio' then 'vitalicio' else 'atrasada' end
    where id = v_anterior.loja_id;
    update public.assinatura_eventos_efi set situacao = 'reconhecido', processado_em = now(),
      fatura_id = v_fatura.id, observacao = 'Falha/estorno conciliado sem gerar NFS-e nem estender acesso.' where id = v_evento_id;
    return query select 'reconhecido'::text, v_fatura.id, false, 'Cobrança não paga conciliada.'::text;
    return;
  end if;

  update public.assinatura_eventos_efi set situacao = 'ignorado', processado_em = now(),
    observacao = 'Status informativo sem efeito financeiro.' where id = v_evento_id;
  return query select 'ignorado'::text, null::uuid, false, 'Status informativo.'::text;
end;
$$;

revoke all on function public.fn_assinatura_processar_evento_efi(text,text,bigint,jsonb,text,text,text,text,bigint,text) from public, anon, authenticated;
grant execute on function public.fn_assinatura_processar_evento_efi(text,text,bigint,jsonb,text,text,text,text,bigint,text) to service_role;

comment on function public.fn_assinatura_processar_evento_efi(text,text,bigint,jsonb,text,text,text,text,bigint,text) is
  'Aplica evento de assinatura Efí uma única vez, em transação atômica, sem confundir assinatura ativa com pagamento confirmado.';

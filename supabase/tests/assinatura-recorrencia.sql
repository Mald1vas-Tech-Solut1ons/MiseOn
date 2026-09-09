-- Prova transacional da Sprint 15C. Executar como postgres somente na loja de
-- provas; toda fixture e alteração da loja são revertidas pela subtransação.
do $$
declare
  v_loja uuid;
  v_sub text := 'sub-teste-sprint15c-' || gen_random_uuid()::text;
  v_sub_late text := 'sub-teste-late-' || gen_random_uuid()::text;
  v_charge_pago text := 'charge-pago-' || gen_random_uuid()::text;
  v_charge_recusado text := 'charge-recusado-' || gen_random_uuid()::text;
  v_fatura_base uuid := gen_random_uuid();
  v_vencimento timestamptz := now() + interval '10 days';
  v_apos_primeiro timestamptz;
  v_result record;
  v_total integer;
begin
  select id into strict v_loja from public.lojas where nome = 'Lanche do Paulista';
  begin
    perform set_config('request.jwt.claim.role', 'service_role', true);
    insert into public.faturas_assinatura (
      id, loja_id, ciclo, parcelas, forma_pagamento, valor_cobrado,
      efi_subscription_id, efi_charge_id, status_cobranca, data_pagamento
    ) values (
      v_fatura_base, v_loja, 'mensal', 1, 'cartao', 169.90,
      v_sub, 'charge-inicial-' || gen_random_uuid()::text, 'pago', now()
    );
    update public.lojas set status_assinatura = 'ativa', trial_termina_em = v_vencimento,
      assinatura_efi_status = 'active', assinatura_efi_evento_em = now() - interval '1 day'
    where id = v_loja;

    -- Callback pode vencer a gravação da fatura inicial. O mesmo evento deve
    -- sair de não reconhecido e ser aplicado quando o vínculo aparecer.
    select * into v_result from public.fn_assinatura_processar_evento_efi(
      'token-s15c-late', 'efi:1', 1, '{}'::jsonb, 'subscription_charge',
      v_sub_late, 'charge-late', 'paid', 16990, now()::text
    );
    if v_result.situacao <> 'nao_reconhecido' then raise exception 'Corrida inicial não ficou reconciliável'; end if;
    insert into public.faturas_assinatura (
      loja_id, ciclo, parcelas, forma_pagamento, valor_cobrado,
      efi_subscription_id, efi_charge_id, status_cobranca, data_pagamento
    ) values (
      v_loja, 'mensal', 1, 'cartao', 169.90,
      v_sub_late, 'charge-late-base', 'pago', now()
    );
    select * into v_result from public.fn_assinatura_processar_evento_efi(
      'token-s15c-late', 'efi:1', 1, '{}'::jsonb, 'subscription_charge',
      v_sub_late, 'charge-late', 'paid', 16990, now()::text
    );
    if v_result.situacao <> 'reconhecido' then raise exception 'Evento não reconhecido não foi retomado'; end if;
    update public.lojas set status_assinatura = 'ativa', trial_termina_em = v_vencimento,
      assinatura_efi_status = 'active', assinatura_efi_evento_em = now() - interval '1 day'
    where id = v_loja;

    select * into v_result from public.fn_assinatura_processar_evento_efi(
      'token-s15c-1', 'efi:1', 1, '{}'::jsonb, 'subscription_charge',
      v_sub, v_charge_pago, 'paid', 16990, now()::text
    );
    if v_result.situacao <> 'reconhecido' or not v_result.acionar_nfse then
      raise exception 'Pagamento não foi reconhecido corretamente: %', row_to_json(v_result);
    end if;
    select trial_termina_em into v_apos_primeiro from public.lojas where id = v_loja;
    if abs(extract(epoch from (v_apos_primeiro - (v_vencimento + interval '1 month')))) > 2 then
      raise exception 'Renovação não preservou período vigente';
    end if;

    -- Mesmo item e novo item para a mesma charge não podem estender duas vezes.
    perform public.fn_assinatura_processar_evento_efi(
      'token-s15c-1', 'efi:1', 1, '{}'::jsonb, 'subscription_charge',
      v_sub, v_charge_pago, 'paid', 16990, now()::text
    );
    perform public.fn_assinatura_processar_evento_efi(
      'token-s15c-1', 'efi:2', 2, '{}'::jsonb, 'subscription_charge',
      v_sub, v_charge_pago, 'paid', 16990, now()::text
    );
    if (select trial_termina_em from public.lojas where id = v_loja) <> v_apos_primeiro then
      raise exception 'Evento duplicado estendeu o acesso novamente';
    end if;
    select count(*) into v_total from public.faturas_assinatura where efi_charge_id = v_charge_pago;
    if v_total <> 1 then raise exception 'Evento duplicado criou % faturas', v_total; end if;

    -- Fora de ordem: unpaid posterior no histórico não rebaixa charge paga.
    perform public.fn_assinatura_processar_evento_efi(
      'token-s15c-1', 'efi:3', 3, '{}'::jsonb, 'subscription_charge',
      v_sub, v_charge_pago, 'unpaid', 16990, now()::text
    );
    if (select status_cobranca from public.faturas_assinatura where efi_charge_id = v_charge_pago) <> 'pago' then
      raise exception 'Evento fora de ordem rebaixou cobrança paga';
    end if;

    -- Recusa cria rastro sem NFS-e; aprovação tardia recupera a mesma fatura.
    select * into v_result from public.fn_assinatura_processar_evento_efi(
      'token-s15c-2', 'efi:1', 1, '{}'::jsonb, 'subscription_charge',
      v_sub, v_charge_recusado, 'unpaid', 16990, now()::text
    );
    if v_result.acionar_nfse or (select status_cobranca from public.faturas_assinatura where efi_charge_id = v_charge_recusado) <> 'recusado' then
      raise exception 'Recusa gerou NFS-e ou não foi registrada';
    end if;
    select * into v_result from public.fn_assinatura_processar_evento_efi(
      'token-s15c-2', 'efi:2', 2, '{}'::jsonb, 'subscription_charge',
      v_sub, v_charge_recusado, 'paid', 16990, (now() + interval '1 minute')::text
    );
    if not v_result.acionar_nfse or (select status_cobranca from public.faturas_assinatura where efi_charge_id = v_charge_recusado) <> 'pago' then
      raise exception 'Aprovação tardia não recuperou a fatura';
    end if;

    -- Cancelamento mais novo não é desfeito por active antigo.
    perform public.fn_assinatura_processar_evento_efi(
      'token-s15c-3', 'efi:2', 2, '{}'::jsonb, 'subscription',
      v_sub, null, 'canceled', null, (now() + interval '2 minutes')::text
    );
    perform public.fn_assinatura_processar_evento_efi(
      'token-s15c-3', 'efi:1', 1, '{}'::jsonb, 'subscription',
      v_sub, null, 'active', null, (now() + interval '1 minute')::text
    );
    if (select assinatura_efi_status from public.lojas where id = v_loja) <> 'canceled'
      or (select status_assinatura from public.lojas where id = v_loja) <> 'cancelada' then
      raise exception 'Evento antigo reativou assinatura cancelada';
    end if;

    raise exception using errcode = 'ZT015', message = 'Verificação concluída: reverter fixtures';
  exception when sqlstate 'ZT015' then null;
  end;

  if exists(select 1 from public.faturas_assinatura where efi_subscription_id in (v_sub, v_sub_late))
    or exists(select 1 from public.assinatura_eventos_efi where subscription_id in (v_sub, v_sub_late)) then
    raise exception 'Fixtures da assinatura não foram revertidas';
  end if;
  raise notice 'PASS: corrida inicial, renovação, duplicidade, fora de ordem, recusa, aprovação tardia, cancelamento e rollback';
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- SPRINT 19 — SUPERADMIN PROFISSIONAL (23/09/2026)
--
-- O dono do SaaS precisa responder em um minuto: quanto entra, quem entra,
-- quem trava, quem sai, o que quebra — e clicar até a loja e a pessoa.
--
-- Decisões:
--   - Loja de teste é marcada em UM lugar (lojas.eh_teste) e sai dos números
--     do negócio. demo-* e lanchepaulista (tenant de provas). natureba não é
--     tocada.
--   - Receita = dinheiro que entrou (faturas pagas). Não se estima receita
--     recorrente por tabela de preço: número que não foi medido não vai para
--     a tela.
--   - Agregação no banco. superadmin-metricas baixava TODOS os pedidos de 30
--     dias para somar dentro da Edge Function — com mil lojas isso estoura.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.lojas add column if not exists eh_teste boolean not null default false;
update public.lojas set eh_teste = true
 where (slug like 'demo-%' or slug = 'lanchepaulista') and not eh_teste;

-- ── Métricas por loja (substitui a soma feita na Edge Function) ────────────
create or replace function public.fn_superadmin_metricas_lojas(p_dias integer default 30)
 returns table(loja_id uuid, pedidos integer, gmv numeric, ultimo_pedido timestamptz)
 language plpgsql stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if not fn_sou_superadmin() then raise exception 'Acesso restrito.'; end if;
  return query
  select p.loja_id, count(*)::int, coalesce(sum(p.valor_total), 0), max(p.criado_em)
  from pedidos p
  where p.status <> 'CANCELADO'
    and p.criado_em > now() - make_interval(days => greatest(1, least(p_dias, 365)))
  group by p.loja_id;
end; $function$;

-- ── Painel: os números do negócio numa chamada ─────────────────────────────
create or replace function public.fn_superadmin_painel(p_dias integer default 30)
 returns jsonb
 language plpgsql stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_dias int := greatest(1, least(p_dias, 365));
  v_desde timestamptz := now() - make_interval(days => greatest(1, least(p_dias, 365)));
  v jsonb;
begin
  if not fn_sou_superadmin() then raise exception 'Acesso restrito.'; end if;

  with reais as (select * from lojas where not eh_teste),
  assin as (
    select
      count(*) filter (where status_assinatura = 'ativa') pagantes,
      count(*) filter (where status_assinatura = 'vitalicio') vitalicias,
      count(*) filter (where coalesce(status_assinatura, 'trial') = 'trial' and (trial_termina_em is null or trial_termina_em >= now())) em_teste,
      count(*) filter (where coalesce(status_assinatura, 'trial') = 'trial' and trial_termina_em < now()) teste_vencido,
      count(*) filter (where coalesce(status_assinatura, 'trial') = 'trial' and trial_termina_em between now() and now() + interval '7 days') teste_vence_7d,
      count(*) filter (where status_assinatura = 'atrasada') atrasadas,
      count(*) filter (where status_assinatura = 'cancelada') canceladas,
      count(*) total
    from reais where ativo
  ),
  receita as (
    select
      coalesce(sum(f.valor_cobrado) filter (where f.status_cobranca = 'pago' and f.data_pagamento > v_desde), 0) recebido_periodo,
      count(*) filter (where f.status_cobranca = 'pago' and f.data_pagamento > v_desde) faturas_pagas_periodo,
      count(*) filter (where f.status_cobranca <> 'pago' and f.created_at > v_desde) faturas_abertas_periodo,
      count(*) filter (where f.nfse_status is not null and f.nfse_status not in ('emitida', 'EMITIDA', 'autorizada') and f.status_cobranca = 'pago') notas_pendentes
    from faturas_assinatura f join reais l on l.id = f.loja_id
  ),
  contas as (
    select count(*) novas,
      count(*) filter (where exists (select 1 from usuarios_loja ul where ul.user_id = u.id)) com_loja
    from auth.users u
    where u.created_at > v_desde and u.email not like '%.miseon.test'
      and not exists (select 1 from plataforma_admins pa where pa.user_id = u.id)
  ),
  ativacao as (
    select count(*) criadas,
      count(*) filter (where exists (select 1 from produtos p where p.loja_id = l.id)) com_produto,
      count(*) filter (where exists (select 1 from pedidos p where p.loja_id = l.id and p.status <> 'CANCELADO')) com_pedido
    from reais l where l.criado_em > v_desde
  ),
  uso as (
    select count(*) pedidos, coalesce(sum(p.valor_total), 0) gmv,
      count(distinct p.loja_id) lojas_com_pedido
    from pedidos p join reais l on l.id = p.loja_id
    where p.status <> 'CANCELADO' and p.criado_em > v_desde
  ),
  risco as (
    select count(*) sem_pedido_14d
    from reais l
    where l.ativo and l.criado_em < now() - interval '14 days'
      and not exists (select 1 from pedidos p where p.loja_id = l.id and p.criado_em > now() - interval '14 days')
  ),
  email as (
    select count(*) filter (where status = 'sent') enviados, count(*) filter (where status = 'failed') falhas
    from email_log where sent_at > now() - interval '7 days' and coalesce(classe, '') <> 'PREVIA'
  )
  select jsonb_build_object(
    'dias', v_dias,
    'assinaturas', (select to_jsonb(assin) from assin),
    'receita', (select to_jsonb(receita) from receita),
    'contas', (select to_jsonb(contas) from contas),
    'ativacao', (select to_jsonb(ativacao) from ativacao),
    'uso', (select to_jsonb(uso) from uso),
    'risco', (select to_jsonb(risco) from risco),
    'email_7d', (select to_jsonb(email) from email),
    'lojas_teste', (select count(*) from lojas where eh_teste)
  ) into v;
  return v;
end; $function$;

-- ── O que precisa de atenção agora, em ordem de dinheiro ───────────────────
create or replace function public.fn_superadmin_atencao()
 returns table(tipo text, prioridade integer, loja_id uuid, loja_nome text, loja_slug text, detalhe text, quando timestamptz)
 language plpgsql stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if not fn_sou_superadmin() then raise exception 'Acesso restrito.'; end if;
  return query
  -- 1. Pagante em atraso: dinheiro que deixou de entrar.
  select 'assinatura_atrasada', 1, l.id, l.nome, l.slug,
         'Assinatura atrasada desde ' || to_char(l.trial_termina_em, 'DD/MM'), l.trial_termina_em
    from lojas l where not l.eh_teste and l.ativo and l.status_assinatura = 'atrasada'
  union all
  -- 2. Teste grátis vencendo: a hora de ligar é agora.
  select 'teste_vencendo', 2, l.id, l.nome, l.slug,
         'Teste grátis vence ' || to_char(l.trial_termina_em, 'DD/MM')
         || ' · ' || coalesce((select count(*) from pedidos p where p.loja_id = l.id and p.status <> 'CANCELADO'), 0) || ' pedidos até hoje',
         l.trial_termina_em
    from lojas l where not l.eh_teste and l.ativo and coalesce(l.status_assinatura, 'trial') = 'trial'
     and l.trial_termina_em between now() and now() + interval '7 days'
  union all
  -- 3. Teste vencido sem assinar: conversão perdida ou por fazer.
  select 'teste_vencido', 3, l.id, l.nome, l.slug,
         'Teste grátis venceu em ' || to_char(l.trial_termina_em, 'DD/MM') || ' e não assinou', l.trial_termina_em
    from lojas l where not l.eh_teste and l.ativo and coalesce(l.status_assinatura, 'trial') = 'trial'
     and l.trial_termina_em < now() and l.trial_termina_em > now() - interval '30 days'
  union all
  -- 4. Loja criada que não configurou: ativação travada.
  select 'sem_cardapio', 4, l.id, l.nome, l.slug,
         'Criada há ' || extract(day from now() - l.criado_em)::int || ' dias sem nenhum produto', l.criado_em
    from lojas l where not l.eh_teste and l.ativo and l.criado_em < now() - interval '1 day'
     and not exists (select 1 from produtos p where p.loja_id = l.id)
  union all
  -- 5. Loja que parou de vender: risco de cancelar.
  select 'parou_de_vender', 5, l.id, l.nome, l.slug,
         'Sem pedido há ' || extract(day from now() - ult.u)::int || ' dias', ult.u
    from lojas l
    join lateral (select max(p.criado_em) u from pedidos p where p.loja_id = l.id) ult on true
   where not l.eh_teste and l.ativo and ult.u is not null and ult.u < now() - interval '14 days'
  union all
  -- 6. Conta que entrou e não criou loja: lead esfriando.
  select 'conta_sem_loja', 6, null::uuid, u.email::text, null::text,
         'Entrou há ' || extract(day from now() - u.created_at)::int || ' dia(s) e não criou a loja', u.created_at
    from auth.users u
   where u.created_at > now() - interval '14 days' and u.email not like '%.miseon.test'
     and not exists (select 1 from usuarios_loja ul where ul.user_id = u.id)
     and not exists (select 1 from plataforma_admins pa where pa.user_id = u.id)
  union all
  -- 7. E-mail que falhou nas últimas 24h.
  select 'email_falhou', 7, e.loja_id, coalesce(l.nome, e.recipient), l.slug,
         'E-mail "' || coalesce(e.campanha, e.evento) || '" falhou: ' || left(coalesce(e.error_message, ''), 120), e.sent_at
    from email_log e left join lojas l on l.id = e.loja_id
   where e.status = 'failed' and e.sent_at > now() - interval '24 hours'
  order by 2, 7 desc;
end; $function$;

-- ── Ficha 360 de uma loja ──────────────────────────────────────────────────
create or replace function public.fn_superadmin_loja_360(p_loja_id uuid)
 returns jsonb
 language plpgsql stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare v jsonb;
begin
  if not fn_sou_superadmin() then raise exception 'Acesso restrito.'; end if;
  select jsonb_build_object(
    'loja', jsonb_build_object('id', l.id, 'nome', l.nome, 'slug', l.slug, 'ativo', l.ativo, 'eh_teste', l.eh_teste,
            'plano', l.plano, 'status_assinatura', l.status_assinatura, 'trial_termina_em', l.trial_termina_em,
            'criado_em', l.criado_em, 'totem_ativo', l.totem_ativo),
    'equipe', (select coalesce(jsonb_agg(jsonb_build_object('email', u.email, 'papel', ul.papel,
                 'ultimo_login', u.last_sign_in_at) order by (ul.papel = 'admin') desc, u.last_sign_in_at desc nulls last), '[]'::jsonb)
                 from usuarios_loja ul join auth.users u on u.id = ul.user_id where ul.loja_id = l.id),
    'cadastro', (select jsonb_build_object('segmento', d.segmento_negocio, 'faz_entregas', d.faz_entregas,
                   'atende_salao', d.atende_salao_garcom, 'fiscal_completo', d.cpf_cnpj is not null and d.razao_social_ou_nome is not null,
                   'email_cobranca', d.email_cobranca)
                   from assinatura_dados_cadastro d where d.loja_id = l.id),
    'configuracao', jsonb_build_object(
       'produtos', (select count(*) from produtos p where p.loja_id = l.id),
       'insumos', (select count(*) from insumos i where i.loja_id = l.id and i.ativo),
       'fichas_tecnicas', (select count(distinct ft.produto_id) from fichas_tecnicas ft
                             join produtos pr on pr.id = ft.produto_id where pr.loja_id = l.id),
       'notas_importadas', (select count(*) from nfce_importadas n where n.loja_id = l.id),
       'pix_configurado', (l.efi_titular_documento is not null and l.efi_conta is not null)),
    'uso', (select jsonb_build_object(
              'pedidos_7d', count(*) filter (where p.criado_em > now() - interval '7 days'),
              'pedidos_30d', count(*) filter (where p.criado_em > now() - interval '30 days'),
              'gmv_30d', coalesce(sum(p.valor_total) filter (where p.criado_em > now() - interval '30 days'), 0),
              'ultimo_pedido', max(p.criado_em),
              'canais_30d', (select coalesce(jsonb_object_agg(c.origem, c.n), '{}'::jsonb) from (
                  select coalesce(p2.origem, 'desconhecido') origem, count(*) n from pedidos p2
                   where p2.loja_id = l.id and p2.status <> 'CANCELADO' and p2.criado_em > now() - interval '30 days'
                   group by 1) c))
            from pedidos p where p.loja_id = l.id and p.status <> 'CANCELADO'),
    'faturas', (select coalesce(jsonb_agg(jsonb_build_object('criada', f.created_at, 'ciclo', f.ciclo, 'valor', f.valor_cobrado,
                  'status', f.status_cobranca, 'pago_em', f.data_pagamento, 'nfse', f.nfse_status) order by f.created_at desc), '[]'::jsonb)
                  from (select * from faturas_assinatura where loja_id = l.id order by created_at desc limit 12) f),
    'emails_30d', (select coalesce(jsonb_agg(jsonb_build_object('campanha', x.campanha, 'enviados', x.n, 'falhas', x.f)), '[]'::jsonb)
                   from (select coalesce(campanha, evento) campanha, count(*) filter (where status = 'sent') n,
                                count(*) filter (where status = 'failed') f
                           from email_log where loja_id = l.id and sent_at > now() - interval '30 days' group by 1) x),
    'erros_7d', (select coalesce(jsonb_agg(jsonb_build_object('mensagem', left(x.mensagem, 160), 'ocorrencias', x.oc, 'ultimo', x.ult)), '[]'::jsonb)
                 from (select min(mensagem) mensagem, sum(ocorrencias) oc, max(visto_em) ult from erros_aplicacao
                        where loja_id = l.id and visto_em > now() - interval '7 days'
                        group by fn_erro_familia(origem, contexto, mensagem) order by 3 desc limit 10) x)
  ) into v
  from lojas l where l.id = p_loja_id;
  return v;
end; $function$;

revoke all on function public.fn_superadmin_metricas_lojas(integer) from public, anon, authenticated;
revoke all on function public.fn_superadmin_painel(integer) from public, anon, authenticated;
revoke all on function public.fn_superadmin_atencao() from public, anon, authenticated;
revoke all on function public.fn_superadmin_loja_360(uuid) from public, anon, authenticated;
grant execute on function public.fn_superadmin_metricas_lojas(integer) to authenticated;
grant execute on function public.fn_superadmin_painel(integer) to authenticated;
grant execute on function public.fn_superadmin_atencao() to authenticated;
grant execute on function public.fn_superadmin_loja_360(uuid) to authenticated;

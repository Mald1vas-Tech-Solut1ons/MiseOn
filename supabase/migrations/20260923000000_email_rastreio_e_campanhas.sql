-- ═══════════════════════════════════════════════════════════════════════════
-- E-MAIL MEDIDO DE PONTA A PONTA (23/09/2026)
--
-- O que estava errado, medido:
--   - email_log tinha opened_at/clicked_at desde sempre e NINGUÉM preenchia:
--     69 envios, zero abertura, zero clique. Nada era medido.
--   - a retomada de cadastro (onboarding-retomada) não gravava NADA no log:
--     a Vitória recebeu o 1º lembrete às 00:00 de 23/09 e o superadmin não
--     tinha como ver isso.
--   - os links saíam para miseon.vercel.app e o descadastro para o domínio
--     técnico da Supabase.
--
-- Agora cada envio tem um token; os links passam por miseon.app.br/e/...
-- (rewrite da Vercel para a função email-rastreio), que registra abertura,
-- clique e descadastro e redireciona só para domínio nosso.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.email_log add column if not exists token uuid not null default gen_random_uuid();
alter table public.email_log add column if not exists campanha text;
alter table public.email_log add column if not exists aberturas integer not null default 0;
alter table public.email_log add column if not exists cliques integer not null default 0;
alter table public.email_log add column if not exists ultimo_clique_url text;
alter table public.email_log add column if not exists descadastrado_em timestamptz;
create unique index if not exists email_log_token_idx on public.email_log (token);
create index if not exists email_log_campanha_idx on public.email_log (campanha, sent_at desc);

-- Envios de loja já existentes: a campanha é o próprio evento.
update public.email_log set campanha = coalesce(campanha, evento, template_type) where campanha is null;

-- ── Registro de abertura / clique / descadastro (só a função de rastreio) ──
create or replace function public.fn_email_registrar_evento(p_token uuid, p_tipo text, p_url text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare v_log record;
begin
  select id, user_id, campanha, classe into v_log from email_log where token = p_token;
  if not found then return jsonb_build_object('ok', false); end if;

  if p_tipo = 'abertura' then
    update email_log set aberturas = aberturas + 1, opened_at = coalesce(opened_at, now()) where id = v_log.id;
  elsif p_tipo = 'clique' then
    -- Quem clicou, abriu: cliente que bloqueia imagem não esconde o clique.
    update email_log set cliques = cliques + 1, clicked_at = coalesce(clicked_at, now()),
           opened_at = coalesce(opened_at, now()), ultimo_clique_url = left(p_url, 500)
     where id = v_log.id;
  elsif p_tipo = 'descadastro' then
    update email_log set descadastrado_em = coalesce(descadastrado_em, now()) where id = v_log.id;
    if v_log.campanha like 'retomada-cadastro%' and v_log.user_id is not null then
      update onboarding_progresso set retomada_optout = true where user_id = v_log.user_id;
    end if;
  else
    return jsonb_build_object('ok', false);
  end if;
  return jsonb_build_object('ok', true);
end; $function$;

-- ── Leitura do superadmin: campanhas ───────────────────────────────────────
-- Conversão só existe para a retomada (criou a loja depois do e-mail); para
-- e-mail transacional de loja ela não se aplica e vem nula, nunca zero.
create or replace function public.fn_superadmin_email_campanhas(p_dias integer default 30)
 returns table(campanha text, classe text, enviados bigint, falhas bigint, abertos bigint,
               clicados bigint, descadastros bigint, convertidos bigint,
               primeiro_envio timestamptz, ultimo_envio timestamptz)
 language plpgsql stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if not fn_sou_superadmin() then raise exception 'Acesso restrito.'; end if;
  return query
  select e.campanha, min(e.classe),
    count(*) filter (where e.status = 'sent'),
    count(*) filter (where e.status = 'failed'),
    count(*) filter (where e.opened_at is not null),
    count(*) filter (where e.clicked_at is not null),
    count(*) filter (where e.descadastrado_em is not null),
    case when e.campanha like 'retomada-cadastro%' then
      count(*) filter (where e.status = 'sent' and exists (
        select 1 from usuarios_loja ul where ul.user_id = e.user_id and ul.criado_em > e.sent_at))
    end,
    min(e.sent_at), max(e.sent_at)
  from email_log e
  where e.sent_at > now() - make_interval(days => greatest(1, least(p_dias, 365)))
    and coalesce(e.classe, '') <> 'PREVIA'
  group by e.campanha
  order by max(e.sent_at) desc;
end; $function$;

-- ── Leitura do superadmin: cada envio ──────────────────────────────────────
create or replace function public.fn_superadmin_email_envios(p_dias integer default 30, p_campanha text default null)
 returns table(id uuid, campanha text, classe text, destinatario text, loja_nome text,
               status text, erro text, enviado_em timestamptz, aberto_em timestamptz,
               aberturas integer, clicado_em timestamptz, cliques integer,
               descadastrado_em timestamptz, convertido_em timestamptz)
 language plpgsql stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if not fn_sou_superadmin() then raise exception 'Acesso restrito.'; end if;
  return query
  select e.id, e.campanha, e.classe, e.recipient, l.nome, e.status, e.error_message,
    e.sent_at, e.opened_at, e.aberturas, e.clicked_at, e.cliques, e.descadastrado_em,
    (select min(ul.criado_em) from usuarios_loja ul
      where e.campanha like 'retomada-cadastro%' and ul.user_id = e.user_id and ul.criado_em > e.sent_at)
  from email_log e
  left join lojas l on l.id = e.loja_id
  where e.sent_at > now() - make_interval(days => greatest(1, least(p_dias, 365)))
    and (p_campanha is null or e.campanha = p_campanha)
  order by e.sent_at desc
  limit 500;
end; $function$;

-- ── Histórico honesto do envio que já saiu sem rastreio ────────────────────
-- O 1º lembrete da Vitória saiu às 00:00 de 23/09, antes do log existir. Ele
-- entra no histórico como enviado — e marcado como sem rastreio.
insert into public.email_log (user_id, recipient, status, sent_at, evento, classe, campanha, template_type, metadata)
select op.user_id, u.email, 'sent', op.ultima_retomada_em, 'retomada-cadastro-1', 'PLATAFORMA',
       'retomada-cadastro-1', 'retomada-cadastro-1',
       jsonb_build_object('observacao', 'Enviado antes do rastreio existir; link apontava para miseon.vercel.app.')
  from public.onboarding_progresso op join auth.users u on u.id = op.user_id
 where op.retomadas_enviadas >= 1 and op.ultima_retomada_em is not null
   and not exists (select 1 from public.email_log e where e.user_id = op.user_id and e.campanha = 'retomada-cadastro-1');

revoke all on function public.fn_email_registrar_evento(uuid, text, text) from public, anon, authenticated;
revoke all on function public.fn_superadmin_email_campanhas(integer) from public, anon, authenticated;
revoke all on function public.fn_superadmin_email_envios(integer, text) from public, anon, authenticated;
grant execute on function public.fn_email_registrar_evento(uuid, text, text) to service_role;
grant execute on function public.fn_superadmin_email_campanhas(integer) to authenticated;
grant execute on function public.fn_superadmin_email_envios(integer, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- FUNIL DE CADASTRO (22/09/2026)
--
-- Motivo, medido: em 22/09 uma lead real (vinda de grupo de delivery) entrou
-- com Google às 11:12, fez UM login e sumiu. Zero loja, zero erro registrado,
-- e ninguém ficou sabendo — só consultando auth.users na mão. A tela que ela
-- viu pedia CNPJ, razão social e endereço antes de mostrar qualquer coisa.
--
-- Esta migração dá três coisas:
--   1. rastro: cada passo do cadastro vira evento no servidor;
--   2. leitura para o superadmin: quem começou, onde parou, há quanto tempo,
--      e até onde chegou depois (cardápio, primeiro pedido);
--   3. retomada: quem entrou e não criou loja recebe no máximo DOIS e-mails,
--      com descadastro. Nasce DESLIGADA (plataforma_flags) até o dono
--      aprovar o texto.
--
-- E tira o muro: dado fiscal deixa de ser obrigatório para abrir a loja no
-- teste grátis. Ele é exigido na tela de Assinatura, antes de pagar.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Interruptores da plataforma ────────────────────────────────────────────
create table if not exists public.plataforma_flags (
  chave text primary key,
  ligado boolean not null default false,
  atualizado_em timestamptz not null default now()
);
alter table public.plataforma_flags enable row level security;
revoke all on public.plataforma_flags from public, anon, authenticated;
insert into public.plataforma_flags (chave, ligado) values ('onboarding_retomada', false)
on conflict (chave) do nothing;

-- ── Progresso por conta ────────────────────────────────────────────────────
create table if not exists public.onboarding_progresso (
  user_id uuid primary key references auth.users(id) on delete cascade,
  etapa text,
  ultimo_evento text,
  ultimo_erro text,
  rascunho jsonb not null default '{}'::jsonb,
  eventos integer not null default 0,
  iniciado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  retomadas_enviadas integer not null default 0,
  ultima_retomada_em timestamptz,
  retomada_optout boolean not null default false,
  retomada_token uuid not null default gen_random_uuid() unique
);

create table if not exists public.onboarding_eventos (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  evento text not null,
  etapa text,
  detalhe text,
  criado_em timestamptz not null default now()
);
create index if not exists onboarding_eventos_user_idx on public.onboarding_eventos (user_id, criado_em);

-- Ninguém lê nem escreve direto: só pelas funções abaixo.
alter table public.onboarding_progresso enable row level security;
alter table public.onboarding_eventos enable row level security;
revoke all on public.onboarding_progresso from public, anon, authenticated;
revoke all on public.onboarding_eventos from public, anon, authenticated;
revoke all on sequence public.onboarding_eventos_id_seq from public, anon, authenticated;

-- ── Registro de um passo (chamado pela tela, como o próprio usuário) ───────
create or replace function public.fn_onboarding_registrar(
  p_evento text, p_etapa text default null, p_detalhe text default null, p_rascunho jsonb default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  -- Lista fechada: evento livre vira lixo no funil.
  if p_evento not in ('abriu', 'etapa', 'erro_validacao', 'erro_criar', 'loja_criada') then
    return;
  end if;
  -- Rascunho é para devolver o que a pessoa digitou, não depósito.
  if p_rascunho is not null and length(p_rascunho::text) > 4000 then p_rascunho := null; end if;

  insert into onboarding_eventos (user_id, evento, etapa, detalhe)
  values (v_uid, p_evento, left(p_etapa, 40), left(p_detalhe, 300));

  insert into onboarding_progresso as op (user_id, etapa, ultimo_evento, ultimo_erro, rascunho, eventos)
  values (v_uid, left(p_etapa, 40), p_evento,
          case when p_evento like 'erro%' then left(p_detalhe, 300) end,
          coalesce(p_rascunho, '{}'::jsonb), 1)
  on conflict (user_id) do update set
    etapa = coalesce(left(p_etapa, 40), op.etapa),
    ultimo_evento = p_evento,
    ultimo_erro = case when p_evento like 'erro%' then left(p_detalhe, 300) else op.ultimo_erro end,
    rascunho = coalesce(p_rascunho, op.rascunho),
    eventos = op.eventos + 1,
    atualizado_em = now();
end; $function$;

create or replace function public.fn_onboarding_meu_rascunho()
 returns jsonb
 language sql stable
 security definer
 set search_path to 'public', 'pg_temp'
as $$ select coalesce((select rascunho from onboarding_progresso where user_id = auth.uid()), '{}'::jsonb) $$;

-- ── Leitura do superadmin ──────────────────────────────────────────────────
-- Uma linha por conta criada na janela. `situacao` é o degrau mais alto que
-- a conta alcançou; é dela que sai o funil.
create or replace function public.fn_superadmin_cadastros(p_dias integer default 30)
 returns table(
   user_id uuid, email text, nome text, provedor text,
   conta_criada_em timestamptz, ultimo_login_em timestamptz,
   situacao text, etapa text, ultimo_evento text, ultimo_erro text,
   eventos integer, atividade_em timestamptz,
   loja_nome text, loja_slug text, loja_criada_em timestamptz,
   produtos integer, pedidos integer,
   retomadas_enviadas integer, ultima_retomada_em timestamptz, retomada_optout boolean)
 language plpgsql stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if not fn_sou_superadmin() then raise exception 'Acesso restrito.'; end if;
  return query
  select u.id, u.email::text,
         coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')::text,
         coalesce(u.raw_app_meta_data->>'provider', 'email')::text,
         u.created_at, u.last_sign_in_at,
         case
           when vl.papel is not null and vl.papel <> 'admin' then 'equipe'
           when l.id is null then 'sem_loja'
           when coalesce(pr.qtd, 0) = 0 then 'loja_sem_cardapio'
           when coalesce(pe.qtd, 0) = 0 then 'cardapio_sem_pedido'
           else 'vendendo'
         end,
         op.etapa, op.ultimo_evento, op.ultimo_erro, coalesce(op.eventos, 0),
         greatest(u.last_sign_in_at, op.atualizado_em),
         l.nome, l.slug, l.criado_em,
         coalesce(pr.qtd, 0)::int, coalesce(pe.qtd, 0)::int,
         coalesce(op.retomadas_enviadas, 0), op.ultima_retomada_em, coalesce(op.retomada_optout, false)
  from auth.users u
  left join onboarding_progresso op on op.user_id = u.id
  left join lateral (
    select ul.loja_id, ul.papel from usuarios_loja ul where ul.user_id = u.id
    order by (ul.papel = 'admin') desc limit 1) vl on true
  left join lojas l on l.id = vl.loja_id
  left join lateral (select count(*) qtd from produtos p where p.loja_id = l.id) pr on true
  left join lateral (select count(*) qtd from pedidos p where p.loja_id = l.id and p.status <> 'CANCELADO') pe on true
  where u.created_at > now() - make_interval(days => greatest(1, least(p_dias, 365)))
    and u.email not like '%.miseon.test'
    and not exists (select 1 from plataforma_admins pa where pa.user_id = u.id)
  order by u.created_at desc;
end; $function$;

-- Passos DENTRO da tela de cadastro, para achar a fricção com número.
create or replace function public.fn_superadmin_funil_eventos(p_dias integer default 30)
 returns table(evento text, etapa text, contas bigint, ocorrencias bigint)
 language plpgsql stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if not fn_sou_superadmin() then raise exception 'Acesso restrito.'; end if;
  return query
  select e.evento, coalesce(e.etapa, '-'), count(distinct e.user_id), count(*)
  from onboarding_eventos e
  where e.criado_em > now() - make_interval(days => greatest(1, least(p_dias, 365)))
  group by 1, 2 order by 3 desc;
end; $function$;

-- ── Retomada por e-mail ────────────────────────────────────────────────────
-- Regra: conta sem loja, e-mail real, criada há 1h a 7 dias. Primeiro envio
-- depois de 1h; o segundo 24h depois do primeiro. Nunca mais que dois, nunca
-- para quem pediu para parar. Só roda com o interruptor ligado.
create or replace function public.fn_onboarding_candidatos_retomada(p_limite integer default 20)
 returns table(user_id uuid, email text, nome text, envio integer, token uuid)
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if not coalesce((select ligado from plataforma_flags where chave = 'onboarding_retomada'), false) then
    return;
  end if;

  -- Conta anterior ao rastro (sem linha de progresso) também merece a retomada.
  insert into onboarding_progresso (user_id, iniciado_em)
  select u.id, u.created_at from auth.users u
  where u.created_at between now() - interval '7 days' and now() - interval '1 hour'
    and not exists (select 1 from usuarios_loja ul where ul.user_id = u.id)
  on conflict do nothing;

  return query
  select u.id, u.email::text,
         split_part(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''), ' ', 1)::text,
         op.retomadas_enviadas + 1, op.retomada_token
  from auth.users u
  join onboarding_progresso op on op.user_id = u.id
  where u.email is not null
    and u.email not like '%.miseon.test'
    and u.created_at between now() - interval '7 days' and now() - interval '1 hour'
    and not exists (select 1 from usuarios_loja ul where ul.user_id = u.id)
    and not exists (select 1 from plataforma_admins pa where pa.user_id = u.id)
    and not op.retomada_optout
    and (
      (op.retomadas_enviadas = 0)
      or (op.retomadas_enviadas = 1 and op.ultima_retomada_em < now() - interval '24 hours')
    )
  order by u.created_at
  limit greatest(1, least(p_limite, 50));
end; $function$;

create or replace function public.fn_onboarding_marcar_retomada(p_user_id uuid)
 returns void
 language sql
 security definer
 set search_path to 'public', 'pg_temp'
as $$
  update onboarding_progresso
     set retomadas_enviadas = retomadas_enviadas + 1, ultima_retomada_em = now()
   where user_id = p_user_id
$$;

create or replace function public.fn_onboarding_parar_retomada(p_token uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare v_n int;
begin
  update onboarding_progresso set retomada_optout = true where retomada_token = p_token;
  get diagnostics v_n = row_count;
  return v_n > 0;
end; $function$;

-- Chamado pelo pg_cron: acorda a função só quando há alguém para lembrar.
create or replace function public.fn_onboarding_disparar_retomada()
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'extensions', 'vault'
as $function$
declare v_token text;
begin
  if not coalesce((select ligado from public.plataforma_flags where chave = 'onboarding_retomada'), false) then
    return;
  end if;
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'email_worker_token_db';
  if v_token is null then
    raise warning 'email_worker_token_db ausente no Vault — retomada não executada';
    return;
  end if;
  perform net.http_post(
    url     := 'https://zzuxklwhaoisuuvndtfw.supabase.co/functions/v1/onboarding-retomada',
    headers := jsonb_build_object('Content-Type','application/json','x-worker-token', v_token),
    body    := jsonb_build_object('acao','processar'),
    timeout_milliseconds := 20000);
end; $function$;

-- ── Dado fiscal deixa de ser porta de entrada ──────────────────────────────
alter table public.assinatura_dados_cadastro alter column tipo_pessoa drop not null;
alter table public.assinatura_dados_cadastro alter column cpf_cnpj drop not null;
alter table public.assinatura_dados_cadastro alter column razao_social_ou_nome drop not null;

-- ── Grants ─────────────────────────────────────────────────────────────────
revoke all on function public.fn_onboarding_registrar(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.fn_onboarding_meu_rascunho() from public, anon, authenticated;
revoke all on function public.fn_superadmin_cadastros(integer) from public, anon, authenticated;
revoke all on function public.fn_superadmin_funil_eventos(integer) from public, anon, authenticated;
revoke all on function public.fn_onboarding_candidatos_retomada(integer) from public, anon, authenticated;
revoke all on function public.fn_onboarding_marcar_retomada(uuid) from public, anon, authenticated;
revoke all on function public.fn_onboarding_parar_retomada(uuid) from public, anon, authenticated;
revoke all on function public.fn_onboarding_disparar_retomada() from public, anon, authenticated;

grant execute on function public.fn_onboarding_registrar(text, text, text, jsonb) to authenticated;
grant execute on function public.fn_onboarding_meu_rascunho() to authenticated;
grant execute on function public.fn_superadmin_cadastros(integer) to authenticated;
grant execute on function public.fn_superadmin_funil_eventos(integer) to authenticated;
grant execute on function public.fn_onboarding_candidatos_retomada(integer) to service_role;
grant execute on function public.fn_onboarding_marcar_retomada(uuid) to service_role;
grant execute on function public.fn_onboarding_parar_retomada(uuid) to service_role;
grant execute on function public.fn_onboarding_disparar_retomada() to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'onboarding-retomada';
select cron.schedule('onboarding-retomada', '*/15 * * * *', 'select public.fn_onboarding_disparar_retomada()');

-- ═══════════════════════════════════════════════════════════════════════════
-- Blindagem de grants, search_path e rate limit que realmente limita.
--
-- Três achados da auditoria de 19/08:
--
--  1. Nove funções de gatilho eram executáveis por anon/authenticated — não
--     por um grant explícito, mas pelo default do Postgres, que concede
--     EXECUTE a PUBLIC em toda função criada. Por isso o revoke tem que citar
--     `public`: revogar só de anon deixa PUBLIC intacto e nada muda. A
--     migration 20260729000340 revogou as funções internas mas passou por cima
--     das que retornam `trigger`. O PostgREST não expõe função com retorno
--     `trigger`, então não era porta aberta — mas grant que ninguém usa é
--     superfície que sobra, e o advisor do Supabase acusa as nove.
--
--  2. fn_sessao_chat escapou da migration de search_path (20260728213721).
--
--  3. O rate limit das Edge Functions vivia num Map em memória do isolate
--     (_shared/rate-limit.ts). Em Deno serverless cada isolate tem o seu
--     contador e eles nascem sob carga: o teto de 10/min virava 10 × N
--     isolates. Isso protegia justamente as funções que custam dinheiro por
--     chamada (ai-gerar-descricao, nutricao-estimar-ia, magic-copy,
--     chat-ai-reception) e a criação de cobrança Pix. Contador compartilhado
--     tem que morar no banco.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Função de gatilho não é API ─────────────────────────────────────────
revoke execute on function public.fatores_conversao_valida()      from public, anon, authenticated;
revoke execute on function public.fn_insumos_normaliza_nome()     from public, anon, authenticated;
revoke execute on function public.fn_sync_tipo_item_is_preparo()  from public, anon, authenticated;
revoke execute on function public.fn_trg_cache_nutricao_ficha()   from public, anon, authenticated;
revoke execute on function public.fn_trg_cache_nutricao_insumo()  from public, anon, authenticated;
revoke execute on function public.fn_trg_ifood_status()           from public, anon, authenticated;
revoke execute on function public.fn_trg_incrementa_uso_cupom()   from public, anon, authenticated;
revoke execute on function public.set_faixas_entrega_updated_at() from public, anon, authenticated;
revoke execute on function public.update_timestamp_column()       from public, anon, authenticated;

-- ── 2. search_path da última função que faltava ────────────────────────────
alter function public.fn_sessao_chat() set search_path = public, pg_temp;

-- ── 3. Rate limit compartilhado ────────────────────────────────────────────
create table if not exists public.rate_limit (
  chave      text primary key,
  janela_ini timestamptz not null default now(),
  contador   integer     not null default 0
);

comment on table public.rate_limit is
  'Contador de janela deslizante compartilhado entre isolates das Edge Functions. '
  'Só service_role toca: RLS ligada e sem policy fecha para anon/authenticated.';

alter table public.rate_limit enable row level security;

-- Varredura da limpeza por janela, não pela PK.
create index if not exists rate_limit_janela_idx on public.rate_limit (janela_ini);

-- Consumo atômico: o ON CONFLICT DO UPDATE toma lock da linha, então duas
-- invocações concorrentes em isolates diferentes não perdem contagem.
create or replace function public.fn_rate_limit_consumir(
  p_chave      text,
  p_janela_seg integer,
  p_max        integer
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_ini  timestamptz;
  v_cont integer;
begin
  insert into rate_limit as rl (chave, janela_ini, contador)
  values (p_chave, now(), 1)
  on conflict (chave) do update
    set contador = case
          when rl.janela_ini < now() - make_interval(secs => p_janela_seg) then 1
          else rl.contador + 1
        end,
        janela_ini = case
          when rl.janela_ini < now() - make_interval(secs => p_janela_seg) then now()
          else rl.janela_ini
        end
  returning rl.janela_ini, rl.contador into v_ini, v_cont;

  return jsonb_build_object(
    'permitido', v_cont <= p_max,
    'restante',  greatest(0, p_max - v_cont),
    'reset_em',  v_ini + make_interval(secs => p_janela_seg)
  );
end;
$fn$;

-- Quem chama é Edge Function com service_role. Nem anon nem authenticated
-- têm motivo para mexer no próprio contador que os limita.
revoke all on function public.fn_rate_limit_consumir(text, integer, integer) from public, anon, authenticated;
grant execute on function public.fn_rate_limit_consumir(text, integer, integer) to service_role;

-- O Map em memória vazava porque nunca removia chave expirada. Aqui a limpeza
-- é explícita: qualquer janela parada há mais de 1h já não conta para ninguém.
create or replace function public.fn_rate_limit_limpar()
returns void
language sql
security definer
set search_path = public, pg_temp
as $fn$
  delete from rate_limit where janela_ini < now() - interval '1 hour';
$fn$;

revoke all on function public.fn_rate_limit_limpar() from public, anon, authenticated;

select cron.schedule('limpar-rate-limit', '*/15 * * * *', $$select public.fn_rate_limit_limpar()$$);

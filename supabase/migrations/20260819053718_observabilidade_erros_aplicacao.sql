-- ═══════════════════════════════════════════════════════════════════════════
-- Captura de erro em produção.
--
-- Não existia nada: nenhum Sentry/Datadog no package.json. Com um cliente,
-- você descobre o problema porque ele liga. Com cinquenta, descobre quando
-- cinco já cancelaram.
--
-- Sem fornecedor novo de propósito: exigiria conta, DSN e mais um segredo.
-- O Postgres que já existe resolve e o dado fica na sua casa.
--
-- Anti-abuso: escrita só pela RPC (a tabela não tem policy de INSERT), texto
-- truncado, e erro repetido na mesma hora vira contador em vez de linha nova —
-- senão um laço no browser de um cliente enche a tabela sozinho.
--
-- `hora_bucket` é coluna comum preenchida pela função, e não expressão no
-- índice: date_trunc sobre timestamptz não é IMMUTABLE e o Postgres recusa.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists erros_aplicacao (
  id           uuid primary key default gen_random_uuid(),
  impressao    text not null,
  hora_bucket  timestamptz not null,
  origem       text not null,
  contexto     text,
  mensagem     text not null,
  stack        text,
  url          text,
  user_agent   text,
  loja_id      uuid references lojas(id) on delete set null,
  user_id      uuid,
  ocorrencias  integer not null default 1,
  visto_em     timestamptz not null default now(),
  criado_em    timestamptz not null default now(),
  resolvido    boolean not null default false
);

create unique index if not exists uq_erros_impressao_hora
  on erros_aplicacao (impressao, hora_bucket);
create index if not exists idx_erros_recentes
  on erros_aplicacao (resolvido, visto_em desc);

alter table erros_aplicacao enable row level security;

create policy superadmin_le_erros on erros_aplicacao
  for select using (fn_sou_superadmin());

create or replace function fn_registrar_erro(
  p_origem     text,
  p_mensagem   text,
  p_contexto   text default null,
  p_stack      text default null,
  p_url        text default null,
  p_user_agent text default null,
  p_loja_id    uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_msg text := left(coalesce(nullif(btrim(p_mensagem), ''), 'erro sem mensagem'), 500);
  v_ctx text := left(coalesce(p_contexto, ''), 200);
  v_org text := left(coalesce(p_origem, 'browser'), 20);
  v_imp text;
begin
  -- Impressão digital ignorando uuid e números, para o mesmo defeito não
  -- virar mil linhas distintas só porque o id do pedido muda.
  v_imp := md5(v_org || '|' || v_ctx || '|' ||
            regexp_replace(v_msg,
              '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+', '#', 'gi'));

  insert into erros_aplicacao
    (impressao, hora_bucket, origem, contexto, mensagem, stack, url, user_agent, loja_id, user_id)
  values
    (v_imp, date_trunc('hour', now()), v_org, nullif(v_ctx,''), v_msg,
     left(p_stack, 4000), left(p_url, 500), left(p_user_agent, 300), p_loja_id, auth.uid())
  on conflict (impressao, hora_bucket) do update
    set ocorrencias = erros_aplicacao.ocorrencias + 1,
        visto_em    = now();
end;
$fn$;

revoke all on function fn_registrar_erro(text,text,text,text,text,text,uuid) from public;
grant execute on function fn_registrar_erro(text,text,text,text,text,text,uuid) to anon, authenticated;

comment on table erros_aplicacao is
  'Erros capturados em produção (browser e edge functions). Agrupados por impressão digital + hora. Leitura só do superadmin, escrita só via fn_registrar_erro.';

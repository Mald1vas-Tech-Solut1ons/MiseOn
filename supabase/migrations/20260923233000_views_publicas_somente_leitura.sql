-- CRÍTICO: view pública aceitava escrita anônima e passava por cima do RLS.
--
-- Medido em 23/09/2026. O DEFAULT PRIVILEGES do projeto dá ALL a `anon` e
-- `authenticated` em toda relação nova de `public` — e view é relação. Uma view
-- simples sobre uma tabela só é AUTO-ATUALIZÁVEL no Postgres, e sem
-- `security_invoker` ela grava com os direitos do dono (`postgres`), ignorando
-- o RLS da tabela de baixo. Provado com um UPDATE sem efeito como `anon`,
-- desfeito em seguida: 1 linha atualizada em `lojas` via `lojas_publicas`.
--
-- As duas piores:
--   lojas_publicas                → qualquer pessoa alterava qualquer loja
--   plataforma_pagamento_publico  → qualquer pessoa trocava o efi_payee_code
--                                   da plataforma, que o cartão usa no split
--                                   (desvio de dinheiro)
-- E três com security_invoker (o RLS segurava, mas o grant de escrita não tinha
-- motivo): vw_estoque_critico, vw_insumos_a_revisar, vw_produtos_sem_ficha.
--
-- Nenhuma tela nem edge function grava por view (conferido no código). Regra
-- daqui em diante: view é vitrine, só leitura. O bloco abaixo vale para TODAS
-- as views de `public`, inclusive as que forem criadas sem lembrar disto — a
-- prova em supabase/tests/views_publicas_somente_leitura.sql reprova se voltar.

do $$
declare r record;
begin
  for r in
    select c.oid::regclass as v
    from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('v','m')
  loop
    execute format('revoke insert, update, delete, truncate, references, trigger on %s from public, anon, authenticated', r.v);
  end loop;
end $$;

-- Views novas nascem só-leitura: o gatilho de DDL repete o revoke logo após o
-- CREATE VIEW. Sem ele, a próxima view criada herdaria o ALL do DEFAULT
-- PRIVILEGES e o buraco reabria em silêncio.
create or replace function public.fn_view_nasce_somente_leitura()
returns event_trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare r record;
begin
  for r in
    select objid::regclass as v
    from pg_event_trigger_ddl_commands()
    where object_type in ('view', 'materialized view')
      and schema_name = 'public'
  loop
    execute format('revoke insert, update, delete, truncate, references, trigger on %s from public, anon, authenticated', r.v);
  end loop;
end;
$$;

revoke all on function public.fn_view_nasce_somente_leitura() from public, anon, authenticated;

drop event trigger if exists trg_view_nasce_somente_leitura;
create event trigger trg_view_nasce_somente_leitura
  on ddl_command_end
  when tag in ('CREATE VIEW', 'CREATE MATERIALIZED VIEW')
  execute function public.fn_view_nasce_somente_leitura();

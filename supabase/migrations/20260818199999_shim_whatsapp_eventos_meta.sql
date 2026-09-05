-- ============================================================================
-- SHIM de drift (Sprint 0, 05/09/2026)
--
-- POR QUÊ EXISTE: a 20260818200000_whatsapp_conexao_pendente.sql faz
-- `alter table whatsapp_eventos_meta add column if not exists ...`, mas essa
-- tabela nunca nasceu em nenhuma migration — foi criada direto em produção
-- (não consta nem no dump de 21/07, que é anterior). Em banco limpo a cadeia
-- morria com "relation whatsapp_eventos_meta does not exist".
--
-- RECONSTRUÇÃO (não cópia de dump, que não a contém): as colunas são as usadas
-- pelos consumidores — whatsapp-webhook/index.ts:299 (insert waba_id, campo,
-- payload), :340 (update processado_em, resultado) e whatsapp-conectar/
-- index.ts:954 (select waba_id, criado_em). Idioma copiado da tabela-irmã
-- whatsapp_eventos (20260722030000:35): service_role only, RLS sem policy.
--
-- AS COLUNAS processado_em/resultado FICAM FORA AQUI de propósito: a própria
-- 20260818200000 as adiciona logo em seguida (add column if not exists), e
-- duplicá-las aqui seria reescrever história.
-- ============================================================================

create table if not exists public.whatsapp_eventos_meta (
  id         uuid primary key default gen_random_uuid(),
  waba_id    text,
  campo      text,
  payload    jsonb not null,
  criado_em  timestamptz not null default now()
);

alter table public.whatsapp_eventos_meta enable row level security;
-- Sem policy: só service_role (webhook/conectar) toca nesta tabela.
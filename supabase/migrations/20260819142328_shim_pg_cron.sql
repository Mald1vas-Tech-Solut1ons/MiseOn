-- ============================================================================
-- SHIM de drift (Sprint 0, 05/09/2026)
--
-- POR QUÊ EXISTE: a 20260819142329_ifood_polling_agendado.sql chama
-- cron.schedule(...), e o pg_cron estava habilitado em produção pelo
-- dashboard — nunca versionado. Em banco limpo a cadeia morria com
-- 'schema "cron" does not exist'. O mesmo vale para o cron.schedule da
-- 20260819154104 (limpeza de rate limit).
--
-- A imagem local do Supabase já traz o pg_cron no shared_preload_libraries,
-- então basta o CREATE EXTENSION — que cria o schema `cron` e é no-op onde
-- a extensão já existe (produção).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron;
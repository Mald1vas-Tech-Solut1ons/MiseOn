-- ============================================================================
-- SHIM de drift (criado no Sprint 0, 05/09/2026)
--
-- POR QUÊ EXISTE: as colunas abaixo existiam no banco de PRODUÇÃO (capturadas
-- no dump supabase/.temp/prod_schema_dump.sql, snapshot ~21/07/2026) mas
-- nenhuma migration as criava — eram drift puro. A cadeia quebrava em banco
-- limpo já na 20260715170500 (UPDATE ... cor_texto → "column does not
-- exist"): o repo não reconstrói o banco.
--
-- Definições CÓPIA EXATA do dump. `IF NOT EXISTS` mantém a produção intacta
-- quando este shim eventualmente for aplicado lá (as colunas já existem).
-- Front-ends e policies leem plano/status/trial para o modelo de assinatura —
-- no banco limpo eles passam a existir desde o nascimento da tabela.
-- ============================================================================

ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS plano text NOT NULL DEFAULT 'trial';
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS trial_termina_em timestamptz DEFAULT (now() + interval '14 days');
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS observacao_admin text;
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS fonte text NOT NULL DEFAULT 'Inter';
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS cor_texto text NOT NULL DEFAULT '#111827';
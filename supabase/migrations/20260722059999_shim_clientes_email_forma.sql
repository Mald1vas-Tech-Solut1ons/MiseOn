-- ============================================================================
-- SHIM de drift (Sprint 0, 05/09/2026)
--
-- POR QUÊ EXISTE: a 20260721100000_versionar_drift_producao.sql versionou
-- clientes.user_id (coluna + FK) mas deixou de fora, embora presentes no
-- dump de produção, três objetos: as colunas `email` e
-- `forma_pagamento_preferida` e o UNIQUE `clientes_loja_user_unique`.
--
-- Consequência: a 20260722060000_email_gatilhos.sql (fn_email_do_pedido)
-- referencia clientes.email e a cadeia morria em banco limpo com
-- "column c.email does not exist" — em produção a coluna existia como
-- drift manual. Os INSERTs de 20260819162313/162525 também usam as três
-- colunas, e o upsert `on conflict (loja_id, user_id)` exige o UNIQUE.
--
-- Definições CÓPIA EXATA do dump de produção (supabase/.temp/
-- prod_schema_dump.sql, linha 821): "user_id" uuid (já versionada),
-- "email" text, "forma_pagamento_preferida" public.metodo_pgto.
-- Idempotente: no-op em produção, onde tudo já existe.
-- ============================================================================

ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS forma_pagamento_preferida public.metodo_pgto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clientes_loja_user_unique'
  ) THEN
    ALTER TABLE public.clientes
      ADD CONSTRAINT clientes_loja_user_unique UNIQUE (loja_id, user_id);
  END IF;
END $$;
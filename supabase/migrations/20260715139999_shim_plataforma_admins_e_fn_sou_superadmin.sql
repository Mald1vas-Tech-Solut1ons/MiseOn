-- ============================================================================
-- SHIM de ordenação (criado no Sprint 0, 05/09/2026)
--
-- POR QUÊ EXISTE: a migration 20260715140000_loja_efi_credenciais.sql cria a
-- policy `cred_superadmin` chamando fn_sou_superadmin(), mas essa função e a
-- tabela plataforma_admins só eram versionadas em
-- 20260721100000_versionar_drift_producao.sql — 6 dias DEPOIS. Em produção o
-- `db reset` nunca rodou e a função existia como drift manual, então ninguém
-- viu; em banco limpo o repo morria na 7ª migration ("repo não reconstrói o
-- banco"). Este shim antecipa os dois objetos para que a cadeia suba do zero.
--
-- A definição aqui é CÓPIA EXATA da versão canônica em 20260721100000, que é
-- idempotente (IF NOT EXISTS / CREATE OR REPLACE) e re-aplica estes mesmos
-- objetos depois — sem conflito, em banco limpo ou em produção.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.plataforma_admins (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.plataforma_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.fn_sou_superadmin() RETURNS boolean
  LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT EXISTS (SELECT 1 FROM plataforma_admins WHERE user_id = auth.uid());
$$;
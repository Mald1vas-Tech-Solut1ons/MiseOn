-- ============================================================================
-- SHIM de ordenação (criado no Sprint 0, 05/09/2026)
--
-- POR QUÊ EXISTE: a migration 20260718141000 (RLS FASE A) habilita RLS e cria
-- policies em historico_pedidos, mas a tabela só era versionada em
-- 20260721100000 — 3 dias DEPOIS. Em produção a tabela existia como drift
-- manual; em banco limpo a cadeia morria aqui ("relation does not exist").
--
-- Definição CÓPIA EXATA de 20260721100000 (CREATE TABLE IF NOT EXISTS +
-- índice), que re-aplica idempotentemente depois: policies e trigger da
-- tabela continuam nascendo lá, como na versão canônica.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.historico_pedidos (
  id              uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  pedido_id       uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  status          public.status_pedido NOT NULL,
  criado_em       timestamptz DEFAULT now(),
  operador_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_historico_pedidos
  ON public.historico_pedidos USING btree (pedido_id, criado_em);
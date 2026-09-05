-- ============================================================================
-- SHIM de drift (Sprint 0, 05/09/2026)
--
-- POR QUÊ EXISTE: a tabela public.localizacao_entregador existe em produção
-- (dump: linha 1123, com RLS na linha 2611) mas nunca nasceu em nenhuma
-- migration — drift manual do módulo de logística. A
-- 20260819130858_logistica_fecha_gps_entregas_e_chat.sql faz `drop policy
-- if exists ... on localizacao_entregador`, que em banco limpo morria com
-- "relation does not exist" (IF EXISTS cobre a policy, não a tabela).
--
-- Definição CÓPIA EXATA do dump (1123-1129 + pkey 1651 + FKs 2125/2130).
-- As policies legadas ver_localizacao/gerenciar_localizacao (dump: 2586,
-- 2767) NÃO são recriadas de propósito: a própria 20260819130858 as remove
-- logo em seguida e as substitui pelas escopadas — recriá-las aqui seria
-- criar objeto só para apagar na linha seguinte. Estado final idêntico ao
-- de produção. Idempotente: no-op em produção.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.localizacao_entregador (
  pedido_id      uuid NOT NULL PRIMARY KEY REFERENCES public.pedidos(id) ON DELETE CASCADE,
  entregador_id  uuid REFERENCES auth.users(id),
  lat            numeric(10,8) NOT NULL,
  lng            numeric(11,8) NOT NULL,
  atualizado_em  timestamptz DEFAULT now()
);

ALTER TABLE public.localizacao_entregador ENABLE ROW LEVEL SECURITY;
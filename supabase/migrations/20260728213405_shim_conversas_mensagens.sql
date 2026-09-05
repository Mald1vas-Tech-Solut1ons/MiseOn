-- ============================================================================
-- SHIM de drift (Sprint 0, 05/09/2026)
--
-- POR QUÊ EXISTE: as tabelas public.conversas e public.mensagens existem em
-- produção (dump: linhas 878 e 1210) com RLS e policies, mas NUNCA nasceram
-- em nenhuma migration — são drift manual da era pré-chat_ia (a 20260721170000
-- criou chat_conversations/chat_messages como o novo módulo de chat, mas não
-- removeu nem versionou as antigas). A 20260728213406 então faz
-- `drop policy if exists ... on public.conversas` — e DROP POLICY IF EXISTS
-- só tolera policy inexistente, não tabela: em banco limpo a cadeia morria
-- com "relation public.conversas does not exist".
--
-- Este shim versiona as tabelas exatamente como no dump de produção para o
-- repo reconstruir o banco 1:1. O enum autor_msg também era drift (nunca
-- versionado) e nasce aqui junto.
--
-- DECISÃO REGISTRADA (backlog Sprint 4/A3): conversas/mensagens provavelmente
-- são legado morto — se confirmado sem consumidor no código, remover de
-- produção deliberadamente, com migration própria, NÃO por omissão aqui.
--
-- Definições CÓPIA EXATA do dump (conversas: 878; mensagens: 1210;
-- autor_msg: 26). RLS habilitado como em produção (dump: 2551, 2620).
-- Idempotente: no-op em produção.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'autor_msg' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.autor_msg AS ENUM ('CLIENTE', 'IA', 'LOJA');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.conversas (
  id         uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  loja_id    uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  telefone   text,
  nome       text,
  pedido_id  uuid REFERENCES public.pedidos(id) ON DELETE SET NULL,
  ia_ativa   boolean DEFAULT true,
  encerrada  boolean DEFAULT false,
  criado_em  timestamptz DEFAULT now()
);

ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.mensagens (
  id           uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  conversa_id  uuid NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  autor        public.autor_msg NOT NULL,
  conteudo     text NOT NULL,
  metadata     jsonb,
  criado_em    timestamptz DEFAULT now()
);

ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;
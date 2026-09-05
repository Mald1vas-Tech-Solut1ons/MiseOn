-- ============================================================================
-- SHIM de ordenação (criado no Sprint 0, 05/09/2026)
--
-- POR QUÊ EXISTE: a migration 20260721073839_add_chat_realtime.sql adicionava
-- chat_messages/chat_conversations à publicação supabase_realtime, mas as
-- tabelas só nascem em 20260721170000_chat_ia.sql — 9h30 DEPOIS. Em produção
-- as tabelas existiam como drift manual antes de ambas, então funcionou; em
-- banco limpo a cadeia morria no ALTER PUBLICATION ("relation does not
-- exist"). A 20260721073839 foi tornada condicional (no-op quando as tabelas
-- ainda não existem) e ESTA migration completa a intenção depois delas.
-- Idempotente: no-op se as tabelas já estão na publicação (caso produção).
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
  END IF;
END $$;
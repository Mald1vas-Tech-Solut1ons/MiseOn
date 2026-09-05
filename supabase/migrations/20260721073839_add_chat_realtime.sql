-- Add chat tables to supabase_realtime publication so the client receives insertion events
--
-- [Sprint 0, 05/09/2026] Originalmente eram 2 ALTER PUBLICATION diretos — mas as
-- tabelas chat_* só nascem em 20260721170000_chat_ia.sql, 9h30 DEPOIS daqui. Em
-- produção existiam como drift manual, então rodou; em banco limpo a cadeia
-- morria aqui. Tornado condicional: no-op enquanto as tabelas não existirem;
-- a adição definitiva acontece em 20260721170499_shim_chat_realtime.sql, após
-- a criação — idempotente também em produção (tabelas já estão na publicação).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chat_messages')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chat_conversations')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_conversations'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
  END IF;
END $$;

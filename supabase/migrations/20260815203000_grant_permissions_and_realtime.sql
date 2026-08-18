-- ============================================================
-- Permissões Globais (Grants) & Supabase Realtime
-- Concede privilégios de tabela aos papéis anon, authenticated e service_role.
-- Sem estes GRANTs, o Postgres retorna erro 42501 (permission denied for table X)
-- e o Supabase Realtime WebSocket falha ao autenticar.
-- ============================================================

-- 1. Permissões no esquema public
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Permissões em todas as tabelas atuais do esquema public
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- 3. Permissões em todas as sequências atuais do esquema public
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 4. Permissões de execução em todas as funções públicas
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- 5. Privilégios padrão para tabelas, sequências e funções criadas no futuro
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

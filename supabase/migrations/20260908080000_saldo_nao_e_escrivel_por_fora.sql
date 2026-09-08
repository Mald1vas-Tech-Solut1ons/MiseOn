-- ============================================================================
-- SPRINT 7 (correção): O REVOKE DE COLUNA NÃO PEGA CONTRA GRANT DE TABELA
--
-- A migration 20260908070000 tentou `REVOKE UPDATE (quantidade_atual) ON
-- insumos`. Verificado logo depois em information_schema.column_privileges:
-- o privilégio continuava lá. Em PostgreSQL, um GRANT de UPDATE na TABELA
-- cobre todas as colunas, e revogar uma coluna isolada dele não faz nada —
-- é preciso revogar a tabela e reconceder coluna a coluna.
--
-- É a diferença entre achar que fechou e ter fechado. Por isso a verificação
-- ficou no fim desta migration: se `quantidade_atual` continuar escrevível
-- por `authenticated`, a migration ABORTA em vez de passar batido.
-- ============================================================================

DO $$
DECLARE
  v_cols text;
BEGIN
  -- Lista todas as colunas MENOS o saldo. Dinâmico de propósito: escrever 40
  -- nomes à mão é como se erra uma e se descobre em produção.
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO v_cols
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'insumos'
     AND column_name <> 'quantidade_atual';

  -- `anon` não volta a receber UPDATE: cliente deslogado não tem por que
  -- editar insumo. A RLS já barrava, mas privilégio que não existe não
  -- depende de policy para não ser usado.
  EXECUTE 'REVOKE UPDATE ON public.insumos FROM anon, authenticated';
  EXECUTE format('GRANT UPDATE (%s) ON public.insumos TO authenticated', v_cols);
END $$;

-- ── Verificação: a migration falha se a porta continuar aberta ──────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.column_privileges
     WHERE table_schema = 'public'
       AND table_name   = 'insumos'
       AND column_name  = 'quantidade_atual'
       AND privilege_type = 'UPDATE'
       AND grantee IN ('anon', 'authenticated')
  ) THEN
    RAISE EXCEPTION 'insumos.quantidade_atual continua escrivel por anon/authenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
     WHERE table_schema = 'public'
       AND table_name IN ('movimentacoes_estoque', 'lotes_estoque')
       AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
       AND grantee IN ('anon', 'authenticated')
  ) THEN
    RAISE EXCEPTION 'ledger/lotes continuam gravaveis por anon/authenticated';
  END IF;
END $$;

-- NOTA para quem adicionar coluna em `insumos` no futuro: o GRANT acima é por
-- coluna, então a coluna nova nasce SEM permissão de UPDATE para o app.
-- Reconceda explicitamente (é o preço de o saldo não ser escrevível por fora).

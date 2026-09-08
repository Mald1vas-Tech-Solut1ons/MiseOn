-- ============================================================================
-- SPRINT 7: A PORTA FECHADA TEM QUE PERMANECER FECHADA
--
-- Os REVOKEs de 20260908070000/080000 tiraram do app a escrita direta no
-- ledger, nos lotes e no saldo. Mas privilégio é estado de banco, não linha de
-- código: um `GRANT ALL` distraído numa migration futura reabre a fábrica de
-- divergência e NADA na aplicação acusa — o estoque volta a mentir em
-- silêncio, que é exatamente o defeito que este sprint fechou.
--
-- Esta função devolve as permissões de escrita que NÃO deveriam existir. Zero
-- linhas = trancado. A suíte de integração falha se voltar a ter linha.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_privilegios_de_escrita_estoque()
RETURNS TABLE (tabela TEXT, coluna TEXT, papel TEXT, privilegio TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  -- Ledger e lotes: nenhuma escrita direta, de nenhuma coluna.
  SELECT g.table_name::text, '(tabela)'::text, g.grantee::text, g.privilege_type::text
    FROM information_schema.role_table_grants g
   WHERE g.table_schema = 'public'
     AND g.table_name IN ('movimentacoes_estoque', 'lotes_estoque')
     AND g.privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
     AND g.grantee IN ('anon', 'authenticated')

  UNION ALL

  -- Insumos: o app edita metadado, mas o SALDO é só das RPCs.
  SELECT 'insumos'::text, c.column_name::text, c.grantee::text, c.privilege_type::text
    FROM information_schema.column_privileges c
   WHERE c.table_schema = 'public'
     AND c.table_name = 'insumos'
     AND c.column_name = 'quantidade_atual'
     AND c.privilege_type = 'UPDATE'
     AND c.grantee IN ('anon', 'authenticated');
$$;

REVOKE ALL ON FUNCTION public.fn_privilegios_de_escrita_estoque() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_privilegios_de_escrita_estoque() TO authenticated;

COMMENT ON FUNCTION public.fn_privilegios_de_escrita_estoque() IS
  'Auditoria: escritas diretas em ledger/lotes/saldo que não deveriam existir. '
  'Zero linhas = só as RPCs movem estoque. A suíte de integração trava nisto.';

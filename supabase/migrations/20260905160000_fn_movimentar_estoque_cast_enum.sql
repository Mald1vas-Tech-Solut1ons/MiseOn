-- ============================================================================
-- HOTFIX DO GO-LIVE — fn_movimentar_estoque: cast de p_tipo para o enum
--
-- Descoberto pelo smoke test do go-live do Sprint 1 (05/09/2026): a RPC criada
-- em 20260905120000 declara p_tipo TEXT e o insere direto na coluna enum
-- movimentacoes_estoque.tipo. Literal ('SAIDA', 'ENTRADA') é tipo desconhecido
-- e o PostgreSQL resolve como enum; VARIÁVEL text não — o catálogo não tem
-- cast de atribuição text -> enum (pg_cast vazio) e toda chamada da RPC
-- morria com 42804 ("column tipo is of type tipo_mov_estoque but expression
-- is of type text"), inclusive pelo caminho real do PostgREST.
--
-- Por que os gates não pegaram: __tests__/integration/estoque-peps.test.ts é
-- describe.runIf(isConfigured) — a suíte pula em silêncio sem
-- SUPABASE_SERVICE_ROLE_KEY, e a branch nunca foi ao CI. Gate falso-verde.
--
-- A correção é um cast explícito no INSERT — o único ponto onde a variável
-- text encontra a coluna enum (as comparações IF p_tipo NOT IN (...) são
-- text = literal, e seguem válidas).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_movimentar_estoque(
  p_insumo_id      UUID,
  p_tipo           TEXT,
  p_quantidade     NUMERIC,
  p_custo_total    NUMERIC DEFAULT NULL,
  p_motivo         TEXT   DEFAULT NULL,
  p_ocorrido_em    TIMESTAMPTZ DEFAULT NULL,
  p_lote_fornecedor TEXT  DEFAULT NULL,
  p_vence_em       DATE   DEFAULT NULL,
  p_pedido_id      UUID   DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_loja      UUID;
  v_saldo     NUMERIC;
  v_nome      TEXT;
  v_mov       UUID;
  v_custo     NUMERIC;
BEGIN
  SELECT loja_id, COALESCE(quantidade_atual, 0), nome
  INTO   v_loja, v_saldo, v_nome
  FROM   public.insumos WHERE id = p_insumo_id;

  IF v_loja IS NULL THEN
    RAISE EXCEPTION 'Insumo % não encontrado.', p_insumo_id;
  END IF;

  -- auth.uid() nulo = chamada interna (service role / testes). Com usuário
  -- logado, exige vínculo com a loja — o mesmo padrão de fn_baixar_estoque.
  IF auth.uid() IS NOT NULL AND NOT public.fn_meu_acesso(v_loja) THEN
    RAISE EXCEPTION 'Sem permissão para movimentar o estoque desta loja.';
  END IF;

  IF p_tipo NOT IN ('ENTRADA', 'SAIDA', 'AJUSTE', 'PERDA') THEN
    RAISE EXCEPTION 'Tipo % inválido para movimentação manual.', p_tipo;
  END IF;

  -- Convenção do schema: positivo entra, negativo sai. BAIXA_VENDA não é
  -- aceita aqui de propósito — ela tem fonte única (fn_baixar_estoque).
  IF p_tipo = 'ENTRADA' AND p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Entrada exige quantidade positiva.';
  END IF;
  IF p_tipo <> 'ENTRADA' AND p_quantidade >= 0 THEN
    RAISE EXCEPTION 'Saída/ajuste/perda exige quantidade negativa.';
  END IF;

  -- Saldo primeiro, com guarda: saída maior que o estoque aborta sem deixar
  -- rastro (saldo negativo é mentira operacional).
  UPDATE public.insumos
  SET    quantidade_atual = COALESCE(quantidade_atual, 0) + p_quantidade
  WHERE  id = p_insumo_id
  RETURNING COALESCE(quantidade_atual, 0) INTO v_saldo;

  IF p_quantidade < 0 AND v_saldo < -1e-6 THEN
    RAISE EXCEPTION 'Estoque insuficiente de %: ficaria %. Ajuste o estoque antes de concluir a operação.',
      v_nome, v_saldo;
  END IF;

  -- A trigger de custeio preenche custo_total na SAIDA/PERDA/AJUSTE
  -- negativos (PEPS dos lotes); a de lote cria o lote na ENTRADA. O
  -- RETURNING traz o custo já apurado pelas triggers.
  INSERT INTO public.movimentacoes_estoque (
    loja_id, insumo_id, tipo, quantidade, custo_total, motivo,
    lote_fornecedor, vence_em, ocorrido_em, pedido_id
  ) VALUES (
    v_loja, p_insumo_id, p_tipo::public.tipo_mov_estoque, p_quantidade,
    NULLIF(p_custo_total, 0), p_motivo, NULLIF(p_lote_fornecedor, ''),
    p_vence_em, COALESCE(p_ocorrido_em, now()), p_pedido_id
  )
  RETURNING id, custo_total INTO v_mov, v_custo;

  RETURN jsonb_build_object(
    'movimentacao_id', v_mov,
    'custo_total',     v_custo,
    'saldo',           v_saldo
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_movimentar_estoque(UUID, TEXT, NUMERIC, NUMERIC, TEXT, TIMESTAMPTZ, TEXT, DATE, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_movimentar_estoque(UUID, TEXT, NUMERIC, NUMERIC, TEXT, TIMESTAMPTZ, TEXT, DATE, UUID) TO authenticated;
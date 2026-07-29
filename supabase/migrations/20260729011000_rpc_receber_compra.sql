-- ============================================================================
-- Módulo de Compras — parte 3: conferência do recebimento (transacional)
-- ============================================================================
-- Antes, receber mercadoria era `insert` na movimentação + `update` no saldo,
-- em duas chamadas soltas do navegador. Se a segunda falhasse — aba fechada,
-- rede caindo, RLS negando — o razão registrava a entrada e o saldo não subia.
-- O estoque passava a mentir sem deixar rastro.
--
-- Aqui isso vira UMA transação: conferência, razão, saldo, custo do cadastro e
-- lançamento financeiro entram juntos ou não entram.
--
-- A flexibilidade que o lojista pediu mora no payload: cada item pode chegar em
-- QUALQUER unidade (com o fator declarado), de outra marca, de outro insumo
-- (substituição), em quantidade diferente e por outro preço. Nada disso é
-- tratado como erro — é o fato, e o fato é o que manda.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_receber_compra(
  p_compra_id   UUID,
  p_itens       JSONB,
  p_numero_nota TEXT        DEFAULT NULL,
  p_recebido_em TIMESTAMPTZ DEFAULT now(),
  p_frete       NUMERIC     DEFAULT NULL,
  p_desconto    NUMERIC     DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_loja           UUID;
  v_fornecedor     TEXT;
  v_item           JSONB;
  v_ci             public.compras_itens%ROWTYPE;
  v_insumo         UUID;
  v_qtd            NUMERIC;
  v_unidade        TEXT;
  v_fator          NUMERIC;
  v_base           NUMERIC;
  v_base_pedida    NUMERIC;
  v_preco          NUMERIC;
  v_mov            UUID;
  v_status         public.compra_item_status;
  v_motivo         TEXT;
  v_total_pago     NUMERIC := 0;
  v_recebidos      INTEGER := 0;
  v_divergentes    INTEGER := 0;
  v_pendentes      INTEGER;
  v_status_compra  public.compra_status;
  v_conta_estoque  UUID;
  v_conta_forn     UUID;
BEGIN
  SELECT c.loja_id, f.nome INTO v_loja, v_fornecedor
  FROM   public.compras c
  LEFT   JOIN public.fornecedores f ON f.id = c.fornecedor_id
  WHERE  c.id = p_compra_id;

  IF v_loja IS NULL THEN
    RAISE EXCEPTION 'Compra % não encontrada.', p_compra_id;
  END IF;

  -- SECURITY DEFINER passa por cima da RLS, então o papel é conferido à mão.
  IF NOT public.fn_tem_papel(v_loja, ARRAY['admin','operador']) THEN
    RAISE EXCEPTION 'Sem permissão para receber compras desta loja.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_itens, '[]'::jsonb))
  LOOP
    SELECT * INTO v_ci
    FROM   public.compras_itens
    WHERE  id = (v_item->>'item_id')::UUID AND compra_id = p_compra_id;

    IF NOT FOUND THEN CONTINUE; END IF;

    v_insumo   := COALESCE((v_item->>'insumo_recebido_id')::UUID, v_ci.insumo_id);
    v_qtd      := COALESCE((v_item->>'qtd')::NUMERIC, 0);
    v_unidade  := COALESCE(v_item->>'unidade', v_ci.unidade_pedida);
    v_fator    := COALESCE((v_item->>'fator')::NUMERIC, v_ci.fator_pedida);
    v_preco    := NULLIF((v_item->>'preco_total')::NUMERIC, 0);
    v_base     := v_qtd * v_fator;
    v_base_pedida := v_ci.qtd_pedida * v_ci.fator_pedida;

    -- O status é DERIVADO do que chegou, não do que o app diz que chegou:
    -- comparar intenção e fato é trabalho do banco, senão cada tela inventa
    -- a sua própria régua de "veio parcial".
    IF v_qtd <= 0 THEN
      v_status := 'NAO_VEIO';
    ELSIF v_insumo <> v_ci.insumo_id THEN
      v_status := 'SUBSTITUIDO';
    ELSIF v_base < v_base_pedida * 0.999 THEN  -- folga p/ ruído de ponto flutuante
      v_status := 'PARCIAL';
    ELSE
      v_status := 'RECEBIDO';
    END IF;

    IF v_status <> 'RECEBIDO' THEN v_divergentes := v_divergentes + 1; END IF;

    IF v_base > 0 THEN
      v_motivo := 'Compra'
        || COALESCE(' — ' || v_fornecedor, '')
        || COALESCE(' — NF ' || NULLIF(p_numero_nota, ''), '')
        -- Guarda a unidade digitada: sem isso o histórico só mostra o saldo já
        -- convertido e um erro de conversão fica invisível na auditoria.
        || ' (' || public.fn_num_txt(v_qtd) || ' ' || v_unidade || ')';

      INSERT INTO public.movimentacoes_estoque (
        loja_id, insumo_id, tipo, quantidade, custo_total, motivo,
        lote_fornecedor, vence_em
      ) VALUES (
        v_loja, v_insumo, 'ENTRADA', v_base, v_preco, v_motivo,
        NULLIF(v_item->>'lote', ''), (NULLIF(v_item->>'vence_em', ''))::DATE
      ) RETURNING id INTO v_mov;
      -- trg_mov_criar_lote já abriu o lote PEPS com o custo desta entrada.

      UPDATE public.insumos
      SET    quantidade_atual = COALESCE(quantidade_atual, 0) + v_base
      WHERE  id = v_insumo;

      -- O cadastro passa a refletir o último preço realmente pago. Mantém a
      -- identidade custo_unitario = preco_embalagem / qtd_embalagem, agora na
      -- unidade em que a mercadoria de fato chegou.
      IF v_preco IS NOT NULL AND v_qtd > 0 THEN
        UPDATE public.insumos
        SET    preco_embalagem = v_preco / v_qtd,
               qtd_embalagem   = v_fator
        WHERE  id = v_insumo;
      END IF;

      v_total_pago := v_total_pago + COALESCE(v_preco, 0);
      v_recebidos  := v_recebidos + 1;
    ELSE
      v_mov := NULL;
    END IF;

    UPDATE public.compras_itens
    SET    status             = v_status,
           insumo_recebido_id = CASE WHEN v_insumo <> insumo_id THEN v_insumo END,
           qtd_recebida       = v_qtd,
           unidade_recebida   = CASE WHEN v_qtd > 0 THEN v_unidade END,
           fator_recebida     = CASE WHEN v_qtd > 0 THEN v_fator END,
           preco_total_pago   = v_preco,
           marca              = NULLIF(v_item->>'marca', ''),
           lote_fornecedor    = NULLIF(v_item->>'lote', ''),
           vence_em           = (NULLIF(v_item->>'vence_em', ''))::DATE,
           observacao         = NULLIF(v_item->>'observacao', ''),
           recebido_em        = p_recebido_em,
           movimentacao_id    = v_mov
    WHERE  id = v_ci.id;
  END LOOP;

  -- Recebimento em ondas é normal: enquanto sobrar item pendente, o documento
  -- fica aberto para a próxima entrega do mesmo pedido.
  SELECT COUNT(*) FILTER (WHERE status = 'PENDENTE') INTO v_pendentes
  FROM   public.compras_itens WHERE compra_id = p_compra_id;

  v_status_compra := CASE WHEN v_pendentes > 0 THEN 'RECEBIDO_PARCIAL'::public.compra_status
                                               ELSE 'RECEBIDO'::public.compra_status END;

  UPDATE public.compras
  SET    status      = v_status_compra,
         numero_nota = COALESCE(NULLIF(p_numero_nota, ''), numero_nota),
         recebido_em = COALESCE(p_recebido_em, now()),
         frete       = COALESCE(p_frete, frete),
         desconto    = COALESCE(p_desconto, desconto)
  WHERE  id = p_compra_id;

  -- Financeiro: mercadoria que entra é ativo que se deve. Débito Estoque,
  -- crédito Fornecedores — a compra deixa de ser invisível no DRE.
  IF v_total_pago > 0 THEN
    SELECT id INTO v_conta_estoque FROM public.contas
      WHERE loja_id = v_loja AND codigo = '1.1.03' LIMIT 1;
    SELECT id INTO v_conta_forn FROM public.contas
      WHERE loja_id = v_loja AND codigo = '2.1.01' LIMIT 1;

    IF v_conta_estoque IS NOT NULL AND v_conta_forn IS NOT NULL THEN
      INSERT INTO public.lancamentos_financeiros (
        loja_id, data_lancamento, historico, valor,
        conta_debitada, conta_creditada, referencia_tipo, referencia_id
      ) VALUES (
        v_loja, p_recebido_em::DATE,
        'Compra de insumos' || COALESCE(' — ' || v_fornecedor, '')
                            || COALESCE(' — NF ' || NULLIF(p_numero_nota, ''), ''),
        v_total_pago + COALESCE(p_frete, 0) - COALESCE(p_desconto, 0),
        v_conta_estoque, v_conta_forn, 'COMPRA', p_compra_id
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'compra_id',    p_compra_id,
    'status',       v_status_compra,
    'itens_recebidos', v_recebidos,
    'itens_divergentes', v_divergentes,
    'itens_pendentes',  v_pendentes,
    'total_pago',   v_total_pago
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_receber_compra(UUID, JSONB, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_receber_compra(UUID, JSONB, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC) TO authenticated;

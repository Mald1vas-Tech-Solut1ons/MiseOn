-- Importação de cupom fiscal (NFC-e) para o estoque, em uma transação só.
--
-- Antes isso era feito em três idas soltas do navegador: criava insumo, inseria
-- movimentação e gravava De-Para. Se qualquer passo falhasse no meio, sobrava
-- insumo criado sem entrada de estoque. Pior: ninguém atualizava
-- insumos.quantidade_atual, então o saldo nunca mexia — a nota "importava" e o
-- estoque continuava igual. Aqui o caminho é o mesmo de fn_receber_compra.
CREATE OR REPLACE FUNCTION public.fn_importar_nfce(
  p_loja_id UUID,
  p_chave TEXT,
  p_emitente TEXT,
  p_itens JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_item        JSONB;
  v_insumo      UUID;
  v_qtd_base    NUMERIC;
  v_custo       NUMERIC;
  v_fator       NUMERIC;
  v_qtd_nota    NUMERIC;
  v_motivo      TEXT;
  v_criados     INTEGER := 0;
  v_entradas    INTEGER := 0;
  v_total       NUMERIC := 0;
BEGIN
  IF NOT public.fn_tem_papel(p_loja_id, ARRAY['admin','operador']) THEN
    RAISE EXCEPTION 'Sem permissão para importar notas nesta loja.';
  END IF;

  v_motivo := 'Importado do cupom fiscal'
    || COALESCE(' — ' || NULLIF(p_emitente, ''), '')
    || COALESCE(' — chave ' || LEFT(NULLIF(p_chave, ''), 10) || '...', '');

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_itens, '[]'::jsonb))
  LOOP
    v_qtd_nota := COALESCE((v_item->>'qtd_nota')::NUMERIC, 0);
    v_fator    := COALESCE(NULLIF((v_item->>'fator')::NUMERIC, 0), 1);
    v_qtd_base := v_qtd_nota * v_fator;
    v_custo    := NULLIF((v_item->>'custo_total')::NUMERIC, 0);

    IF v_qtd_base <= 0 THEN CONTINUE; END IF;

    -- Insumo novo quando o lojista não vinculou a um existente.
    IF COALESCE((v_item->>'criar_novo')::BOOLEAN, false) OR (v_item->>'insumo_id') IS NULL THEN
      INSERT INTO public.insumos (loja_id, nome, unidade_medida, quantidade_atual,
                                  estoque_minimo, preco_embalagem, qtd_embalagem, ativo)
      VALUES (p_loja_id,
              COALESCE(NULLIF(v_item->>'nome', ''), 'Item do cupom'),
              COALESCE(NULLIF(v_item->>'unidade', ''), 'un'),
              0, 0,
              COALESCE(v_custo, 0),
              GREATEST(v_qtd_base, 0.0001),
              true)
      RETURNING id INTO v_insumo;
      v_criados := v_criados + 1;
    ELSE
      v_insumo := (v_item->>'insumo_id')::UUID;
      -- Confere que o insumo é mesmo desta loja: o id vem do navegador.
      PERFORM 1 FROM public.insumos WHERE id = v_insumo AND loja_id = p_loja_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Insumo % não pertence a esta loja.', v_insumo;
      END IF;
    END IF;

    -- A movimentação dispara o gatilho que abre o lote PEPS com o custo real.
    INSERT INTO public.movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, custo_total, motivo)
    VALUES (p_loja_id, v_insumo, 'ENTRADA', v_qtd_base, v_custo, v_motivo);

    -- Saldo do insumo: é isto que faz a quantidade aparecer na tela de Estoque.
    UPDATE public.insumos
    SET    quantidade_atual = COALESCE(quantidade_atual, 0) + v_qtd_base
    WHERE  id = v_insumo;

    -- Preço de referência da última compra, como fn_receber_compra faz.
    IF v_custo IS NOT NULL AND v_qtd_nota > 0 THEN
      UPDATE public.insumos
      SET    preco_embalagem = v_custo / v_qtd_nota,
             qtd_embalagem   = v_fator
      WHERE  id = v_insumo;
    END IF;

    -- Memória do De-Para para a próxima nota do mesmo mercado.
    IF NULLIF(v_item->>'chave_depara', '') IS NOT NULL THEN
      INSERT INTO public.compras_depara_itens (loja_id, chave_item_fornecedor, descricao_nota,
                                               gtin_nota, insumo_id, fator_conversao)
      VALUES (p_loja_id, v_item->>'chave_depara',
              COALESCE(NULLIF(v_item->>'descricao_nota', ''), 'Item do cupom'),
              NULLIF(v_item->>'gtin', ''), v_insumo, v_fator)
      ON CONFLICT (loja_id, chave_item_fornecedor)
      DO UPDATE SET insumo_id = EXCLUDED.insumo_id,
                    fator_conversao = EXCLUDED.fator_conversao,
                    descricao_nota = EXCLUDED.descricao_nota,
                    atualizado_em = now();
    END IF;

    v_entradas := v_entradas + 1;
    v_total := v_total + COALESCE(v_custo, 0);
  END LOOP;

  RETURN jsonb_build_object(
    'itens_lancados', v_entradas,
    'insumos_criados', v_criados,
    'total', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_importar_nfce(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_importar_nfce(UUID, TEXT, TEXT, JSONB) TO authenticated;

-- Importação de NFC-e passa a gravar o gênero do catálogo universal.
--
-- O cadastro manual (src/components/estoque/SeletorItemUniversal.tsx) grava
-- `catalogo_ref` desde a migração 20260831100000: é o slug que agrupa todas as
-- variedades do mesmo item ('tomate' para Tomate Italiano, Débora e Cereja) e
-- responde "quanto gastei de tomate no mês".
--
-- Sem esta migração o agrupamento valeria só para metade do estoque: o tomate
-- digitado à mão entraria no relatório e o tomate que chega pela nota fiscal
-- ficaria de fora, o que é pior do que não agrupar — dá um número que parece
-- certo e está pela metade.
--
-- O front manda o slug que `sugerirDaNota` já reconheceu. Insumo que já tem
-- gênero gravado não é tocado: escolha feita à mão vence palpite por nome.

CREATE OR REPLACE FUNCTION public.fn_importar_nfce(
  p_loja_id UUID,
  p_chave TEXT,
  p_emitente TEXT,
  p_itens JSONB,
  p_repetir BOOLEAN DEFAULT false
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_item        JSONB;
  v_insumo      UUID;
  v_nome        TEXT;
  v_gtin        TEXT;
  v_unidade     TEXT;
  v_catalogo    TEXT;
  v_saldo       NUMERIC;
  v_qtd_base    NUMERIC;
  v_custo       NUMERIC;
  v_fator       NUMERIC;
  v_qtd_nota    NUMERIC;
  v_motivo      TEXT;
  v_criados     INTEGER := 0;
  v_reusados    INTEGER := 0;
  v_entradas    INTEGER := 0;
  v_com_gtin    INTEGER := 0;
  v_ajustadas   INTEGER := 0;
  v_trocadas    INTEGER := 0;
  v_total       NUMERIC := 0;
  v_ja          TIMESTAMPTZ;
BEGIN
  IF NOT public.fn_tem_papel(p_loja_id, ARRAY['admin','operador']) THEN
    RAISE EXCEPTION 'Sem permissão para importar notas nesta loja.';
  END IF;

  IF NULLIF(p_chave, '') IS NOT NULL AND NOT p_repetir THEN
    SELECT importado_em INTO v_ja
    FROM public.nfce_importadas WHERE loja_id = p_loja_id AND chave = p_chave;
    IF v_ja IS NOT NULL THEN
      RETURN jsonb_build_object('ja_importada', true, 'importado_em', v_ja, 'itens_lancados', 0);
    END IF;
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
    v_nome     := COALESCE(NULLIF(btrim(v_item->>'nome'), ''), 'Item do cupom');
    v_gtin     := NULLIF(btrim(COALESCE(v_item->>'gtin', '')), '');
    -- Gênero do catálogo universal: é o que agrupa as variedades no relatório
    -- de custo. O cadastro manual grava a mesma coisa; sem isto, o tomate que
    -- entra pela nota ficaria fora do agrupamento do tomate digitado à mão.
    v_catalogo := NULLIF(btrim(COALESCE(v_item->>'catalogo_ref', '')), '');

    IF v_qtd_base <= 0 THEN CONTINUE; END IF;

    -- Unidade pedida, já reduzida ao catálogo. NULL = "não sei", e cada ramo
    -- abaixo decide o que fazer com isso.
    v_unidade := NULLIF(btrim(COALESCE(v_item->>'unidade', '')), '');
    IF v_unidade IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.unidades_medida WHERE codigo = v_unidade)
    THEN
      v_ajustadas := v_ajustadas + 1;
      v_unidade := NULL;
    END IF;

    IF COALESCE((v_item->>'criar_novo')::BOOLEAN, false) OR (v_item->>'insumo_id') IS NULL THEN
      SELECT id INTO v_insumo
      FROM   public.insumos
      WHERE  loja_id = p_loja_id AND lower(btrim(nome)) = lower(v_nome) AND ativo
      LIMIT  1;

      IF v_insumo IS NULL THEN
        INSERT INTO public.insumos (loja_id, nome, unidade_medida, quantidade_atual,
                                    estoque_minimo, preco_embalagem, qtd_embalagem, ativo,
                                    gtin, catalogo_ref)
        VALUES (p_loja_id, v_nome, COALESCE(v_unidade, 'un'),
                0, 0, COALESCE(v_custo, 0), GREATEST(v_qtd_base, 0.0001), true,
                v_gtin, v_catalogo)
        RETURNING id INTO v_insumo;
        v_criados := v_criados + 1;
        IF v_gtin IS NOT NULL THEN v_com_gtin := v_com_gtin + 1; END IF;
      ELSE
        v_reusados := v_reusados + 1;
      END IF;
    ELSE
      v_insumo := (v_item->>'insumo_id')::UUID;
      PERFORM 1 FROM public.insumos WHERE id = v_insumo AND loja_id = p_loja_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Insumo % não pertence a esta loja.', v_insumo;
      END IF;

      -- Troca de unidade de um insumo que já existe. Só com saldo zerado: o
      -- número guardado significa a unidade antiga, e reinterpretá-lo seria
      -- inventar estoque. Sem saldo, não há nada para reinterpretar — é aqui
      -- que o tomate cadastrado em "rodela" volta a ser tomate em quilo.
      IF COALESCE((v_item->>'trocar_unidade')::BOOLEAN, false) AND v_unidade IS NOT NULL THEN
        SELECT COALESCE(quantidade_atual, 0) INTO v_saldo
        FROM public.insumos WHERE id = v_insumo;

        IF v_saldo = 0 THEN
          UPDATE public.insumos
          SET    unidade_medida = v_unidade
          WHERE  id = v_insumo AND unidade_medida <> v_unidade;
          IF FOUND THEN v_trocadas := v_trocadas + 1; END IF;
        END IF;
      END IF;
    END IF;

    -- Vincula o gênero em quem ainda não tem. Nunca sobrescreve: uma escolha
    -- feita à mão no cadastro vale mais que o palpite do casamento por nome.
    IF v_catalogo IS NOT NULL THEN
      UPDATE public.insumos SET catalogo_ref = v_catalogo
      WHERE id = v_insumo AND catalogo_ref IS NULL;
    END IF;

    -- Preenche o código de barras quando o insumo ainda não tem. Nunca
    -- sobrescreve: um EAN já conferido vale mais que o da nota da vez.
    IF v_gtin IS NOT NULL THEN
      UPDATE public.insumos SET gtin = v_gtin
      WHERE id = v_insumo AND (gtin IS NULL OR btrim(gtin) = '');
      IF FOUND THEN v_com_gtin := v_com_gtin + 1; END IF;
    END IF;

    INSERT INTO public.movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, custo_total, motivo)
    VALUES (p_loja_id, v_insumo, 'ENTRADA', v_qtd_base, v_custo, v_motivo);

    UPDATE public.insumos
    SET    quantidade_atual = COALESCE(quantidade_atual, 0) + v_qtd_base
    WHERE  id = v_insumo;

    IF v_custo IS NOT NULL AND v_qtd_nota > 0 THEN
      UPDATE public.insumos
      SET    preco_embalagem = v_custo / v_qtd_nota,
             qtd_embalagem   = v_fator
      WHERE  id = v_insumo;
    END IF;

    IF NULLIF(v_item->>'chave_depara', '') IS NOT NULL THEN
      INSERT INTO public.compras_depara_itens (loja_id, chave_item_fornecedor, descricao_nota,
                                               gtin_nota, insumo_id, fator_conversao)
      VALUES (p_loja_id, v_item->>'chave_depara',
              COALESCE(NULLIF(v_item->>'descricao_nota', ''), 'Item do cupom'),
              v_gtin, v_insumo, v_fator)
      ON CONFLICT (loja_id, chave_item_fornecedor)
      DO UPDATE SET insumo_id = EXCLUDED.insumo_id,
                    fator_conversao = EXCLUDED.fator_conversao,
                    descricao_nota = EXCLUDED.descricao_nota,
                    atualizado_em = now();
    END IF;

    v_entradas := v_entradas + 1;
    v_total := v_total + COALESCE(v_custo, 0);
  END LOOP;

  IF NULLIF(p_chave, '') IS NOT NULL AND v_entradas > 0 THEN
    INSERT INTO public.nfce_importadas (loja_id, chave, emitente, itens_lancados, valor_total, importado_por)
    VALUES (p_loja_id, p_chave, NULLIF(p_emitente, ''), v_entradas, v_total, auth.uid())
    ON CONFLICT (loja_id, chave) DO UPDATE
      SET itens_lancados = public.nfce_importadas.itens_lancados + EXCLUDED.itens_lancados,
          valor_total    = COALESCE(public.nfce_importadas.valor_total, 0) + COALESCE(EXCLUDED.valor_total, 0),
          importado_em   = now();
  END IF;

  RETURN jsonb_build_object(
    'ja_importada', false,
    'itens_lancados', v_entradas,
    'insumos_criados', v_criados,
    'insumos_reaproveitados', v_reusados,
    'com_codigo_barras', v_com_gtin,
    'unidades_trocadas', v_trocadas,
    -- Acima de zero significa que alguma unidade fora do catálogo chegou até
    -- aqui e foi corrigida para 'un' — sinal de front desatualizado.
    'unidades_ajustadas', v_ajustadas,
    'total', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_importar_nfce(UUID, TEXT, TEXT, JSONB, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_importar_nfce(UUID, TEXT, TEXT, JSONB, BOOLEAN) TO authenticated;

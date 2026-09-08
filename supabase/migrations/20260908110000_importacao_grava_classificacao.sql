-- ============================================================================
-- SPRINT 8: A IMPORTAÇÃO PASSA A GRAVAR O QUE ENTENDEU (COM ORIGEM)
--
-- Reescrita de fn_importar_nfce SOBRE a definição de produção. O corpo antigo
-- foi preservado inteiro: entram apenas a classificação e sua proveniência.
--
-- ANTES: o modal calculava categoria/gênero (catálogo + IA) e o payload
-- enviado à RPC levava só nome/unidade/quantidade/custo. `categoria_insumo` e
-- `tipo_item` NUNCA eram gravados — todo insumo importado nascia sem
-- categoria e a tela o exibia como "Ingrediente". Foi assim que material de
-- limpeza e descartável entraram no estoque como comida.
--
-- AGORA: a classificação é resolvida por fn_classificar_insumo (NCM primeiro,
-- categoria depois, 'Outros'/baixa como piso) e gravada junto com origem e
-- confiança. Duas regras que não se quebram:
--
--   · O QUE O LOJISTA DECIDIU NÃO SE TOCA. Insumo com
--     classificacao_origem = 'USUARIO' é soberano: reimportar a mesma nota,
--     ou outra nota do mesmo item, não desfaz a correção dele.
--   · IMPORTAÇÃO NÃO REESCREVE CLASSIFICAÇÃO EXISTENTE. Em insumo que já
--     existe, os campos só são preenchidos quando estão vazios. Automação
--     preenche o que falta; não opina sobre o que já foi resolvido.
--
-- Quantidade, unidade, preço e custo continuam vindo da nota — a IA nunca
-- encostou neles e continua sem encostar.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_importar_nfce(
  p_loja_id uuid,
  p_chave text,
  p_emitente text,
  p_itens jsonb,
  p_repetir boolean DEFAULT false,
  p_data_emissao timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_modo text DEFAULT 'SOMAR'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
  v_vence       DATE;
  v_fabricado   DATE;
  v_lote        TEXT;
  v_criados     INTEGER := 0;
  v_reusados    INTEGER := 0;
  v_entradas    INTEGER := 0;
  v_com_gtin    INTEGER := 0;
  v_ajustadas   INTEGER := 0;
  v_trocadas    INTEGER := 0;
  v_com_validade INTEGER := 0;
  v_vencidos    INTEGER := 0;
  v_total       NUMERIC := 0;
  v_ja          TIMESTAMPTZ;
  v_ocorrido    TIMESTAMPTZ := COALESCE(p_data_emissao, now());
  v_somar       BOOLEAN := COALESCE(upper(p_modo), 'SOMAR') <> 'HISTORICO';
  -- Sprint 8: classificação com proveniência.
  v_categoria   TEXT;
  v_ncm         TEXT;
  v_conf_in     TEXT;
  v_classif     JSONB;
  v_classificados INTEGER := 0;
  v_a_revisar   INTEGER := 0;
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

  v_motivo := CASE WHEN v_somar THEN 'Importado do cupom fiscal'
                   ELSE 'Histórico de compra (sem entrada no saldo)' END
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
    v_catalogo := NULLIF(btrim(COALESCE(v_item->>'catalogo_ref', '')), '');
    v_lote     := NULLIF(btrim(COALESCE(v_item->>'lote_fornecedor', '')), '');
    v_vence    := NULLIF(btrim(COALESCE(v_item->>'vence_em', '')), '')::DATE;
    v_fabricado := NULLIF(btrim(COALESCE(v_item->>'fabricado_em', '')), '')::DATE;

    -- Sprint 8: sinais de classificação vindos da tela.
    v_categoria := NULLIF(btrim(COALESCE(v_item->>'categoria', '')), '');
    v_ncm       := NULLIF(regexp_replace(COALESCE(v_item->>'ncm', ''), '\D', '', 'g'), '');
    v_conf_in   := NULLIF(btrim(COALESCE(v_item->>'confianca_classificacao', '')), '');

    v_classif := public.fn_classificar_insumo(v_categoria, v_nome, v_ncm);

    -- Quando a classificação veio da categoria (não do NCM) e a tela avisou
    -- que o casamento foi fraco, a confiança do item é a fraca. Palpite ruim
    -- não vira dado bom por passar numa tabela.
    IF v_classif->>'origem' = 'CATALOGO' AND v_conf_in = 'baixa' THEN
      v_classif := jsonb_set(v_classif, '{confianca}', '"baixa"');
    END IF;

    IF v_qtd_base <= 0 THEN CONTINUE; END IF;

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
                                    gtin, catalogo_ref,
                                    categoria_insumo, tipo_item, ncm,
                                    classificacao_origem, classificacao_confianca)
        VALUES (p_loja_id, v_nome, COALESCE(v_unidade, 'un'),
                0, 0, COALESCE(v_custo, 0), GREATEST(v_qtd_base, 0.0001), true,
                v_gtin, v_catalogo,
                v_classif->>'categoria', v_classif->>'tipo_item', v_ncm,
                v_classif->>'origem', v_classif->>'confianca')
        RETURNING id INTO v_insumo;
        v_criados := v_criados + 1;
        v_classificados := v_classificados + 1;
        IF v_classif->>'confianca' = 'baixa' THEN v_a_revisar := v_a_revisar + 1; END IF;
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

      IF COALESCE((v_item->>'trocar_unidade')::BOOLEAN, false) AND v_unidade IS NOT NULL THEN
        SELECT COALESCE(quantidade_atual, 0) INTO v_saldo
        FROM public.insumos WHERE id = v_insumo;
        IF v_saldo = 0 THEN
          UPDATE public.insumos SET unidade_medida = v_unidade
          WHERE  id = v_insumo AND unidade_medida <> v_unidade;
          IF FOUND THEN v_trocadas := v_trocadas + 1; END IF;
        END IF;
      END IF;
    END IF;

    -- Insumo que já existia: preenche só o que está VAZIO, e nunca por cima
    -- de decisão do lojista. É a diferença entre ajudar e atropelar.
    UPDATE public.insumos
       SET categoria_insumo        = COALESCE(categoria_insumo, v_classif->>'categoria'),
           tipo_item               = COALESCE(tipo_item, v_classif->>'tipo_item'),
           ncm                     = COALESCE(ncm, v_ncm),
           classificacao_origem    = COALESCE(classificacao_origem, v_classif->>'origem'),
           classificacao_confianca = COALESCE(classificacao_confianca, v_classif->>'confianca')
     WHERE id = v_insumo
       AND COALESCE(classificacao_origem, '') <> 'USUARIO'
       AND (categoria_insumo IS NULL OR tipo_item IS NULL OR classificacao_origem IS NULL);

    IF v_catalogo IS NOT NULL THEN
      UPDATE public.insumos SET catalogo_ref = v_catalogo
      WHERE id = v_insumo AND catalogo_ref IS NULL;
    END IF;

    IF v_gtin IS NOT NULL THEN
      UPDATE public.insumos SET gtin = v_gtin
      WHERE id = v_insumo AND (gtin IS NULL OR btrim(gtin) = '');
      IF FOUND THEN v_com_gtin := v_com_gtin + 1; END IF;
    END IF;

    IF v_vence IS NOT NULL THEN
      v_com_validade := v_com_validade + 1;
      IF v_vence < CURRENT_DATE THEN v_vencidos := v_vencidos + 1; END IF;
    END IF;

    IF v_somar THEN
      INSERT INTO public.movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade,
                                                custo_total, motivo, ocorrido_em,
                                                lote_fornecedor, vence_em)
      VALUES (p_loja_id, v_insumo, 'ENTRADA', v_qtd_base, v_custo, v_motivo, v_ocorrido,
              v_lote, v_vence);

      UPDATE public.insumos
      SET    quantidade_atual = COALESCE(quantidade_atual, 0) + v_qtd_base
      WHERE  id = v_insumo;

      IF v_fabricado IS NOT NULL THEN
        UPDATE public.lotes_estoque SET fabricado_em = v_fabricado
        WHERE  insumo_id = v_insumo AND fabricado_em IS NULL
          AND  criado_em >= now() - INTERVAL '1 minute';
      END IF;
    END IF;

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
    'modo', CASE WHEN v_somar THEN 'SOMAR' ELSE 'HISTORICO' END,
    'itens_lancados', v_entradas,
    'insumos_criados', v_criados,
    'insumos_reaproveitados', v_reusados,
    'com_codigo_barras', v_com_gtin,
    'unidades_trocadas', v_trocadas,
    'unidades_ajustadas', v_ajustadas,
    'com_validade', v_com_validade,
    'ja_vencidos', v_vencidos,
    'classificados', v_classificados,
    'a_revisar', v_a_revisar,
    'ocorrido_em', v_ocorrido,
    'registrado_em', now(),
    'total', v_total
  );
END;
$function$;

COMMENT ON FUNCTION public.fn_importar_nfce(uuid, text, text, jsonb, boolean, timestamp with time zone, text) IS
  'Importa itens da nota para o estoque. Desde 20260908 grava também a '
  'classificação (categoria/tipo/NCM) com origem e confiança — sem nunca '
  'sobrescrever decisão do lojista (origem USUARIO) nem classificação já '
  'existente. Quantidade, unidade e custo continuam vindo da nota.';

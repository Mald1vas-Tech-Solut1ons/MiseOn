-- ═══════════════════════════════════════════════════════════════════════════
-- SPRINT 18 — ENTRADA FISCAL COM FONTE E CONFIANÇA (22/09/2026)
--
-- A regra: o MiseOn nunca transforma um dado fiscal correto em estoque
-- semanticamente errado. Medido em produção antes desta migração:
--
--   1. fn_importar_nfce recebia só `fator`, sem saber DE ONDE ele veio. Um
--      fator lido pela IA na embalagem entrava igual a um fato do XML.
--   2. Gravava preco_embalagem/qtd_embalagem por UPDATE direto, passando por
--      cima de fn_definir_embalagem_insumo — a autoridade que protege a
--      correção do lojista (USUARIO nunca é sobrescrito).
--   3. O movimento de entrada não guardava quantidade fiscal, unidade da
--      nota, fator, origem do fator nem a chave do documento: não havia como
--      auditar "de onde saíram estes 1000 g".
--   4. O servidor não conferia a aritmética da linha (qtd × unitário = total):
--      a troca de quantidade por valor da leitura por foto só era barrada na
--      tela.
--
-- Agora cada linha carrega a semântica fiscal separada (qtd_nota, unidade_nota,
-- valor_unitario_nota, valor_total_nota) e a proveniência do fator
-- (origem_fator + fator_confirmado). O servidor recusa — e diz por quê — o que
-- não tem fonte suficiente. Cliente antigo (sem os campos novos) continua
-- funcionando como antes: nenhuma nota legítima quebra.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Rastro de auditoria no movimento e no de-para ──────────────────────────
alter table public.movimentacoes_estoque add column if not exists documento_chave text;
alter table public.movimentacoes_estoque add column if not exists qtd_nota numeric;
alter table public.movimentacoes_estoque add column if not exists unidade_nota text;
alter table public.movimentacoes_estoque add column if not exists fator_conversao numeric;
alter table public.movimentacoes_estoque add column if not exists origem_fator text;

alter table public.compras_depara_itens add column if not exists unidade_nota text;
alter table public.compras_depara_itens add column if not exists origem_fator text;

-- ── Autoridade de embalagem ganha a NOTA_FISCAL ────────────────────────────
alter table public.insumos drop constraint if exists insumos_qtd_embalagem_origem_check;
alter table public.insumos add constraint insumos_qtd_embalagem_origem_check
  check (qtd_embalagem_origem is null
         or qtd_embalagem_origem in ('USUARIO','NOTA_FISCAL','CATALOGO','RENDIMENTO','DESCRICAO','IA'));

-- Ordem: USUARIO (a mão do lojista) > NOTA_FISCAL (qTrib/uTrib do XML: fato
-- assinado) > CATALOGO > RENDIMENTO > DESCRICAO > IA. Mesma função, mesmo
-- contrato: quem tem posto menor não sobrescreve quem tem posto maior.
create or replace function public.fn_definir_embalagem_insumo(p_insumo_id uuid, p_qtd numeric, p_origem text)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_origem_atual text;
  v_rank_novo    int;
  v_rank_atual   int;
begin
  if p_qtd is null or p_qtd <= 0 then return false; end if;
  if p_origem not in ('USUARIO','NOTA_FISCAL','CATALOGO','RENDIMENTO','DESCRICAO','IA') then
    raise exception 'Origem inválida para tamanho de embalagem: %', p_origem;
  end if;

  select qtd_embalagem_origem into v_origem_atual from insumos where id = p_insumo_id;
  if not found then return false; end if;

  v_rank_novo  := case p_origem when 'USUARIO' then 6 when 'NOTA_FISCAL' then 5 when 'CATALOGO' then 4
                                when 'RENDIMENTO' then 3 when 'DESCRICAO' then 2 else 1 end;
  v_rank_atual := case v_origem_atual when 'USUARIO' then 6 when 'NOTA_FISCAL' then 5 when 'CATALOGO' then 4
                                      when 'RENDIMENTO' then 3 when 'DESCRICAO' then 2
                                      when 'IA' then 1 else 0 end;

  if p_origem <> 'USUARIO' and v_rank_atual > v_rank_novo then return false; end if;

  update insumos
     set qtd_embalagem = p_qtd, qtd_embalagem_origem = p_origem
   where id = p_insumo_id
     and (qtd_embalagem is distinct from p_qtd
          or qtd_embalagem_origem is distinct from p_origem);
  return found;
end $function$;

-- ── Importação ─────────────────────────────────────────────────────────────
create or replace function public.fn_importar_nfce(p_loja_id uuid, p_chave text, p_emitente text, p_itens jsonb, p_repetir boolean DEFAULT false, p_data_emissao timestamp with time zone DEFAULT NULL::timestamp with time zone, p_modo text DEFAULT 'SOMAR'::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
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
  v_fator_txt   TEXT;
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
  v_recusados   INTEGER := 0;
  v_recusas     JSONB := '[]'::jsonb;
  v_com_validade INTEGER := 0;
  v_vencidos    INTEGER := 0;
  v_total       NUMERIC := 0;
  v_ja          TIMESTAMPTZ;
  v_ocorrido    TIMESTAMPTZ := COALESCE(p_data_emissao, now());
  v_somar       BOOLEAN := COALESCE(upper(p_modo), 'SOMAR') <> 'HISTORICO';
  v_categoria   TEXT;
  v_ncm         TEXT;
  v_conf_in     TEXT;
  v_classif     JSONB;
  v_classificados INTEGER := 0;
  v_a_revisar   INTEGER := 0;
  -- Semântica fiscal separada (Sprint 18).
  v_unidade_nota TEXT;
  v_vu_nota     NUMERIC;
  v_vt_nota     NUMERIC;
  v_origem_fator TEXT;
  v_confirmado  BOOLEAN;
  v_conf_arit   BOOLEAN;
  v_desc_nota   TEXT;
  v_origem_emb  TEXT;
  v_qtd_emb     NUMERIC;
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
    v_desc_nota := COALESCE(NULLIF(v_item->>'descricao_nota', ''), NULLIF(v_item->>'nome', ''), 'Item do cupom');
    v_unidade_nota := NULLIF(btrim(COALESCE(v_item->>'unidade_nota', '')), '');
    v_vu_nota := NULLIF(v_item->>'valor_unitario_nota', '')::NUMERIC;
    v_vt_nota := NULLIF(v_item->>'valor_total_nota', '')::NUMERIC;
    v_origem_fator := NULLIF(upper(btrim(COALESCE(v_item->>'origem_fator', ''))), '');
    v_confirmado := COALESCE((v_item->>'fator_confirmado')::BOOLEAN, false);
    v_conf_arit := COALESCE((v_item->>'aritmetica_confirmada')::BOOLEAN, false);

    -- Fator ausente = 1 (compatibilidade: linha na mesma unidade omite o
    -- campo). Presente e <= 0 = a tela disse "não sei": recusa.
    v_fator_txt := NULLIF(btrim(COALESCE(v_item->>'fator', '')), '');
    IF v_fator_txt IS NULL THEN
      v_fator := 1;
    ELSE
      v_fator := v_fator_txt::NUMERIC;
      IF v_fator <= 0 THEN
        v_recusados := v_recusados + 1;
        v_recusas := v_recusas || jsonb_build_object('descricao', v_desc_nota,
          'motivo', 'Conversão desconhecida: informe quanto 1 ' || COALESCE(v_unidade_nota, 'unidade') || ' rende no estoque.');
        CONTINUE;
      END IF;
    END IF;

    -- IA sugere, não decide: conteúdo lido na embalagem só vale confirmado.
    IF v_origem_fator = 'IA' AND NOT v_confirmado THEN
      v_recusados := v_recusados + 1;
      v_recusas := v_recusas || jsonb_build_object('descricao', v_desc_nota,
        'motivo', 'A conversão foi sugerida pela IA e não foi confirmada.');
      CONTINUE;
    END IF;
    IF v_origem_fator IS NOT NULL
       AND v_origem_fator NOT IN ('NOTA_FISCAL','REGRA','CATALOGO','HISTORICO','IA','USUARIO') THEN
      v_recusados := v_recusados + 1;
      v_recusas := v_recusas || jsonb_build_object('descricao', v_desc_nota,
        'motivo', 'Origem da conversão sem autoridade: ' || v_origem_fator);
      CONTINUE;
    END IF;

    -- A nota é aritmética. Quando qtd × unitário não dá o total, algum dos
    -- três foi lido errado — e não há como saber qual sem olhar o papel.
    IF v_vu_nota IS NOT NULL AND v_vt_nota IS NOT NULL AND v_qtd_nota > 0 AND NOT v_conf_arit
       AND abs(round(v_qtd_nota * v_vu_nota, 2) - v_vt_nota) > greatest(0.02, v_vt_nota * 0.005) THEN
      v_recusados := v_recusados + 1;
      v_recusas := v_recusas || jsonb_build_object('descricao', v_desc_nota,
        'motivo', format('Quantidade × valor unitário dá %s, mas a linha diz %s.',
                         round(v_qtd_nota * v_vu_nota, 2), v_vt_nota));
      CONTINUE;
    END IF;

    v_qtd_base := v_qtd_nota * v_fator;
    v_custo    := NULLIF((v_item->>'custo_total')::NUMERIC, 0);
    v_nome     := COALESCE(NULLIF(btrim(v_item->>'nome'), ''), 'Item do cupom');
    v_gtin     := NULLIF(btrim(COALESCE(v_item->>'gtin', '')), '');
    v_catalogo := NULLIF(btrim(COALESCE(v_item->>'catalogo_ref', '')), '');
    v_lote     := NULLIF(btrim(COALESCE(v_item->>'lote_fornecedor', '')), '');
    v_vence    := NULLIF(btrim(COALESCE(v_item->>'vence_em', '')), '')::DATE;
    v_fabricado := NULLIF(btrim(COALESCE(v_item->>'fabricado_em', '')), '')::DATE;

    v_categoria := NULLIF(btrim(COALESCE(v_item->>'categoria', '')), '');
    v_ncm       := NULLIF(regexp_replace(COALESCE(v_item->>'ncm', ''), '[^0-9]', '', 'g'), '');
    v_conf_in   := NULLIF(btrim(COALESCE(v_item->>'confianca_classificacao', '')), '');

    v_classif := public.fn_classificar_insumo(v_categoria, v_nome, v_ncm);

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
      -- O lote (fn_mov_criar_lote) custa por custo_total / quantidade-base:
      -- é a autoridade do PEPS. O rastro fiscal vai junto no movimento.
      INSERT INTO public.movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade,
                                                custo_total, motivo, ocorrido_em,
                                                lote_fornecedor, vence_em,
                                                documento_chave, qtd_nota, unidade_nota,
                                                fator_conversao, origem_fator)
      VALUES (p_loja_id, v_insumo, 'ENTRADA', v_qtd_base, v_custo, v_motivo, v_ocorrido,
              v_lote, v_vence,
              NULLIF(p_chave, ''), v_qtd_nota, v_unidade_nota,
              v_fator, COALESCE(v_origem_fator, 'LEGADO'));

      UPDATE public.insumos
      SET    quantidade_atual = COALESCE(quantidade_atual, 0) + v_qtd_base
      WHERE  id = v_insumo;

      IF v_fabricado IS NOT NULL THEN
        UPDATE public.lotes_estoque SET fabricado_em = v_fabricado
        WHERE  insumo_id = v_insumo AND fabricado_em IS NULL
          AND  criado_em >= now() - INTERVAL '1 minute';
      END IF;
    END IF;

    -- Tamanho da embalagem passa pela AUTORIDADE (fn_definir_embalagem_insumo):
    -- a correção do lojista nunca é sobrescrita por leitura automática.
    -- Conversão confirmada por gente (USUARIO, HISTORICO, IA confirmada) vale
    -- como USUARIO; XML tributável como NOTA_FISCAL; regra/catálogo como
    -- DESCRICAO/CATALOGO. Cliente antigo sem origem = DESCRICAO (posto baixo).
    v_origem_emb := CASE
      WHEN v_origem_fator IN ('USUARIO', 'HISTORICO') OR (v_origem_fator = 'IA' AND v_confirmado) THEN 'USUARIO'
      WHEN v_origem_fator = 'NOTA_FISCAL' THEN 'NOTA_FISCAL'
      WHEN v_origem_fator = 'CATALOGO' THEN 'CATALOGO'
      ELSE 'DESCRICAO'
    END;
    PERFORM public.fn_definir_embalagem_insumo(v_insumo, v_fator, v_origem_emb);

    -- O preço de referência acompanha a embalagem que ficou valendo — não a
    -- da nota. Assim custo unitário = preço / qtd continua sendo o custo real
    -- desta compra por unidade-base, mesmo quando a autoridade recusou o fator.
    IF v_custo IS NOT NULL AND v_qtd_base > 0 THEN
      SELECT qtd_embalagem INTO v_qtd_emb FROM public.insumos WHERE id = v_insumo;
      UPDATE public.insumos
      SET    preco_embalagem = round((v_custo / v_qtd_base) * COALESCE(NULLIF(v_qtd_emb, 0), v_fator), 6)
      WHERE  id = v_insumo;
    END IF;

    IF NULLIF(v_item->>'chave_depara', '') IS NOT NULL THEN
      INSERT INTO public.compras_depara_itens (loja_id, chave_item_fornecedor, descricao_nota,
                                               gtin_nota, insumo_id, fator_conversao,
                                               unidade_nota, origem_fator)
      VALUES (p_loja_id, v_item->>'chave_depara', v_desc_nota,
              v_gtin, v_insumo, v_fator, v_unidade_nota, v_origem_fator)
      ON CONFLICT (loja_id, chave_item_fornecedor)
      DO UPDATE SET insumo_id = EXCLUDED.insumo_id,
                    fator_conversao = EXCLUDED.fator_conversao,
                    descricao_nota = EXCLUDED.descricao_nota,
                    unidade_nota = COALESCE(EXCLUDED.unidade_nota, public.compras_depara_itens.unidade_nota),
                    origem_fator = COALESCE(EXCLUDED.origem_fator, public.compras_depara_itens.origem_fator),
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
    'itens_recusados', v_recusados,
    'recusas', v_recusas,
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

-- Anônimo nunca importa nota: a checagem de papel barrava, agora nem entra.
revoke execute on function public.fn_importar_nfce(uuid, text, text, jsonb, boolean, timestamptz, text) from public, anon;
grant execute on function public.fn_importar_nfce(uuid, text, text, jsonb, boolean, timestamptz, text) to authenticated, service_role;

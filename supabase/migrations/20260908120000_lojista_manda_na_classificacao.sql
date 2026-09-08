-- ============================================================================
-- SPRINT 8: A ÚLTIMA PALAVRA É DO LOJISTA
--
-- A leitura automática serve para poupar digitação no começo — não para
-- decidir. Quando o lojista escolhe a categoria na tela, aquilo deixa de ser
-- palpite e vira decisão: origem 'USUARIO', revisada = true. A partir daí
-- nenhuma importação futura reescreve (fn_importar_nfce respeita).
--
-- A regra de qual categoria implica qual tipo/natureza mora em UM lugar só
-- (classificacao_categorias). Se o front derivasse isso por conta própria,
-- passaríamos a ter duas verdades para a mesma pergunta.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_definir_classificacao_insumo(
  p_insumo_id UUID,
  p_categoria TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_loja UUID;
  v_cat  TEXT := NULLIF(btrim(COALESCE(p_categoria, '')), '');
  r      RECORD;
BEGIN
  SELECT loja_id INTO v_loja FROM public.insumos WHERE id = p_insumo_id;
  IF v_loja IS NULL THEN
    RAISE EXCEPTION 'Insumo % não encontrado.', p_insumo_id;
  END IF;

  IF NOT public.fn_tem_papel(v_loja, ARRAY['admin','operador']) THEN
    RAISE EXCEPTION 'Sem permissão para classificar insumo desta loja.';
  END IF;

  IF v_cat IS NULL THEN
    RAISE EXCEPTION 'Categoria vazia.';
  END IF;

  -- A categoria fica EXATAMENTE como o lojista escreveu. Ele pode inventar
  -- "Molhos Especiais" e isso não vira "Outros" — normalizar o texto dele
  -- seria apagar a decisão que esta função existe para respeitar.
  SELECT * INTO r
    FROM public.classificacao_categorias
   WHERE lower(categoria) = lower(v_cat);

  UPDATE public.insumos
     SET categoria_insumo        = v_cat,
         -- Categoria conhecida deriva o tipo; categoria própria preserva o
         -- tipo atual (e só cai em OUTROS quando não havia nada).
         tipo_item               = COALESCE(r.tipo_item, tipo_item, 'OUTROS'),
         classificacao_origem    = 'USUARIO',
         classificacao_confianca = 'alta',
         classificacao_revisada  = true
   WHERE id = p_insumo_id;

  RETURN jsonb_build_object(
    'categoria', v_cat,
    'tipo_item', COALESCE(r.tipo_item, (SELECT tipo_item FROM public.insumos WHERE id = p_insumo_id)),
    'natureza', r.natureza,
    'entra_ficha_tecnica', r.entra_ficha_tecnica,
    'entra_nutricao', r.entra_nutricao,
    'origem', 'USUARIO',
    'confianca', 'alta',
    'categoria_conhecida', r.categoria IS NOT NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_definir_classificacao_insumo(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_definir_classificacao_insumo(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.fn_definir_classificacao_insumo(UUID, TEXT) IS
  'O lojista classificou na tela: grava categoria + tipo derivado da regra e '
  'marca origem USUARIO/revisada. Importação nunca sobrescreve isto.';

-- As regras precisam ser LEGÍVEIS pelo app (a tela monta o select com elas).
-- Escrita continua fora do alcance: quem muda regra é migration.
ALTER TABLE public.classificacao_categorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS classificacao_categorias_leitura ON public.classificacao_categorias;
CREATE POLICY classificacao_categorias_leitura ON public.classificacao_categorias
  FOR SELECT USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.classificacao_categorias FROM anon, authenticated;
GRANT SELECT ON public.classificacao_categorias TO anon, authenticated;

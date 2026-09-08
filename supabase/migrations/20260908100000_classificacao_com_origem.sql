-- ============================================================================
-- SPRINT 8: A NOTA VIRA DADO COM ORIGEM — E TUDO CONTINUA CORRIGÍVEL
--
-- ─── O QUE ESTAVA ERRADO (medido no banco, 08/09) ──────────────────────────
--
-- 1. A CLASSIFICAÇÃO ERA CALCULADA E JOGADA FORA. O modal de importação
--    resolve gênero, categoria e unidade (catálogo + IA), mas o payload
--    enviado a fn_importar_nfce leva só nome/unidade/quantidade/custo. A RPC
--    nunca gravou `categoria_insumo` nem `tipo_item`. Todo insumo importado
--    nasce sem categoria e a tela o mostra como "Ingrediente" por default.
--
-- 2. POR ISSO MATERIAL DE LIMPEZA VIRA COMIDA. Contado agora: 4 itens de
--    "Descartáveis" e 1 de "Limpeza" estão com tipo_item = 'INGREDIENTE' —
--    entram em ficha técnica e no módulo nutricional como alimento. É
--    exatamente o caso da água sanitária: estoque SIM, ficha alimentar NÃO.
--
-- 3. NÃO DAVA PARA SABER O QUE ERA PALPITE. Nada registrava se um campo veio
--    do XML (fato), de regra determinística, do catálogo, da IA ou do
--    lojista. Depois de salvo, chute e documento ficam indistinguíveis — e
--    revisar vira adivinhação.
--
-- ─── O QUE ESTA MIGRATION FAZ ──────────────────────────────────────────────
--
-- Classificação passa a ser DADO (tabela de regras no banco, não lista fixa
-- no bundle), com ORIGEM e CONFIANÇA gravadas por insumo. Decisão do lojista
-- (origem USUARIO) é soberana: nenhuma importação futura a sobrescreve.
-- A leitura automática continua servindo para o que ela é boa — poupar
-- digitação no começo — sem virar verdade imutável.
-- ============================================================================

-- ── 1. AS REGRAS VIRAM DADO ────────────────────────────────────────────────
-- Estava tudo em src/lib/catalogoInsumos.ts (49 KB compilados no bundle):
-- o lojista não podia corrigir nem ensinar nada sem deploy. Aqui a regra é
-- linha de tabela — dá para ajustar sem recompilar o produto.
CREATE TABLE IF NOT EXISTS public.classificacao_categorias (
  categoria           TEXT PRIMARY KEY,
  natureza            TEXT NOT NULL
                      CHECK (natureza IN ('ALIMENTO','BEBIDA','LIMPEZA','EMBALAGEM',
                                          'DESCARTAVEL','OPERACIONAL','OUTROS')),
  tipo_item           TEXT NOT NULL,
  entra_ficha_tecnica BOOLEAN NOT NULL,
  entra_nutricao      BOOLEAN NOT NULL,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.classificacao_categorias IS
  'Categoria do item → o que ele É para o sistema (natureza, se entra em ficha '
  'técnica e em nutrição). Regra de negócio como DADO: era lista fixa no bundle '
  'do front, onde ninguém podia corrigir sem deploy.';

INSERT INTO public.classificacao_categorias
  (categoria, natureza, tipo_item, entra_ficha_tecnica, entra_nutricao) VALUES
  -- Comida: entra na ficha e tem valor nutricional.
  ('Hortifrúti',     'ALIMENTO',    'INGREDIENTE', true,  true),
  ('Carnes',         'ALIMENTO',    'INGREDIENTE', true,  true),
  ('Pescados',       'ALIMENTO',    'INGREDIENTE', true,  true),
  ('Frios',          'ALIMENTO',    'INGREDIENTE', true,  true),
  ('Laticínios',     'ALIMENTO',    'INGREDIENTE', true,  true),
  ('Mercearia',      'ALIMENTO',    'INGREDIENTE', true,  true),
  ('Padaria',        'ALIMENTO',    'INGREDIENTE', true,  true),
  ('Congelados',     'ALIMENTO',    'INGREDIENTE', true,  true),
  ('Ingrediente',    'ALIMENTO',    'INGREDIENTE', true,  true),
  -- Bebida entra na ficha (caipirinha leva vodka) e tem rótulo nutricional.
  ('Bebidas',        'BEBIDA',      'INGREDIENTE', true,  true),
  -- NÃO É COMIDA: controla estoque e custo, mas não entra em ficha alimentar
  -- nem no módulo nutricional. É o caso da água sanitária.
  ('Limpeza',        'LIMPEZA',     'LIMPEZA',     false, false),
  ('Higiene',        'LIMPEZA',     'LIMPEZA',     false, false),
  ('Descartáveis',   'DESCARTAVEL', 'DESCARTAVEL', false, false),
  ('Embalagem',      'EMBALAGEM',   'EMBALAGEM',   false, false),
  ('Utensílios',     'OPERACIONAL', 'OPERACIONAL', false, false),
  ('Manutenção',     'OPERACIONAL', 'OPERACIONAL', false, false),
  -- Revenda: sai como está, não é insumo de preparo.
  ('Revenda Direta', 'ALIMENTO',    'REVENDA',     false, true),
  -- Desconhecido nasce fora da ficha: incluir errado contamina CMV, e o
  -- lojista corrige em um clique. O contrário é silencioso.
  ('Outros',         'OUTROS',      'OUTROS',      false, false)
ON CONFLICT (categoria) DO NOTHING;

-- ── 2. PROVENIÊNCIA: DE ONDE VEIO E COM QUANTA CONFIANÇA ───────────────────
ALTER TABLE public.insumos
  ADD COLUMN IF NOT EXISTS classificacao_origem TEXT,
  ADD COLUMN IF NOT EXISTS classificacao_confianca TEXT,
  ADD COLUMN IF NOT EXISTS classificacao_revisada BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.insumos DROP CONSTRAINT IF EXISTS insumos_classificacao_origem_check;
ALTER TABLE public.insumos ADD CONSTRAINT insumos_classificacao_origem_check
  CHECK (classificacao_origem IS NULL OR classificacao_origem IN
         ('XML','NCM','REGRA','CATALOGO','IA','USUARIO'));

ALTER TABLE public.insumos DROP CONSTRAINT IF EXISTS insumos_classificacao_confianca_check;
ALTER TABLE public.insumos ADD CONSTRAINT insumos_classificacao_confianca_check
  CHECK (classificacao_confianca IS NULL OR classificacao_confianca IN ('alta','media','baixa'));

COMMENT ON COLUMN public.insumos.classificacao_origem IS
  'De onde veio a classificação: XML/NCM/REGRA/CATALOGO = determinístico; '
  'IA = palpite; USUARIO = decisão do lojista, soberana (importação nunca '
  'sobrescreve).';
COMMENT ON COLUMN public.insumos.classificacao_confianca IS
  'alta/media/baixa. Baixa é convite à revisão, não erro — a tela destaca.';
COMMENT ON COLUMN public.insumos.classificacao_revisada IS
  'true quando um humano confirmou. Some do painel de revisão.';

-- ── 3. A AUTORIDADE DA CLASSIFICAÇÃO ───────────────────────────────────────
-- Determinístico primeiro (NCM → categoria conhecida), IA só onde não há
-- regra. Nunca inventa quantidade, preço ou unidade: isso é da nota.
CREATE OR REPLACE FUNCTION public.fn_classificar_insumo(
  p_categoria TEXT,
  p_nome      TEXT DEFAULT NULL,
  p_ncm       TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r          RECORD;
  v_ncm      TEXT := regexp_replace(COALESCE(p_ncm, ''), '\D', '', 'g');
  v_cat      TEXT;
  v_origem   TEXT;
  v_conf     TEXT;
BEGIN
  -- NCM é o sinal mais forte que a nota carrega: capítulo fiscal não é
  -- opinião. Cap. 34 = sabões/limpeza; 39 = plásticos (embalagem/descartável);
  -- 48 = papel; 22 = bebidas; 02/03 = carnes e pescados; 07/08 = hortifrúti.
  IF length(v_ncm) >= 2 THEN
    v_cat := CASE substr(v_ncm, 1, 2)
      WHEN '34' THEN 'Limpeza'
      WHEN '39' THEN 'Descartáveis'
      WHEN '48' THEN 'Descartáveis'
      WHEN '22' THEN 'Bebidas'
      WHEN '02' THEN 'Carnes'
      WHEN '03' THEN 'Pescados'
      WHEN '07' THEN 'Hortifrúti'
      WHEN '08' THEN 'Hortifrúti'
      WHEN '04' THEN 'Laticínios'
      WHEN '19' THEN 'Padaria'
      ELSE NULL
    END;
    IF v_cat IS NOT NULL THEN
      v_origem := 'NCM';
      v_conf   := 'alta';
    END IF;
  END IF;

  -- Sem NCM útil: vale a categoria que veio (catálogo ou IA).
  IF v_cat IS NULL AND NULLIF(btrim(COALESCE(p_categoria, '')), '') IS NOT NULL THEN
    SELECT categoria INTO v_cat
      FROM public.classificacao_categorias
     WHERE lower(categoria) = lower(btrim(p_categoria));
    IF v_cat IS NOT NULL THEN
      v_origem := 'CATALOGO';
      v_conf   := 'media';
    END IF;
  END IF;

  -- Nada reconhecido: 'Outros', fora da ficha, confiança baixa. Nasce pedindo
  -- revisão em vez de entrar torto no CMV.
  IF v_cat IS NULL THEN
    v_cat    := 'Outros';
    v_origem := 'REGRA';
    v_conf   := 'baixa';
  END IF;

  SELECT * INTO r FROM public.classificacao_categorias WHERE categoria = v_cat;

  RETURN jsonb_build_object(
    'categoria',           r.categoria,
    'natureza',            r.natureza,
    'tipo_item',           r.tipo_item,
    'entra_ficha_tecnica', r.entra_ficha_tecnica,
    'entra_nutricao',      r.entra_nutricao,
    'origem',              v_origem,
    'confianca',           v_conf
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_classificar_insumo(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_classificar_insumo(TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.fn_classificar_insumo(TEXT, TEXT, TEXT) IS
  'O que o item É, com origem e confiança. NCM (fato fiscal) vence categoria '
  'sugerida; nada reconhecido vira Outros/baixa, fora da ficha técnica.';

-- ── 4. CONSERTA O QUE JÁ ESTÁ TORTO ────────────────────────────────────────
-- Itens cuja categoria diz uma coisa e o tipo_item diz outra. Só mexe em quem
-- NÃO foi revisado por humano — decisão de gente não se atropela.
UPDATE public.insumos i
   SET tipo_item = c.tipo_item,
       classificacao_origem = COALESCE(i.classificacao_origem, 'REGRA'),
       classificacao_confianca = COALESCE(i.classificacao_confianca, 'alta')
  FROM public.classificacao_categorias c
 WHERE lower(i.categoria_insumo) = lower(c.categoria)
   AND i.tipo_item IS DISTINCT FROM c.tipo_item
   AND COALESCE(i.classificacao_revisada, false) = false
   AND COALESCE(i.classificacao_origem, '') <> 'USUARIO';

-- ── 5. ONDE REVISAR ────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.vw_insumos_a_revisar AS
  SELECT i.id, i.loja_id, i.nome, i.categoria_insumo, i.tipo_item,
         i.unidade_medida, i.classificacao_origem, i.classificacao_confianca
    FROM public.insumos i
   WHERE i.ativo
     AND COALESCE(i.classificacao_revisada, false) = false
     AND (i.classificacao_confianca = 'baixa'
          OR i.classificacao_origem = 'IA'
          OR i.categoria_insumo IS NULL
          OR i.tipo_item IS NULL);

COMMENT ON VIEW public.vw_insumos_a_revisar IS
  'Insumos cuja classificação é palpite (IA/baixa confiança) ou está vazia. '
  'É a fila de revisão do lojista — automação serve para poupar digitação, '
  'não para decidir sozinha.';

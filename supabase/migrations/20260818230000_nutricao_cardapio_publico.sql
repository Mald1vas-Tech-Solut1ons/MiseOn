-- Tabela nutricional na vitrine pública.
--
-- O motor de cálculo (fn_calcular_nutricao_receita / fn_recalcular_nutricao_produto)
-- já existia, mas só era alcançável por quem estava logado no painel — o dado
-- nunca chegava a quem decide o pedido. Esta função expõe, para o cardápio
-- público, apenas o resultado consolidado dos produtos ativos da loja.
--
-- Critério de publicação (ADR-02, endurecido): a ficha precisa estar COMPLETA,
-- sem nenhum insumo faltante. A primeira versão liberava com 85% de cobertura,
-- mas cobertura é medida por MASSA — e insumo lançado em unidade (1 pão, 2
-- fatias de queijo) não tem massa conhecida, entra como zero e some do
-- denominador. Na prática, o X-BACON aparecia com 93,6% de cobertura tendo
-- sete dos nove insumos sem dado nenhum, e o valor calórico ignorava o pão e o
-- queijo. Número subestimado é pior que ausência de número: engana quem conta
-- caloria e quem evita ingrediente por questão de saúde.
CREATE OR REPLACE FUNCTION public.fn_nutricao_cardapio(p_loja_id UUID)
RETURNS TABLE (
  produto_id UUID,
  status TEXT,
  cobertura_pct NUMERIC,
  massa_g NUMERIC,
  nutrientes JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id,
         (n->>'status')::TEXT,
         COALESCE((n->>'cobertura_pct')::NUMERIC, 0),
         COALESCE((n->>'massa_g')::NUMERIC, 0),
         COALESCE(n->'nutrientes', '{}'::jsonb)
  FROM   public.produtos p
  CROSS  JOIN LATERAL public.fn_recalcular_nutricao_produto(p.id) AS n
  WHERE  p.loja_id = p_loja_id
    AND  p.disponivel
    AND  (n->>'status') = 'COMPLETO'
    -- Nenhum insumo da ficha pode estar sem dado nutricional.
    AND  COALESCE(jsonb_array_length(n->'insumos_faltantes'), 0) = 0
    AND  COALESCE((n->>'cobertura_pct')::NUMERIC, 0) >= 99
    AND  n->'nutrientes' <> '{}'::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_nutricao_cardapio(UUID) FROM PUBLIC;
-- anon: a vitrine é pública, o cliente não tem login.
GRANT EXECUTE ON FUNCTION public.fn_nutricao_cardapio(UUID) TO anon, authenticated;

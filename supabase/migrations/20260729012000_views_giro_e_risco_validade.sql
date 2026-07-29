-- ============================================================================
-- Estoque — parte 5: as duas leituras que faltavam para comprar com juízo
-- ============================================================================
-- A Central de Compras sugeria repor com base em `estoque_minimo` — um número
-- digitado uma vez e esquecido. Isso ignora a única coisa que importa: a
-- VELOCIDADE com que o item sai. Dois insumos com o mesmo mínimo, um que gira
-- 10 kg/dia e outro 200 g/dia, não têm a mesma urgência.
--
--   vw_insumo_giro    → quanto sai por dia e quantos dias o saldo ainda cobre
--   vw_lotes_validade → o dinheiro que está prestes a virar lixo
--
-- Ambas com security_invoker: herdam a RLS de quem consulta em vez de vazar o
-- estoque de todas as lojas com o privilégio do dono da view.
-- ============================================================================

CREATE VIEW public.vw_insumo_giro
WITH (security_invoker = true) AS
SELECT
  i.id            AS insumo_id,
  i.loja_id,
  i.nome,
  i.unidade_medida,
  i.quantidade_atual,
  i.estoque_minimo,
  i.categoria_insumo,
  COALESCE(m.consumo_30d, 0)                    AS consumo_30d,
  COALESCE(m.consumo_30d, 0) / 30.0             AS consumo_diario,
  -- Dias de autonomia. NULL quando o item não teve saída no período: sem giro
  -- não há previsão honesta a fazer — melhor admitir do que inventar.
  CASE WHEN COALESCE(m.consumo_30d, 0) > 0
       THEN i.quantidade_atual / (m.consumo_30d / 30.0) END AS dias_cobertura,
  COALESCE(m.perda_30d, 0)                      AS perda_30d,
  -- Custo médio ponderado dos lotes VIVOS — o valor real parado na prateleira,
  -- não o preço da última compra.
  COALESCE(l.custo_medio, NULLIF(i.preco_embalagem / NULLIF(i.qtd_embalagem, 0), 0), 0)
                                                AS custo_unitario,
  i.quantidade_atual * COALESCE(l.custo_medio,
    NULLIF(i.preco_embalagem / NULLIF(i.qtd_embalagem, 0), 0), 0) AS capital_parado
FROM public.insumos i
LEFT JOIN (
  SELECT insumo_id,
         SUM(abs(quantidade)) FILTER (WHERE tipo IN ('BAIXA_VENDA', 'SAIDA')) AS consumo_30d,
         SUM(abs(quantidade)) FILTER (WHERE tipo = 'PERDA')                   AS perda_30d
  FROM   public.movimentacoes_estoque
  WHERE  criado_em > now() - INTERVAL '30 days'
  GROUP  BY insumo_id
) m ON m.insumo_id = i.id
LEFT JOIN (
  SELECT insumo_id,
         SUM(quantidade_restante * custo_unitario) / NULLIF(SUM(quantidade_restante), 0) AS custo_medio
  FROM   public.lotes_estoque
  WHERE  quantidade_restante > 0
  GROUP  BY insumo_id
) l ON l.insumo_id = i.id
WHERE i.ativo AND NOT COALESCE(i.is_preparo, false);

-- ─── Risco de validade: perda que ainda dá tempo de evitar ──────────────────
CREATE VIEW public.vw_lotes_validade
WITH (security_invoker = true) AS
SELECT
  le.id            AS lote_id,
  le.loja_id,
  le.insumo_id,
  i.nome           AS insumo_nome,
  i.unidade_medida,
  le.lote_fornecedor,
  le.vence_em,
  (le.vence_em - CURRENT_DATE)                    AS dias_para_vencer,
  le.quantidade_restante,
  le.custo_unitario,
  le.quantidade_restante * le.custo_unitario      AS valor_em_risco,
  CASE
    WHEN le.vence_em < CURRENT_DATE       THEN 'VENCIDO'
    WHEN le.vence_em <= CURRENT_DATE + 3  THEN 'CRITICO'
    WHEN le.vence_em <= CURRENT_DATE + 7  THEN 'ATENCAO'
    ELSE 'OK'
  END AS risco
FROM public.lotes_estoque le
JOIN public.insumos i ON i.id = le.insumo_id
WHERE le.quantidade_restante > 0
  AND le.vence_em IS NOT NULL;

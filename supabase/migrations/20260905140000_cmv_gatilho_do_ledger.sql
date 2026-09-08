-- ============================================================================
-- S1-D — CMV: FONTE AUTORITATIVA E GATILHO DO LEDGER
--
-- O Sprint 1-C reescreveu a FUNÇÃO fn_lancar_custo_estoque com a regra
-- "CMV é consumo definitivo" (quantidade negativa + custo apurado + tipo <>
-- 'SAIDA'). Mas o GATILHO que a invoca continuava com o filtro de 2026-07-21:
--
--     WHEN (NEW.tipo = 'BAIXA_VENDA' AND NEW.pedido_id IS NOT NULL)
--
-- Ou seja: a regra nova nunca era aplicada a PERDA nem a AJUSTE negativo —
-- descarte por validade e quebra de inventário custeada SAÍAM do CMV sem
-- ninguém ver. O ledger da conta 4.1.01 é a FONTE AUTORITATIVA do CMV
-- contábil (é dela que vw_dre_mensal lê); um gatilho que deixa consumo passar
-- faz a autoridade mentir por omissão.
--
-- O gatilho novo espelha a guarda da função: dispara em TODO consumo
-- definitivo. A função continua sendo a última linha de defesa (valida de
-- novo) — o WHEN existe para não pagar o custo de chamada em entradas,
-- que são a maioria das movimentações.
--
-- Comportamento que muda (mensurado, intencional):
--   • PERDA custeada (descarte de lote em EstoquePreparos, PERDA via RPC)
--     passa a gerar CMV. Descartar comida é custar comida.
--   • AJUSTE negativo custeado (fn_ajustar_inventario, contagem física)
--     passa a gerar CMV. Quebra de estoque é custo real do período.
--   • BAIXA_VENDA sem pedido_id passa a gerar CMV (antes era silêncio).
--   • SAIDA (transferência entre insumos) CONTINUA fora — o valor reentra
--     pela ENTRADA do destino; contá-lo duplicaria o DRE.
--   • ENTRADA continua fora — entrada nunca é custo de venda.
--
-- ── Inventário do S1-D: as implementações de custo/CMV e seus papéis ────────
--
--   1. Ledger contábil: fn_lancar_custo_estoque → débito 4.1.01, lido por
--      vw_dre_mensal.cmv.                      → CMV CONTÁBIL (AUTORIDADE).
--      Consumidor no front: NENHUM ainda (a aba DRE do Financeiro é mock).
--   2. vw_custo_produto (20260714185331): ficha técnica × preço de cadastro
--      + rateio de custo fixo. Consumidor: Financeiro (KPI "Lucro estimado"
--      e aba Margens).                          → ESTIMATIVA, rotulada.
--   3. vw_custo_real_estoque: média ponderada dos lotes e desvio vs cadastro.
--      Consumidor: rastreio 3D.                → OBSERVABILIDADE.
--   4. vw_margem_produto_real (20260722000100): ficha × lote PEPS, mas
--      ordena a fila por criado_em — diverge da ordem oficial
--      (ocorrido_em/vence_em/id, 20260831140000). Sem consumidor.
--                                                → MORTA E DIVERGENTE.
--   5. vw_lucro_real_produto (20260721200000): junta ledger por produto com
--      OR em contas (duplica linhas) e referencia_id que nunca casa com o
--      que o trigger grava (pedido_id, não produto_id). Sem consumidor.
--                                                → MORTA E QUEBRADA.
--   6. Motor TS custeio.ts + edge custeio-calcular: preview PEPS. O
--      SimuladorCusto usa o motor LOCAL; o adapter remoto
--      (custeio-service.ts) não tem consumidor no front.
--                                                → PREVIEW (alinhado ao SQL
--      desde 20260905120000).
--   7. vw_insumo_giro: custo médio dos lotes para compras/capital parado.
--                                                → COMPRAS.
--   8. vw_ultimo_custo_insumo: último lote com custo, por ocorrido_em.
--                                                → SUGESTÃO DE PREÇO NA
--      COMPRA (NFCe, variação de preço).
--
-- Uma fonte por papel: custo unitário = lotes/PEPS no SQL; CMV contábil =
-- conta 4.1.01 (este gatilho); estimativa de ficha = cadastro, rotulada.
--
-- Nota de drift: ler pg_get_functiondef/pg_get_triggerdef na produção antes
-- de aplicar (a sessão de 05/09 não teve credenciais de leitura).
-- ============================================================================

DROP TRIGGER IF EXISTS trg_lancar_custo_estoque ON public.movimentacoes_estoque;

CREATE TRIGGER trg_lancar_custo_estoque
  AFTER INSERT ON public.movimentacoes_estoque
  FOR EACH ROW
  -- O espelho exato da guarda de fn_lancar_custo_estoque (20260905120000):
  -- sai do estoque (negativo), custeado (> 0) e não é transferência.
  WHEN (NEW.quantidade < 0 AND COALESCE(NEW.custo_total, 0) > 0 AND NEW.tipo <> 'SAIDA')
  EXECUTE FUNCTION public.fn_lancar_custo_estoque();
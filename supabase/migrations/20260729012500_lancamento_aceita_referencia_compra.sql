-- ============================================================================
-- Compras — parte 6: o razão passa a aceitar a compra como origem
-- ============================================================================
-- `lancamentos_financeiros.referencia_tipo` só admitia origens de VENDA
-- (pedido, pagamento, estorno, cashback, taxa iFood). Fazia sentido enquanto
-- dinheiro só entrava; agora que a compra de insumo gera lançamento
-- (débito Estoque / crédito Fornecedores), 'COMPRA' precisa ser uma origem
-- legítima — sem isso o recebimento inteiro é revertido pelo CHECK.
-- ============================================================================

ALTER TABLE public.lancamentos_financeiros
  DROP CONSTRAINT lancamentos_financeiros_referencia_tipo_check;

ALTER TABLE public.lancamentos_financeiros
  ADD CONSTRAINT lancamentos_financeiros_referencia_tipo_check
  CHECK (referencia_tipo = ANY (ARRAY[
    'PEDIDO', 'PAGAMENTO', 'ESTORNO', 'CASHBACK', 'TAXA_IFOOD',
    'COMPRA',        -- recebimento de mercadoria
    'INVENTARIO',    -- ajuste de contagem física
    'TRANSFORMACAO'  -- monta / desmonta
  ]));

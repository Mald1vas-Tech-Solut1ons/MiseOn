-- Migration: Índices de Desempenho para Pedidos (MiseOn Audit)
-- Data: 2026-08-18
-- Otimização de queries frequentes do painel admin, KDS, iFood e checkout

CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_id ON pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_ifood_order_id ON pedidos(ifood_order_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_loja_criado ON pedidos(loja_id, criado_em DESC);

-- O ifood-webhook grava o pagamento com metodo 'IFOOD' quando o meio nao e PIX
-- nem dinheiro (e tambem quando o pedido vem sem detalhe de pagamento). Mas o
-- enum metodo_pgto era (PIX, CREDITO, DEBITO, DINHEIRO): 'IFOOD' nao existia,
-- o insert falhava com 22P02, e o webhook nao conferia o erro desse insert.
--
-- Conferido em producao antes de aplicar: dos pedidos com origem iFood, ZERO
-- possuiam registro de pagamento. Todo pedido de marketplace entrava sem
-- receita lancada — invisivel no financeiro e na DRE.

alter type metodo_pgto add value if not exists 'IFOOD';

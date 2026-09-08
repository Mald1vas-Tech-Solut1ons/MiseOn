-- ============================================================================
-- SPRINT 9: PEDIDO ONLINE NÃO EXISTE ANTES DE O PAGAMENTO EXISTIR
--
-- Medido no fluxo real: `fn_criar_pedido_completo` cria o pedido como NOVO
-- ANTES de gerar a cobrança Pix ou de tentar o cartão. Resultado: no instante
-- em que o cliente abre a tela de pagamento, o lojista já recebe alerta
-- sonoro e o pedido aparece em "Abertos". Ele aceita um pedido que ainda não
-- foi pago — e, se o cliente desistir ou o cartão for recusado, aquilo vira
-- comida feita para ninguém.
--
-- O estado que faltava é o de carrinho em pagamento. Esta migration só CRIA o
-- valor no enum: o Postgres não deixa usar um valor de enum na mesma
-- transação em que ele foi adicionado, então quem passa a usá-lo é a
-- migration seguinte.
-- ============================================================================

ALTER TYPE public.status_pedido ADD VALUE IF NOT EXISTS 'AGUARDANDO_PAGAMENTO' BEFORE 'NOVO';

-- Quando o iFood recusa o cancelamento DEPOIS de aceitar o pedido de cancelamento
--
-- O /requestCancellation responde 202 e nao decide nada ali: a resposta de
-- verdade chega por evento, minutos depois.
--   CAR  = cancellation requested  (o iFood recebeu o pedido)
--   CARF = cancellation request failed (o iFood recusou)
--   CAN  = cancelado de fato
--
-- Ate agora CAR e CARF caiam no ramo "evento nao tratado" da ifood-webhook:
-- viravam uma linha de log e sumiam. Ou seja, o pior caso era invisivel — a
-- loja marca o pedido como cancelado, o iFood recusa o cancelamento, e o
-- cliente continua esperando uma comida que ninguem vai fazer. Ninguem no
-- balcao tinha como saber.
--
-- Esta coluna guarda essa recusa para a tela poder gritar.
alter table public.pedidos
  add column if not exists ifood_cancelamento_erro text;

comment on column public.pedidos.ifood_cancelamento_erro is
  'Preenchido quando o iFood recusa o cancelamento por evento (CARF). Se tem texto aqui, o pedido pode continuar ativo no app do cliente.';

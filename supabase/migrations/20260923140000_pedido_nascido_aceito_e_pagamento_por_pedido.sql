-- Sprint 20 — fluxo de pedidos íntegro, de ponta a ponta.
--
-- Achado pela varredura supabase/tests/fluxo_pedidos.sql, confirmado contra
-- pg_get_functiondef em produção:
--
-- 1) `fn_trg_status_pedido` só dispara em UPDATE. `fn_pedido_mesa_criar`
--    (mesa/QR/garçom) e `fn_registrar_pesagem_comanda` (balança) inserem o
--    pedido já com status ACEITO — nunca passam pela transição
--    NOVO/AGUARDANDO_PAGAMENTO → ACEITO que baixa o estoque. Como a baixa só
--    dispara nessa transição específica, um pedido nascido em ACEITO nunca
--    baixa estoque, nem quando chega em FINALIZADO depois. Achado real: 7
--    pedidos de mesa/balança em produção com estoque_baixado = false apesar
--    de aceitos e preparados.
--
--    Correção: `trg_pedido_genesis_efeitos`, AFTER INSERT, CONSTRAINT
--    TRIGGER DEFERRABLE INITIALLY DEFERRED (mesmo padrão já usado em
--    `trg_revalidar_desconto_cupom`) — dispara no fim da transação, depois
--    que `itens_pedido` já foi inserido pela função chamadora, e baixa o
--    estoque (e lança receita, se o pedido já nascer FINALIZADO) para quem
--    nasceu além de NOVO/AGUARDANDO_PAGAMENTO. `fn_baixar_estoque` e
--    `fn_lancar_receita_pedido` já são idempotentes — chamar de novo em
--    pedido que passou pelo caminho normal não faz nada.
--
-- 2) `fn_fechar_comanda_buffet` somava o valor de TODOS os pedidos da
--    comanda e gravava um único pagamento no pedido mais recente — os
--    demais pedidos da comanda viravam FINALIZADO sem nenhum registro de
--    pagamento próprio (achado real: pedido #266 nesta comanda). Correção:
--    um pagamento por pedido, cada um pelo próprio valor.

CREATE OR REPLACE FUNCTION public.fn_trg_pedido_genesis_efeitos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_status text;
  v_estoque_baixado boolean;
  v_receita_lancada boolean;
BEGIN
  SELECT status::text, estoque_baixado, receita_lancada
    INTO v_status, v_estoque_baixado, v_receita_lancada
  FROM pedidos WHERE id = NEW.id;

  IF v_status IN ('ACEITO','PREPARANDO','PRONTO','EM_ROTA','FINALIZADO') AND NOT v_estoque_baixado THEN
    PERFORM fn_baixar_estoque(NEW.id);
    UPDATE pedidos SET estoque_baixado = true WHERE id = NEW.id AND NOT estoque_baixado;
  END IF;

  IF v_status = 'FINALIZADO' AND NOT v_receita_lancada THEN
    PERFORM fn_creditar_cashback(NEW.id);
    UPDATE pedidos SET receita_lancada = fn_lancar_receita_pedido(NEW.id) WHERE id = NEW.id;
  END IF;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_pedido_genesis_efeitos ON public.pedidos;
CREATE CONSTRAINT TRIGGER trg_pedido_genesis_efeitos
AFTER INSERT ON public.pedidos
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION fn_trg_pedido_genesis_efeitos();

CREATE OR REPLACE FUNCTION public.fn_fechar_comanda_buffet(p_comanda_id uuid, p_metodo_pagamento metodo_pgto)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_comanda public.comandas%ROWTYPE;
  v_total numeric(10,2);
  v_qtd int;
BEGIN
  IF p_metodo_pagamento NOT IN (
    'PIX'::public.metodo_pgto,
    'CREDITO'::public.metodo_pgto,
    'DEBITO'::public.metodo_pgto,
    'DINHEIRO'::public.metodo_pgto
  ) THEN
    RAISE EXCEPTION 'Método de pagamento inválido para recebimento presencial.';
  END IF;

  SELECT * INTO v_comanda
  FROM public.comandas
  WHERE id = p_comanda_id
  FOR UPDATE;

  IF NOT FOUND OR NOT public.fn_tem_papel(v_comanda.loja_id, ARRAY['admin', 'operador', 'garcom']) THEN
    RAISE EXCEPTION 'Comanda não encontrada ou sem acesso.';
  END IF;
  IF v_comanda.status <> 'ABERTA' OR v_comanda.tipo_comanda <> 'INDIVIDUAL' THEN
    RAISE EXCEPTION 'Esta comanda não é uma conta individual aberta do buffet.';
  END IF;

  SELECT round(coalesce(sum(p.valor_total), 0), 2), count(*)::int
    INTO v_total, v_qtd
  FROM public.pedidos p
  WHERE p.comanda_id = v_comanda.id AND p.status <> 'CANCELADO';

  IF v_qtd IS NULL OR v_qtd = 0 OR v_total <= 0 THEN
    RAISE EXCEPTION 'A comanda não possui consumo para receber.';
  END IF;

  -- Um pagamento por pedido da comanda, cada um pelo próprio valor — não mais
  -- um pagamento só no pedido mais recente carregando a soma da comanda
  -- inteira (isso deixava os demais pedidos FINALIZADO sem nenhum pagamento
  -- registrado). `status NOT IN ('FINALIZADO','CANCELADO')` também torna a
  -- chamada segura para repetir: pedido já pago não recebe pagamento de novo.
  INSERT INTO public.pagamentos (pedido_id, metodo, status, valor_pago, data_pagamento)
  SELECT p.id, p_metodo_pagamento, 'PAGO', p.valor_total, now()
  FROM public.pedidos p
  WHERE p.comanda_id = v_comanda.id
    AND p.status NOT IN ('FINALIZADO', 'CANCELADO')
    AND p.valor_total > 0;

  UPDATE public.pedidos
  SET status = 'FINALIZADO'
  WHERE comanda_id = v_comanda.id
    AND status NOT IN ('FINALIZADO', 'CANCELADO');

  UPDATE public.comandas
  SET status = 'FECHADA', fechada_em = now(), fechada_por = auth.uid(),
      metodo_pagamento = p_metodo_pagamento::text
  WHERE id = v_comanda.id;

  RETURN jsonb_build_object(
    'comanda_id', v_comanda.id,
    'status', 'FECHADA',
    'valor_pago', v_total,
    'metodo_pagamento', p_metodo_pagamento
  );
END;
$function$;

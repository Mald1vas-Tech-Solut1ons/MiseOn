-- O garçom já podia abrir a tela de PDV e lançar itens, mas o fluxo mobile
-- terminava ali: a única RPC atômica de recebimento aceitava só admin/operador.
-- A operação solicitada é pagamento presencial à mesa. Mantemos a autoridade
-- financeira numa única função, registramos o usuário em fechada_por e não
-- damos UPDATE direto em pagamento/pedido/comanda ao navegador.

CREATE OR REPLACE FUNCTION public.fn_fechar_comanda_buffet(
  p_comanda_id uuid,
  p_metodo_pagamento public.metodo_pgto
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_comanda public.comandas%ROWTYPE;
  v_pedido_id uuid;
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

  SELECT p.id INTO v_pedido_id
  FROM public.pedidos p
  WHERE p.comanda_id = v_comanda.id AND p.status <> 'CANCELADO'
  ORDER BY p.criado_em DESC
  LIMIT 1;

  SELECT round(coalesce(sum(p.valor_total), 0), 2), count(*)::int
  INTO v_total, v_qtd
  FROM public.pedidos p
  WHERE p.comanda_id = v_comanda.id AND p.status <> 'CANCELADO';

  IF v_qtd IS NULL OR v_qtd = 0 OR v_total <= 0 OR v_pedido_id IS NULL THEN
    RAISE EXCEPTION 'A comanda não possui consumo para receber.';
  END IF;

  INSERT INTO public.pagamentos (
    pedido_id, metodo, status, valor_pago, data_pagamento
  ) VALUES (
    v_pedido_id, p_metodo_pagamento, 'PAGO', v_total, now()
  );

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

REVOKE ALL ON FUNCTION public.fn_fechar_comanda_buffet(uuid, public.metodo_pgto)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_fechar_comanda_buffet(uuid, public.metodo_pgto)
  TO authenticated;

COMMENT ON FUNCTION public.fn_fechar_comanda_buffet(uuid, public.metodo_pgto) IS
  'Admin, operador ou garçom recebem presencialmente e encerram uma comanda individual do buffet de forma atômica e auditável.';

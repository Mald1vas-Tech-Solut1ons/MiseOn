-- ============================================================================
-- SPRINT 11: COMANDA INDIVIDUAL DO BUFFET TEM CICLO DE VIDA TRANSACIONAL
--
-- A pesagem abre/reutiliza uma conta viva; o caixa encerra a conta somente ao
-- registrar o pagamento. A comanda fechada continua rastreável no histórico,
-- mas deixa de aparecer entre as opções operacionais.
-- ============================================================================

-- Comanda por cartão não pertence obrigatoriamente a uma mesa. O NOT NULL da
-- primeira versão do salão tornava impossível criar a comanda individual que
-- a própria tela da balança oferecia.
ALTER TABLE public.comandas ALTER COLUMN mesa_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_registrar_pesagem_comanda(
  p_loja_id uuid,
  p_comanda_id uuid DEFAULT NULL,
  p_numero_cartao text DEFAULT NULL,
  p_produto_id uuid DEFAULT NULL,
  p_nome_produto text DEFAULT 'Buffet por quilo',
  p_preco_quilo numeric DEFAULT 0,
  p_peso_liquido_kg numeric DEFAULT 0,
  p_tara_g numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_comanda public.comandas%ROWTYPE;
  v_pedido public.pedidos%ROWTYPE;
  v_cartao text := nullif(btrim(p_numero_cartao), '');
  v_total numeric(10,2);
BEGIN
  IF NOT public.fn_tem_papel(p_loja_id, ARRAY['admin', 'operador']) THEN
    RAISE EXCEPTION 'Você não tem acesso operacional à balança desta loja.';
  END IF;
  IF p_peso_liquido_kg <= 0 OR p_preco_quilo < 0 THEN
    RAISE EXCEPTION 'Peso e preço precisam ser válidos.';
  END IF;
  IF p_comanda_id IS NULL AND v_cartao IS NULL THEN
    RAISE EXCEPTION 'Informe uma comanda ou leia o cartão do cliente.';
  END IF;
  IF p_produto_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.produtos p
    WHERE p.id = p_produto_id AND p.loja_id = p_loja_id
  ) THEN
    RAISE EXCEPTION 'Produto por quilo não pertence a esta loja.';
  END IF;

  IF p_comanda_id IS NOT NULL THEN
    SELECT * INTO v_comanda
    FROM public.comandas
    WHERE id = p_comanda_id AND loja_id = p_loja_id AND status = 'ABERTA'
    FOR UPDATE;
  ELSE
    -- Serializa duas leituras simultâneas do mesmo cartão para não abrir duas
    -- contas vivas no caixa e na balança.
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_loja_id::text || ':' || v_cartao, 0));
    SELECT * INTO v_comanda
    FROM public.comandas
    WHERE loja_id = p_loja_id AND numero_cartao = v_cartao AND status = 'ABERTA'
    ORDER BY aberta_em DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      INSERT INTO public.comandas (
        loja_id, mesa_id, status, tipo_comanda, numero_cartao,
        taxa_servico_pct, valor_servico
      ) VALUES (
        p_loja_id, NULL, 'ABERTA', 'INDIVIDUAL', v_cartao, 0, 0
      ) RETURNING * INTO v_comanda;
    END IF;
  END IF;

  IF v_comanda.id IS NULL THEN
    RAISE EXCEPTION 'Comanda aberta não encontrada.';
  END IF;

  SELECT * INTO v_pedido
  FROM public.pedidos
  WHERE comanda_id = v_comanda.id
    AND status NOT IN ('FINALIZADO', 'CANCELADO')
  ORDER BY criado_em DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.pedidos (
      loja_id, comanda_id, tipo_pedido, status, identificador_cliente,
      subtotal, taxa_entrega, desconto, valor_total, origem,
      requer_cozinha, estacao_atual
    ) VALUES (
      p_loja_id, v_comanda.id, 'SALAO', 'ACEITO',
      CASE WHEN v_comanda.numero_cartao IS NOT NULL
        THEN 'Comanda ' || v_comanda.numero_cartao ELSE 'Cliente Buffet' END,
      0, 0, 0, 0, 'balanca', false, 'BALCAO'
    ) RETURNING * INTO v_pedido;
  END IF;

  INSERT INTO public.itens_pedido (
    pedido_id, produto_id, nome_produto, preco_unitario, quantidade,
    origem_balanca, tara_g
  ) VALUES (
    v_pedido.id, p_produto_id, coalesce(nullif(btrim(p_nome_produto), ''), 'Buffet por quilo'),
    p_preco_quilo, p_peso_liquido_kg, true, greatest(p_tara_g, 0)
  );

  SELECT round(coalesce(sum(preco_unitario * quantidade), 0), 2)
  INTO v_total
  FROM public.itens_pedido
  WHERE pedido_id = v_pedido.id;

  UPDATE public.pedidos
  SET subtotal = v_total, valor_total = v_total
  WHERE id = v_pedido.id;

  RETURN jsonb_build_object(
    'comanda_id', v_comanda.id,
    'pedido_id', v_pedido.id,
    'numero_cartao', v_comanda.numero_cartao,
    'valor_total', v_total,
    'status', 'ABERTA'
  );
END;
$function$;

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

  IF NOT FOUND OR NOT public.fn_tem_papel(v_comanda.loja_id, ARRAY['admin', 'operador']) THEN
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

  IF v_qtd IS NULL OR v_total <= 0 THEN
    RAISE EXCEPTION 'A comanda não possui consumo para receber.';
  END IF;

  -- O pagamento existe antes do FINALIZADO para o ledger reconhecer a conta
  -- de entrada correta quando o gatilho de receita for executado.
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

REVOKE ALL ON FUNCTION public.fn_registrar_pesagem_comanda(uuid, uuid, text, uuid, text, numeric, numeric, numeric)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_registrar_pesagem_comanda(uuid, uuid, text, uuid, text, numeric, numeric, numeric)
  TO authenticated;

REVOKE ALL ON FUNCTION public.fn_fechar_comanda_buffet(uuid, public.metodo_pgto)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_fechar_comanda_buffet(uuid, public.metodo_pgto)
  TO authenticated;

COMMENT ON FUNCTION public.fn_registrar_pesagem_comanda(uuid, uuid, text, uuid, text, numeric, numeric, numeric) IS
  'Abre/reutiliza comanda individual e registra pesagem + item + total atomicamente.';
COMMENT ON FUNCTION public.fn_fechar_comanda_buffet(uuid, public.metodo_pgto) IS
  'Recebe e encerra uma comanda individual do buffet atomicamente; o registro fechado permanece auditável.';

-- ============================================================================
-- SPRINT 12: O GARÇOM ENXERGA E ATENDE A COMANDA INDIVIDUAL DO BUFFET
--
-- Até aqui só a balança escrevia na comanda individual (fn_registrar_pesagem_
-- comanda). O cliente senta, come, quer uma bebida ou repetir o prato — e não
-- havia como o garçom lançar esse item sem uma mesa. Duas mudanças:
--
-- 1. fn_lancar_item_avulso_comanda: RPC genérica (mesa OU comanda individual)
--    para o papel 'garcom' lançar item num pedido já aberto.
-- 2. fn_registrar_pesagem_comanda passa a abrir um chamado de atendimento
--    automático quando NASCE uma comanda nova — configurável por loja via
--    lojas.modulos_ativos->>'buffet_aciona_garcom' (ausente = ligado; nem
--    todo buffet quer que o garçom seja acionado a cada prato pesado).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_lancar_item_avulso_comanda(
  p_loja_id uuid,
  p_comanda_id uuid,
  p_produto_id uuid DEFAULT NULL,
  p_nome_produto text DEFAULT NULL,
  p_preco_unitario numeric DEFAULT 0,
  p_quantidade numeric DEFAULT 1,
  p_observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_comanda public.comandas%ROWTYPE;
  v_pedido public.pedidos%ROWTYPE;
  v_nome text := coalesce(nullif(btrim(p_nome_produto), ''), NULL);
  v_total numeric(10,2);
BEGIN
  IF NOT public.fn_tem_papel(p_loja_id, ARRAY['admin', 'operador', 'garcom']) THEN
    RAISE EXCEPTION 'Você não tem acesso operacional a esta loja.';
  END IF;
  IF p_quantidade <= 0 OR p_preco_unitario < 0 THEN
    RAISE EXCEPTION 'Quantidade e preço precisam ser válidos.';
  END IF;

  IF p_produto_id IS NOT NULL THEN
    SELECT p.nome INTO v_nome
    FROM public.produtos p
    WHERE p.id = p_produto_id AND p.loja_id = p_loja_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto não pertence a esta loja.';
    END IF;
  END IF;
  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Informe o produto ou o nome do item.';
  END IF;

  SELECT * INTO v_comanda
  FROM public.comandas
  WHERE id = p_comanda_id AND loja_id = p_loja_id AND status = 'ABERTA'
  FOR UPDATE;

  IF NOT FOUND THEN
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
      0, 0, 0, 0, 'garcom_mobile', false, 'BALCAO'
    ) RETURNING * INTO v_pedido;
  END IF;

  INSERT INTO public.itens_pedido (
    pedido_id, produto_id, nome_produto, preco_unitario, quantidade, observacao
  ) VALUES (
    v_pedido.id, p_produto_id, v_nome, p_preco_unitario, p_quantidade, nullif(btrim(p_observacao), '')
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
    'valor_total', v_total
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_lancar_item_avulso_comanda(uuid, uuid, uuid, text, numeric, numeric, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_lancar_item_avulso_comanda(uuid, uuid, uuid, text, numeric, numeric, text)
  TO authenticated;

COMMENT ON FUNCTION public.fn_lancar_item_avulso_comanda(uuid, uuid, uuid, text, numeric, numeric, text) IS
  'Garçom (ou admin/operador) lança item avulso numa comanda ABERTA (mesa ou individual) sem depender de mesa_id.';

-- ----------------------------------------------------------------------------
-- Chamado automático de atendimento no nascimento da comanda do buffet.
-- ----------------------------------------------------------------------------
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
  v_comanda_nova boolean := false;
  v_aciona_garcom boolean;
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
      v_comanda_nova := true;
    END IF;
  END IF;

  IF v_comanda.id IS NULL THEN
    RAISE EXCEPTION 'Comanda aberta não encontrada.';
  END IF;

  IF v_comanda_nova THEN
    SELECT coalesce((modulos_ativos->>'buffet_aciona_garcom')::boolean, true)
    INTO v_aciona_garcom
    FROM public.lojas
    WHERE id = p_loja_id;

    IF coalesce(v_aciona_garcom, true) THEN
      INSERT INTO public.chamados_garcom (loja_id, comanda_id, tipo, status, mensagem)
      VALUES (p_loja_id, v_comanda.id, 'ATENDIMENTO', 'PENDENTE', 'Comanda de buffet aberta — cliente sentou.');
    END IF;
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

COMMENT ON FUNCTION public.fn_registrar_pesagem_comanda(uuid, uuid, text, uuid, text, numeric, numeric, numeric) IS
  'Abre/reutiliza comanda individual e registra pesagem + item + total atomicamente; dispara chamado de atendimento na 1ª pesagem se a loja não desligou buffet_aciona_garcom.';

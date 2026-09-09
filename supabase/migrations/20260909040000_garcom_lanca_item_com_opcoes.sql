-- ============================================================================
-- SPRINT 14: O MODIFICADOR VIAJA COM O ITEM LANÇADO PELO GARÇOM
--
-- "Ponto da carne" e "gelo e limão" não são texto livre que o garçom digita —
-- são MODIFICADORES do produto, definidos no cardápio (grupos_opcoes/opcoes),
-- com preço, disponibilidade e insumo próprio. Esse modelo já existe e já
-- funciona ponta a ponta:
--   • fn_baixar_estoque baixa o insumo da opção (JOIN opcoes ... insumo_id)
--   • fn_despachar_kds_tickets leva as opções no ticket da estação
--   • KDSEstacao exibe as opções abaixo do item
--
-- O que faltava era o garçom conseguir ESCOLHER: fn_lancar_item_avulso_comanda
-- só aceitava produto + quantidade + observação. Sem isso, a bebida chegava no
-- bar sem "com gelo e limão" e o preparo saía errado ou esquecido.
--
-- p_opcoes recebe [{"id": "<uuid da opcao>"}]. Nome e preço vêm do CATÁLOGO,
-- nunca do cliente — mesma regra de preço do resto do sistema: quem manda é o
-- banco, não o payload.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_lancar_item_avulso_comanda(
  p_loja_id uuid,
  p_comanda_id uuid,
  p_produto_id uuid DEFAULT NULL,
  p_nome_produto text DEFAULT NULL,
  p_preco_unitario numeric DEFAULT 0,
  p_quantidade numeric DEFAULT 1,
  p_observacao text DEFAULT NULL,
  p_opcoes jsonb DEFAULT '[]'::jsonb
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
  v_item_id uuid;
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
    v_pedido.id, p_produto_id, v_nome, p_preco_unitario, p_quantidade,
    nullif(btrim(p_observacao), '')
  ) RETURNING id INTO v_item_id;

  -- Nome e preço do CATÁLOGO. O payload manda só o id da opção; se ele
  -- mandasse preço, o cliente escolheria quanto paga pelo bacon extra.
  -- O JOIN também garante que a opção pertence a um produto DESTA loja.
  INSERT INTO public.itens_pedido_opcoes (item_id, opcao_id, nome_opcao, preco_adicional)
  SELECT v_item_id, o.id, o.nome, o.preco_adicional
  FROM jsonb_array_elements(coalesce(p_opcoes, '[]'::jsonb)) sel
  JOIN public.opcoes o ON o.id = nullif(sel->>'id', '')::uuid
  JOIN public.grupos_opcoes g ON g.id = o.grupo_id
  JOIN public.produtos pr ON pr.id = g.produto_id AND pr.loja_id = p_loja_id;

  SELECT round(coalesce(sum(
    (ip.preco_unitario + coalesce(op.soma, 0)) * ip.quantidade
  ), 0), 2)
  INTO v_total
  FROM public.itens_pedido ip
  LEFT JOIN LATERAL (
    SELECT sum(ipo.preco_adicional) AS soma
    FROM public.itens_pedido_opcoes ipo
    WHERE ipo.item_id = ip.id
  ) op ON true
  WHERE ip.pedido_id = v_pedido.id;

  UPDATE public.pedidos
  SET subtotal = v_total, valor_total = v_total
  WHERE id = v_pedido.id;

  RETURN jsonb_build_object(
    'comanda_id', v_comanda.id,
    'pedido_id', v_pedido.id,
    'item_id', v_item_id,
    'valor_total', v_total
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_lancar_item_avulso_comanda(uuid, uuid, uuid, text, numeric, numeric, text, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_lancar_item_avulso_comanda(uuid, uuid, uuid, text, numeric, numeric, text, jsonb)
  TO authenticated;

COMMENT ON FUNCTION public.fn_lancar_item_avulso_comanda(uuid, uuid, uuid, text, numeric, numeric, text, jsonb) IS
  'Garçom lança item numa comanda ABERTA (mesa ou individual) com observação e modificadores do cardápio. Nome e preço da opção vêm do catálogo, nunca do payload.';

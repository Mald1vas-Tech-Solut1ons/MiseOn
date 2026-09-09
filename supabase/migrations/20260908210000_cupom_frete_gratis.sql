-- ============================================================================
-- SPRINT 13: CUPOM TAMBÉM PODE SER POLÍTICA DE FRETE GRÁTIS
-- ============================================================================

ALTER TABLE public.cupons
  ADD COLUMN IF NOT EXISTS frete_gratis boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS cupons_cliente_idx ON public.cupons(loja_id, cliente_id)
  WHERE cliente_id IS NOT NULL;

DROP FUNCTION IF EXISTS public.fn_validar_cupom(uuid, text, numeric, text);

CREATE FUNCTION public.fn_validar_cupom(
  p_loja_id uuid,
  p_codigo text,
  p_subtotal numeric DEFAULT 0,
  p_metodo text DEFAULT NULL
)
RETURNS TABLE(
  id uuid, codigo text, descricao text, tipo text, valor numeric,
  pedido_minimo numeric, desconto numeric, frete_gratis boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  c record;
  v_cliente uuid;
BEGIN
  SELECT cu.* INTO c
  FROM public.cupons cu
  WHERE cu.loja_id = p_loja_id
    AND upper(btrim(cu.codigo)) = upper(btrim(coalesce(p_codigo, '')));

  IF NOT FOUND THEN RAISE EXCEPTION 'Não encontramos esse cupom nesta loja. Confira o código.'; END IF;

  SELECT cl.id INTO v_cliente FROM public.clientes cl
  WHERE cl.user_id = auth.uid() AND cl.loja_id = p_loja_id;

  IF NOT c.ativo THEN RAISE EXCEPTION 'Este cupom não está mais disponível.'; END IF;
  IF c.validade IS NOT NULL AND c.validade < current_date THEN
    RAISE EXCEPTION 'Este cupom venceu em %.', to_char(c.validade, 'DD/MM/YYYY');
  END IF;
  IF c.limite_usos IS NOT NULL AND coalesce(c.usos, 0) >= c.limite_usos THEN
    RAISE EXCEPTION 'Este cupom já atingiu o limite de usos.';
  END IF;
  IF c.metodo_exigido IS NOT NULL AND p_metodo IS NOT NULL
     AND c.metodo_exigido::text <> p_metodo THEN
    RAISE EXCEPTION 'Este cupom vale só no pagamento por %.',
      CASE c.metodo_exigido::text
        WHEN 'PIX' THEN 'Pix' WHEN 'CREDITO' THEN 'cartão de crédito'
        WHEN 'DEBITO' THEN 'cartão de débito' WHEN 'DINHEIRO' THEN 'dinheiro'
        ELSE c.metodo_exigido::text END;
  END IF;
  IF coalesce(p_subtotal, 0) < coalesce(c.pedido_minimo, 0) THEN
    RAISE EXCEPTION 'Este cupom vale a partir de R$ %.', to_char(c.pedido_minimo, 'FM999G999D00');
  END IF;
  IF c.cliente_id IS NOT NULL AND c.cliente_id IS DISTINCT FROM v_cliente THEN
    RAISE EXCEPTION 'Este cupom foi emitido para outro cliente.';
  END IF;

  IF c.apenas_primeiro_pedido THEN
    IF v_cliente IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.pedidos ant
      WHERE ant.cliente_id = v_cliente AND ant.loja_id = p_loja_id AND ant.status = 'FINALIZADO'
    ) THEN
      RAISE EXCEPTION 'Este cupom é só para a primeira compra.';
    END IF;
  END IF;

  RETURN QUERY SELECT
    c.id, c.codigo, c.descricao, c.tipo::text, c.valor, c.pedido_minimo,
    CASE WHEN c.tipo = 'FIXO'
      THEN least(c.valor, coalesce(p_subtotal, 0))
      ELSE round(coalesce(p_subtotal, 0) * c.valor / 100, 2) END,
    c.frete_gratis;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_validar_cupom(uuid, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_validar_cupom(uuid, text, numeric, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_recalcular_pedido(p_pedido_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_loja uuid; v_cupom uuid; v_taxa numeric; v_cashback numeric;
  v_subtotal numeric := 0; v_desconto numeric := 0; v_total numeric;
  v_metodo text; v_cliente uuid; v_intruso int;
  c record;
BEGIN
  SELECT loja_id, cupom_id, coalesce(taxa_entrega, 0), cliente_id
  INTO v_loja, v_cupom, v_taxa, v_cliente
  FROM public.pedidos WHERE id = p_pedido_id;
  IF v_loja IS NULL THEN RETURN NULL; END IF;

  SELECT count(*) INTO v_intruso
  FROM public.itens_pedido ip
  JOIN public.produtos pr ON pr.id = ip.produto_id
  WHERE ip.pedido_id = p_pedido_id AND pr.loja_id <> v_loja;
  IF v_intruso > 0 THEN RAISE EXCEPTION 'Pedido % contém item de outra loja.', p_pedido_id; END IF;

  SELECT coalesce(sum((coalesce(pr.preco, ip.preco_unitario) + coalesce(op.soma, 0)) * ip.quantidade), 0)
  INTO v_subtotal
  FROM public.itens_pedido ip
  LEFT JOIN public.produtos pr ON pr.id = ip.produto_id AND pr.loja_id = v_loja
  LEFT JOIN LATERAL (
    SELECT sum(coalesce(o.preco_adicional, ipo.preco_adicional)) AS soma
    FROM public.itens_pedido_opcoes ipo
    LEFT JOIN public.opcoes o ON o.id = ipo.opcao_id
    WHERE ipo.item_id = ip.id
  ) op ON true
  WHERE ip.pedido_id = p_pedido_id;

  SELECT metodo::text INTO v_metodo
  FROM public.pagamentos
  WHERE pedido_id = p_pedido_id
  ORDER BY (status = 'PAGO') DESC, data_pagamento DESC NULLS LAST
  LIMIT 1;

  IF v_cupom IS NOT NULL THEN
    SELECT * INTO c FROM public.cupons cu
    WHERE cu.id = v_cupom AND cu.loja_id = v_loja AND cu.ativo
      AND (cu.validade IS NULL OR cu.validade >= current_date)
      AND v_subtotal >= coalesce(cu.pedido_minimo, 0)
      AND (cu.limite_usos IS NULL OR coalesce(cu.usos, 0) < cu.limite_usos)
      AND (cu.metodo_exigido IS NULL OR v_metodo IS NULL OR cu.metodo_exigido::text = v_metodo)
      AND (cu.cliente_id IS NULL OR cu.cliente_id = v_cliente);

    IF FOUND AND c.apenas_primeiro_pedido AND v_cliente IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.pedidos ant
      WHERE ant.cliente_id = v_cliente AND ant.loja_id = v_loja
        AND ant.id <> p_pedido_id AND ant.status = 'FINALIZADO'
    ) THEN c := NULL; END IF;

    IF c.id IS NOT NULL THEN
      v_desconto := CASE WHEN c.tipo = 'FIXO'
        THEN least(c.valor, v_subtotal)
        ELSE round(v_subtotal * c.valor / 100, 2) END;
      IF c.frete_gratis THEN v_taxa := 0; END IF;
    END IF;
  END IF;

  SELECT coalesce(-sum(cm.valor), 0) INTO v_cashback
  FROM public.cashback_movimentos cm
  WHERE cm.pedido_id = p_pedido_id AND cm.tipo = 'USO';

  v_cashback := least(greatest(v_cashback, 0), v_subtotal + v_taxa - v_desconto);
  v_total := greatest(0, v_subtotal + v_taxa - v_desconto - v_cashback);

  UPDATE public.pedidos
  SET subtotal = v_subtotal, taxa_entrega = v_taxa, desconto = v_desconto,
      valor_total = v_total, cashback_usado = v_cashback, atualizado_em = now()
  WHERE id = p_pedido_id;

  RETURN v_total;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_recalcular_pedido(uuid) FROM PUBLIC, anon, authenticated;

COMMENT ON COLUMN public.cupons.frete_gratis IS
  'Quando verdadeiro, zera a taxa calculada por distância após validar todas as demais regras do cupom.';

CREATE OR REPLACE FUNCTION public.fn_distribuir_cupom_cliente(
  p_cupom_id uuid,
  p_cliente_id uuid,
  p_enviar_email boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  c public.cupons%ROWTYPE;
  cl public.clientes%ROWTYPE;
  v_email_fila uuid;
  v_ref uuid;
BEGIN
  SELECT * INTO c FROM public.cupons WHERE id = p_cupom_id;
  SELECT * INTO cl FROM public.clientes WHERE id = p_cliente_id;

  IF c.id IS NULL OR cl.id IS NULL OR c.loja_id <> cl.loja_id
     OR NOT public.fn_sou_admin(c.loja_id) THEN
    RAISE EXCEPTION 'Cupom ou cliente não encontrado para esta loja.';
  END IF;
  IF c.cliente_id IS NOT NULL AND c.cliente_id <> cl.id THEN
    RAISE EXCEPTION 'Este cupom já pertence a outro cliente.';
  END IF;

  -- Referência estável por cupom+cliente: clicar duas vezes não duplica e-mail.
  v_ref := (
    substr(md5(c.id::text || ':' || cl.id::text), 1, 8) || '-' ||
    substr(md5(c.id::text || ':' || cl.id::text), 9, 4) || '-' ||
    substr(md5(c.id::text || ':' || cl.id::text), 13, 4) || '-' ||
    substr(md5(c.id::text || ':' || cl.id::text), 17, 4) || '-' ||
    substr(md5(c.id::text || ':' || cl.id::text), 21, 12)
  )::uuid;

  IF p_enviar_email AND cl.email IS NOT NULL THEN
    v_email_fila := public.fn_email_enfileirar(
      c.loja_id,
      'cupom-disponivel',
      cl.email,
      jsonb_build_object(
        'cliente_nome', cl.nome,
        'codigo', c.codigo,
        'valor_exibicao', CASE WHEN c.frete_gratis THEN 'Frete grátis'
          WHEN c.tipo = 'PERCENTUAL' THEN trim(to_char(c.valor, 'FM999G999D##')) || '% OFF'
          ELSE 'R$ ' || trim(to_char(c.valor, 'FM999G999D00')) END,
        'descricao', c.descricao,
        'pedido_minimo', CASE WHEN c.pedido_minimo > 0 THEN to_char(c.pedido_minimo, 'FM999G999D00') END,
        'validade', CASE WHEN c.validade IS NOT NULL THEN to_char(c.validade, 'DD/MM/YYYY') END
      ),
      v_ref,
      'MARKETING'
    );
  END IF;

  RETURN jsonb_build_object(
    'email_enfileirado', v_email_fila IS NOT NULL,
    'telefone', cl.telefone,
    'email', cl.email,
    'codigo', c.codigo
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_distribuir_cupom_cliente(uuid, uuid, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_distribuir_cupom_cliente(uuid, uuid, boolean)
  TO authenticated;

COMMENT ON COLUMN public.cupons.cliente_id IS
  'Cupom individual de recuperação: só o cliente destinatário pode validá-lo.';

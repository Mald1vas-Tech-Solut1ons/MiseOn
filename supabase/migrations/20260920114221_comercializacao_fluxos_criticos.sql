-- Gates de comercializacao confirmados no teste de usabilidade de 20/09/2026.
-- Mantem preco, recebimento e cancelamento em autoridades transacionais do
-- banco; o navegador apenas envia a intencao e exibe o resultado.

-- A chave torna pagamento parcial repetivel depois de timeout/rede instavel.
ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS idempotencia_chave text;

CREATE UNIQUE INDEX IF NOT EXISTS pagamentos_idempotencia_chave_uidx
  ON public.pagamentos (idempotencia_chave)
  WHERE idempotencia_chave IS NOT NULL;

COMMENT ON COLUMN public.pagamentos.idempotencia_chave IS
  'Chave opaca da tentativa de recebimento presencial; impede pagamento duplicado em retry.';

-- C3: checkout online nasce em AGUARDANDO_PAGAMENTO. A versao anterior so
-- aceitava NOVO, portanto cashback integral marcava o pagamento como PAGO mas
-- deixava o pedido fora da operacao.
CREATE OR REPLACE FUNCTION public.fn_quitar_pedido_cashback(p_pedido_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_total numeric;
  v_cashback numeric;
BEGIN
  SELECT * INTO v_pedido
  FROM public.pedidos p
  WHERE p.id = p_pedido_id
  FOR UPDATE;

  IF NOT FOUND OR v_pedido.cliente_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;

  -- Retry depois da resposta se perder: nao repete pagamento nem baixa.
  IF v_pedido.status = 'ACEITO'
     AND EXISTS (
       SELECT 1 FROM public.pagamentos pg
       WHERE pg.pedido_id = p_pedido_id AND pg.status = 'PAGO'
     ) THEN
    RETURN true;
  END IF;

  IF v_pedido.status NOT IN ('NOVO', 'AGUARDANDO_PAGAMENTO') THEN
    RETURN false;
  END IF;

  v_total := public.fn_recalcular_pedido(p_pedido_id);
  IF v_total IS NULL THEN RETURN false; END IF;

  SELECT coalesce(cashback_usado, 0) INTO v_cashback
  FROM public.pedidos WHERE id = p_pedido_id;

  IF NOT (v_total <= 0 AND v_cashback > 0) THEN
    RETURN false;
  END IF;

  UPDATE public.pagamentos
  SET status = 'PAGO', data_pagamento = coalesce(data_pagamento, now())
  WHERE pedido_id = p_pedido_id AND status = 'PENDENTE';

  IF NOT EXISTS (
    SELECT 1 FROM public.pagamentos
    WHERE pedido_id = p_pedido_id AND status = 'PAGO'
  ) THEN
    RAISE EXCEPTION 'Pagamento por cashback nao encontrado para o pedido.';
  END IF;

  UPDATE public.pedidos
  SET status = 'ACEITO'
  WHERE id = p_pedido_id
    AND status IN ('NOVO', 'AGUARDANDO_PAGAMENTO');

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_quitar_pedido_cashback(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_quitar_pedido_cashback(uuid)
  TO authenticated;

-- C4: o cliente pode desfazer apenas o proprio carrinho ainda nao pago. O
-- lock serializa a disputa com o webhook; cashback debitado volta pelo ledger.
CREATE OR REPLACE FUNCTION public.fn_cancelar_meu_pedido_pendente(p_pedido_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_movimento_cashback numeric := 0;
BEGIN
  SELECT * INTO v_pedido
  FROM public.pedidos p
  WHERE p.id = p_pedido_id
  FOR UPDATE;

  IF NOT FOUND OR v_pedido.cliente_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Pedido nao encontrado ou sem acesso.';
  END IF;

  IF v_pedido.status = 'CANCELADO' THEN
    RETURN jsonb_build_object('pedido_id', v_pedido.id, 'status', 'CANCELADO', 'ja_cancelado', true);
  END IF;
  IF v_pedido.status NOT IN ('NOVO', 'AGUARDANDO_PAGAMENTO') THEN
    RAISE EXCEPTION 'Este pedido ja entrou na operacao e nao pode ser cancelado por este fluxo.';
  END IF;

  PERFORM 1 FROM public.pagamentos
  WHERE pedido_id = p_pedido_id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public.pagamentos
    WHERE pedido_id = p_pedido_id AND status = 'PAGO'
  ) THEN
    RAISE EXCEPTION 'O pagamento ja foi confirmado. Nao cobre novamente; fale com a loja.';
  END IF;

  SELECT coalesce(sum(valor), 0)
  INTO v_movimento_cashback
  FROM public.cashback_movimentos
  WHERE pedido_id = p_pedido_id;

  -- Soma negativa significa que ainda existe debito liquido deste pedido.
  IF v_movimento_cashback < 0 AND v_pedido.cliente_id IS NOT NULL THEN
    INSERT INTO public.cashback_saldos (cliente_id, loja_id, saldo)
    VALUES (v_pedido.cliente_id, v_pedido.loja_id, -v_movimento_cashback)
    ON CONFLICT (cliente_id, loja_id) DO UPDATE
      SET saldo = public.cashback_saldos.saldo - v_movimento_cashback,
          atualizado_em = now();

    INSERT INTO public.cashback_movimentos (
      loja_id, cliente_id, pedido_id, tipo, valor
    ) VALUES (
      v_pedido.loja_id, v_pedido.cliente_id, v_pedido.id,
      'CREDITO', -v_movimento_cashback
    );
  END IF;

  UPDATE public.pagamentos
  SET status = 'CANCELADO'
  WHERE pedido_id = p_pedido_id AND status = 'PENDENTE';

  UPDATE public.pedidos
  SET status = 'CANCELADO',
      motivo_cancelamento = 'Pagamento online nao iniciado ou recusado'
  WHERE id = p_pedido_id;

  RETURN jsonb_build_object(
    'pedido_id', v_pedido.id,
    'status', 'CANCELADO',
    'cashback_devolvido', greatest(-v_movimento_cashback, 0)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_cancelar_meu_pedido_pendente(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_cancelar_meu_pedido_pendente(uuid)
  TO authenticated;

-- C2: um produto compartilhado continua sendo UM item pelo preco integral.
-- Os participantes sao uma regra de rateio, nao copias financeiras do item.
CREATE OR REPLACE FUNCTION public.fn_lancar_item_dividido_comanda(
  p_loja_id uuid,
  p_comanda_id uuid,
  p_produto_id uuid,
  p_quantidade numeric,
  p_observacao text,
  p_participantes integer[],
  p_opcoes jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_capacidade integer;
  v_lancamento jsonb;
  v_item_id uuid;
BEGIN
  IF NOT public.fn_tem_papel(p_loja_id, ARRAY['admin', 'operador', 'garcom']) THEN
    RAISE EXCEPTION 'Voce nao tem acesso operacional a esta loja.';
  END IF;

  SELECT m.capacidade INTO v_capacidade
  FROM public.comandas c
  JOIN public.mesas m ON m.id = c.mesa_id
  WHERE c.id = p_comanda_id
    AND c.loja_id = p_loja_id
    AND c.status = 'ABERTA'
    AND c.tipo_comanda = 'MESA'
  FOR UPDATE OF c;

  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda de mesa aberta nao encontrada.'; END IF;
  IF coalesce(cardinality(p_participantes), 0) = 0 THEN
    RAISE EXCEPTION 'Escolha ao menos um assento.';
  END IF;
  IF cardinality(p_participantes) <> (
    SELECT count(DISTINCT x) FROM unnest(p_participantes) x
  ) OR EXISTS (
    SELECT 1 FROM unnest(p_participantes) x
    WHERE x < 1 OR x > coalesce(v_capacidade, 1)
  ) THEN
    RAISE EXCEPTION 'Assentos repetidos ou fora da capacidade da mesa.';
  END IF;

  -- Chamada com oito argumentos escolhe explicitamente a versao com opcoes.
  v_lancamento := public.fn_lancar_item_avulso_comanda(
    p_loja_id, p_comanda_id, p_produto_id, NULL, 0,
    p_quantidade, p_observacao, coalesce(p_opcoes, '[]'::jsonb)
  );
  v_item_id := nullif(v_lancamento->>'item_id', '')::uuid;
  IF v_item_id IS NULL THEN RAISE EXCEPTION 'Item lancado sem identificador.'; END IF;

  UPDATE public.itens_pedido
  SET participantes_assentos = p_participantes,
      assento_numero = CASE WHEN cardinality(p_participantes) = 1 THEN p_participantes[1] ELSE NULL END,
      fracionado = cardinality(p_participantes) > 1
  WHERE id = v_item_id;

  RETURN v_lancamento || jsonb_build_object('participantes_assentos', p_participantes);
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_lancar_item_dividido_comanda(uuid, uuid, uuid, numeric, text, integer[], jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_lancar_item_dividido_comanda(uuid, uuid, uuid, numeric, text, integer[], jsonb)
  TO authenticated;

-- Persiste o mapa item -> participantes sem tocar em preco ou quantidade. A
-- verificacao final torna a invariancia financeira explicita.
CREATE OR REPLACE FUNCTION public.fn_definir_divisao_itens_comanda(
  p_comanda_id uuid,
  p_divisoes jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_comanda public.comandas%ROWTYPE;
  v_capacidade integer;
  v_divisao jsonb;
  v_item_id uuid;
  v_assentos integer[];
  v_total_antes numeric;
  v_total_depois numeric;
  v_atualizados integer := 0;
BEGIN
  SELECT c.*
  INTO v_comanda
  FROM public.comandas c
  WHERE c.id = p_comanda_id
  FOR UPDATE OF c;

  IF NOT FOUND OR v_comanda.status <> 'ABERTA' OR v_comanda.tipo_comanda <> 'MESA'
     OR NOT public.fn_tem_papel(v_comanda.loja_id, ARRAY['admin', 'operador', 'garcom']) THEN
    RAISE EXCEPTION 'Comanda nao encontrada ou sem acesso.';
  END IF;

  SELECT m.capacidade
  INTO v_capacidade
  FROM public.mesas m
  WHERE m.id = v_comanda.mesa_id;
  IF p_divisoes IS NULL OR jsonb_typeof(p_divisoes) <> 'array'
     OR jsonb_array_length(p_divisoes) = 0 THEN
    RAISE EXCEPTION 'Informe a divisao dos itens.';
  END IF;

  SELECT round(coalesce(sum(i.preco_unitario * i.quantidade), 0), 2)
  INTO v_total_antes
  FROM public.itens_pedido i
  JOIN public.pedidos p ON p.id = i.pedido_id
  WHERE p.comanda_id = p_comanda_id AND p.status <> 'CANCELADO';

  FOR v_divisao IN SELECT value FROM jsonb_array_elements(p_divisoes)
  LOOP
    v_item_id := nullif(v_divisao->>'item_id', '')::uuid;
    SELECT array_agg(DISTINCT x::integer ORDER BY x::integer)
    INTO v_assentos
    FROM jsonb_array_elements_text(coalesce(v_divisao->'assentos', '[]'::jsonb)) x;

    IF v_item_id IS NULL OR coalesce(cardinality(v_assentos), 0) = 0
       OR cardinality(v_assentos) <> jsonb_array_length(coalesce(v_divisao->'assentos', '[]'::jsonb))
       OR EXISTS (
         SELECT 1 FROM unnest(v_assentos) a
         WHERE a < 1 OR a > coalesce(v_capacidade, 1)
       ) THEN
      RAISE EXCEPTION 'Divisao contem item ou assento invalido.';
    END IF;

    UPDATE public.itens_pedido i
    SET participantes_assentos = v_assentos,
        assento_numero = CASE WHEN cardinality(v_assentos) = 1 THEN v_assentos[1] ELSE NULL END,
        fracionado = cardinality(v_assentos) > 1
    FROM public.pedidos p
    WHERE i.id = v_item_id
      AND p.id = i.pedido_id
      AND p.comanda_id = p_comanda_id
      AND p.status <> 'CANCELADO';
    IF NOT FOUND THEN RAISE EXCEPTION 'Item nao pertence a esta comanda.'; END IF;
    v_atualizados := v_atualizados + 1;
  END LOOP;

  SELECT round(coalesce(sum(i.preco_unitario * i.quantidade), 0), 2)
  INTO v_total_depois
  FROM public.itens_pedido i
  JOIN public.pedidos p ON p.id = i.pedido_id
  WHERE p.comanda_id = p_comanda_id AND p.status <> 'CANCELADO';

  IF v_total_depois IS DISTINCT FROM v_total_antes THEN
    RAISE EXCEPTION 'A divisao alterou o valor da comanda e foi revertida.';
  END IF;

  RETURN jsonb_build_object(
    'comanda_id', p_comanda_id,
    'itens_atualizados', v_atualizados,
    'valor_total', v_total_depois
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_definir_divisao_itens_comanda(uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_definir_divisao_itens_comanda(uuid, jsonb)
  TO authenticated;

-- A3/A4: uma unica transacao calcula apenas pagamentos PAGO, registra uma
-- parcela e, quando ela quita o saldo, fecha pedidos + comanda. Qualquer erro
-- reverte tudo; a chave evita duplicacao em retry.
CREATE OR REPLACE FUNCTION public.fn_receber_comanda_mesa(
  p_comanda_id uuid,
  p_metodo_pagamento public.metodo_pgto,
  p_valor_recebido numeric,
  p_taxa_servico_pct numeric,
  p_idempotencia_chave text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_comanda public.comandas%ROWTYPE;
  v_pedido_id uuid;
  v_pagamento_existente public.pagamentos%ROWTYPE;
  v_subtotal numeric(12,2);
  v_servico numeric(12,2);
  v_total numeric(12,2);
  v_pago numeric(12,2);
  v_saldo numeric(12,2);
  v_aplicado numeric(12,2);
  v_fechada boolean := false;
BEGIN
  IF p_metodo_pagamento NOT IN (
    'PIX'::public.metodo_pgto, 'CREDITO'::public.metodo_pgto,
    'DEBITO'::public.metodo_pgto, 'DINHEIRO'::public.metodo_pgto
  ) THEN
    RAISE EXCEPTION 'Metodo de pagamento invalido para recebimento presencial.';
  END IF;
  IF p_valor_recebido IS NULL OR p_valor_recebido <= 0 THEN
    RAISE EXCEPTION 'Informe um valor positivo para o recebimento.';
  END IF;
  IF p_taxa_servico_pct IS NULL OR p_taxa_servico_pct < 0 OR p_taxa_servico_pct > 100 THEN
    RAISE EXCEPTION 'Taxa de servico invalida.';
  END IF;
  IF nullif(btrim(p_idempotencia_chave), '') IS NULL
     OR length(p_idempotencia_chave) > 200 THEN
    RAISE EXCEPTION 'Chave de idempotencia invalida.';
  END IF;

  SELECT * INTO v_comanda
  FROM public.comandas
  WHERE id = p_comanda_id
  FOR UPDATE;

  IF NOT FOUND OR v_comanda.tipo_comanda <> 'MESA'
     OR NOT public.fn_tem_papel(v_comanda.loja_id, ARRAY['admin', 'operador', 'garcom']) THEN
    RAISE EXCEPTION 'Comanda nao encontrada ou sem acesso.';
  END IF;

  SELECT pg.* INTO v_pagamento_existente
  FROM public.pagamentos pg
  JOIN public.pedidos p ON p.id = pg.pedido_id
  WHERE pg.idempotencia_chave = p_idempotencia_chave
    AND p.comanda_id = p_comanda_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'comanda_id', p_comanda_id,
      'pagamento_id', v_pagamento_existente.id,
      'valor_pago', v_pagamento_existente.valor_pago,
      'status', v_comanda.status,
      'idempotente', true
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pagamentos
    WHERE idempotencia_chave = p_idempotencia_chave
  ) THEN
    RAISE EXCEPTION 'Chave de idempotencia ja utilizada em outra comanda.';
  END IF;
  IF v_comanda.status <> 'ABERTA' THEN
    RAISE EXCEPTION 'Esta comanda ja esta fechada.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.pedidos p
    WHERE p.comanda_id = p_comanda_id
      AND p.status IN ('NOVO', 'ACEITO', 'PREPARANDO')
  ) THEN
    RAISE EXCEPTION 'Ainda existe item em preparo nesta comanda.';
  END IF;

  SELECT p.id INTO v_pedido_id
  FROM public.pedidos p
  WHERE p.comanda_id = p_comanda_id AND p.status <> 'CANCELADO'
  ORDER BY p.criado_em DESC
  LIMIT 1
  FOR UPDATE;
  IF v_pedido_id IS NULL THEN RAISE EXCEPTION 'A comanda nao possui consumo.'; END IF;

  SELECT round(coalesce(sum(p.valor_total), 0), 2)
  INTO v_subtotal
  FROM public.pedidos p
  WHERE p.comanda_id = p_comanda_id AND p.status <> 'CANCELADO';

  v_servico := round(v_subtotal * p_taxa_servico_pct / 100, 2);
  v_total := v_subtotal + v_servico;

  SELECT round(coalesce(sum(pg.valor_pago), 0), 2)
  INTO v_pago
  FROM public.pagamentos pg
  JOIN public.pedidos p ON p.id = pg.pedido_id
  WHERE p.comanda_id = p_comanda_id
    AND p.status <> 'CANCELADO'
    AND pg.status = 'PAGO';

  v_saldo := greatest(v_total - v_pago, 0);
  IF v_saldo <= 0.01 THEN RAISE EXCEPTION 'A comanda ja esta integralmente paga.'; END IF;

  v_aplicado := least(round(p_valor_recebido, 2), v_saldo);

  INSERT INTO public.pagamentos (
    pedido_id, metodo, status, valor_pago, data_pagamento, idempotencia_chave
  ) VALUES (
    v_pedido_id, p_metodo_pagamento, 'PAGO', v_aplicado, now(), p_idempotencia_chave
  ) RETURNING * INTO v_pagamento_existente;

  v_saldo := round(v_saldo - v_aplicado, 2);
  v_fechada := v_saldo <= 0.01;

  UPDATE public.comandas
  SET taxa_servico_pct = p_taxa_servico_pct,
      valor_servico = v_servico,
      metodo_pagamento = CASE WHEN v_fechada THEN p_metodo_pagamento::text ELSE metodo_pagamento END,
      status = CASE WHEN v_fechada THEN 'FECHADA' ELSE status END,
      fechada_em = CASE WHEN v_fechada THEN now() ELSE fechada_em END,
      fechada_por = CASE WHEN v_fechada THEN auth.uid() ELSE fechada_por END
  WHERE id = p_comanda_id;

  IF v_fechada THEN
    UPDATE public.pedidos
    SET status = 'FINALIZADO'
    WHERE comanda_id = p_comanda_id
      AND status NOT IN ('FINALIZADO', 'CANCELADO');
  END IF;

  RETURN jsonb_build_object(
    'comanda_id', p_comanda_id,
    'pagamento_id', v_pagamento_existente.id,
    'valor_pago', v_aplicado,
    'troco', greatest(round(p_valor_recebido - v_aplicado, 2), 0),
    'saldo_restante', greatest(v_saldo, 0),
    'status', CASE WHEN v_fechada THEN 'FECHADA' ELSE 'ABERTA' END,
    'idempotente', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_receber_comanda_mesa(uuid, public.metodo_pgto, numeric, numeric, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_receber_comanda_mesa(uuid, public.metodo_pgto, numeric, numeric, text)
  TO authenticated;

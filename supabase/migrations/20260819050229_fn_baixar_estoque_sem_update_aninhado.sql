-- Correção da migration anterior. Eu tinha posto `UPDATE pedidos SET
-- estoque_baixado = true` dentro de fn_baixar_estoque para evitar baixa dupla —
-- mas a função é chamada por fn_trg_status_pedido, que é BEFORE UPDATE em
-- `pedidos`. Atualizar a mesma linha dali derruba a transação com
--   27000: tuple to be updated was already modified by an operation triggered
--          by the current command
-- ou seja, NOVO→ACEITO deixava de funcionar. É exatamente a armadilha que o
-- comentário do estorno em fn_trg_status_pedido já documentava.
--
-- A idempotência agora olha para `movimentacoes_estoque`: se já existe
-- BAIXA_VENDA para o pedido, não baixa de novo. Isso protege contra a baixa
-- dupla sem escrever em `pedidos`, e vale tanto para a chamada direta do PDV
-- quanto para a trigger — sem depender de quem marca a flag.
--
-- A checagem de permissão (o motivo original da mudança) continua.

create or replace function fn_baixar_estoque(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
DECLARE
  v_loja UUID;
  v_saldo NUMERIC(12,4);
  v_nome_insumo TEXT;
  r RECORD;
BEGIN
  SELECT loja_id INTO v_loja FROM pedidos WHERE id = p_pedido_id AND NOT estoque_baixado;
  IF v_loja IS NULL THEN RETURN; END IF;

  -- auth.uid() nulo = chamada interna (trigger de status, pix-webhook com
  -- service role). Com usuário logado, exige vínculo com a loja do pedido:
  -- antes qualquer usuário autenticado desovava o estoque de qualquer loja.
  IF auth.uid() IS NOT NULL AND NOT fn_meu_acesso(v_loja) THEN
    RAISE EXCEPTION 'Sem permissão para movimentar o estoque desta loja.';
  END IF;

  -- Idempotência sem tocar em `pedidos`: se este pedido já gerou baixa, sai.
  IF EXISTS (
    SELECT 1 FROM movimentacoes_estoque
    WHERE pedido_id = p_pedido_id AND tipo = 'BAIXA_VENDA'
  ) THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT ft.insumo_id, SUM(ft.quantidade_consumida * ip.quantidade) AS qtd
    FROM itens_pedido ip
    JOIN produtos p   ON p.id = ip.produto_id AND p.controla_estoque
    JOIN fichas_tecnicas ft ON ft.produto_id = p.id
    WHERE ip.pedido_id = p_pedido_id
    GROUP BY ft.insumo_id
  LOOP
    UPDATE insumos SET quantidade_atual = quantidade_atual - r.qtd WHERE id = r.insumo_id
    RETURNING quantidade_atual, nome INTO v_saldo, v_nome_insumo;

    IF v_saldo < 0 THEN
      RAISE EXCEPTION 'Estoque insuficiente: o insumo "%" ficaria negativo (faltam %). Ajuste o estoque antes de confirmar o pedido.', v_nome_insumo, abs(v_saldo);
    END IF;

    INSERT INTO movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, motivo, pedido_id)
    VALUES (v_loja, r.insumo_id, 'BAIXA_VENDA', -r.qtd, 'Baixa automática por pedido', p_pedido_id);
  END LOOP;

  FOR r IN
    SELECT o.insumo_id, SUM(COALESCE(o.quantidade_insumo,1) * ip.quantidade) AS qtd
    FROM itens_pedido ip
    JOIN itens_pedido_opcoes ipo ON ipo.item_id = ip.id
    JOIN opcoes o ON o.id = ipo.opcao_id AND o.insumo_id IS NOT NULL
    WHERE ip.pedido_id = p_pedido_id
    GROUP BY o.insumo_id
  LOOP
    UPDATE insumos SET quantidade_atual = quantidade_atual - r.qtd WHERE id = r.insumo_id
    RETURNING quantidade_atual, nome INTO v_saldo, v_nome_insumo;

    IF v_saldo < 0 THEN
      RAISE EXCEPTION 'Estoque insuficiente: o insumo "%" ficaria negativo (faltam %) por causa dos adicionais. Ajuste o estoque antes de confirmar o pedido.', v_nome_insumo, abs(v_saldo);
    END IF;

    INSERT INTO movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, motivo, pedido_id)
    VALUES (v_loja, r.insumo_id, 'BAIXA_VENDA', -r.qtd, 'Baixa automática (extras)', p_pedido_id);
  END LOOP;

  UPDATE produtos p SET vendidos = vendidos + CASE WHEN p.tipo_venda = 'POR_PESO' THEN 1 ELSE ip.quantidade END
  FROM itens_pedido ip
  WHERE ip.pedido_id = p_pedido_id AND ip.produto_id = p.id;
END;
$fn$;

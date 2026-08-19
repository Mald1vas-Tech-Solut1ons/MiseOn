-- ═══════════════════════════════════════════════════════════════════════════
-- fn_baixar_estoque estava exposta a QUALQUER usuário logado, sem checagem, e
-- aceita p_pedido_id de qualquer loja. Um cliente comum (ou o operador de uma
-- loja concorrente) podia desovar o estoque alheio chamando ela em série.
--
-- Pior: a função NÃO grava `estoque_baixado` — quem grava é a trigger
-- fn_trg_status_pedido. Chamando direto num pedido ainda NOVO, o estoque baixa
-- uma vez ali e baixa DE NOVO quando a loja aceita o pedido. Baixa dupla e
-- silenciosa, que só apareceria na conferência de inventário.
--
-- Chamadores legítimos:
--   · PDV/balcão — src/lib/pedidos.ts, staff logado com acesso à loja;
--   · trigger de NOVO→ACEITO e pix-webhook — rodam sem auth.uid() (service role).
-- ═══════════════════════════════════════════════════════════════════════════

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
  -- service role). Com usuário logado, exige vínculo com a loja do pedido.
  IF auth.uid() IS NOT NULL AND NOT fn_meu_acesso(v_loja) THEN
    RAISE EXCEPTION 'Sem permissão para movimentar o estoque desta loja.';
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

  -- Marca o pedido como baixado dentro da própria função. Antes só a trigger
  -- marcava, então a chamada direta do PDV deixava a flag falsa e o mesmo
  -- pedido era baixado outra vez no NOVO→ACEITO.
  UPDATE pedidos SET estoque_baixado = true WHERE id = p_pedido_id;

  UPDATE produtos p SET vendidos = vendidos + CASE WHEN p.tipo_venda = 'POR_PESO' THEN 1 ELSE ip.quantidade END
  FROM itens_pedido ip
  WHERE ip.pedido_id = p_pedido_id AND ip.produto_id = p.id;
END;
$fn$;

-- Cache de nutrição: nenhuma chamada no front (grep em src/ = 0), é usada só
-- pelas triggers. Fora do alcance de quem vem pela API pública.
revoke execute on function fn_atualizar_cache_nutricao(uuid) from public, anon, authenticated;

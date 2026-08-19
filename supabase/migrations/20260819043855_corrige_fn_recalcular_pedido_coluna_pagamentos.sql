-- Correção da migration anterior: `pagamentos` não tem coluna `criado_em`
-- (as colunas são id, pedido_id, metodo, status, valor_pago, gateway_txid,
-- data_pagamento). O ORDER BY criado_em fazia fn_recalcular_pedido estourar
-- 42703 — e como Pix e cartão chamam essa função antes de cobrar, os dois
-- ficavam sem conseguir gerar cobrança. Pego pelo teste ponta a ponta.
--
-- Um pedido tem no máximo um pagamento no fluxo atual; onde houver mais de um,
-- o que importa para o cupom é o pagamento efetivo — então preferimos o PAGO
-- mais recente e caímos no pendente quando ainda não há nenhum quitado.

create or replace function fn_recalcular_pedido(p_pedido_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_loja uuid; v_cupom uuid; v_taxa numeric; v_cashback numeric;
  v_subtotal numeric := 0; v_desconto numeric := 0; v_total numeric;
  v_metodo text; v_cliente uuid; v_intruso int;
  c record;
begin
  select loja_id, cupom_id, coalesce(taxa_entrega, 0), cliente_id
    into v_loja, v_cupom, v_taxa, v_cliente
  from pedidos where id = p_pedido_id;
  if v_loja is null then return null; end if;

  -- Item apontando para produto que não é desta loja é adulteração: antes o
  -- join não filtrava por loja e dava para referenciar o item de R$1 de outra
  -- loja pagando por esse preço. Aborta em vez de calcular errado.
  select count(*) into v_intruso
  from itens_pedido ip
  join produtos pr on pr.id = ip.produto_id
  where ip.pedido_id = p_pedido_id and pr.loja_id <> v_loja;
  if v_intruso > 0 then
    raise exception 'Pedido % contém item de outra loja.', p_pedido_id;
  end if;

  -- produto_id nulo é legítimo só na venda por peso (balança), inserida por
  -- staff — a policy de INSERT é quem garante isso. Aqui, quando existe
  -- produto, o preço é SEMPRE o do catálogo; o preco_unitario do cliente só
  -- vale para o item avulso da balança. Mesma regra para as opções.
  select coalesce(sum(
           (coalesce(pr.preco, ip.preco_unitario) + coalesce(op.soma, 0)) * ip.quantidade
         ), 0)
    into v_subtotal
  from itens_pedido ip
  left join produtos pr on pr.id = ip.produto_id and pr.loja_id = v_loja
  left join lateral (
    select sum(coalesce(o.preco_adicional, ipo.preco_adicional)) as soma
    from itens_pedido_opcoes ipo
    left join opcoes o on o.id = ipo.opcao_id
    where ipo.item_id = ip.id
  ) op on true
  where ip.pedido_id = p_pedido_id;

  -- Método de pagamento do pedido (para cupom com metodo_exigido). Só era
  -- checado no browser, em CheckoutDrawer.tsx — ou seja, contornável.
  select metodo::text into v_metodo
  from pagamentos
  where pedido_id = p_pedido_id
  order by (status = 'PAGO') desc, data_pagamento desc nulls last
  limit 1;

  -- ── Cupom: agora com TODAS as regras que a tabela promete ───────────────
  if v_cupom is not null then
    select * into c from cupons
      where id = v_cupom and loja_id = v_loja and ativo
        and (validade is null or validade >= current_date)
        and v_subtotal >= coalesce(pedido_minimo, 0)
        and (limite_usos is null or coalesce(usos, 0) < limite_usos)
        and (metodo_exigido is null or v_metodo is null or metodo_exigido::text = v_metodo);

    if found and c.apenas_primeiro_pedido and v_cliente is not null then
      if exists (
        select 1 from pedidos ant
        where ant.cliente_id = v_cliente
          and ant.loja_id = v_loja
          and ant.id <> p_pedido_id
          and ant.status = 'FINALIZADO'
      ) then
        c := null;
      end if;
    end if;

    if c.id is not null then
      v_desconto := case when c.tipo = 'FIXO'
        then least(c.valor, v_subtotal)
        else round(v_subtotal * c.valor / 100, 2) end;
    end if;
  end if;

  select coalesce(-sum(cm.valor), 0)
    into v_cashback
  from cashback_movimentos cm
  where cm.pedido_id = p_pedido_id and cm.tipo = 'USO';

  v_cashback := least(greatest(v_cashback, 0), v_subtotal + v_taxa - v_desconto);

  v_total := greatest(0, v_subtotal + v_taxa - v_desconto - v_cashback);

  update pedidos
     set subtotal = v_subtotal, desconto = v_desconto, valor_total = v_total,
         cashback_usado = v_cashback,
         atualizado_em = now()
   where id = p_pedido_id;

  return v_total;
end;
$fn$;

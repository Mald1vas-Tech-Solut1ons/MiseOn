-- ============================================================
-- MiseOn — Pedidos de Mesa (Salão/QR/Garçom) com Envio Direto ao KDS
--
-- Corrige a RPC fn_pedido_mesa_criar para que novos pedidos de mesa
-- nasçam com status = 'ACEITO', estacao_atual = 'COZINHA',
-- requer_cozinha = true e etapa_kds_atual = 'etapa_fila'.
-- Isso elimina o engessamento de ter que aprovar manualmente
-- pedidos da mesa no balcão, enviando os pratos direto à cozinha.
-- ============================================================

create or replace function public.fn_pedido_mesa_criar(
  p_loja_id uuid,
  p_mesa_id uuid,
  p_identificador text default null,
  p_observacao text default null,
  p_itens jsonb default '[]'::jsonb
)
returns table (pedido_id uuid, numero int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mesa_numero int;
  v_comanda     uuid;
  v_pedido      uuid;
  v_numero      int;
  v_item        jsonb;
  v_opcao       jsonb;
  v_prod        record;
  v_op          record;
  v_qtd         int;
  v_preco_item  numeric;
  v_subtotal    numeric := 0;
  v_item_id     uuid;
  v_tem_cozinha boolean := false;
  v_estacao     text;
  v_prod_nome   text;
begin
  select m.numero into v_mesa_numero
    from mesas m
   where m.id = p_mesa_id and m.loja_id = p_loja_id and m.ativo;
  if not found then
    raise exception 'Mesa inválida ou inativa para esta loja';
  end if;

  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Pedido sem itens';
  end if;

  for v_item in select value from jsonb_array_elements(p_itens) loop
    select pr.estacao_preparo, pr.nome into v_estacao, v_prod_nome
      from produtos pr
     where pr.id = (v_item->>'produto_id')::uuid;
    
    if (v_estacao is null or v_estacao = 'COZINHA') then
      if coalesce(v_prod_nome, '') not ilike '%coca%' 
         and coalesce(v_prod_nome, '') not ilike '%guarana%' 
         and coalesce(v_prod_nome, '') not ilike '%fanta%' 
         and coalesce(v_prod_nome, '') not ilike '%sprite%' 
         and coalesce(v_prod_nome, '') not ilike '%suco%' 
         and coalesce(v_prod_nome, '') not ilike '%cerveja%' 
         and coalesce(v_prod_nome, '') not ilike '%agua%' 
         and coalesce(v_prod_nome, '') not ilike '%buffet%' 
         and coalesce(v_prod_nome, '') not ilike '%quilo%' then
        v_tem_cozinha := true;
      end if;
    end if;
  end loop;

  insert into pedidos (loja_id, tipo_pedido, origem, comanda_id, mesa_numero,
                       identificador_cliente, subtotal, valor_total, observacao,
                       requer_cozinha, status, estacao_atual, etapa_kds_atual, enviado_cozinha_em)
  values (p_loja_id, 'SALAO', 'mesa', v_comanda, v_mesa_numero,
          coalesce(nullif(trim(coalesce(p_identificador, '')), ''), 'Mesa ' || v_mesa_numero), 0, 0,
          nullif(trim(coalesce(p_observacao, '')), ''),
          v_tem_cozinha, 'ACEITO', case when v_tem_cozinha then 'COZINHA' else 'BALCAO' end,
          case when v_tem_cozinha then 'etapa_fila' else null end,
          case when v_tem_cozinha then now() else null end)
  returning pedidos.id, pedidos.numero into v_pedido, v_numero;

  for v_item in select value from jsonb_array_elements(p_itens) loop
    select pr.id, pr.nome, pr.preco into v_prod
      from produtos pr
     where pr.id = (v_item->>'produto_id')::uuid
       and pr.loja_id = p_loja_id
       and pr.disponivel;
    if not found then
      raise exception 'Produto inválido ou indisponível: %', v_item->>'produto_id';
    end if;

    v_qtd := greatest(1, coalesce((v_item->>'quantidade')::int, 1));
    v_preco_item := v_prod.preco;

    for v_opcao in select value from jsonb_array_elements(coalesce(v_item->'opcoes', '[]'::jsonb)) loop
      select o.id, o.nome, o.preco_adicional into v_op
        from opcoes o
        join grupos_opcoes g on g.id = o.grupo_id
       where o.id = (v_opcao->>'opcao_id')::uuid
         and g.produto_id = v_prod.id;
      if not found then
        raise exception 'Opção inválida para o produto %', v_prod.nome;
      end if;
      v_preco_item := v_preco_item + v_op.preco_adicional;
    end loop;

    insert into itens_pedido (pedido_id, produto_id, nome_produto, preco_unitario, quantidade, observacao)
    values (v_pedido, v_prod.id, v_prod.nome, v_preco_item, v_qtd,
            nullif(trim(coalesce(v_item->>'observacao', '')), ''))
    returning id into v_item_id;

    for v_opcao in select value from jsonb_array_elements(coalesce(v_item->'opcoes', '[]'::jsonb)) loop
      select o.id, o.nome, o.preco_adicional into v_op
        from opcoes o
        join grupos_opcoes g on g.id = o.grupo_id
       where o.id = (v_opcao->>'opcao_id')::uuid
         and g.produto_id = v_prod.id;
      insert into itens_pedido_opcoes (item_id, opcao_id, nome_opcao, preco_adicional)
      values (v_item_id, v_op.id, v_op.nome, v_op.preco_adicional);
    end loop;

    v_subtotal := v_subtotal + v_preco_item * v_qtd;
  end loop;

  update pedidos set subtotal = v_subtotal, valor_total = v_subtotal where id = v_pedido;

  return query select v_pedido, v_numero;
end;
$$;

grant execute on function public.fn_pedido_mesa_criar(uuid, uuid, text, text, jsonb) to anon, authenticated;

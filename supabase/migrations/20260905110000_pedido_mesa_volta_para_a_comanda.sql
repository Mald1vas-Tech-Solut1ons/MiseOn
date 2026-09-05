-- ============================================================================
-- SPRINT 1 (S1-B): PEDIDO DE MESA VIA QR VOLTA PARA A COMANDA
--
-- Problema medido: pedidos de mesa criados pela RPC fn_pedido_mesa_criar
-- nascem com comanda_id NULL. Na reescrita de 20260904000000 (pedido de mesa
-- direto ao KDS com status ACEITO) a linha
--     v_comanda := public.fn_comanda_aberta_mesa(p_loja_id, p_mesa_id);
-- caiu: a variável v_comanda seguiu declarada e usada no INSERT, mas nunca
-- atribuída — gravava NULL em pedidos.comanda_id.
--
-- Evidência da origem: a versão ORIGINAL da RPC
-- (20260722100000_pedido_mesa_via_rpc.sql:63) fazia exatamente essa atribuição.
--
-- Consequência operacional: o pedido do cliente via QR não entra no
-- fechamento da mesa — Mesas.tsx agrega os pedidos da comanda por comanda_id,
-- então a mesa fecha sem cobrar a rodada pedida pelo QR, e a comanda que o
-- garçom vê no PDV não inclui essa rodada. Dinheiro e comanda divergem sem
-- qualquer aviso.
--
-- Correção: restaura APENAS essa linha, reutilizando a MESMA fonte de verdade
-- do PDV/garçom/cliente QR — fn_comanda_aberta_mesa (SECURITY DEFINER), que
-- valida mesa×loja e obtém-ou-cria a comanda ABERTA da mesa. Nada mais muda
-- no corpo da função: nem a heurística de revenda (duplicada e conhecida —
-- backlog, não escopo), nem o status ACEITO/estação COZINHA da 20260904.
--
-- Invariante preservada: um pedido de mesa pertence à comanda aberta da sua
-- mesa, pela mesma regra em TODOS os canais (garçom no PDV e cliente via QR
-- resolvem a comanda pela mesma RPC). Fonte única por conceito.
--
-- Nota: o banco de produção pode ter divergido desta migração (drift não
-- verificável na sessão de 05/09 — credenciais indisponíveis). Antes de
-- qualquer novo reparo nesta função, ler pg_get_functiondef na produção.
-- ============================================================================

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

  -- Comanda da mesa: obtém a ABERTA ou abre uma nova — a MESMA RPC que o
  -- PDV/garçom usam (linha restaurada; caiu na reescrita de 20260904).
  v_comanda := public.fn_comanda_aberta_mesa(p_loja_id, p_mesa_id);

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

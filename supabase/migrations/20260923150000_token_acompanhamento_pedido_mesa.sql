-- Achado N1 do teste de usabilidade simulada (docs/teste-de-usabilidade-
-- simulada.md, 23/09/2026): pedido de mesa/QR nasce sem `cliente_user_id`
-- (quem pede pela mesa não precisa estar logado — só ter o token do QR) e
-- `fn_acompanhar_pedido` exigia `auth.uid()` correspondendo ao dono. Na
-- prática: cliente que pediu pela mesa não tinha NENHUMA forma de
-- acompanhar o próprio pedido, nem no instante em que pediu — o cardápio só
-- mostrava um toast que desaparecia (`Cardapio.tsx`, estado
-- `pedidoMesaSucesso`), sem link nenhum.
--
-- Correção: todo pedido nasce com um segredo próprio (`token_acompanhamento`,
-- não é o id do pedido, não dá para adivinhar). `fn_pedido_mesa_criar` devolve
-- esse token pro cliente que acabou de pedir; `fn_acompanhar_pedido` aceita o
-- token como caminho de acesso alternativo ao login — sem exigir conta.

alter table public.pedidos add column token_acompanhamento uuid not null default gen_random_uuid();

drop function public.fn_pedido_mesa_criar(uuid, uuid, text, text, jsonb, uuid);

CREATE OR REPLACE FUNCTION public.fn_pedido_mesa_criar(p_loja_id uuid, p_mesa_id uuid, p_identificador text DEFAULT NULL::text, p_observacao text DEFAULT NULL::text, p_itens jsonb DEFAULT '[]'::jsonb, p_token uuid DEFAULT NULL::uuid)
 RETURNS TABLE(pedido_id uuid, numero integer, token_acompanhamento uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_mesa_numero int;
  v_comanda     uuid;
  v_pedido      uuid;
  v_numero      int;
  v_token_acompanhamento uuid;
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
  v_da_equipe   boolean;
  v_token_ok    boolean;
  v_recentes    int;
begin
  select m.numero into v_mesa_numero
    from mesas m
   where m.id = p_mesa_id and m.loja_id = p_loja_id and m.ativo;
  if not found then
    raise exception 'Mesa inválida ou inativa para esta loja';
  end if;

  v_da_equipe := public.fn_tem_papel(p_loja_id, array['admin','operador','garcom']);

  if not v_da_equipe then
    select exists (
      select 1 from mesas m where m.id = p_mesa_id and m.token = p_token
    ) into v_token_ok;

    if not v_token_ok then
      raise exception 'Este QR não vale mais para pedir. Chame o garçom.'
        using errcode = '42501';
    end if;

    if not public.fn_loja_aberta(p_loja_id) then
      raise exception 'A loja está fechada no momento.' using errcode = '42501';
    end if;

    select count(*) into v_recentes
      from pedidos p
     where p.mesa_numero = v_mesa_numero
       and p.loja_id = p_loja_id
       and p.criado_em > now() - interval '10 minutes';
    if v_recentes >= 10 then
      raise exception 'Muitos pedidos seguidos nesta mesa. Chame o garçom.'
        using errcode = '42501';
    end if;
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
  returning pedidos.id, pedidos.numero, pedidos.token_acompanhamento into v_pedido, v_numero, v_token_acompanhamento;

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

  return query select v_pedido, v_numero, v_token_acompanhamento;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_pedido_mesa_criar(uuid, uuid, text, text, jsonb, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_acompanhar_pedido(p_id uuid, p_token uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'id',                     p.id,
    'loja_id',                p.loja_id,
    'numero',                 p.numero,
    'senha',                  p.senha,
    'status',                 p.status,
    'tipo_pedido',            p.tipo_pedido,
    'identificador_cliente',  p.identificador_cliente,
    'endereco_entrega',       p.endereco_entrega,
    'bairro',                 p.bairro,
    'complemento',            p.complemento,
    'numero_endereco',        p.numero_endereco,
    'subtotal',               p.subtotal,
    'taxa_entrega',           p.taxa_entrega,
    'desconto',               p.desconto,
    'cashback_usado',         p.cashback_usado,
    'valor_total',            p.valor_total,
    'observacao',             p.observacao,
    'motivo_cancelamento',    p.motivo_cancelamento,
    'agendado_para',          p.agendado_para,
    'mesa_numero',            p.mesa_numero,
    'rota_id',                p.rota_id,
    'criado_em',              p.criado_em,
    'itens_pedido', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',             ip.id,
        'nome_produto',   ip.nome_produto,
        'quantidade',     ip.quantidade,
        'preco_unitario', ip.preco_unitario,
        'observacao',     ip.observacao,
        'itens_pedido_opcoes', coalesce((
          select jsonb_agg(jsonb_build_object(
            'nome_opcao',      ipo.nome_opcao,
            'preco_adicional', ipo.preco_adicional
          ))
          from public.itens_pedido_opcoes ipo
          where ipo.item_id = ip.id
        ), '[]'::jsonb)
      ))
      from public.itens_pedido ip
      where ip.pedido_id = p.id
    ), '[]'::jsonb),
    'pagamentos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'metodo', pg.metodo,
        'status', pg.status,
        'valor_pago', pg.valor_pago
      ))
      from public.pagamentos pg
      where pg.pedido_id = p.id
    ), '[]'::jsonb)
  )
  from public.pedidos p
  where p.id = p_id
    and (
      (p_token is not null and p.token_acompanhamento = p_token)
      or (
        auth.uid() is not null
        and (
          p.cliente_user_id = auth.uid()
          or public.fn_meu_acesso(p.loja_id)
        )
      )
    );
$function$;

GRANT EXECUTE ON FUNCTION public.fn_acompanhar_pedido(uuid, uuid) TO anon, authenticated;

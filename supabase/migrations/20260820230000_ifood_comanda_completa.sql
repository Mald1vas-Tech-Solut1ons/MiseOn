-- A comanda do iFood chegava pela metade
--
-- O `fn_ifood_criar_pedido` lia sete campos do payload e jogava fora o resto.
-- O que se perdia, e o que isso custava:
--
--   endereco de entrega  -> o cartao do Painel mostrava o endereco em branco.
--                           Entrega propria sem endereco e entrega que nao sai.
--   phone.localizer      -> e o codigo que conclui o pedido no iFood
--                           (verifyDeliveryCode). Sem ele, nao ha etapa 5.
--   delivery.pickupCode  -> codigo que o entregador do iFood informa na coleta.
--   card.brand           -> criterio de homologacao: exibir a bandeira do cartao.
--   cash.changeFor       -> criterio: calcular o troco corretamente.
--   benefits             -> criterio: exibir o cupom E quem arca com ele.
--   customer.documentNumber -> criterio: exibir CPF/CNPJ para a nota.
--   delivery.observations   -> criterio: exibir observacoes de entrega.
--   items[].options      -> os complementos do item sumiam da comanda. A cozinha
--                           montava o lanche sem os adicionais que o cliente
--                           pediu e pagou.
--   schedule             -> pedido agendado entrava como imediato.
--
-- Havia ainda um campo lido de um caminho que NAO EXISTE no contrato do iFood:
-- `total.discounts`. O correto e `total.benefits`. Resultado: a coluna desconto
-- ficava zerada em todo pedido do marketplace, e o valor do cupom sumia do
-- financeiro.
--
-- As colunas de despacho e validacao (ifood_despachado_em,
-- ifood_entrega_validada_em) fecham o mesmo padrao ja usado no cancelamento:
-- carimbo do que ja foi acertado com o iFood, para o gatilho nao repetir a
-- chamada e para a tela saber o que aconteceu.

alter table public.pedidos
  add column if not exists ponto_referencia          text,
  add column if not exists observacao_entrega        text,
  add column if not exists documento_cliente         text,
  add column if not exists ifood_localizador         text,
  add column if not exists ifood_codigo_coleta       text,
  add column if not exists ifood_entregue_por        text,
  add column if not exists ifood_cartao_bandeira     text,
  add column if not exists ifood_beneficios          jsonb,
  add column if not exists ifood_taxas_adicionais    numeric,
  add column if not exists ifood_info_extra          text,
  add column if not exists ifood_despachado_em       timestamptz,
  add column if not exists ifood_entrega_validada_em timestamptz;

comment on column public.pedidos.ifood_localizador is
  'customer.phone.localizer — codigo usado no verifyDeliveryCode para concluir o pedido na entrega propria.';
comment on column public.pedidos.ifood_codigo_coleta is
  'delivery.pickupCode — codigo que o entregador do iFood apresenta na coleta (validatePickupCode).';
comment on column public.pedidos.ifood_entregue_por is
  'delivery.deliveredBy: MERCHANT (entrega propria, exige /dispatch) ou IFOOD (logistica deles).';
comment on column public.pedidos.ifood_beneficios is
  'benefits[] do pedido: valor do cupom, onde se aplica e quem patrocina (IFOOD/MERCHANT/EXTERNAL/CHAIN).';
comment on column public.pedidos.ifood_despachado_em is
  'Quando o /dispatch foi aceito pelo iFood. Preenchido, impede o gatilho de despachar de novo.';
comment on column public.pedidos.ifood_entrega_validada_em is
  'Quando o codigo de entrega/retirada foi validado no iFood e o pedido foi concluido.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Criacao do pedido, agora com a comanda inteira
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.fn_ifood_criar_pedido(p_order_id text, p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_loja_id   uuid;
  v_loja_nome text;
  v_pct       numeric;
  v_fixa      numeric;
  v_cliente   uuid;
  v_tel       text;
  v_pedido    uuid;
  v_numero    integer;
  v_bruto     numeric;
  v_taxa      numeric;
  v_delivery  boolean;
  v_item      jsonb;
  v_opcao     jsonb;
  v_prod      uuid;
  v_item_id   uuid;
  v_pag       jsonb;
  v_ja        uuid;
  v_itens     integer := 0;
  v_pagtos    integer := 0;
  v_end       jsonb;
  v_bandeira  text;
  v_troco     numeric;
  v_agendado  timestamptz;
begin
  if p_order_id is null or btrim(p_order_id) = '' then
    raise exception 'orderId do iFood ausente.';
  end if;

  -- ── Loja pelo merchant do iFood ──────────────────────────────────────────
  select id, nome, coalesce(ifood_taxa_pct, 0), coalesce(ifood_taxa_fixa, 0)
    into v_loja_id, v_loja_nome, v_pct, v_fixa
  from lojas
  where ifood_merchant_id = p_order#>>'{merchant,id}';

  if v_loja_id is null then
    return jsonb_build_object('status', 'loja_nao_encontrada',
                              'merchant', p_order#>>'{merchant,id}');
  end if;

  -- ── Idempotência ─────────────────────────────────────────────────────────
  select id into v_ja from pedidos where ifood_order_id = p_order_id;
  if v_ja is not null then
    return jsonb_build_object('status', 'ja_existe', 'pedido_id', v_ja);
  end if;

  -- ── Cliente (mesma regra de telefone do webhook, agora no servidor) ──────
  v_tel := regexp_replace(coalesce(p_order#>>'{customer,phone,number}', ''), '\D', '', 'g');
  if v_tel = '' or v_tel !~ '^[1-9]{2}9?[0-9]{8}$' then
    v_tel := 'IFOOD_' || coalesce(
      nullif(p_order#>>'{customer,id}', ''),
      nullif(p_order->>'displayId', ''),
      p_order_id
    );
  end if;

  select id into v_cliente from clientes where loja_id = v_loja_id and telefone = v_tel;
  if v_cliente is null then
    insert into clientes (loja_id, nome, telefone)
    values (v_loja_id, coalesce(nullif(p_order#>>'{customer,name}', ''), 'Cliente iFood'), v_tel)
    returning id into v_cliente;
  end if;

  -- ── Repasse ──────────────────────────────────────────────────────────────
  v_bruto    := coalesce((p_order#>>'{total,orderAmount}')::numeric, 0);
  v_taxa     := (v_bruto * v_pct / 100) + v_fixa;
  v_delivery := coalesce(p_order->>'orderType', '') = 'DELIVERY';
  v_end      := p_order#>'{delivery,deliveryAddress}';

  -- Bandeira e troco: varrem os metodos e ficam com o primeiro que trouxer o
  -- dado. Pedido com pagamento dividido (parte online, parte na entrega) traz
  -- os dois em metodos diferentes — e quem esta no balcao precisa dos dois.
  select m->'card'->>'brand' into v_bandeira
  from jsonb_array_elements(coalesce(p_order#>'{payments,methods}', '[]'::jsonb)) m
  where nullif(m->'card'->>'brand', '') is not null
  limit 1;

  select (m->'cash'->>'changeFor')::numeric into v_troco
  from jsonb_array_elements(coalesce(p_order#>'{payments,methods}', '[]'::jsonb)) m
  where nullif(m->'cash'->>'changeFor', '') is not null
  limit 1;

  -- Agendamento: so quando o iFood diz que o pedido E agendado. O bloco
  -- `schedule` aparece tambem em pedido imediato (com a janela de entrega
  -- prevista); usar so a presenca dele jogaria todo pedido para a fila de
  -- agendados e o balcao nao veria o pedido chegar.
  if coalesce(p_order->>'orderTiming', '') = 'SCHEDULED' then
    v_agendado := nullif(p_order#>>'{schedule,deliveryDateTimeStart}', '')::timestamptz;
  end if;

  -- ── Pedido ───────────────────────────────────────────────────────────────
  insert into pedidos (
    loja_id, cliente_id, status, origem, tipo_pedido,
    subtotal, taxa_entrega, desconto, valor_total,
    observacao, numero, identificador_cliente,
    ifood_order_id, valor_bruto_ifood, taxa_ifood_retida,
    telefone_contato, endereco_entrega, logradouro, numero_endereco,
    complemento, bairro, cep, cidade, uf, lat, lng, ponto_referencia,
    observacao_entrega, documento_cliente, troco_para, agendado_para,
    ifood_localizador, ifood_codigo_coleta, ifood_entregue_por,
    ifood_cartao_bandeira, ifood_beneficios, ifood_taxas_adicionais,
    ifood_info_extra
  ) values (
    v_loja_id, v_cliente, 'NOVO'::status_pedido, 'ifood',
    case when v_delivery then 'DELIVERY' else 'RETIRADA_BALCAO' end::tipo_pedido,
    coalesce((p_order#>>'{total,subTotal}')::numeric, 0),
    coalesce((p_order#>>'{total,deliveryFee}')::numeric, 0),
    -- `total.benefits`, nao `total.discounts`: o segundo nao existe no contrato
    -- do iFood e deixava o desconto zerado em todo pedido.
    coalesce((p_order#>>'{total,benefits}')::numeric, 0),
    v_bruto,
    nullif(p_order->>'observations', ''),
    -- displayId e o numero que o cliente ve no app do iFood. Se vier vazio ou
    -- nao numerico, cai na numeracao da propria loja em vez de gravar 0.
    case when coalesce(p_order->>'displayId', '') ~ '^[0-9]+$'
         then (p_order->>'displayId')::integer
         else fn_proximo_numero(v_loja_id) end,
    coalesce(nullif(p_order#>>'{customer,name}', ''), 'iFood'),
    p_order_id, v_bruto, v_taxa,
    nullif(p_order#>>'{customer,phone,number}', ''),
    nullif(v_end->>'formattedAddress', ''),
    nullif(v_end->>'streetName', ''),
    nullif(v_end->>'streetNumber', ''),
    nullif(v_end->>'complement', ''),
    nullif(v_end->>'neighborhood', ''),
    nullif(v_end->>'postalCode', ''),
    nullif(v_end->>'city', ''),
    nullif(v_end->>'state', ''),
    nullif(v_end#>>'{coordinates,latitude}', '')::numeric,
    nullif(v_end#>>'{coordinates,longitude}', '')::numeric,
    nullif(v_end->>'reference', ''),
    -- Entrega e retirada guardam a observacao em lugares diferentes.
    coalesce(nullif(p_order#>>'{delivery,observations}', ''),
             nullif(p_order#>>'{takeout,observations}', '')),
    nullif(p_order#>>'{customer,documentNumber}', ''),
    v_troco,
    v_agendado,
    nullif(p_order#>>'{customer,phone,localizer}', ''),
    nullif(p_order#>>'{delivery,pickupCode}', ''),
    nullif(p_order#>>'{delivery,deliveredBy}', ''),
    v_bandeira,
    nullif(p_order->'benefits', 'null'::jsonb),
    nullif(p_order#>>'{total,additionalFees}', '')::numeric,
    nullif(p_order->>'extraInfo', '')
  )
  returning id, numero into v_pedido, v_numero;

  -- ── Itens: casa pelo pdv_code, e falha alto se o insert nao passar ───────
  for v_item in select * from jsonb_array_elements(coalesce(p_order->'items', '[]'::jsonb))
  loop
    select id into v_prod
    from produtos
    where loja_id = v_loja_id and pdv_code = v_item->>'externalCode'
    limit 1;

    insert into itens_pedido (pedido_id, produto_id, nome_produto, preco_unitario, quantidade, observacao)
    values (
      v_pedido, v_prod,
      coalesce(nullif(v_item->>'name', ''), 'Item iFood'),
      coalesce((v_item->>'unitPrice')::numeric, 0),
      coalesce((v_item->>'quantity')::numeric, 1),
      nullif(v_item->>'observations', '')
    )
    returning id into v_item_id;
    v_itens := v_itens + 1;

    -- Complementos. `opcao_id` fica nulo de proposito: a opcao existe no
    -- catalogo do iFood, nao no nosso — o nome e o preco sao o que a cozinha
    -- precisa ler. Sem isto, o lanche saia sem os adicionais que o cliente
    -- pediu e pagou.
    for v_opcao in select * from jsonb_array_elements(coalesce(v_item->'options', '[]'::jsonb))
    loop
      insert into itens_pedido_opcoes (item_id, opcao_id, nome_opcao, preco_adicional)
      values (
        v_item_id, null,
        coalesce(nullif(v_opcao->>'name', ''), 'Complemento'),
        greatest(coalesce((v_opcao->>'price')::numeric, 0), 0)
      );
    end loop;
  end loop;

  -- ── Pagamentos ───────────────────────────────────────────────────────────
  for v_pag in select * from jsonb_array_elements(coalesce(p_order#>'{payments,methods}', '[]'::jsonb))
  loop
    insert into pagamentos (pedido_id, metodo, valor_pago, status, data_pagamento)
    values (
      v_pedido,
      (case v_pag->>'method'
         when 'PIX'  then 'PIX'
         when 'CASH' then 'DINHEIRO'
         else 'IFOOD'
       end)::metodo_pgto,
      coalesce((v_pag->>'value')::numeric, 0),
      -- `type` = ONLINE quer dizer que o iFood ja recebeu; OFFLINE e para
      -- cobrar na entrega. O campo `prepaid` lido antes nem existe no metodo:
      -- ele mora em payments.prepaid, entao TODO pagamento entrava PENDENTE.
      (case when coalesce(v_pag->>'type', '') = 'ONLINE' then 'PAGO' else 'PENDENTE' end)::status_pgto,
      case when coalesce(v_pag->>'type', '') = 'ONLINE' then now() else null end
    );
    v_pagtos := v_pagtos + 1;
  end loop;

  -- Pedido sem detalhe de pagamento: o iFood ja recebeu do cliente.
  if v_pagtos = 0 then
    insert into pagamentos (pedido_id, metodo, valor_pago, status, data_pagamento)
    values (v_pedido, 'IFOOD'::metodo_pgto, v_bruto, 'PAGO'::status_pgto, now());
    v_pagtos := 1;
  end if;

  return jsonb_build_object(
    'status', 'criado',
    'loja', v_loja_nome,
    'pedido_id', v_pedido,
    'numero', v_numero,
    'itens', v_itens,
    'pagamentos', v_pagtos
  );
end;
$fn$;

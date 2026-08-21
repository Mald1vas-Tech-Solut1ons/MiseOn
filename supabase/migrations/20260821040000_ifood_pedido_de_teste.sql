-- Pedido de teste do iFood contava como faturamento
--
-- A aba "Pedidos iFood" mostrava, na loja de demonstracao:
--
--   Bruto (30 dias)    R$ 513,00
--   Liquido estimado   R$ 494,19
--
-- Medido no banco: dos 19 pedidos somados, 16 estavam CANCELADOS (R$ 432,00) e
-- os 19 eram pedidos de TESTE, gerados pelo wizard de homologacao. Ou seja,
-- 84% do numero era pedido cancelado e 100% era dinheiro que nunca existiu.
--
-- Sao dois defeitos somados, e um deles nao se resolve so na tela:
--
--   1. o total nao filtrava status — corrigido em Ifood.tsx;
--   2. o payload do iFood traz `isTest: true` e a gente descartava o campo,
--      entao nao havia como distinguir pedido de homologacao de venda real.
--      Sem isso, todo pedido de teste que o lojista gerar para conferir a
--      integracao entra no faturamento dele para sempre.
--
-- Numero errado sobre dinheiro nao e detalhe de tela: se o faturamento mente,
-- o lojista para de acreditar no resto do sistema — com razao.

alter table public.pedidos
  add column if not exists ifood_pedido_teste boolean not null default false;

comment on column public.pedidos.ifood_pedido_teste is
  'isTest do payload do iFood: pedido gerado para homologacao/conferencia. Nunca entra em faturamento.';

-- Indice parcial: as consultas de faturamento excluem estes, e eles sao poucos.
create index if not exists idx_pedidos_ifood_teste
  on public.pedidos (loja_id)
  where ifood_pedido_teste;

-- ── Backfill ────────────────────────────────────────────────────────────────
-- Os 19 pedidos que ja estao no banco vieram todos do wizard e trazem os itens
-- do catalogo de teste do iFood ("PRODUTO 1 - NAO ENTREGAR"). Conferido antes
-- de rodar: 19 de 19 batem com esse criterio, nenhum pedido real e afetado.
update public.pedidos p
   set ifood_pedido_teste = true
 where p.origem = 'ifood'
   and not p.ifood_pedido_teste
   and exists (
     select 1 from public.itens_pedido i
      where i.pedido_id = p.id
        and i.nome_produto ilike '%NÃO ENTREGAR%'
   );

-- ── Passa a gravar o campo ──────────────────────────────────────────────────
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
  v_teste     boolean;
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

  -- Pedido gerado pelo wizard de homologacao ou pelo "gerar pedido de teste"
  -- do Portal. Entra no painel para o lojista conferir a operacao, mas fica
  -- fora de qualquer soma de dinheiro.
  v_teste := coalesce((p_order->>'isTest')::boolean, false);

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
    ifood_info_extra, ifood_pedido_teste
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
    nullif(p_order->>'extraInfo', ''),
    v_teste
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
    'pagamentos', v_pagtos,
    'teste', v_teste
  );
end;
$fn$;

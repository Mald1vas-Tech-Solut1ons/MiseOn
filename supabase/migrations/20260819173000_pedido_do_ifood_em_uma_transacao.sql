-- ═══════════════════════════════════════════════════════════════════════════
-- Pedido vindo do iFood em UMA transação — e o conserto de um defeito que
-- estava zerando o financeiro do marketplace.
--
-- 1) O DEFEITO DO PAGAMENTO
--
-- O webhook gravava o pagamento assim:
--     metodo: m.method === 'PIX' ? 'PIX' : m.method === 'CASH' ? 'DINHEIRO' : 'IFOOD'
-- e, quando o pedido vinha sem `payments.methods`, gravava 'IFOOD' direto.
--
-- Só que o enum metodo_pgto era (PIX, CREDITO, DEBITO, DINHEIRO). 'IFOOD' não
-- existia. O insert falhava com 22P02 — e o webhook não conferia o erro desse
-- insert, então a falha era descartada. Conferido em produção antes de mexer:
-- dos pedidos com origem iFood, ZERO tinham registro de pagamento. Não é risco
-- teórico; já aconteceu em 100% deles. Pedido do iFood entrava sem pagamento,
-- logo sem receita no fluxo financeiro e sem aparecer na DRE.
--
-- O valor 'IFOOD' foi adicionado ao enum na migration anterior a esta.
--
-- 2) A TRANSAÇÃO
--
-- Mesmo defeito estrutural do CheckoutDrawer, corrigido em
-- 20260819162313: cliente, pedido, laço de itens e pagamentos eram quatro
-- escritas sequenciais soltas. Timeout da Edge Function ou queda no meio deixa
-- pedido sem item — e aqui é pior que no checkout, porque logo depois o
-- webhook chama confirmOrder() e diz ao iFood que aceitou um pedido que o
-- banco guardou pela metade.
--
-- Agora tudo nasce junto ou não nasce. O confirmOrder() continua FORA e DEPOIS
-- desta função, que é a ordem certa: só se confirma ao marketplace o que já
-- está seguro no banco.
--
-- 3) ITENS QUE SUMIAM CALADOS
--
-- O laço de itens também ignorava o retorno do insert. Item que falhasse saía
-- do pedido sem aviso. Aqui, qualquer item que falhe aborta a transação inteira.
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
  v_prod      uuid;
  v_pag       jsonb;
  v_ja        uuid;
  v_itens     integer := 0;
  v_pagtos    integer := 0;
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

  -- ── Pedido ───────────────────────────────────────────────────────────────
  insert into pedidos (
    loja_id, cliente_id, status, origem, tipo_pedido,
    subtotal, taxa_entrega, desconto, valor_total,
    observacao, numero, identificador_cliente,
    ifood_order_id, valor_bruto_ifood, taxa_ifood_retida
  ) values (
    v_loja_id, v_cliente, 'NOVO'::status_pedido, 'ifood',
    case when v_delivery then 'DELIVERY' else 'RETIRADA_BALCAO' end::tipo_pedido,
    coalesce((p_order#>>'{total,subTotal}')::numeric, 0),
    coalesce((p_order#>>'{total,deliveryFee}')::numeric, 0),
    coalesce((p_order#>>'{total,discounts}')::numeric, 0),
    v_bruto,
    nullif(p_order->>'observations', ''),
    -- displayId e o numero que o cliente ve no app do iFood. Se vier vazio ou
    -- nao numerico, cai na numeracao da propria loja em vez de gravar 0.
    case when coalesce(p_order->>'displayId', '') ~ '^[0-9]+$'
         then (p_order->>'displayId')::integer
         else fn_proximo_numero(v_loja_id) end,
    coalesce(nullif(p_order#>>'{customer,name}', ''), 'iFood'),
    p_order_id, v_bruto, v_taxa
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
    );
    v_itens := v_itens + 1;
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
      (case when coalesce((v_pag->>'prepaid')::boolean, false) then 'PAGO' else 'PENDENTE' end)::status_pgto,
      case when coalesce((v_pag->>'prepaid')::boolean, false) then now() else null end
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
    'status', 'criado', 'pedido_id', v_pedido, 'numero', v_numero,
    'itens', v_itens, 'pagamentos', v_pagtos, 'loja', v_loja_nome
  );

exception
  -- Dois eventos PLC do mesmo pedido chegando juntos: o indice unico de
  -- ifood_order_id decide, e o perdedor devolve "ja_existe" em vez de estourar.
  when unique_violation then
    select id into v_ja from pedidos where ifood_order_id = p_order_id;
    return jsonb_build_object('status', 'ja_existe', 'pedido_id', v_ja);
end;
$fn$;

comment on function public.fn_ifood_criar_pedido(text, jsonb) is
  'Cria o pedido do iFood (cliente, pedido, itens e pagamentos) numa unica transacao. Substitui as quatro escritas sequenciais do ifood-webhook. confirmOrder() no iFood deve ser chamado DEPOIS desta funcao retornar.';

-- Quem chama e a Edge Function com service_role.
revoke all on function public.fn_ifood_criar_pedido(text, jsonb) from public, anon, authenticated;
grant execute on function public.fn_ifood_criar_pedido(text, jsonb) to service_role;

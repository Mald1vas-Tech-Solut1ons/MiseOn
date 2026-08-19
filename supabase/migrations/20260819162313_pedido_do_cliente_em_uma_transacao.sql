-- ═══════════════════════════════════════════════════════════════════════════
-- Criação de pedido do cardápio em UMA transação.
--
-- Como era: CheckoutDrawer.enviar() fazia sete escritas sequenciais a partir do
-- browser — upsert de cliente, endereço, insert do pedido, débito de cashback,
-- laço de itens, opções e pagamento. Cada passo com o seu `if (erro)` chamando
-- descartarPedidoIncompleto() para desfazer na mão.
--
-- O furo: essa compensação roda NO CLIENTE. O caso que ela precisa cobrir é
-- justamente o que a impede de rodar — o celular perdendo sinal no meio do
-- checkout. Perdeu a rede depois do insert do pedido e antes dos itens, fica um
-- pedido sem item, sem pagamento, visível no painel do lojista, e ninguém
-- desfaz. Compensação client-side não é atomicidade.
--
-- Aqui a função é o limite transacional: qualquer exceção desfaz tudo, inclusive
-- o débito de cashback. Rede caindo no meio deixa a transação sem commit e o
-- Postgres reverte sozinho. Não existe estado parcial para compensar.
--
-- De quebra, preço e nome do item passam a vir do catálogo dentro da mesma
-- transação, em vez de virem do payload do browser: o front não precisa mais
-- ser confiável para essa parte, só para dizer O QUE foi pedido.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.fn_criar_pedido_completo(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_user     uuid := auth.uid();
  v_loja     uuid := nullif(p_payload->>'loja_id','')::uuid;
  v_tipo     text := coalesce(p_payload->>'tipo_pedido','DELIVERY');
  v_metodo   text := p_payload->>'metodo';
  v_end      jsonb := p_payload->'endereco';
  v_cashback numeric := coalesce(nullif(p_payload->>'cashback_usado','')::numeric, 0);
  v_cliente  uuid;
  v_pedido   uuid;
  v_numero   integer;
  v_total    numeric;
  v_item     jsonb;
  v_item_id  uuid;
  v_qtd_end  integer;
  v_ok       boolean;
begin
  -- O dono do pedido é sempre quem está autenticado. Nunca o que o payload diz:
  -- aceitar cliente_user_id do browser deixaria um cliente criar pedido no nome
  -- de outro.
  if v_user is null then
    raise exception 'Sessão inválida — faça login novamente.';
  end if;
  if v_loja is null then
    raise exception 'loja_id é obrigatório.';
  end if;
  if jsonb_array_length(coalesce(p_payload->'itens','[]'::jsonb)) = 0 then
    raise exception 'Pedido sem itens.';
  end if;

  -- ── 1. Cliente ───────────────────────────────────────────────────────────
  insert into clientes (loja_id, user_id, nome, telefone, email, bairro, forma_pagamento_preferida)
  values (
    v_loja, v_user,
    nullif(btrim(p_payload->>'nome'),''),
    p_payload->>'telefone',
    nullif(p_payload->>'email',''),
    coalesce(v_end->>'bairro', nullif(p_payload->>'bairro_manual','')),
    nullif(v_metodo,'')::metodo_pgto
  )
  on conflict (loja_id, user_id) do update
    set nome     = excluded.nome,
        telefone = excluded.telefone,
        email    = coalesce(excluded.email, clientes.email),
        bairro   = coalesce(excluded.bairro, clientes.bairro),
        forma_pagamento_preferida =
          coalesce(excluded.forma_pagamento_preferida, clientes.forma_pagamento_preferida)
  returning id into v_cliente;

  -- ── 2. Endereço padrão: só cria se o cliente ainda não tem nenhum ────────
  if v_tipo = 'DELIVERY' and v_end is not null and v_end <> 'null'::jsonb then
    select count(*) into v_qtd_end from enderecos_cliente where cliente_id = v_cliente;
    if v_qtd_end = 0 then
      insert into enderecos_cliente
        (cliente_id, cep, logradouro, numero, complemento, bairro, cidade, uf, ponto_referencia, padrao)
      values (
        v_cliente,
        v_end->>'cep',
        v_end->>'logradouro',
        case when coalesce((v_end->>'sem_numero')::boolean, false)
             then 'SN' else nullif(v_end->>'numero','') end,
        nullif(v_end->>'complemento',''),
        v_end->>'bairro',
        v_end->>'cidade',
        upper(coalesce(v_end->>'uf','')),
        nullif(v_end->>'ponto_referencia',''),
        true
      );
    end if;
  end if;

  -- ── 3. Pedido ────────────────────────────────────────────────────────────
  insert into pedidos (
    loja_id, tipo_pedido, identificador_cliente, telefone_contato,
    cliente_id, cliente_user_id,
    endereco_entrega, bairro, cep, logradouro, numero_endereco, complemento, cidade, uf,
    distancia_km, lat, lng,
    subtotal, taxa_entrega, desconto, valor_total,
    cupom_id, troco_para, agendado_para, cashback_usado, requer_cozinha
  ) values (
    v_loja, v_tipo::tipo_pedido,
    nullif(btrim(p_payload->>'nome'),''),
    p_payload->>'telefone',
    v_cliente, v_user,
    nullif(p_payload->>'endereco_formatado',''),
    v_end->>'bairro',
    v_end->>'cep',
    v_end->>'logradouro',
    nullif(v_end->>'numero',''),
    nullif(v_end->>'complemento',''),
    v_end->>'cidade',
    v_end->>'uf',
    nullif(p_payload->>'distancia_km','')::numeric,
    nullif(p_payload->>'lat','')::numeric,
    nullif(p_payload->>'lng','')::numeric,
    0, coalesce(nullif(p_payload->>'taxa_entrega','')::numeric, 0), 0, 0,
    nullif(p_payload->>'cupom_id','')::uuid,
    nullif(p_payload->>'troco_para','')::numeric,
    nullif(p_payload->>'agendado_para','')::timestamptz,
    v_cashback,
    false
  )
  returning id, numero into v_pedido, v_numero;

  -- ── 4. Itens e opções ────────────────────────────────────────────────────
  -- Nome e preço saem do catálogo desta loja. O payload diz o que foi pedido;
  -- quanto custa é decisão do servidor.
  for v_item in select * from jsonb_array_elements(p_payload->'itens')
  loop
    v_item_id := null;

    insert into itens_pedido (pedido_id, produto_id, nome_produto, preco_unitario, quantidade, observacao)
    select
      v_pedido, pr.id, pr.nome, pr.preco,
      coalesce(nullif(v_item->>'quantidade','')::numeric, 1),
      nullif(v_item->>'observacao','')
    from produtos pr
    where pr.id = nullif(v_item->>'produto_id','')::uuid
      and pr.loja_id = v_loja
    returning id into v_item_id;

    if v_item_id is null then
      raise exception 'Produto % não pertence a esta loja.', v_item->>'produto_id';
    end if;

    insert into itens_pedido_opcoes (item_id, opcao_id, nome_opcao, preco_adicional)
    select v_item_id, o.id, o.nome, o.preco_adicional
    from jsonb_array_elements(coalesce(v_item->'opcoes','[]'::jsonb)) sel
    join opcoes o on o.id = nullif(sel->>'id','')::uuid;
  end loop;

  -- ── 5. Preço final é do servidor ─────────────────────────────────────────
  v_total := fn_recalcular_pedido(v_pedido);

  -- ── 6. Cashback ──────────────────────────────────────────────────────────
  -- Dentro da transação: se qualquer passo adiante falhar, o débito volta.
  if v_cashback > 0 then
    v_ok := fn_usar_cashback(v_cliente, v_loja, v_pedido, v_cashback);
    if not coalesce(v_ok, false) then
      raise exception 'Seu saldo de cashback mudou nesse instante — atualize a página e tente novamente.';
    end if;
    v_total := fn_recalcular_pedido(v_pedido);
  end if;

  -- ── 7. Pagamento ─────────────────────────────────────────────────────────
  -- Nasce PENDENTE por default da coluna. Quem marca PAGO é gateway/webhook.
  insert into pagamentos (pedido_id, metodo, valor_pago)
  values (v_pedido, v_metodo::metodo_pgto, coalesce(v_total, 0));

  -- ── 8. Conversa de WhatsApp (opcional) ───────────────────────────────────
  if nullif(p_payload->>'wa_token','') is not null then
    begin
      perform fn_atribuir_conversa_ao_pedido(v_pedido, p_payload->>'wa_token');
    exception when others then
      -- Vincular conversa é conveniência: não vale derrubar o pedido inteiro.
      null;
    end;
  end if;

  return jsonb_build_object(
    'pedido_id',   v_pedido,
    'numero',      v_numero,
    'valor_total', coalesce(v_total, 0)
  );
end;
$fn$;

comment on function public.fn_criar_pedido_completo(jsonb) is
  'Cria pedido do cardapio (cliente, endereco, itens, opcoes, cashback e pagamento) numa unica transacao. Substitui as sete escritas sequenciais do CheckoutDrawer, que deixavam pedido orfao quando a rede caia no meio do checkout.';

revoke all on function public.fn_criar_pedido_completo(jsonb) from public, anon;
grant execute on function public.fn_criar_pedido_completo(jsonb) to authenticated;

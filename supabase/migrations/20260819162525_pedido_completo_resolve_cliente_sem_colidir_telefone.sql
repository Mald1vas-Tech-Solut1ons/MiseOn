-- A tabela clientes tem DUAS uniques: (loja_id, user_id) e (loja_id, telefone).
-- O upsert `on conflict (loja_id, user_id)` — que o CheckoutDrawer usava e a
-- primeira versão desta função copiou — explode com 23505 na OUTRA constraint
-- quando o telefone digitado já pertence a outro cadastro da mesma loja.
-- Reproduzido em teste: erro cru de constraint no meio do checkout, pedido não
-- sai. O defeito já existia no fluxo antigo; só ficou visível ao consolidar.
--
-- Resolução em ordem, sem nunca roubar telefone de outro cadastro:
--   1. já existe cliente deste usuário nesta loja        -> usa esse
--   2. existe cadastro órfão (user_id null) com o telefone -> adota
--   3. não existe                                        -> cria
-- Se o telefone pertence a OUTRO usuário, o telefone do cadastro não é tocado.
-- Nada se perde: pedidos.telefone_contato guarda o que o cliente digitou.

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
  v_nome     text := nullif(btrim(p_payload->>'nome'),'');
  v_tel      text := nullif(btrim(p_payload->>'telefone'),'');
  v_bairro   text := coalesce(p_payload#>>'{endereco,bairro}', nullif(p_payload->>'bairro_manual',''));
  v_cliente  uuid;
  v_tel_alheio boolean;
  v_pedido   uuid;
  v_numero   integer;
  v_total    numeric;
  v_item     jsonb;
  v_item_id  uuid;
  v_qtd_end  integer;
  v_ok       boolean;
begin
  if v_user is null then
    raise exception 'Sessao invalida - faca login novamente.';
  end if;
  if v_loja is null then
    raise exception 'loja_id e obrigatorio.';
  end if;
  if jsonb_array_length(coalesce(p_payload->'itens','[]'::jsonb)) = 0 then
    raise exception 'Pedido sem itens.';
  end if;

  -- ── 1. Cliente ───────────────────────────────────────────────────────────
  select id into v_cliente from clientes
   where loja_id = v_loja and user_id = v_user;

  if v_cliente is null and v_tel is not null then
    select id into v_cliente from clientes
     where loja_id = v_loja and telefone = v_tel and user_id is null;
    if v_cliente is not null then
      update clientes set user_id = v_user where id = v_cliente;
    end if;
  end if;

  select exists (
    select 1 from clientes
     where loja_id = v_loja and telefone = v_tel
       and (v_cliente is null or id <> v_cliente)
  ) into v_tel_alheio;

  if v_cliente is null then
    insert into clientes (loja_id, user_id, nome, telefone, email, bairro, forma_pagamento_preferida)
    values (
      v_loja, v_user, v_nome,
      -- telefone e NOT NULL; se o numero e de outro cadastro, guarda um
      -- marcador unico por usuario e deixa o numero real so no pedido.
      case when v_tel_alheio or v_tel is null
           then 'U' || replace(v_user::text, '-', '')
           else v_tel end,
      nullif(p_payload->>'email',''),
      v_bairro,
      nullif(v_metodo,'')::metodo_pgto
    )
    returning id into v_cliente;
  else
    update clientes
       set nome     = coalesce(v_nome, nome),
           telefone = case when v_tel_alheio or v_tel is null then telefone else v_tel end,
           email    = coalesce(nullif(p_payload->>'email',''), email),
           bairro   = coalesce(v_bairro, bairro),
           forma_pagamento_preferida =
             coalesce(nullif(v_metodo,'')::metodo_pgto, forma_pagamento_preferida)
     where id = v_cliente;
  end if;

  -- ── 2. Endereco padrao: so cria se o cliente ainda nao tem nenhum ────────
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
    v_loja, v_tipo::tipo_pedido, v_nome, v_tel,
    v_cliente, v_user,
    nullif(p_payload->>'endereco_formatado',''),
    v_end->>'bairro', v_end->>'cep', v_end->>'logradouro',
    nullif(v_end->>'numero',''), nullif(v_end->>'complemento',''),
    v_end->>'cidade', v_end->>'uf',
    nullif(p_payload->>'distancia_km','')::numeric,
    nullif(p_payload->>'lat','')::numeric,
    nullif(p_payload->>'lng','')::numeric,
    0, coalesce(nullif(p_payload->>'taxa_entrega','')::numeric, 0), 0, 0,
    nullif(p_payload->>'cupom_id','')::uuid,
    nullif(p_payload->>'troco_para','')::numeric,
    nullif(p_payload->>'agendado_para','')::timestamptz,
    v_cashback, false
  )
  returning id, numero into v_pedido, v_numero;

  -- ── 4. Itens e opcoes: nome e preco saem do catalogo desta loja ──────────
  for v_item in select * from jsonb_array_elements(p_payload->'itens')
  loop
    v_item_id := null;

    insert into itens_pedido (pedido_id, produto_id, nome_produto, preco_unitario, quantidade, observacao)
    select v_pedido, pr.id, pr.nome, pr.preco,
           coalesce(nullif(v_item->>'quantidade','')::numeric, 1),
           nullif(v_item->>'observacao','')
      from produtos pr
     where pr.id = nullif(v_item->>'produto_id','')::uuid
       and pr.loja_id = v_loja
    returning id into v_item_id;

    if v_item_id is null then
      raise exception 'Produto % nao pertence a esta loja.', v_item->>'produto_id';
    end if;

    insert into itens_pedido_opcoes (item_id, opcao_id, nome_opcao, preco_adicional)
    select v_item_id, o.id, o.nome, o.preco_adicional
      from jsonb_array_elements(coalesce(v_item->'opcoes','[]'::jsonb)) sel
      join opcoes o on o.id = nullif(sel->>'id','')::uuid;
  end loop;

  -- ── 5. Preco final e do servidor ─────────────────────────────────────────
  v_total := fn_recalcular_pedido(v_pedido);

  -- ── 6. Cashback, dentro da mesma transacao ───────────────────────────────
  if v_cashback > 0 then
    v_ok := fn_usar_cashback(v_cliente, v_loja, v_pedido, v_cashback);
    if not coalesce(v_ok, false) then
      raise exception 'Seu saldo de cashback mudou nesse instante - atualize a pagina e tente novamente.';
    end if;
    v_total := fn_recalcular_pedido(v_pedido);
  end if;

  -- ── 7. Pagamento (nasce PENDENTE pelo default) ───────────────────────────
  insert into pagamentos (pedido_id, metodo, valor_pago)
  values (v_pedido, v_metodo::metodo_pgto, coalesce(v_total, 0));

  -- ── 8. Conversa de WhatsApp: conveniencia, nao derruba o pedido ──────────
  if nullif(p_payload->>'wa_token','') is not null then
    begin
      perform fn_atribuir_conversa_ao_pedido(v_pedido, p_payload->>'wa_token');
    exception when others then
      null;
    end;
  end if;

  return jsonb_build_object(
    'pedido_id', v_pedido, 'numero', v_numero, 'valor_total', coalesce(v_total, 0)
  );
end;
$fn$;

revoke all on function public.fn_criar_pedido_completo(jsonb) from public, anon;
grant execute on function public.fn_criar_pedido_completo(jsonb) to authenticated;

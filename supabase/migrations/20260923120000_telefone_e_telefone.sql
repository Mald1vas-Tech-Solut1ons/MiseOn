-- ═══════════════════════════════════════════════════════════════════════════
-- TELEFONE É TELEFONE (23/09/2026)
--
-- clientes.telefone era NOT NULL, então quem não tinha número recebia um
-- valor inventado no campo: 'U' + id do usuário (cardápio online, conta sem
-- telefone ou com número de outra conta) e 'totem-' + hash (totem só com
-- e-mail). O campo tinha dois significados, e a tela Minha Conta mostrava
-- "U5ab15e03bcab470781cd150539751861" como se fosse o WhatsApp do cliente.
--
-- Agora: telefone é número real ou NULO. UNIQUE (loja_id, telefone) aceita
-- vários nulos; a identidade do cliente logado já é (loja_id, user_id).
-- O iFood ('IFOOD_' + id do cliente) usa o valor para reencontrar o cliente e
-- vai para coluna própria em sprint dedicado — não é tocado aqui.
-- Gerado a partir de pg_get_functiondef (produção), trocando só esse trecho.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.clientes alter column telefone drop not null;

update public.clientes set telefone = null
 where telefone ~ '^U[0-9a-f]{32}$' or telefone like 'totem-%';

CREATE OR REPLACE FUNCTION public.fn_criar_pedido_completo(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  v_entrega     jsonb;
  v_subtotal_srv numeric;
  v_status_inicial status_pedido;
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

  if nullif(p_payload->>'agendado_para','') is null
     and not public.fn_loja_aberta(v_loja) then
    raise exception 'A loja esta fechada no momento. Agende um horario ou tente quando ela abrir.';
  end if;

  -- PAGAMENTO ONLINE NASCE COMO CARRINHO, NAO COMO PEDIDO.
  -- PIX e CREDITO tem confirmacao pelo gateway: ate ela chegar, o pedido fica
  -- em AGUARDANDO_PAGAMENTO — invisivel no painel do lojista, sem alerta
  -- sonoro, sem baixa de estoque. Antes nascia NOVO e o lojista era alertado
  -- no instante em que o cliente ABRIA a tela de pagamento; aceitava pedido
  -- que ninguem pagou, e o que o cliente abandonava virava comida perdida.
  -- DINHEIRO (e qualquer outro) continua NOVO: paga na entrega, entao o
  -- lojista precisa ver na hora.
  v_status_inicial := case
    when v_metodo in ('PIX','CREDITO') then 'AGUARDANDO_PAGAMENTO'::status_pedido
    else 'NOVO'::status_pedido
  end;

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
      case when v_tel_alheio then null else v_tel end,
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

  insert into pedidos (
    loja_id, tipo_pedido, status, identificador_cliente, telefone_contato,
    cliente_id, cliente_user_id,
    endereco_entrega, bairro, cep, logradouro, numero_endereco, complemento, cidade, uf,
    distancia_km, lat, lng,
    subtotal, taxa_entrega, desconto, valor_total,
    cupom_id, troco_para, agendado_para, cashback_usado, requer_cozinha
  ) values (
    v_loja, v_tipo::tipo_pedido, v_status_inicial, v_nome, v_tel,
    v_cliente, v_user,
    nullif(p_payload->>'endereco_formatado',''),
    v_end->>'bairro', v_end->>'cep', v_end->>'logradouro',
    nullif(v_end->>'numero',''), nullif(v_end->>'complemento',''),
    v_end->>'cidade', v_end->>'uf',
    nullif(p_payload->>'distancia_km','')::numeric,
    nullif(p_payload->>'lat','')::numeric,
    nullif(p_payload->>'lng','')::numeric,
    0, 0, 0, 0,
    nullif(p_payload->>'cupom_id','')::uuid,
    nullif(p_payload->>'troco_para','')::numeric,
    nullif(p_payload->>'agendado_para','')::timestamptz,
    v_cashback, false
  )
  returning id, numero into v_pedido, v_numero;

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

  v_total := fn_recalcular_pedido(v_pedido);

  if v_tipo = 'DELIVERY' then
    select subtotal into v_subtotal_srv from pedidos where id = v_pedido;

    v_entrega := public.fn_taxa_entrega_calculada(
      v_loja,
      nullif(p_payload->>'lat','')::numeric,
      nullif(p_payload->>'lng','')::numeric,
      v_bairro,
      coalesce(v_subtotal_srv, 0)
    );

    if coalesce((v_entrega->>'fora_de_area')::boolean, false) then
      raise exception 'Este endereco esta fora da area de entrega desta loja.';
    end if;

    update pedidos
       set taxa_entrega = coalesce((v_entrega->>'taxa')::numeric, 0),
           distancia_km = coalesce(nullif(v_entrega->>'distancia_km','')::numeric, distancia_km)
     where id = v_pedido;

    v_total := fn_recalcular_pedido(v_pedido);
  end if;

  if v_cashback > 0 then
    v_ok := fn_usar_cashback(v_cliente, v_loja, v_pedido, v_cashback);
    if not coalesce(v_ok, false) then
      raise exception 'Seu saldo de cashback mudou nesse instante - atualize a pagina e tente novamente.';
    end if;
    v_total := fn_recalcular_pedido(v_pedido);
  end if;

  insert into pagamentos (pedido_id, metodo, valor_pago)
  values (v_pedido, v_metodo::metodo_pgto, coalesce(v_total, 0));

  if nullif(p_payload->>'wa_token','') is not null then
    begin
      perform fn_atribuir_conversa_ao_pedido(v_pedido, p_payload->>'wa_token');
    exception when others then
      null;
    end;
  end if;

  return jsonb_build_object(
    'pedido_id', v_pedido, 'numero', v_numero, 'valor_total', coalesce(v_total, 0),
    'taxa_entrega', coalesce((v_entrega->>'taxa')::numeric, 0),
    'status', v_status_inicial::text,
    'aguardando_pagamento', v_status_inicial = 'AGUARDANDO_PAGAMENTO'
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_totem_criar_pedido(p_token uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_loja uuid; v_metodo text := coalesce(p_payload->>'metodo','PIX');
  v_pedido uuid; v_numero integer; v_total numeric;
  v_item jsonb; v_item_id uuid; v_status status_pedido;
  v_email text := nullif(lower(btrim(p_payload->>'email')),'');
  v_tel   text := nullif(regexp_replace(coalesce(p_payload->>'telefone',''), '[^0-9]', '', 'g'),'');
  v_doc   text := nullif(regexp_replace(coalesce(p_payload->>'documento',''), '[^0-9]', '', 'g'),'');
  v_cliente uuid;
  v_quer_cashback boolean := coalesce((p_payload->>'usar_cashback')::boolean, false);
  v_saldo numeric; v_resgate numeric := 0;
begin
  -- As duas chaves do produto contratado. Nenhuma sozinha abre a porta.
  select id into v_loja from lojas
   where totem_ativo is true and totem_token is not null and totem_token = p_token;
  if v_loja is null then
    raise exception 'Totem nao autorizado: verifique se o MiseOn Kiosk esta contratado para esta loja e se o aparelho foi vinculado.';
  end if;
  if jsonb_array_length(coalesce(p_payload->'itens','[]'::jsonb)) = 0 then
    raise exception 'Pedido sem itens.'; end if;

  if v_email is not null or v_tel is not null then
    select id into v_cliente from clientes
     where loja_id = v_loja
       and ((v_email is not null and lower(email) = v_email) or (v_tel is not null and telefone = v_tel))
     limit 1;
    if v_cliente is null then
      insert into clientes (loja_id, telefone, nome, email)
      values (v_loja, v_tel,
              nullif(btrim(p_payload->>'nome'),''), v_email)
      returning id into v_cliente;
    elsif v_email is not null then
      update clientes set email = coalesce(email, v_email) where id = v_cliente;
    end if;
  end if;

  v_status := case when v_metodo in ('PIX','CREDITO')
                   then 'AGUARDANDO_PAGAMENTO'::status_pedido else 'NOVO'::status_pedido end;

  -- Cupom não entra por aqui: o totem não tem campo de cupom, e resgate e
  -- cupom não se somam. Se um dia entrar, a exclusão continua valendo abaixo.
  insert into pedidos (loja_id, tipo_pedido, origem, status, identificador_cliente,
                       observacao, cliente_id, documento_cliente)
  values (v_loja, 'RETIRADA_BALCAO', 'totem', v_status,
          coalesce(nullif(btrim(p_payload->>'nome'),''), 'Totem'),
          nullif(p_payload->>'observacao',''), v_cliente, v_doc)
  returning id, numero into v_pedido, v_numero;

  for v_item in select * from jsonb_array_elements(p_payload->'itens') loop
    -- Preco e nome vem do BANCO, nunca do payload: o totem fica na rua.
    insert into itens_pedido (pedido_id, produto_id, nome_produto, preco_unitario, quantidade, observacao)
    select v_pedido, pr.id, pr.nome, pr.preco,
           coalesce(nullif(v_item->>'quantidade','')::numeric,1), nullif(v_item->>'observacao','')
      from produtos pr where pr.id = nullif(v_item->>'produto_id','')::uuid and pr.loja_id = v_loja
    returning id into v_item_id;
    if v_item_id is null then raise exception 'Produto % nao pertence a esta loja.', v_item->>'produto_id'; end if;
    insert into itens_pedido_opcoes (item_id, opcao_id, nome_opcao, preco_adicional)
    select v_item_id, o.id, o.nome, o.preco_adicional
      from jsonb_array_elements(coalesce(v_item->'opcoes','[]'::jsonb)) sel
      join opcoes o on o.id = nullif(sel->>'id','')::uuid;
  end loop;

  v_total := fn_recalcular_pedido(v_pedido);

  -- RESGATE. O totem manda só a intenção; o valor sai daqui, do saldo que
  -- existia ANTES deste pedido e do total que o banco acabou de calcular.
  if v_quer_cashback and v_cliente is not null
     and not exists (select 1 from pedidos where id = v_pedido and cupom_id is not null) then
    perform fn_expirar_cashback(v_loja);
    -- Trava a linha: dois pedidos do mesmo telefone ao mesmo tempo não gastam
    -- o mesmo saldo duas vezes.
    select saldo into v_saldo from cashback_saldos
     where cliente_id = v_cliente and loja_id = v_loja for update;
    v_resgate := fn_cashback_valor_resgate(coalesce(v_saldo, 0), coalesce(v_total, 0));
    if v_resgate > 0 then
      update cashback_saldos set saldo = saldo - v_resgate, atualizado_em = now()
       where cliente_id = v_cliente and loja_id = v_loja;
      insert into cashback_movimentos (loja_id, cliente_id, pedido_id, tipo, valor)
      values (v_loja, v_cliente, v_pedido, 'USO', -v_resgate);
      v_total := fn_recalcular_pedido(v_pedido);
    end if;
  end if;

  insert into pagamentos (pedido_id, metodo, valor_pago)
  values (v_pedido, v_metodo::metodo_pgto, coalesce(v_total,0));

  return jsonb_build_object('pedido_id', v_pedido, 'numero', v_numero,
    'senha', (select senha from pedidos where id = v_pedido),
    'valor_total', coalesce(v_total,0), 'status', v_status::text,
    'identificado', v_cliente is not null,
    'cashback_usado', v_resgate,
    'cashback_validade_dias', (fn_cashback_regras()->>'validade_dias')::int,
    'cashback_pct', (select coalesce(cashback_pct,0) from lojas where id = v_loja));
end; $function$
;

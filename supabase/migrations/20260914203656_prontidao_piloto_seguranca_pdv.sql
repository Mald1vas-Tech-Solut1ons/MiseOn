-- Privilégios públicos não substituem autorização por loja.
create or replace function public.fn_ajustar_operacao_nicho(p_loja uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $fn$
declare v_direto int:=0; v_peso int:=0;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' and not public.fn_tem_papel(p_loja, array['admin']) then
    raise exception 'Sem permissão para configurar esta loja.' using errcode='42501';
  end if;
  update produtos p set estacao_preparo='DIRETO' from categorias c
  where c.id=p.categoria_id and p.loja_id=p_loja
    and c.nome in ('Bebidas','Bebidas sem Álcool','Complementos','Bordas','Chopes e Cervejas','Drinks','Sobremesas','Açaí');
  get diagnostics v_direto = row_count;
  update produtos set tipo_venda='POR_PESO', preco_por_quilo=preco, preco=0
  where loja_id=p_loja and nome='Buffet por Quilo' and tipo_venda <> 'POR_PESO';
  get diagnostics v_peso = row_count;
  return jsonb_build_object('direto',v_direto,'por_peso',v_peso);
end $fn$;
revoke all on function public.fn_ajustar_operacao_nicho(uuid) from public, anon;
grant execute on function public.fn_ajustar_operacao_nicho(uuid) to authenticated, service_role;
alter view public.vw_insumos_a_revisar set (security_invoker=true);
revoke all on public.vw_insumos_a_revisar from public, anon;
grant select on public.vw_insumos_a_revisar to authenticated;

-- Recibo da tentativa: criado na MESMA transação do pedido, sem acesso direto pela API.
create table public.pdv_tentativas (
  loja_id uuid not null references public.lojas(id) on delete cascade,
  chave uuid not null,
  usuario_id uuid not null,
  payload jsonb not null,
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  resposta jsonb not null,
  criado_em timestamptz not null default now(),
  primary key (loja_id, chave)
);
alter table public.pdv_tentativas enable row level security;
revoke all on public.pdv_tentativas from public, anon, authenticated;
create index pdv_tentativas_pedido_idx on public.pdv_tentativas(pedido_id);

create or replace function public.fn_pdv_registrar(p_chave uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $fn$
declare
  v_loja uuid := (p_payload->>'loja_id')::uuid;
  v_tipo text := p_payload->>'tipo_pedido';
  v_metodo text := p_payload->>'metodo';
  v_cliente uuid := nullif(p_payload->>'cliente_id','')::uuid;
  v_comanda uuid := nullif(p_payload->>'comanda_id','')::uuid;
  v_desconto numeric := coalesce((p_payload->>'desconto')::numeric,0);
  v_cashback numeric := coalesce((p_payload->>'cashback_usado')::numeric,0);
  v_pedido uuid; v_numero int; v_senha int; v_item_id uuid;
  v_item jsonb; v_opcao jsonb; v_produto record; v_op record; v_anterior record;
  v_qtd numeric; v_subtotal numeric:=0; v_extras numeric; v_total numeric;
  v_cozinha boolean:=false; v_resposta jsonb;
begin
  if auth.uid() is null or v_loja is null or p_chave is null or
     not public.fn_tem_papel(v_loja, array['admin','operador','garcom']) then
    raise exception 'Sem permissão para vender nesta loja.' using errcode='42501';
  end if;
  if v_tipo is null or v_tipo not in ('SALAO','RETIRADA_BALCAO') then raise exception 'Tipo de venda inválido.'; end if;
  if v_tipo='RETIRADA_BALCAO' and not public.fn_tem_papel(v_loja,array['admin','operador']) then
    raise exception 'Somente caixa ou administrador pode receber.' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_loja::text || p_chave::text,0));
  select * into v_anterior from pdv_tentativas where loja_id=v_loja and chave=p_chave;
  if found then
    if v_anterior.usuario_id <> auth.uid() or v_anterior.payload <> p_payload then
      raise exception 'Tentativa já registrada com outros dados. Confira o pedido antes de iniciar outra venda.';
    end if;
    return v_anterior.resposta;
  end if;
  if jsonb_typeof(p_payload->'itens') is distinct from 'array' or jsonb_array_length(p_payload->'itens')=0 then
    raise exception 'Pedido sem itens.';
  end if;
  if v_desconto < 0 or v_desconto::text in ('NaN','Infinity','-Infinity') or
     v_cashback < 0 or v_cashback::text in ('NaN','Infinity','-Infinity') then raise exception 'Desconto inválido.'; end if;
  if v_cliente is not null and not exists(select 1 from clientes where id=v_cliente and loja_id=v_loja) then
    raise exception 'Cliente não pertence à loja.';
  end if;
  if v_tipo='SALAO' then
    if v_comanda is null or not exists(select 1 from comandas where id=v_comanda and loja_id=v_loja and status='ABERTA') then
      raise exception 'Comanda fechada ou de outra loja.';
    end if;
    perform 1 from comandas where id=v_comanda for update;
    if v_cashback <> 0 then raise exception 'Use o cashback no fechamento da conta.'; end if;
  elsif v_metodo is null or v_metodo not in ('DINHEIRO','PIX','CREDITO','DEBITO') then
    raise exception 'Forma de pagamento inválida.';
  end if;

  -- Montagem invisível para a operação até todos os itens serem validados.
  insert into pedidos(loja_id,tipo_pedido,origem,status,identificador_cliente,cliente_id,comanda_id,mesa_numero,
    subtotal,desconto,valor_total,troco_para,requer_cozinha,estacao_atual,etapa_kds_atual)
  values(v_loja,v_tipo::tipo_pedido,case when v_tipo='SALAO' then 'garcom' else 'balcao' end,
    'AGUARDANDO_PAGAMENTO',coalesce(nullif(p_payload->>'identificador_cliente',''),'Balcão'),v_cliente,v_comanda,
    nullif(p_payload->>'mesa_numero','')::int,0,0,0,nullif(p_payload->>'troco_para','')::numeric,false,'BALCAO','etapa_fila')
  returning id,numero,senha into v_pedido,v_numero,v_senha;

  for v_item in select * from jsonb_array_elements(p_payload->'itens') loop
    v_qtd := (v_item->>'quantidade')::numeric;
    if v_qtd is null or v_qtd<=0 or v_qtd::text in ('NaN','Infinity','-Infinity') then raise exception 'Quantidade inválida.'; end if;
    select * into v_produto from produtos where id=(v_item->>'produto_id')::uuid and loja_id=v_loja and disponivel;
    if not found then raise exception 'Produto indisponível ou de outra loja.'; end if;
    -- Venda por peso usa o fluxo de pesagem/comanda, que registra tara e peso.
    -- Não aceitar preço zero do catálogo de quilo neste fluxo unitário.
    if v_produto.tipo_venda='POR_PESO' then raise exception 'Para produto por peso, use o painel Balança e sua comanda.'; end if;
    if v_qtd <> trunc(v_qtd) then raise exception 'Produto unitário exige quantidade inteira.'; end if;
    v_cozinha := v_cozinha or coalesce(v_produto.estacao_preparo,'COZINHA') <> 'DIRETO';
    insert into itens_pedido(pedido_id,produto_id,nome_produto,preco_unitario,quantidade,observacao,assento_numero)
    values(v_pedido,v_produto.id,v_produto.nome,v_produto.preco,v_qtd,v_item->>'observacao',nullif(v_item->>'assento_numero','')::int)
    returning id into v_item_id;
    v_extras:=0;
    for v_opcao in select * from jsonb_array_elements(coalesce(v_item->'opcoes','[]')) loop
      select o.* into v_op from opcoes o join grupos_opcoes g on g.id=o.grupo_id
      where o.id=(v_opcao->>'id')::uuid and g.produto_id=v_produto.id and o.disponivel;
      if not found then raise exception 'Opção indisponível ou de outro produto.'; end if;
      if exists(select 1 from itens_pedido_opcoes where item_id=v_item_id and opcao_id=v_op.id) then raise exception 'Opção repetida.'; end if;
      insert into itens_pedido_opcoes(item_id,opcao_id,nome_opcao,preco_adicional)
      values(v_item_id,v_op.id,v_op.nome,v_op.preco_adicional);
      v_extras:=v_extras+v_op.preco_adicional;
    end loop;
    if exists(select 1 from grupos_opcoes g where g.produto_id=v_produto.id and
      ((select count(*) from itens_pedido_opcoes io join opcoes o on o.id=io.opcao_id where io.item_id=v_item_id and o.grupo_id=g.id)
         not between coalesce(g.min_escolhas,0) and coalesce(g.max_escolhas,2147483647))) then
      raise exception 'Confira as opções obrigatórias e os limites de escolha.';
    end if;
    v_subtotal:=v_subtotal+(v_produto.preco+v_extras)*v_qtd;
  end loop;
  v_subtotal:=round(v_subtotal,2);
  if v_desconto>v_subtotal or v_cashback>v_desconto then raise exception 'Desconto maior que o permitido.'; end if;
  v_total:=round(v_subtotal-v_desconto,2);
  if (p_payload->>'valor_total')::numeric is distinct from v_total then
    raise exception 'O preço do catálogo mudou. Atualize os produtos e confira o total antes de receber.';
  end if;
  if v_cashback>0 then
    update cashback_saldos set saldo=saldo-v_cashback,atualizado_em=now()
    where cliente_id=v_cliente and loja_id=v_loja and saldo>=v_cashback;
    if not found then raise exception 'Saldo de cashback insuficiente. Confira o desconto.'; end if;
    insert into cashback_movimentos(loja_id,cliente_id,pedido_id,tipo,valor)
    values(v_loja,v_cliente,v_pedido,'USO',-v_cashback);
  end if;
  update pedidos set subtotal=v_subtotal,desconto=v_desconto-v_cashback,cashback_usado=v_cashback,valor_total=v_total,
    requer_cozinha=v_cozinha
  where id=v_pedido;
  if v_tipo='RETIRADA_BALCAO' then
    insert into pagamentos(pedido_id,metodo,valor_pago,status,data_pagamento)
    values(v_pedido,v_metodo::metodo_pgto,v_total,
      (case when v_metodo='PIX' then 'PENDENTE' else 'PAGO' end)::status_pgto,
      case when v_metodo<>'PIX' then now() else null end);
  end if;
  if v_tipo='SALAO' or v_metodo<>'PIX' then
    -- O trigger de aceite baixa estoque e despacha KDS dentro desta transação.
    update pedidos set status='ACEITO' where id=v_pedido;
    if v_cozinha then
      update pedidos set estacao_atual='COZINHA',enviado_cozinha_em=now() where id=v_pedido;
    end if;
    if v_tipo='RETIRADA_BALCAO' and not v_cozinha then
      update pedidos set status='PRONTO' where id=v_pedido;
      update pedidos set status='FINALIZADO' where id=v_pedido;
    end if;
  end if;
  v_resposta:=jsonb_build_object('id',v_pedido,'numero',v_numero,'senha',v_senha,'valor_total',v_total,'requer_cozinha',v_cozinha);
  insert into pdv_tentativas(loja_id,chave,usuario_id,payload,pedido_id,resposta)
  values(v_loja,p_chave,auth.uid(),p_payload,v_pedido,v_resposta);
  return v_resposta;
end $fn$;
revoke all on function public.fn_pdv_registrar(uuid,jsonb) from public, anon;
grant execute on function public.fn_pdv_registrar(uuid,jsonb) to authenticated;

create or replace function public.fn_pdv_concluir_pix(p_pedido_id uuid, p_confirmacao_manual boolean default false)
returns void language plpgsql security definer set search_path to 'public','pg_temp'
as $fn$
declare v_p public.pedidos%rowtype;
begin
  select * into v_p from pedidos where id=p_pedido_id for update;
  if v_p.id is null or not public.fn_tem_papel(v_p.loja_id,array['admin','operador']) or v_p.origem<>'balcao' then
    raise exception 'Sem permissão para concluir este pedido.' using errcode='42501';
  end if;
  if v_p.status='CANCELADO' then raise exception 'Pedido cancelado: confira o pagamento e o estorno.'; end if;
  if p_confirmacao_manual then
    update pagamentos set status='PAGO',data_pagamento=now()
    where pedido_id=p_pedido_id and metodo='PIX' and status='PENDENTE';
  end if;
  if not exists(select 1 from pagamentos where pedido_id=p_pedido_id and metodo='PIX' and status='PAGO') then
    raise exception 'Pagamento Pix ainda não confirmado.';
  end if;
  if v_p.status in ('NOVO','AGUARDANDO_PAGAMENTO') then
    update pedidos set status='ACEITO' where id=p_pedido_id;
    if v_p.requer_cozinha then
      update pedidos set estacao_atual='COZINHA',enviado_cozinha_em=now() where id=p_pedido_id;
    end if;
  end if;
  if v_p.requer_cozinha then
    update pedidos set estacao_atual='COZINHA',enviado_cozinha_em=coalesce(enviado_cozinha_em,now())
    where id=p_pedido_id and status='ACEITO' and estacao_atual='BALCAO';
  end if;
  if not v_p.requer_cozinha then
    update pedidos set status='PRONTO' where id=p_pedido_id and status='ACEITO';
    update pedidos set status='FINALIZADO' where id=p_pedido_id and status='PRONTO';
  end if;
end $fn$;
revoke all on function public.fn_pdv_concluir_pix(uuid,boolean) from public, anon;
grant execute on function public.fn_pdv_concluir_pix(uuid,boolean) to authenticated;

-- O gateway também chama o recalculador. No PDV o recibo transacional já
-- contém o preço conferido pelo servidor, inclusive desconto autorizado.
-- Recalcular pelo catálogo depois da venda mudaria a cobrança e apagaria desconto.
do $patch$
declare def text; ancora text := '  SELECT loja_id, cupom_id, coalesce(taxa_entrega, 0), cliente_id';
begin
  def := pg_get_functiondef('public.fn_recalcular_pedido(uuid)'::regprocedure);
  if strpos(def,ancora)=0 then raise exception 'Recalculador mudou; revisar patch do recibo PDV.'; end if;
  def := replace(def,ancora,$body$
  SELECT (t.resposta->>'valor_total')::numeric INTO v_total
  FROM public.pdv_tentativas t WHERE t.pedido_id=p_pedido_id;
  IF FOUND THEN RETURN v_total; END IF;
$body$ || ancora);
  execute def;
end $patch$;

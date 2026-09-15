-- Suíte de prova do desconto por cupom.
--
-- Por que existe: até 15/09/2026 o módulo de marketing não tinha UM teste. Foi
-- assim que passaram um crash de PL/pgSQL no cupom de primeira compra e, pior,
-- um pedido em dinheiro gravando o desconto que o navegador mandasse.
--
-- Como rodar: cole no SQL Editor do Supabase (ou mande pela Management API).
-- É SEGURO em produção: cada caso monta o cenário, confere e derruba tudo com
-- um RAISE no fim — nada é gravado. Confirme com a consulta de resíduo no pé.
--
-- Loja usada: Lanche do Paulista (`lanchepaulista`), o tenant de provas.

-- Uma linha do relatório, no formato caso|resultado|ok.
create or replace function pg_temp.linha(p_caso text, p_res text, p_ok boolean)
returns text language sql immutable as $$
  select p_caso || '|' || p_res || '|' || (p_ok)::text;
$$;

create or replace function pg_temp.prova_cupom() returns table(caso text, resultado text, ok boolean)
language plpgsql as $$
declare
  v_out text[] := '{}';
  v_loja uuid; v_prod uuid; v_preco numeric; v_cli uuid;
  v_ped uuid; v_cup uuid; v_desc numeric; v_tot numeric; v_sub numeric;
  v_peso numeric := 0.350; v_praticado numeric := 69.90;
begin
  select id into v_loja from public.lojas where slug = 'lanchepaulista';
  if v_loja is null then
    return query select 'setup'::text, 'loja lanchepaulista nao encontrada'::text, false; return;
  end if;
  select id, preco into v_prod, v_preco from public.produtos
   where loja_id = v_loja and disponivel limit 1;


  -- ── 1. Cupom vencido com total forjado pelo cliente ──────────────────────
  insert into public.cupons(loja_id,codigo,tipo,valor,pedido_minimo,ativo,validade)
    values (v_loja,'_PROVA_VENC','PERCENTUAL',90,0,true,current_date-30) returning id into v_cup;
  insert into public.pedidos(loja_id,status,tipo_pedido,identificador_cliente,cupom_id,
                             subtotal,desconto,valor_total,origem)
    values (v_loja,'NOVO','RETIRADA_BALCAO','_prova',v_cup,v_preco,v_preco-1,1,'link')
    returning id into v_ped;
  insert into public.itens_pedido(pedido_id,produto_id,quantidade,preco_unitario,nome_produto)
    values (v_ped,v_prod,1,v_preco,'x');
  set constraints all immediate;
  select desconto, valor_total into v_desc, v_tot from public.pedidos where id = v_ped;
  v_out := v_out || pg_temp.linha('cupom vencido + total forjado R$1',
    'desconto='||v_desc||' total='||v_tot, v_desc = 0 and v_tot = v_preco);

  -- ── 2. Cupom válido, mas o cliente manda um desconto maior ───────────────
  insert into public.cupons(loja_id,codigo,tipo,valor,pedido_minimo,ativo)
    values (v_loja,'_PROVA_10','PERCENTUAL',10,0,true) returning id into v_cup;
  insert into public.pedidos(loja_id,status,tipo_pedido,identificador_cliente,cupom_id,
                             subtotal,desconto,valor_total,origem)
    values (v_loja,'NOVO','RETIRADA_BALCAO','_prova',v_cup,v_preco,v_preco*0.9,v_preco*0.1,'link')
    returning id into v_ped;
  insert into public.itens_pedido(pedido_id,produto_id,quantidade,preco_unitario,nome_produto)
    values (v_ped,v_prod,1,v_preco,'x');
  set constraints all immediate;
  select desconto into v_desc from public.pedidos where id = v_ped;
  v_out := v_out || pg_temp.linha('cupom 10% + desconto forjado 90%',
    'desconto='||v_desc, v_desc = round(v_preco*0.1,2));

  -- ── 3. Abaixo do pedido mínimo ───────────────────────────────────────────
  insert into public.cupons(loja_id,codigo,tipo,valor,pedido_minimo,ativo)
    values (v_loja,'_PROVA_MIN','FIXO',15,9999,true) returning id into v_cup;
  insert into public.pedidos(loja_id,status,tipo_pedido,identificador_cliente,cupom_id,
                             subtotal,desconto,valor_total,origem)
    values (v_loja,'NOVO','RETIRADA_BALCAO','_prova',v_cup,v_preco,15,v_preco-15,'link')
    returning id into v_ped;
  insert into public.itens_pedido(pedido_id,produto_id,quantidade,preco_unitario,nome_produto)
    values (v_ped,v_prod,1,v_preco,'x');
  set constraints all immediate;
  select desconto into v_desc from public.pedidos where id = v_ped;
  v_out := v_out || pg_temp.linha('abaixo do pedido minimo', 'desconto='||v_desc, v_desc = 0);

  -- ── 4. Primeira compra usada por quem já comprou: descarta, não quebra ───
  select cliente_id into v_cli from public.pedidos
   where loja_id = v_loja and cliente_id is not null and status = 'FINALIZADO' limit 1;
  if v_cli is not null then
    insert into public.cupons(loja_id,codigo,tipo,valor,pedido_minimo,apenas_primeiro_pedido,ativo)
      values (v_loja,'_PROVA_1A','PERCENTUAL',20,0,true,true) returning id into v_cup;
    insert into public.pedidos(loja_id,cliente_id,status,tipo_pedido,identificador_cliente,
                               cupom_id,subtotal,valor_total,origem)
      values (v_loja,v_cli,'NOVO','RETIRADA_BALCAO','_prova',v_cup,0,0,'link') returning id into v_ped;
    insert into public.itens_pedido(pedido_id,produto_id,quantidade,preco_unitario,nome_produto)
      values (v_ped,v_prod,1,v_preco,'x');
    begin
      set constraints all immediate;
      select desconto into v_desc from public.pedidos where id = v_ped;
      v_out := v_out || pg_temp.linha('1a compra em cliente recorrente',
        'desconto='||v_desc, v_desc = 0);
    exception when others then
      v_out := v_out || pg_temp.linha('1a compra em cliente recorrente',
        'EXCECAO: '||SQLERRM, false);
    end;
  else
    v_out := v_out || pg_temp.linha('1a compra em cliente recorrente',
      'pulado: nenhum cliente com pedido FINALIZADO', true);
  end if;

  -- ── 5. Regressão: pedido sem cupom não pode ser alterado ─────────────────
  insert into public.pedidos(loja_id,status,tipo_pedido,identificador_cliente,subtotal,valor_total,origem)
    values (v_loja,'NOVO','RETIRADA_BALCAO','_prova',0,0,'link') returning id into v_ped;
  insert into public.itens_pedido(pedido_id,produto_id,quantidade,preco_unitario,nome_produto)
    values (v_ped,v_prod,2,v_preco,'x');
  set constraints all immediate;
  select subtotal, valor_total into v_sub, v_tot from public.pedidos where id = v_ped;
  v_out := v_out || pg_temp.linha('sem cupom, 2 itens',
    'subtotal='||v_sub||' total='||v_tot, v_sub = v_preco*2 and v_tot = v_preco*2);

  -- ── 6. Regressão: cupom legítimo continua valendo ────────────────────────
  insert into public.cupons(loja_id,codigo,tipo,valor,pedido_minimo,ativo)
    values (v_loja,'_PROVA_20','PERCENTUAL',20,0,true) returning id into v_cup;
  insert into public.pedidos(loja_id,status,tipo_pedido,identificador_cliente,cupom_id,subtotal,valor_total,origem)
    values (v_loja,'NOVO','RETIRADA_BALCAO','_prova',v_cup,0,0,'link') returning id into v_ped;
  insert into public.itens_pedido(pedido_id,produto_id,quantidade,preco_unitario,nome_produto)
    values (v_ped,v_prod,1,v_preco,'x');
  set constraints all immediate;
  select desconto, valor_total into v_desc, v_tot from public.pedidos where id = v_ped;
  v_out := v_out || pg_temp.linha('cupom legitimo de 20%',
    'desconto='||v_desc||' total='||v_tot, v_desc = round(v_preco*0.2,2));

  -- ── 7. Regressão: venda por peso mantém o preço praticado ────────────────
  -- O item da balança entra sem produto_id justamente para conservar o R$/kg
  -- que o operador praticou. Se algum dia isto falhar, o buffet perdeu o preço.
  insert into public.pedidos(loja_id,status,tipo_pedido,identificador_cliente,subtotal,valor_total,origem)
    values (v_loja,'NOVO','RETIRADA_BALCAO','_prova',0,0,'balanca') returning id into v_ped;
  insert into public.itens_pedido(pedido_id,produto_id,quantidade,preco_unitario,nome_produto)
    values (v_ped,null,v_peso,v_praticado,'Buffet por quilo');
  set constraints all immediate;
  select subtotal into v_sub from public.pedidos where id = v_ped;
  v_out := v_out || pg_temp.linha('balanca 0,350kg x R$69,90 praticado',
    'subtotal='||v_sub, v_sub = round(v_peso*v_praticado,2));

  raise exception 'PROVA:%', array_to_string(v_out, chr(10));
exception when others then
  if SQLERRM like 'PROVA:%' then
    -- O RAISE acima derruba tudo que a prova montou. A mensagem atravessa o
    -- rollback, e é por ela que o relatório volta.
    return query
      select split_part(l,'|',1), split_part(l,'|',2), split_part(l,'|',3)::boolean
      from unnest(string_to_array(substr(SQLERRM,7), chr(10))) l;
  else
    return query select 'erro de montagem'::text, SQLERRM::text, false;
  end if;
end $$;

select * from pg_temp.prova_cupom();

-- Resíduo (tem que devolver 0 e 0):
select (select count(*) from public.cupons  where codigo like '\_PROVA\_%') as cupons_deixados,
       (select count(*) from public.pedidos where identificador_cliente = '_prova') as pedidos_deixados;

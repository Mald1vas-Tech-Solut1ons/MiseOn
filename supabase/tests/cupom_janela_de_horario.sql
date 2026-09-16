-- Suíte de prova da janela de horário do cupom.
--
-- Por que existe: "desconto depois da 1h40" é regra de preço. Regra de preço
-- errada devolve dinheiro que não era para devolver, ou nega desconto que foi
-- prometido na tela — e as duas coisas o cliente percebe na frente do caixa.
--
-- Como rodar: cole no SQL Editor do Supabase (ou mande pela Management API).
-- É SEGURO em produção: cada caso monta o cenário, confere e derruba tudo com
-- um RAISE no fim — nada é gravado. Confirme com a consulta de resíduo no pé.
--
-- Loja usada: Lanche do Paulista (`lanchepaulista`), o tenant de provas.
--
-- As janelas são montadas RELATIVAS à hora local de quem roda, nunca fixas:
-- uma suíte que só passa às 14h não é suíte, é coincidência. Janela que cruza
-- a meia-noite (rodar isto às 23h30 monta uma) cai no ramo certo sozinha.

create or replace function pg_temp.linha(p_caso text, p_res text, p_ok boolean)
returns text language sql immutable as $$
  select p_caso || '|' || p_res || '|' || (p_ok)::text;
$$;

create or replace function pg_temp.prova_janela() returns table(caso text, resultado text, ok boolean)
language plpgsql as $$
declare
  v_out text[] := '{}';
  v_loja uuid; v_prod uuid; v_preco numeric;
  v_ped uuid; v_cup uuid; v_desc numeric; v_forjado timestamptz; v_gravado timestamptz;
  v_agora timestamp; v_dow smallint; v_erro text;
begin
  select id into v_loja from public.lojas where slug = 'lanchepaulista';
  if v_loja is null then
    return query select 'setup'::text, 'loja lanchepaulista nao encontrada'::text, false; return;
  end if;
  select id, preco into v_prod, v_preco from public.produtos
   where loja_id = v_loja and disponivel and preco > 0 limit 1;

  v_agora := now() at time zone 'America/Sao_Paulo';
  v_dow   := extract(dow from v_agora)::smallint;

  -- ── 1. Cupom SEM janela segue valendo (a migração é aditiva) ────────────
  insert into public.cupons(loja_id,codigo,tipo,valor,pedido_minimo,ativo)
    values (v_loja,'_PROVA_SEMJANELA','PERCENTUAL',10,0,true) returning id into v_cup;
  insert into public.pedidos(loja_id,status,tipo_pedido,identificador_cliente,cupom_id,origem)
    values (v_loja,'NOVO','RETIRADA_BALCAO','_provajanela',v_cup,'link') returning id into v_ped;
  insert into public.itens_pedido(pedido_id,produto_id,quantidade,preco_unitario,nome_produto)
    values (v_ped,v_prod,1,v_preco,'prova');
  set constraints all immediate;
  select desconto into v_desc from public.pedidos where id = v_ped;
  v_out := v_out || pg_temp.linha('cupom sem janela continua descontando',
    'desconto='||v_desc, v_desc = round(v_preco*0.10,2));

  -- ── 2. DENTRO da janela: o desconto entra ───────────────────────────────
  -- Janela de uma hora antes até uma hora depois de agora.
  insert into public.cupons(loja_id,codigo,tipo,valor,pedido_minimo,ativo,hora_inicio,hora_fim)
    values (v_loja,'_PROVA_DENTRO','PERCENTUAL',20,0,true,
            (v_agora - interval '1 hour')::time, (v_agora + interval '1 hour')::time)
    returning id into v_cup;
  insert into public.pedidos(loja_id,status,tipo_pedido,identificador_cliente,cupom_id,origem)
    values (v_loja,'NOVO','RETIRADA_BALCAO','_provajanela',v_cup,'link') returning id into v_ped;
  insert into public.itens_pedido(pedido_id,produto_id,quantidade,preco_unitario,nome_produto)
    values (v_ped,v_prod,1,v_preco,'prova');
  set constraints all immediate;
  select desconto into v_desc from public.pedidos where id = v_ped;
  v_out := v_out || pg_temp.linha('dentro da janela desconta',
    'desconto='||v_desc, v_desc = round(v_preco*0.20,2));

  -- ── 3. FORA da janela: o servidor zera, mesmo o pedido pedindo ──────────
  -- Janela daqui a 2h até daqui a 3h. E o INSERT já chega com desconto
  -- gravado, que é exatamente o que um navegador adulterado mandaria.
  insert into public.cupons(loja_id,codigo,tipo,valor,pedido_minimo,ativo,hora_inicio,hora_fim)
    values (v_loja,'_PROVA_FORA','PERCENTUAL',90,0,true,
            (v_agora + interval '2 hours')::time, (v_agora + interval '3 hours')::time)
    returning id into v_cup;
  insert into public.pedidos(loja_id,status,tipo_pedido,identificador_cliente,cupom_id,
                             subtotal,desconto,valor_total,origem)
    values (v_loja,'NOVO','RETIRADA_BALCAO','_provajanela',v_cup,
            v_preco,round(v_preco*0.90,2),round(v_preco*0.10,2),'link')
    returning id into v_ped;
  insert into public.itens_pedido(pedido_id,produto_id,quantidade,preco_unitario,nome_produto)
    values (v_ped,v_prod,1,v_preco,'prova');
  set constraints all immediate;
  select desconto into v_desc from public.pedidos where id = v_ped;
  v_out := v_out || pg_temp.linha('fora da janela nao desconta',
    'desconto='||v_desc, v_desc = 0);

  -- ── 4. Dia da semana certo ──────────────────────────────────────────────
  insert into public.cupons(loja_id,codigo,tipo,valor,pedido_minimo,ativo,dias_semana)
    values (v_loja,'_PROVA_DIAOK','PERCENTUAL',15,0,true,array[v_dow])
    returning id into v_cup;
  insert into public.pedidos(loja_id,status,tipo_pedido,identificador_cliente,cupom_id,origem)
    values (v_loja,'NOVO','RETIRADA_BALCAO','_provajanela',v_cup,'link') returning id into v_ped;
  insert into public.itens_pedido(pedido_id,produto_id,quantidade,preco_unitario,nome_produto)
    values (v_ped,v_prod,1,v_preco,'prova');
  set constraints all immediate;
  select desconto into v_desc from public.pedidos where id = v_ped;
  v_out := v_out || pg_temp.linha('dia da semana marcado desconta',
    'desconto='||v_desc, v_desc = round(v_preco*0.15,2));

  -- ── 5. Dia da semana errado ─────────────────────────────────────────────
  insert into public.cupons(loja_id,codigo,tipo,valor,pedido_minimo,ativo,dias_semana)
    values (v_loja,'_PROVA_DIANAO','PERCENTUAL',15,0,true,array[((v_dow+3)%7)::smallint])
    returning id into v_cup;
  insert into public.pedidos(loja_id,status,tipo_pedido,identificador_cliente,cupom_id,origem)
    values (v_loja,'NOVO','RETIRADA_BALCAO','_provajanela',v_cup,'link') returning id into v_ped;
  insert into public.itens_pedido(pedido_id,produto_id,quantidade,preco_unitario,nome_produto)
    values (v_ped,v_prod,1,v_preco,'prova');
  set constraints all immediate;
  select desconto into v_desc from public.pedidos where id = v_ped;
  v_out := v_out || pg_temp.linha('outro dia da semana nao desconta',
    'desconto='||v_desc, v_desc = 0);

  -- ── 6. A prévia recusa e diz a regra ────────────────────────────────────
  begin
    perform public.fn_validar_cupom(v_loja, '_PROVA_FORA', v_preco, null);
    v_out := v_out || pg_temp.linha('previa recusa fora da janela','nao levantou erro',false);
  exception when others then
    v_erro := SQLERRM;
    v_out := v_out || pg_temp.linha('previa recusa e diz a regra', v_erro,
      v_erro like 'Este cupom vale das %');
  end;

  -- ── 7. A prévia aceita dentro da janela ─────────────────────────────────
  begin
    perform public.fn_validar_cupom(v_loja, '_PROVA_DENTRO', v_preco, null);
    v_out := v_out || pg_temp.linha('previa aceita dentro da janela','passou',true);
  exception when others then
    v_out := v_out || pg_temp.linha('previa aceita dentro da janela',SQLERRM,false);
  end;

  -- ── 8. criado_em vindo do navegador é descartado ────────────────────────
  -- Sem esta trava a janela seria contornável: bastava mandar criado_em
  -- dentro do horário do desconto para levá-lo a qualquer hora.
  v_forjado := now() - interval '9 hours';
  insert into public.pedidos(loja_id,status,tipo_pedido,identificador_cliente,origem,criado_em)
    values (v_loja,'NOVO','RETIRADA_BALCAO','_provajanela','link',v_forjado)
    returning id into v_ped;
  select criado_em into v_gravado from public.pedidos where id = v_ped;
  v_out := v_out || pg_temp.linha('criado_em forjado no insert e descartado',
    'diferenca='||round(extract(epoch from (v_gravado - v_forjado)))||'s',
    v_gravado > v_forjado + interval '8 hours');

  -- ── 9. criado_em não se move no update ──────────────────────────────────
  update public.pedidos set criado_em = now() - interval '9 hours' where id = v_ped;
  v_out := v_out || pg_temp.linha('criado_em nao se move no update',
    'igual='||(v_gravado = (select criado_em from public.pedidos where id = v_ped))::text,
    v_gravado = (select criado_em from public.pedidos where id = v_ped));

  -- ── 10. A CHECK recusa dia inválido ─────────────────────────────────────
  begin
    insert into public.cupons(loja_id,codigo,tipo,valor,ativo,dias_semana)
      values (v_loja,'_PROVA_DIARUIM','FIXO',1,true,array[9]::smallint[]);
    v_out := v_out || pg_temp.linha('CHECK recusa dia fora de 0..6','aceitou',false);
  exception when check_violation then
    v_out := v_out || pg_temp.linha('CHECK recusa dia fora de 0..6','recusou',true);
  end;

  -- ── 11. A CHECK recusa array vazio ──────────────────────────────────────
  begin
    insert into public.cupons(loja_id,codigo,tipo,valor,ativo,dias_semana)
      values (v_loja,'_PROVA_DIAVAZIO','FIXO',1,true,array[]::smallint[]);
    v_out := v_out || pg_temp.linha('CHECK recusa array vazio','aceitou',false);
  exception when check_violation then
    v_out := v_out || pg_temp.linha('CHECK recusa array vazio','recusou',true);
  end;

  -- ── 12. A madrugada de sexta pega o cliente de 1h de sábado ─────────────
  -- Chamada direta ao predicado, com momento fixo: é a regra que nenhuma
  -- hora de execução consegue exercitar sozinha.
  v_out := v_out || pg_temp.linha('sexta 22h-02h pega sabado 01h',
    public.fn_cupom_na_janela('22:00','02:00',array[5]::smallint[],
      '2026-09-19 01:00-03'::timestamptz)::text,
    public.fn_cupom_na_janela('22:00','02:00',array[5]::smallint[],
      '2026-09-19 01:00-03'::timestamptz));

  v_out := v_out || pg_temp.linha('sexta 22h-02h solta domingo 01h',
    public.fn_cupom_na_janela('22:00','02:00',array[5]::smallint[],
      '2026-09-20 01:00-03'::timestamptz)::text,
    not public.fn_cupom_na_janela('22:00','02:00',array[5]::smallint[],
      '2026-09-20 01:00-03'::timestamptz));

  -- ── 13. O fuso é o da loja, não o do banco ──────────────────────────────
  -- 13h41 UTC é 10h41 em São Paulo. Um cupom "a partir das 13h40" que aceite
  -- este momento está comparando contra a hora do banco.
  v_out := v_out || pg_temp.linha('janela usa a hora da loja, nao a do banco',
    public.fn_cupom_na_janela('13:40',null,null,'2026-09-15 13:41+00'::timestamptz)::text,
    not public.fn_cupom_na_janela('13:40',null,null,'2026-09-15 13:41+00'::timestamptz));

  raise exception 'PROVA:%', array_to_string(v_out, chr(10));
exception when others then
  if SQLERRM like 'PROVA:%' then
    return query
      select split_part(l,'|',1), split_part(l,'|',2), split_part(l,'|',3)::boolean
      from unnest(string_to_array(substr(SQLERRM,7), chr(10))) l;
  else
    return query select 'erro de montagem'::text, SQLERRM::text, false;
  end if;
end $$;

select * from pg_temp.prova_janela();

-- Resíduo (tem que devolver 0 e 0):
select (select count(*) from public.cupons  where codigo like '\_PROVA\_%') as cupons_deixados,
       (select count(*) from public.pedidos where identificador_cliente = '_provajanela') as pedidos_deixados;

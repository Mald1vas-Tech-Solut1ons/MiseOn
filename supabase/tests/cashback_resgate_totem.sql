-- Suíte de prova do resgate de cashback no totem.
--
-- Por que existe: até 22/09/2026 o totem só acumulava, e a tela prometia "use
-- na próxima compra". Junto com o resgate vieram o estorno no CANCELADO (antes
-- só o cliente online recebia o saldo de volta) e o prazo de 15 dias.
--
-- Como rodar: mande pela Management API ou cole no SQL Editor. É SEGURO em
-- produção: monta o cenário, confere e derruba tudo com um RAISE no fim —
-- nada é gravado. Confirme com a consulta de resíduo no pé.
--
-- Loja usada: Lanche do Paulista (`lanchepaulista`), o tenant de provas.

create or replace function pg_temp.linha(p_caso text, p_res text, p_ok boolean)
returns text language sql immutable as $$
  select p_caso || '|' || p_res || '|' || (p_ok)::text;
$$;

create or replace function pg_temp.prova_cashback_totem() returns table(caso text, resultado text, ok boolean)
language plpgsql as $$
declare
  v_out text[] := '{}';
  v_loja uuid; v_token uuid; v_pct numeric; v_prod uuid; v_preco numeric;
  v_tel text := '00999990001'; v_cli uuid;
  v_itens jsonb; v_total numeric; v_teto numeric;
  v_cons jsonb; v_r jsonb; v_ped uuid; v_saldo numeric; v_pago numeric;
  v_mov int; v_cred numeric; v_exp timestamptz;
begin
  select id, totem_token, cashback_pct into v_loja, v_token, v_pct
    from public.lojas where slug = 'lanchepaulista';
  select id, preco into v_prod, v_preco from public.produtos
   where loja_id = v_loja and disponivel and preco >= 10 order by preco limit 1;
  v_itens := jsonb_build_array(jsonb_build_object('produto_id', v_prod, 'quantidade', 3, 'opcoes', '[]'::jsonb));
  v_total := v_preco * 3;
  v_teto  := floor(v_total * 30) / 100;

  insert into public.clientes (loja_id, telefone, nome) values (v_loja, v_tel, '_prova_cashback')
    returning id into v_cli;
  insert into public.cashback_saldos (cliente_id, loja_id, saldo) values (v_cli, v_loja, 100);
  insert into public.cashback_movimentos (loja_id, cliente_id, tipo, valor, expira_em)
    values (v_loja, v_cli, 'CREDITO', 100, now() + interval '10 days');

  -- ── 1. Consulta: teto de 30% do carrinho ─────────────────────────────────
  v_cons := public.fn_totem_saldo_cashback(v_token, v_tel, v_itens);
  v_out := v_out || pg_temp.linha('consulta: saldo 100, carrinho '||v_total,
    'resgate='||(v_cons->>'resgate')||' teto='||v_teto,
    (v_cons->>'resgate')::numeric = v_teto and (v_cons->>'saldo')::numeric = 100);

  -- ── 2. Pedido com intenção: servidor decide o valor ──────────────────────
  -- O payload traz um "cashback_usado" forjado: tem que ser ignorado.
  v_r := public.fn_totem_criar_pedido(v_token, jsonb_build_object(
    'metodo','PIX','telefone',v_tel,'usar_cashback',true,'cashback_usado',999,'itens',v_itens));
  v_ped := (v_r->>'pedido_id')::uuid;
  select saldo into v_saldo from public.cashback_saldos where cliente_id = v_cli and loja_id = v_loja;
  select valor_pago into v_pago from public.pagamentos where pedido_id = v_ped;
  set constraints all immediate;
  v_out := v_out || pg_temp.linha('pedido com usar_cashback (e 999 forjado)',
    'usado='||(v_r->>'cashback_usado')||' total='||(v_r->>'valor_total')||' pix='||v_pago||' saldo='||v_saldo,
    (v_r->>'cashback_usado')::numeric = v_teto
    and (v_r->>'valor_total')::numeric = v_total - v_teto
    and v_pago = v_total - v_teto
    and v_saldo = 100 - v_teto
    and (select cashback_usado from public.pedidos where id = v_ped) = v_teto);

  -- ── 3. Crédito do FINALIZADO: sobre o pago, 15 dias ──────────────────────
  perform public.fn_creditar_cashback(v_ped);
  select valor, expira_em into v_cred, v_exp from public.cashback_movimentos
   where pedido_id = v_ped and tipo = 'CREDITO';
  v_out := v_out || pg_temp.linha('crédito sobre o valor pago, validade 15 dias',
    'credito='||coalesce(v_cred::text,'nenhum')||' esperado='||round((v_total - v_teto) * v_pct / 100, 2)
      ||' dias='||coalesce(round(extract(epoch from v_exp - now()) / 86400)::text,'-'),
    coalesce(v_pct,0) <= 0 or (v_cred = round((v_total - v_teto) * v_pct / 100, 2)
      and round(extract(epoch from v_exp - now()) / 86400) = 15));
  delete from public.cashback_movimentos where pedido_id = v_ped and tipo = 'CREDITO';
  update public.cashback_saldos set saldo = 100 - v_teto where cliente_id = v_cli and loja_id = v_loja;

  -- ── 4. Cancelar no totem devolve o saldo, uma vez só ─────────────────────
  perform public.fn_totem_cancelar_pedido(v_token, v_ped);
  perform public.fn_totem_cancelar_pedido(v_token, v_ped);
  select saldo into v_saldo from public.cashback_saldos where cliente_id = v_cli and loja_id = v_loja;
  select count(*) into v_mov from public.cashback_movimentos where pedido_id = v_ped and tipo = 'ESTORNO';
  v_out := v_out || pg_temp.linha('cancelar no totem (duas vezes)',
    'saldo='||v_saldo||' estornos='||v_mov, v_saldo = 100 and v_mov = 1);

  -- ── 5. Cancelamento pela loja também devolve ─────────────────────────────
  v_r := public.fn_totem_criar_pedido(v_token, jsonb_build_object(
    'metodo','PIX','telefone',v_tel,'usar_cashback',true,'itens',v_itens));
  v_ped := (v_r->>'pedido_id')::uuid;
  update public.pedidos set status = 'CANCELADO' where id = v_ped;
  select saldo into v_saldo from public.cashback_saldos where cliente_id = v_cli and loja_id = v_loja;
  v_out := v_out || pg_temp.linha('cancelado por fora do totem',
    'saldo='||v_saldo, v_saldo = 100);

  -- ── 6. Sem a intenção, nada é gasto ──────────────────────────────────────
  v_r := public.fn_totem_criar_pedido(v_token, jsonb_build_object(
    'metodo','PIX','telefone',v_tel,'itens',v_itens));
  select saldo into v_saldo from public.cashback_saldos where cliente_id = v_cli and loja_id = v_loja;
  v_out := v_out || pg_temp.linha('pedido sem usar_cashback',
    'usado='||(v_r->>'cashback_usado')||' saldo='||v_saldo,
    (v_r->>'cashback_usado')::numeric = 0 and v_saldo = 100);

  -- ── 7. Saldo abaixo de R$ 5 não resgata ──────────────────────────────────
  update public.cashback_saldos set saldo = 4.99 where cliente_id = v_cli and loja_id = v_loja;
  v_cons := public.fn_totem_saldo_cashback(v_token, v_tel, v_itens);
  v_r := public.fn_totem_criar_pedido(v_token, jsonb_build_object(
    'metodo','PIX','telefone',v_tel,'usar_cashback',true,'itens',v_itens));
  v_out := v_out || pg_temp.linha('saldo R$ 4,99',
    'consulta='||(v_cons->>'resgate')||' pedido='||(v_r->>'cashback_usado'),
    (v_cons->>'resgate')::numeric = 0 and (v_r->>'cashback_usado')::numeric = 0);

  -- ── 8. Saldo vencido não aparece nem é gasto ─────────────────────────────
  update public.cashback_saldos set saldo = 100 where cliente_id = v_cli and loja_id = v_loja;
  delete from public.cashback_movimentos where cliente_id = v_cli;
  insert into public.cashback_movimentos (loja_id, cliente_id, tipo, valor, expira_em)
    values (v_loja, v_cli, 'CREDITO', 100, now() - interval '1 day');
  v_cons := public.fn_totem_saldo_cashback(v_token, v_tel, v_itens);
  v_out := v_out || pg_temp.linha('crédito vencido ontem',
    'saldo='||(v_cons->>'saldo')||' resgate='||(v_cons->>'resgate'),
    (v_cons->>'saldo')::numeric = 0 and (v_cons->>'resgate')::numeric = 0);

  -- ── 9. Telefone desconhecido e token errado ──────────────────────────────
  v_cons := public.fn_totem_saldo_cashback(v_token, '00999990002', v_itens);
  v_out := v_out || pg_temp.linha('telefone sem cadastro', 'resgate='||(v_cons->>'resgate'),
    (v_cons->>'resgate')::numeric = 0);
  begin
    perform public.fn_totem_saldo_cashback(gen_random_uuid(), v_tel, v_itens);
    v_out := v_out || pg_temp.linha('token inválido', 'respondeu', false);
  exception when others then
    v_out := v_out || pg_temp.linha('token inválido', 'recusado', true);
  end;

  -- ── 10. Nada interno exposto ao anônimo ──────────────────────────────────
  v_out := v_out || pg_temp.linha('anon sem acesso às funções internas',
    'manutencao='||has_function_privilege('anon','public.fn_cashback_manutencao()','execute')
      ||' creditar='||has_function_privilege('anon','public.fn_creditar_cashback(uuid)','execute')
      ||' consulta='||has_function_privilege('anon','public.fn_totem_saldo_cashback(uuid,text,jsonb)','execute'),
    not has_function_privilege('anon','public.fn_cashback_manutencao()','execute')
    and not has_function_privilege('anon','public.fn_creditar_cashback(uuid)','execute')
    and not has_function_privilege('anon','public.fn_expirar_cashback(uuid)','execute')
    and has_function_privilege('anon','public.fn_totem_saldo_cashback(uuid,text,jsonb)','execute'));

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

select * from pg_temp.prova_cashback_totem();

-- Resíduo (tem que devolver 0):
-- select count(*) from public.clientes where nome = '_prova_cashback';

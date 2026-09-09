-- Verificação com rollback interno: nenhuma fixture fica visível ao worker.
-- Executar como postgres, somente com a loja de testes provisionada.
do $$
declare
  v_loja uuid;
  v_cliente uuid := gen_random_uuid();
  v_pedido uuid := gen_random_uuid();
  v_cancelado uuid := gen_random_uuid();
  v_presencial uuid := gen_random_uuid();
  v_fila uuid := gen_random_uuid();
  v_total int;
begin
  select id into strict v_loja from public.lojas where nome = 'Lanche do Paulista';
  begin
    insert into public.clientes(id,loja_id,telefone,nome,email)
    values(v_cliente,v_loja,v_cliente::text,'Teste transacional','teste@example.invalid');
    insert into public.pedidos(id,loja_id,cliente_id,identificador_cliente,status,subtotal,valor_total,requer_cozinha)
    values(v_pedido,v_loja,v_cliente,'Teste transacional','AGUARDANDO_PAGAMENTO',10,10,false);
    if exists(select 1 from public.email_fila where referencia_id=v_pedido) then
      raise exception 'Checkout pendente enfileirou email';
    end if;
    if public.fn_email_enfileirar(v_loja,'pedido-recebido','teste@example.invalid','{}',v_pedido) is not null then
      raise exception 'Chamada direta contornou a espera do pagamento';
    end if;

    -- Reproduz uma linha que já estivesse na fila antes da correção.
    insert into public.email_fila(id,loja_id,evento,referencia_id,destinatario,classe)
    values(v_fila,v_loja,'pedido-recebido',v_pedido,'teste@example.invalid','TRANSACIONAL');
    perform public.fn_email_reservar(100,v_loja);
    if (select status from public.email_fila where id=v_fila) <> 'PENDENTE' then
      raise exception 'Worker reservou confirmação de checkout pendente';
    end if;
    delete from public.email_fila where id=v_fila;

    insert into public.pagamentos(pedido_id,metodo,valor_pago,status)
    values(v_pedido,'PIX',10,'PAGO');
    update public.pedidos set status='ACEITO' where id=v_pedido;
    select count(*) into v_total from public.email_fila
      where referencia_id=v_pedido and evento='pedido-recebido';
    if v_total <> 1 then raise exception 'Aprovação deveria enfileirar uma confirmação, recebeu %',v_total; end if;
    update public.pedidos set status='ACEITO' where id=v_pedido;
    perform public.fn_email_enfileirar(v_loja,'pedido-recebido','teste@example.invalid','{}',v_pedido);
    select count(*) into v_total from public.email_fila
      where referencia_id=v_pedido and evento='pedido-recebido';
    if v_total <> 1 then raise exception 'Repetição duplicou email'; end if;

    insert into public.pedidos(id,loja_id,cliente_id,identificador_cliente,status,requer_cozinha)
    values(v_cancelado,v_loja,v_cliente,'Teste cancelamento','AGUARDANDO_PAGAMENTO',false);
    update public.pedidos set status='CANCELADO' where id=v_cancelado;
    if exists(select 1 from public.email_fila where referencia_id=v_cancelado) then
      raise exception 'Cancelamento de checkout gerou email de pedido';
    end if;

    insert into public.pedidos(id,loja_id,cliente_id,identificador_cliente,tipo_pedido,status,requer_cozinha)
    values(v_presencial,v_loja,v_cliente,'Teste mesa','SALAO','ACEITO',false);
    if not exists(select 1 from public.email_fila where referencia_id=v_presencial and evento='pedido-recebido') then
      raise exception 'Mesa com pagamento posterior deixou de confirmar';
    end if;
    raise exception using errcode='ZT001', message='Verificação concluída: reverter fixtures';
  exception when sqlstate 'ZT001' then null;
  end;
  if exists(select 1 from public.pedidos where id in(v_pedido,v_cancelado,v_presencial))
    or exists(select 1 from public.clientes where id=v_cliente) then
    raise exception 'Fixture não foi revertida';
  end if;
  raise notice 'PASS: pendente, chamada direta, fila antiga, aprovação, repetição, cancelamento, salão e rollback';
end;
$$;

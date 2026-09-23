-- Verificação com rollback interno: nenhuma fixture fica visível ao worker.
-- Executar como postgres, somente com a loja de testes provisionada.
do $$
declare
  v_loja uuid;
  v_cliente uuid := gen_random_uuid();
  v_cancelado uuid := gen_random_uuid();
  v_aguardando uuid := gen_random_uuid();
  f_orfa uuid := gen_random_uuid();
  f_esgotada uuid := gen_random_uuid();
  f_recente uuid := gen_random_uuid();
  f_cancelado uuid := gen_random_uuid();
  f_aguardando uuid := gen_random_uuid();
  f_sumido uuid := gen_random_uuid();
  r record;
begin
  select id into strict v_loja from public.lojas where slug = 'lanchepaulista';
  begin
    insert into public.clientes(id,loja_id,telefone,nome,email)
    values(v_cliente,v_loja,v_cliente::text,'Teste fila','teste@example.invalid');
    insert into public.pedidos(id,loja_id,cliente_id,identificador_cliente,status,requer_cozinha)
    values(v_cancelado,v_loja,v_cliente,'Teste fila','CANCELADO',false),
          (v_aguardando,v_loja,v_cliente,'Teste fila','AGUARDANDO_PAGAMENTO',false);

    insert into public.email_fila(id,loja_id,evento,referencia_id,destinatario,classe,status,tentativas,atualizado_em)
    values
      (f_orfa,     v_loja,'pedido-a-caminho',null,'teste@example.invalid','TRANSACIONAL','ENVIANDO',0,now()-interval '20 minutes'),
      (f_esgotada, v_loja,'pedido-entregue', null,'teste@example.invalid','TRANSACIONAL','ENVIANDO',3,now()-interval '20 minutes'),
      (f_recente,  v_loja,'pedido-entregue', null,'teste2@example.invalid','TRANSACIONAL','ENVIANDO',0,now()-interval '2 minutes'),
      (f_cancelado,v_loja,'pedido-recebido',v_cancelado,'teste@example.invalid','TRANSACIONAL','PENDENTE',0,now()),
      (f_aguardando,v_loja,'pedido-recebido',v_aguardando,'teste@example.invalid','TRANSACIONAL','PENDENTE',0,now()),
      (f_sumido,   v_loja,'pedido-recebido',gen_random_uuid(),'teste@example.invalid','TRANSACIONAL','PENDENTE',0,now());

    perform public.fn_email_arrumar_fila();

    select status, tentativas into r from public.email_fila where id = f_orfa;
    if r.status <> 'PENDENTE' or r.tentativas <> 1 then
      raise exception 'Reserva órfã deveria voltar à fila com 1 tentativa, ficou % / %', r.status, r.tentativas;
    end if;
    if (select status from public.email_fila where id = f_esgotada) <> 'FALHOU' then
      raise exception 'Reserva órfã na 4ª tentativa deveria virar FALHOU';
    end if;
    if (select status from public.email_fila where id = f_recente) <> 'ENVIANDO' then
      raise exception 'Reserva recente não pode ser tomada do worker';
    end if;
    if (select status from public.email_fila where id = f_cancelado) <> 'SUPRIMIDO' then
      raise exception 'Confirmação de pedido cancelado deveria ser SUPRIMIDA';
    end if;
    if (select status from public.email_fila where id = f_sumido) <> 'SUPRIMIDO' then
      raise exception 'Confirmação de pedido inexistente deveria ser SUPRIMIDA';
    end if;
    if (select status from public.email_fila where id = f_aguardando) <> 'PENDENTE' then
      raise exception 'Confirmação aguardando pagamento deve continuar esperando';
    end if;

    -- O item que espera pagamento NÃO pode acordar o drenador.
    if public.fn_email_pronto_para_envio((select q from public.email_fila q where id = f_aguardando)) then
      raise exception 'Item aguardando pagamento foi considerado pronto';
    end if;
    if not public.fn_email_pronto_para_envio((select q from public.email_fila q where id = f_orfa)) then
      raise exception 'Reserva devolvida deveria estar pronta para envio';
    end if;

    raise exception using errcode='ZT001', message='Verificação concluída: reverter fixtures';
  exception when sqlstate 'ZT001' then null;
  end;
  if exists(select 1 from public.email_fila where id in (f_orfa,f_esgotada,f_recente,f_cancelado,f_aguardando,f_sumido))
    or exists(select 1 from public.clientes where id=v_cliente) then
    raise exception 'Fixture não foi revertida';
  end if;
  raise notice 'PASS: órfã devolvida, esgotada falha, recente intocada, cancelado/sumido suprimidos, aguardando espera sem acordar o drenador, rollback';
end;
$$;

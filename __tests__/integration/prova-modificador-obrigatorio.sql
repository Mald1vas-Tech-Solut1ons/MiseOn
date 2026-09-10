-- Prova de comportamento da trava de modificador obrigatório.
-- Cria um pedido de balcão com um produto que TEM "Ponto da carne" obrigatório,
-- tenta aceitar sem responder (deve barrar), responde e tenta de novo (deve aceitar).
do $prova$
declare
  v_loja uuid; v_prod uuid; v_ped uuid; v_item uuid; v_op uuid;
  v_sem text := 'NAO BARROU (falha)';
  v_com text := '';
begin
  select p.loja_id, p.id into v_loja, v_prod
    from produtos p
    join grupos_opcoes g on g.produto_id = p.id
   where g.min_escolhas >= 1 and g.nome = 'Ponto da carne'
   limit 1;

  insert into pedidos (loja_id, identificador_cliente, tipo_pedido, status, valor_total)
  values (v_loja, 'PROVA OBRIGATORIO', 'RETIRADA_BALCAO', 'NOVO', 10)
  returning id into v_ped;

  insert into itens_pedido (pedido_id, produto_id, nome_produto, preco_unitario, quantidade)
  values (v_ped, v_prod, 'Item de prova', 10, 1)
  returning id into v_item;

  begin
    update pedidos set status = 'ACEITO' where id = v_ped;
  exception when others then
    v_sem := 'BARROU: ' || sqlerrm;
  end;

  select o.id into v_op
    from opcoes o join grupos_opcoes g on g.id = o.grupo_id
   where g.produto_id = v_prod and g.nome = 'Ponto da carne'
   limit 1;

  insert into itens_pedido_opcoes (item_id, opcao_id) values (v_item, v_op);

  begin
    update pedidos set status = 'ACEITO' where id = v_ped;
    v_com := 'ACEITOU (correto)';
  exception when others then
    v_com := 'RECUSOU (falha): ' || sqlerrm;
  end;

  create temp table _r as select v_sem as sem_o_obrigatorio, v_com as com_o_obrigatorio;
end;
$prova$;

select * from _r

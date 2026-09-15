-- Executar depois da migration DENTRO de BEGIN/ROLLBACK: não deixa vendas nem usuários.
do $test$
declare
  u uuid:=gen_random_uuid(); l uuid:=gen_random_uuid(); outra uuid:=gen_random_uuid();
  produto uuid:=gen_random_uuid(); intruso uuid:=gen_random_uuid(); cozinha uuid:=gen_random_uuid();
  chave uuid:=gen_random_uuid(); payload jsonb; r jsonb; repetido jsonb; pix jsonb;
  insumo uuid:=gen_random_uuid(); cliente uuid:=gen_random_uuid(); grupo uuid:=gen_random_uuid(); opcao uuid:=gen_random_uuid();
  estacao uuid:=gen_random_uuid(); workflow uuid:=gen_random_uuid();
  recusou boolean; qtd int;
begin
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  insert into auth.users(id) values(u);
  insert into lojas(id,nome,slug) values(l,'QA transação rollback','qa-descartavel-'||l),(outra,'QA isolamento rollback','qa-descartavel-'||outra);
  insert into usuarios_loja(user_id,loja_id,papel) values(u,l,'admin');
  insert into produtos(id,loja_id,nome,preco,disponivel,estacao_preparo)
  values(produto,l,'Água teste',10,true,'DIRETO'),(intruso,outra,'Outra loja',10,true,'DIRETO'),(cozinha,l,'Prato teste',20,true,'COZINHA');
  insert into insumos(id,loja_id,nome,unidade_medida,quantidade_atual,preco_embalagem,qtd_embalagem,ativo,classificacao_origem,classificacao_confianca)
  values(insumo,l,'Insumo QA','un',0,5,1,true,'IA','baixa');
  update produtos set controla_estoque=true where id in (produto,cozinha);
  insert into fichas_tecnicas(produto_id,insumo_id,quantidade_consumida) values(produto,insumo,1),(cozinha,insumo,1);
  insert into clientes(id,loja_id,nome,telefone) values(cliente,l,'Cliente QA','qa-'||cliente);
  insert into cashback_saldos(loja_id,cliente_id,saldo) values(l,cliente,5);
  insert into kds_estacoes(id,loja_id,nome,ativo,ordem) values(estacao,l,'QA cozinha',true,900);
  insert into kds_workflows(id,loja_id,estacao_id,nome,etapas)
  values(workflow,l,estacao,'QA fluxo','[{"id":"fila","nome":"Fila","ordem":0},{"id":"preparo","nome":"Preparo","ordem":1},{"id":"expedicao","nome":"Expedição","ordem":2}]');
  update produtos set estacao_kds_id=estacao,workflow_kds_id=workflow where id=cozinha;
  insert into grupos_opcoes(id,produto_id,nome,min_escolhas,max_escolhas) values(grupo,cozinha,'Ponto',1,1);
  insert into opcoes(id,grupo_id,nome,preco_adicional,disponivel) values(opcao,grupo,'Ao ponto',0,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  perform fn_movimentar_estoque(p_insumo_id=>insumo,p_tipo=>'ENTRADA',p_quantidade=>10,p_custo_total=>50,p_motivo=>'QA rollback');
  payload:=jsonb_build_object('loja_id',l,'tipo_pedido','RETIRADA_BALCAO','metodo','DINHEIRO','valor_total',20,
    'itens',jsonb_build_array(jsonb_build_object('produto_id',produto,'quantidade',2)));
  r:=fn_pdv_registrar(chave,payload);
  repetido:=fn_pdv_registrar(chave,payload);
  if r<>repetido then raise exception 'TESTE: retry mudou pedido'; end if;
  if (select quantidade_atual from insumos where id=insumo)<>8 then raise exception 'TESTE: saldo incorreto após venda/retry'; end if;
  if (select sum(quantidade_restante) from lotes_estoque where insumo_id=insumo)<>8 then raise exception 'TESTE: lotes não acompanharam venda'; end if;
  if (select count(*) from pagamentos where pedido_id=(r->>'id')::uuid)<>1 then raise exception 'TESTE: pagamento duplicado'; end if;
  if (select status::text from pedidos where id=(r->>'id')::uuid)<>'FINALIZADO' then raise exception 'TESTE: balcão não finalizou'; end if;
  recusou:=false;
  begin perform fn_pdv_registrar(chave,payload||'{"valor_total":5}'); exception when others then recusou:=true; end;
  if not recusou then raise exception 'TESTE: aceitou alteração de tentativa'; end if;
  select count(*) into qtd from pedidos where loja_id=l;
  recusou:=false;
  begin
    perform fn_pdv_registrar(gen_random_uuid(), payload||jsonb_build_object('itens',jsonb_build_array(
      jsonb_build_object('produto_id',produto,'quantidade',1),jsonb_build_object('produto_id',intruso,'quantidade',1))));
  exception when others then recusou:=true; end;
  if not recusou or (select count(*) from pedidos where loja_id=l)<>qtd then raise exception 'TESTE: falha parcial deixou pedido'; end if;
  recusou:=false;
  begin perform fn_ajustar_operacao_nicho(outra); exception when insufficient_privilege then recusou:=true; end;
  if not recusou then raise exception 'TESTE: configurou outra loja'; end if;
  perform fn_ajustar_operacao_nicho(l);
  pix:=fn_pdv_registrar(gen_random_uuid(),payload||'{"metodo":"PIX"}');
  if (select status::text from pedidos where id=(pix->>'id')::uuid)<>'AGUARDANDO_PAGAMENTO' then raise exception 'TESTE: Pix entrou antes de pagar'; end if;
  if (select quantidade_atual from insumos where id=insumo)<>8 then raise exception 'TESTE: Pix pendente baixou estoque'; end if;
  recusou:=false;
  begin perform fn_pdv_concluir_pix((pix->>'id')::uuid); exception when others then recusou:=true; end;
  if not recusou then raise exception 'TESTE: concluiu Pix sem pagamento'; end if;
  perform fn_pdv_concluir_pix((pix->>'id')::uuid,true);
  perform fn_pdv_concluir_pix((pix->>'id')::uuid,true);
  if (select status::text from pedidos where id=(pix->>'id')::uuid)<>'FINALIZADO' then raise exception 'TESTE: Pix não finalizou'; end if;
  if (select quantidade_atual from insumos where id=insumo)<>6 then raise exception 'TESTE: Pix baixou estoque errado'; end if;
  recusou:=false;
  begin perform fn_pdv_registrar(gen_random_uuid(),payload||jsonb_build_object('itens',jsonb_build_array(jsonb_build_object('produto_id',cozinha,'quantidade',1))));
  exception when others then recusou:=true; end;
  if not recusou then raise exception 'TESTE: aceitou produto sem opção obrigatória'; end if;
  r:=fn_pdv_registrar(gen_random_uuid(),payload||jsonb_build_object('itens',jsonb_build_array(jsonb_build_object('produto_id',cozinha,'quantidade',1,'opcoes',jsonb_build_array(jsonb_build_object('id',opcao))))));
  set constraints all immediate;
  if not exists(select 1 from kds_tickets where pedido_id=(r->>'id')::uuid) then raise exception 'TESTE: ticket não chegou ao KDS'; end if;
  if (select status::text from pedidos where id=(r->>'id')::uuid) not in ('ACEITO','PREPARANDO') then raise exception 'TESTE: cozinha não recebeu'; end if;
  if (select quantidade_atual from insumos where id=insumo)<>5 then raise exception 'TESTE: cozinha não baixou estoque'; end if;
  update pedidos set status='CANCELADO' where id=(r->>'id')::uuid;
  if (select quantidade_atual from insumos where id=insumo)<>6 then raise exception 'TESTE: cancelamento não recompôs saldo'; end if;
  if (select sum(quantidade_restante) from lotes_estoque where insumo_id=insumo)<>6 then raise exception 'TESTE: cancelamento não recompôs lotes'; end if;
  r:=fn_pdv_registrar(gen_random_uuid(),payload||jsonb_build_object('cliente_id',cliente,'desconto',3,'cashback_usado',3,'valor_total',17));
  execute 'reset role';
  if fn_recalcular_pedido((r->>'id')::uuid)<>17 then raise exception 'TESTE: gateway mudou o total/desconto do PDV'; end if;
  execute 'set local role authenticated';
  if (select saldo from cashback_saldos where cliente_id=cliente and loja_id=l)<>2 then raise exception 'TESTE: cashback não debitado'; end if;
  if (select count(*) from vw_insumos_a_revisar where loja_id=l)<>1 then raise exception 'TESTE: view bloqueou dono'; end if;
  execute 'reset role';
  execute 'set local role anon';
  recusou:=false;
  begin perform fn_ajustar_operacao_nicho(l); exception when insufficient_privilege then recusou:=true; end;
  if not recusou then raise exception 'TESTE: anônimo configurou loja'; end if;
  recusou:=false;
  begin perform * from vw_insumos_a_revisar; exception when insufficient_privilege then recusou:=true; end;
  if not recusou then raise exception 'TESTE: anônimo acessou view'; end if;
  execute 'reset role';
end $test$;
select 'PASS: venda, retry, atomicidade, autorização, Pix e cozinha' as resultado;

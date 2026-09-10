-- Prova de comportamento da expedição parcial.
-- Monta dois pedidos com DOIS tickets cada (um PRONTO, um AGUARDANDO):
--   SALAO    -> deve expedir 1 e deixar o outro em produção
--   DELIVERY -> deve recusar, porque a sacola sai inteira
-- Tudo dentro de begin/rollback: não fica nada no banco.
do $prova$
declare
  v_loja uuid; v_user uuid; v_estacao uuid; v_workflow uuid;
  v_salao uuid; v_delivery uuid;
  v_salao_res jsonb; v_salao_2a jsonb; v_delivery_res text;
begin
  -- Sessão de um admin real da loja: a RPC exige papel admin/operador.
  select ul.loja_id, ul.user_id into v_loja, v_user
    from usuarios_loja ul where ul.papel = 'admin' limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text, true);

  select id into v_estacao from kds_estacoes where loja_id = v_loja limit 1;
  select id into v_workflow from kds_workflows where loja_id = v_loja limit 1;
  if v_estacao is null or v_workflow is null then
    create temp table _r as select 'BLOCKED: loja sem estacao/workflow de KDS'::text as salao,
                                   'BLOCKED'::text as salao_2a, 'BLOCKED'::text as delivery;
    return;
  end if;

  -- ── Pedido de SALÃO: chope pronto, prato ainda na chapa ──
  insert into pedidos (loja_id, identificador_cliente, tipo_pedido, status, valor_total)
  values (v_loja, 'PROVA SALAO', 'SALAO', 'PREPARANDO', 50) returning id into v_salao;

  insert into kds_tickets (loja_id, pedido_id, estacao_id, workflow_id, workflow_snapshot, rodada_numero, itens, status)
  values (v_loja, v_salao, v_estacao, v_workflow, '[]'::jsonb, 1, '[]'::jsonb, 'PRONTO'),
         (v_loja, v_salao, v_estacao, v_workflow, '[]'::jsonb, 2, '[]'::jsonb, 'AGUARDANDO');

  v_salao_res := fn_expedir_kds_pedido(v_salao);
  v_salao_2a  := fn_expedir_kds_pedido(v_salao);

  -- ── Pedido de DELIVERY: mesma situação, resposta oposta ──
  insert into pedidos (loja_id, identificador_cliente, tipo_pedido, status, valor_total)
  values (v_loja, 'PROVA DELIVERY', 'DELIVERY', 'PREPARANDO', 50) returning id into v_delivery;

  insert into kds_tickets (loja_id, pedido_id, estacao_id, workflow_id, workflow_snapshot, rodada_numero, itens, status)
  values (v_loja, v_delivery, v_estacao, v_workflow, '[]'::jsonb, 1, '[]'::jsonb, 'PRONTO'),
         (v_loja, v_delivery, v_estacao, v_workflow, '[]'::jsonb, 2, '[]'::jsonb, 'AGUARDANDO');

  begin
    perform fn_expedir_kds_pedido(v_delivery);
    v_delivery_res := 'EXPEDIU (falha: sacola sairia pela metade)';
  exception when others then
    v_delivery_res := 'RECUSOU (correto): ' || sqlerrm;
  end;

  create temp table _r as
  select v_salao_res::text as salao_1a_chamada,
         v_salao_2a::text  as salao_2a_chamada,
         v_delivery_res    as delivery,
         (select status from pedidos where id = v_salao)::text as status_pedido_salao;
end;
$prova$;

select * from _r

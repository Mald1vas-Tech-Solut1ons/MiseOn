-- Suíte de prova da entrada fiscal com fonte e confiança (Sprint 18).
--
-- A regra que está sendo provada: o MiseOn nunca transforma um dado fiscal
-- correto em estoque semanticamente errado.
--
-- Como rodar: Management API ou SQL Editor. SEGURO em produção: monta tudo,
-- confere e derruba com RAISE no fim. Tenant: lanchepaulista.

create or replace function pg_temp.linha(p_caso text, p_res text, p_ok boolean)
returns text language sql immutable as $$ select p_caso || '|' || p_res || '|' || (p_ok)::text; $$;

create or replace function pg_temp.prova() returns table(caso text, resultado text, ok boolean)
language plpgsql as $$
declare
  v_out text[] := '{}';
  v_loja uuid; v_admin uuid; v_ins uuid; v_r jsonb; v_mov record; v_lote record; v_emb record;
begin
  select id into v_loja from lojas where slug = 'lanchepaulista';
  select user_id into v_admin from usuarios_loja where loja_id = v_loja and papel = 'admin' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  -- ── 1. qCom=20 KG, vUnCom=18,90, vProd=378: 20 kg, NUNCA 378 ─────────────
  insert into insumos (loja_id, nome, unidade_medida, quantidade_atual, ativo)
    values (v_loja, '_PROVA_ALCATRA', 'kg', 0, true) returning id into v_ins;
  v_r := fn_importar_nfce(v_loja, null, '_prova', jsonb_build_array(jsonb_build_object(
    'insumo_id', v_ins, 'nome', '_PROVA_ALCATRA', 'descricao_nota', 'ALCATRA KG',
    'qtd_nota', 20, 'unidade_nota', 'KG', 'valor_unitario_nota', 18.90, 'valor_total_nota', 378.00,
    'fator', 1, 'origem_fator', 'REGRA', 'custo_total', 378.00)), true);
  select * into v_mov from movimentacoes_estoque where insumo_id = v_ins and tipo = 'ENTRADA';
  select * into v_lote from lotes_estoque where insumo_id = v_ins;
  v_out := v_out || pg_temp.linha('20 KG x 18,90 = 378',
    format('estoque=%s kg, lote custo=%s/kg, rastro=%s %s fator %s %s',
      v_mov.quantidade, v_lote.custo_unitario, v_mov.qtd_nota, v_mov.unidade_nota, v_mov.fator_conversao, v_mov.origem_fator),
    v_mov.quantidade = 20 and v_lote.custo_unitario = 18.90 and v_mov.qtd_nota = 20
      and v_mov.unidade_nota = 'KG' and v_mov.origem_fator = 'REGRA');

  -- ── 2. 10 CX x 50 = 500, qTrib 120 UN: 120 un a R$ 4,1667 ────────────────
  insert into insumos (loja_id, nome, unidade_medida, quantidade_atual, ativo)
    values (v_loja, '_PROVA_REFRI_LATA', 'un', 0, true) returning id into v_ins;
  v_r := fn_importar_nfce(v_loja, null, '_prova', jsonb_build_array(jsonb_build_object(
    'insumo_id', v_ins, 'nome', '_PROVA_REFRI_LATA', 'descricao_nota', 'REFRI LATA CX',
    'qtd_nota', 10, 'unidade_nota', 'CX', 'valor_unitario_nota', 50, 'valor_total_nota', 500,
    'fator', 12, 'origem_fator', 'NOTA_FISCAL', 'custo_total', 500)), true);
  select * into v_mov from movimentacoes_estoque where insumo_id = v_ins and tipo = 'ENTRADA';
  select * into v_lote from lotes_estoque where insumo_id = v_ins;
  select qtd_embalagem, qtd_embalagem_origem, preco_embalagem into v_emb from insumos where id = v_ins;
  v_out := v_out || pg_temp.linha('10 CX (qTrib 120 UN) x 50',
    format('estoque=%s un, lote=%s/un, embalagem=%s (%s) a %s',
      v_mov.quantidade, round(v_lote.custo_unitario, 4), v_emb.qtd_embalagem, v_emb.qtd_embalagem_origem, v_emb.preco_embalagem),
    v_mov.quantidade = 120 and round(v_lote.custo_unitario, 4) = 4.1667
      and v_emb.qtd_embalagem = 12 and v_emb.qtd_embalagem_origem = 'NOTA_FISCAL' and v_emb.preco_embalagem = 50);

  -- ── 3. Fator da IA sem confirmação: recusado, nada entra ────────────────
  insert into insumos (loja_id, nome, unidade_medida, quantidade_atual, ativo)
    values (v_loja, '_PROVA_GUARDANAPO', 'un', 0, true) returning id into v_ins;
  v_r := fn_importar_nfce(v_loja, null, '_prova', jsonb_build_array(jsonb_build_object(
    'insumo_id', v_ins, 'nome', '_PROVA_GUARDANAPO', 'descricao_nota', 'GUARDANAPO PCT',
    'qtd_nota', 5, 'unidade_nota', 'PCT', 'valor_unitario_nota', 8, 'valor_total_nota', 40,
    'fator', 50, 'origem_fator', 'IA', 'custo_total', 40)), true);
  v_out := v_out || pg_temp.linha('IA sem confirmação',
    format('recusados=%s motivo=%s saldo=%s', v_r->>'itens_recusados', v_r->'recusas'->0->>'motivo',
      (select quantidade_atual from insumos where id = v_ins)),
    (v_r->>'itens_recusados')::int = 1 and (select quantidade_atual from insumos where id = v_ins) = 0
      and not exists (select 1 from movimentacoes_estoque where insumo_id = v_ins));

  -- ── 4. A mesma linha, confirmada pelo lojista: entra, e vira USUARIO ────
  v_r := fn_importar_nfce(v_loja, null, '_prova', jsonb_build_array(jsonb_build_object(
    'insumo_id', v_ins, 'nome', '_PROVA_GUARDANAPO', 'descricao_nota', 'GUARDANAPO PCT',
    'qtd_nota', 5, 'unidade_nota', 'PCT', 'valor_unitario_nota', 8, 'valor_total_nota', 40,
    'fator', 50, 'origem_fator', 'IA', 'fator_confirmado', true, 'custo_total', 40)), true);
  select qtd_embalagem, qtd_embalagem_origem into v_emb from insumos where id = v_ins;
  v_out := v_out || pg_temp.linha('IA confirmada',
    format('saldo=%s embalagem=%s (%s)', (select quantidade_atual from insumos where id = v_ins), v_emb.qtd_embalagem, v_emb.qtd_embalagem_origem),
    (select quantidade_atual from insumos where id = v_ins) = 250 and v_emb.qtd_embalagem_origem = 'USUARIO');

  -- ── 5. Leitura trocada (qtd 378, un 18,90, total 378): recusada ─────────
  insert into insumos (loja_id, nome, unidade_medida, quantidade_atual, ativo)
    values (v_loja, '_PROVA_PICANHA', 'kg', 0, true) returning id into v_ins;
  v_r := fn_importar_nfce(v_loja, null, '_prova', jsonb_build_array(jsonb_build_object(
    'insumo_id', v_ins, 'nome', '_PROVA_PICANHA', 'descricao_nota', 'PICANHA KG',
    'qtd_nota', 378, 'unidade_nota', 'KG', 'valor_unitario_nota', 18.90, 'valor_total_nota', 378,
    'fator', 1, 'origem_fator', 'REGRA', 'custo_total', 378)), true);
  v_out := v_out || pg_temp.linha('qtd trocada por valor (378 kg a 18,90 = 378?)',
    format('recusados=%s motivo=%s', v_r->>'itens_recusados', v_r->'recusas'->0->>'motivo'),
    (v_r->>'itens_recusados')::int = 1 and (select quantidade_atual from insumos where id = v_ins) = 0);

  -- ── 6. Correção do lojista não é sobrescrita por leitura automática ─────
  insert into insumos (loja_id, nome, unidade_medida, quantidade_atual, ativo, qtd_embalagem, qtd_embalagem_origem, preco_embalagem)
    values (v_loja, '_PROVA_OVOS', 'un', 0, true, 30, 'USUARIO', 18) returning id into v_ins;
  v_r := fn_importar_nfce(v_loja, null, '_prova', jsonb_build_array(jsonb_build_object(
    'insumo_id', v_ins, 'nome', '_PROVA_OVOS', 'descricao_nota', 'OVOS PVC 20UN',
    'qtd_nota', 2, 'unidade_nota', 'UN', 'valor_unitario_nota', 12, 'valor_total_nota', 24,
    'fator', 20, 'origem_fator', 'REGRA', 'custo_total', 24)), true);
  select qtd_embalagem, qtd_embalagem_origem, preco_embalagem into v_emb from insumos where id = v_ins;
  select * into v_lote from lotes_estoque where insumo_id = v_ins;
  v_out := v_out || pg_temp.linha('embalagem USUARIO=30 vs nota 20UN',
    format('embalagem=%s (%s) preco=%s lote=%s/un', v_emb.qtd_embalagem, v_emb.qtd_embalagem_origem, v_emb.preco_embalagem, v_lote.custo_unitario),
    v_emb.qtd_embalagem = 30 and v_emb.qtd_embalagem_origem = 'USUARIO'
      and v_emb.preco_embalagem = 18 and v_lote.custo_unitario = 0.6);

  -- ── 7. Conversão desconhecida (fator 0): recusada ───────────────────────
  v_r := fn_importar_nfce(v_loja, null, '_prova', jsonb_build_array(jsonb_build_object(
    'insumo_id', v_ins, 'nome', '_PROVA_OVOS', 'descricao_nota', 'OVOS CX',
    'qtd_nota', 1, 'unidade_nota', 'CX', 'valor_unitario_nota', 90, 'valor_total_nota', 90,
    'fator', 0, 'origem_fator', 'REGRA', 'custo_total', 90)), true);
  v_out := v_out || pg_temp.linha('CX sem conversão conhecida', format('recusados=%s', v_r->>'itens_recusados'),
    (v_r->>'itens_recusados')::int = 1);

  -- ── 8. Cliente antigo (sem origem): entra como antes, marcado LEGADO ────
  insert into insumos (loja_id, nome, unidade_medida, quantidade_atual, ativo)
    values (v_loja, '_PROVA_LEGADO', 'kg', 0, true) returning id into v_ins;
  v_r := fn_importar_nfce(v_loja, null, '_prova', jsonb_build_array(jsonb_build_object(
    'insumo_id', v_ins, 'nome', '_PROVA_LEGADO', 'qtd_nota', 3, 'fator', 1, 'custo_total', 30)), true);
  select * into v_mov from movimentacoes_estoque where insumo_id = v_ins;
  v_out := v_out || pg_temp.linha('payload antigo', format('estoque=%s origem=%s', v_mov.quantidade, v_mov.origem_fator),
    v_mov.quantidade = 3 and v_mov.origem_fator = 'LEGADO');

  raise exception 'PROVA:%', array_to_string(v_out, chr(10));
exception when others then
  if SQLERRM like 'PROVA:%' then
    return query select split_part(l,'|',1), split_part(l,'|',2), split_part(l,'|',3)::boolean
      from unnest(string_to_array(substr(SQLERRM,7), chr(10))) l;
  else
    return query select 'erro de montagem'::text, SQLERRM::text, false;
  end if;
end $$;

select * from pg_temp.prova();
-- Resíduo (tem que devolver 0): select count(*) from insumos where nome like '\_PROVA\_%';

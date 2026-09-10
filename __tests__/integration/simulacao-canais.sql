-- =====================================================================
-- SIMULACAO DE CANAIS — prova de integridade do pedido de ponta a ponta
-- =====================================================================
-- Roda contra o banco de PRODUCAO dentro de uma transacao que termina em
-- ROLLBACK: cria loja/mesa/produto/insumo temporarios, exercita os SEIS
-- canais de entrada de pedido e NAO deixa rastro.
--
-- Como executar (nao ha psql/CLI/Docker neste ambiente):
--   PAT=$(grep -E "^SUPABASE_ACCESS_TOKEN=" .env.local | cut -d= -f2- | tr -d '"\r')
--   curl -s -X POST "https://api.supabase.com/v1/projects/<ref>/database/query" \
--     -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" -d @q.json
-- O corpo e {"query": "<este arquivo>"}. A API devolve as linhas do SELECT
-- final e o ROLLBACK desfaz tudo. NUNCA rode sem o rollback.
--
-- Cada bloco DO tem um sub-bloco begin/exception: se um canal quebrar, ele
-- registra BLOCKED e os outros continuam medindo.
-- =====================================================================

begin;

create temp table res(ord serial, canal text, invariante text, resultado text, evidencia text);
create temp table ctx(k text primary key, v text);

-- ---------------------------------------------------------------------
-- SETUP: tenant descartavel completo (loja aberta, plano de contas vindo
-- do trigger trg_criar_contas_padrao, duas estacoes de KDS com workflow,
-- insumo com lote custeado, produto com ficha tecnica e modificador).
-- ---------------------------------------------------------------------
do $setup$
declare
  v_user uuid; v_outro uuid;
  v_loja uuid; v_cat uuid; v_mesa uuid; v_mesa2 uuid;
  v_ins_pao uuid; v_ins_bacon uuid;
  v_burger uuid; v_drink uuid; v_refri uuid;
  v_grp uuid; v_opc uuid;
  v_est_coz uuid; v_est_bar uuid; v_wf_coz uuid; v_wf_bar uuid;
  v_mov uuid;
begin
  -- Usuario real de auth.users: fn_criar_pedido_completo exige auth.uid().
  select ul.user_id into v_user from usuarios_loja ul limit 1;
  -- Segundo usuario real SEM vinculo com a loja de teste: simula o cliente
  -- logado que le o QR da mesa.
  select ul.user_id into v_outro from usuarios_loja ul where ul.user_id <> v_user limit 1;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text, true);

  insert into lojas (slug, nome, aberto_manual, lat, lng,
                     entrega_taxa_base, entrega_taxa_km, entrega_raio_km,
                     ifood_merchant_id, ifood_taxa_pct, ifood_taxa_fixa)
  values ('zz-sim-canais-'||substr(md5(random()::text),1,10), 'ZZ Simulacao Canais',
          true, -23.55, -46.63, 5, 0, 50,
          'ZZ-MERCHANT-'||substr(md5(random()::text),1,10), 12, 0)
  returning id into v_loja;

  insert into usuarios_loja (user_id, loja_id, papel, nome)
  values (v_user, v_loja, 'admin', 'Simulador');

  -- Piso alto na sequencia de numero para separar visualmente numero e senha:
  -- numero comeca em 501, senha do dia comeca em 1.
  insert into loja_sequencias (loja_id, ultimo_numero) values (v_loja, 500);

  insert into categorias (loja_id, nome) values (v_loja, 'ZZ Categoria') returning id into v_cat;

  insert into kds_estacoes (loja_id, nome, ordem) values (v_loja, 'ZZ Cozinha', 0) returning id into v_est_coz;
  insert into kds_estacoes (loja_id, nome, ordem) values (v_loja, 'ZZ Bar', 1) returning id into v_est_bar;
  insert into kds_workflows (loja_id, estacao_id, nome, etapas)
  values (v_loja, v_est_coz, 'ZZ Fluxo Cozinha',
          '[{"id":"fila","nome":"Fila de Entrada","ordem":0},{"id":"preparo","nome":"Em Preparo","ordem":1}]'::jsonb)
  returning id into v_wf_coz;
  insert into kds_workflows (loja_id, estacao_id, nome, etapas)
  values (v_loja, v_est_bar, 'ZZ Fluxo Bar',
          '[{"id":"fila","nome":"Fila de Entrada","ordem":0},{"id":"preparo","nome":"Em Preparo","ordem":1}]'::jsonb)
  returning id into v_wf_bar;

  insert into mesas (loja_id, numero) values (v_loja, 91) returning id into v_mesa;
  insert into mesas (loja_id, numero) values (v_loja, 92) returning id into v_mesa2;

  -- Insumos com saldo e LOTE custeado (a entrada e quem cria o lote via
  -- trg_mov_criar_lote; o saldo nao deriva do ledger, entao vai na mao).
  insert into insumos (loja_id, nome, unidade_medida, quantidade_atual)
  values (v_loja, 'ZZ Pao', 'un', 1000) returning id into v_ins_pao;
  insert into insumos (loja_id, nome, unidade_medida, quantidade_atual)
  values (v_loja, 'ZZ Bacon', 'g', 1000) returning id into v_ins_bacon;
  insert into movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, custo_total, motivo)
  values (v_loja, v_ins_pao, 'ENTRADA', 1000, 500, 'ZZ carga inicial');
  insert into movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, custo_total, motivo)
  values (v_loja, v_ins_bacon, 'ENTRADA', 1000, 2000, 'ZZ carga inicial');

  -- Produto de cozinha (roteia para a estacao ZZ Cozinha) com ficha tecnica.
  insert into produtos (loja_id, categoria_id, nome, preco, estacao_preparo,
                        controla_estoque, estacao_kds_id, workflow_kds_id, pdv_code)
  values (v_loja, v_cat, 'ZZ Burger', 20, 'COZINHA', true, v_est_coz, v_wf_coz, 'ZZBURGER')
  returning id into v_burger;
  insert into fichas_tecnicas (produto_id, insumo_id, quantidade_consumida)
  values (v_burger, v_ins_pao, 2);

  -- Produto de bar: estacao_preparo DIRETO mas com estacao_kds_id proprio —
  -- prova o roteamento por estacao, nao pelo campo legado.
  insert into produtos (loja_id, categoria_id, nome, preco, estacao_preparo,
                        controla_estoque, estacao_kds_id, workflow_kds_id, pdv_code)
  values (v_loja, v_cat, 'ZZ Caipirinha', 12, 'DIRETO', false, v_est_bar, v_wf_bar, 'ZZDRINK')
  returning id into v_drink;

  -- Revenda pura: DIRETO e sem estacao — nao pode gerar ticket de KDS.
  insert into produtos (loja_id, categoria_id, nome, preco, estacao_preparo,
                        controla_estoque, pdv_code)
  values (v_loja, v_cat, 'ZZ Coca Lata', 8, 'DIRETO', false, 'ZZCOCA')
  returning id into v_refri;

  -- Modificador que consome insumo proprio (bacon extra).
  insert into grupos_opcoes (produto_id, nome, min_escolhas, max_escolhas, ordem)
  values (v_burger, 'ZZ Adicionais', 0, 2, 0) returning id into v_grp;
  insert into opcoes (grupo_id, nome, preco_adicional, insumo_id, quantidade_insumo, ordem)
  values (v_grp, 'ZZ Bacon extra', 5, v_ins_bacon, 30, 0) returning id into v_opc;

  insert into ctx(k,v) values
    ('user', v_user::text), ('outro', coalesce(v_outro::text,'')), ('loja', v_loja::text),
    ('mesa', v_mesa::text), ('mesa2', v_mesa2::text),
    ('burger', v_burger::text), ('drink', v_drink::text), ('refri', v_refri::text),
    ('opc', v_opc::text), ('est_coz', v_est_coz::text), ('est_bar', v_est_bar::text),
    ('ins_pao', v_ins_pao::text), ('ins_bacon', v_ins_bacon::text);

  insert into res(canal, invariante, resultado, evidencia)
  values ('SETUP','tenant descartavel criado','PASS',
          format('loja=%s contas=%s', v_loja,
                 (select count(*) from contas where loja_id = v_loja)));
end
$setup$;

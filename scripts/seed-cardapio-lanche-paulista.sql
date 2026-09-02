-- ============================================================================
-- SEED — Cardápio de demonstração do Lanche do Paulista (loja fictícia)
-- ============================================================================
-- Aplicado em 2026-09-02. Reproduz o cardápio usado como prova da Onda V
-- (docs/PLANO-NUTRICIONAL-VITRINE.md §5): 16 produtos em 7 categorias, linha
-- tradicional e linha fit, 100% com tabela nutricional publicada.
--
-- Gramaturas seguem referências de ficha técnica de hamburgueria: pão brioche
-- 80 g, blend 180 g, cheddar 30 g/fatia, bacon 30–50 g, cebola caramelizada
-- 25–30 g, molho 20–40 g; smash de 90 g (faixa usual 90–110 g).
--
-- Nutrição: nada é digitado. Cada insumo aponta para um alimento de
-- `alimentos_referencia` (USDA FoodData Central, CC0) ou para um rótulo de
-- fabricante, e a proveniência fica gravada (ADR-06).
--
-- É idempotente: pode rodar de novo. NÃO apaga produtos (o histórico de
-- pedidos aponta para eles) — só reescreve fichas, config e nutrição.
--
-- Loja: 34004cf0-6b5a-485b-9bf4-079aaad9aa47 (slug lanchepaulista)
-- ============================================================================

\set loja '34004cf0-6b5a-485b-9bf4-079aaad9aa47'

-- ── 0. Alimentos de referência que faltavam para a linha fit ────────────────
insert into public.alimentos_referencia (fonte, fonte_versao, fonte_url, licenca, codigo_fonte, nome, nome_pt, grupo, base_qtd, base_unidade, nutrientes, alergenos_contem, alergenos_pode_conter)
values
 ('USDA_FDC','FoodData Central 2026-07 (SR Legacy + Foundation)','https://fdc.nal.usda.gov/food-details/170416/nutrients','CC0-1.0','170416','Parsley, fresh','Salsinha','Hortaliças',100,'g',
  '{"ENERGIA_KCAL":36,"PROTEINAS":2.97,"CARBOIDRATOS":6.33,"ACUCARES_TOTAIS":0.85,"GORDURAS_TOTAIS":0.79,"GORDURAS_SATURADAS":0.132,"GORDURAS_TRANS":0,"FIBRAS_ALIMENTARES":3.3,"SODIO":56,"COLESTEROL":0}'::jsonb,'{}','{}'),
 ('USDA_FDC','FoodData Central 2026-07 (SR Legacy + Foundation)','https://fdc.nal.usda.gov/food-details/169997/nutrients','CC0-1.0','169997','Chives, raw','Cebolinha','Hortaliças',100,'g',
  '{"ENERGIA_KCAL":30,"PROTEINAS":3.27,"CARBOIDRATOS":4.35,"ACUCARES_TOTAIS":1.85,"GORDURAS_TOTAIS":0.73,"GORDURAS_SATURADAS":0.146,"GORDURAS_TRANS":0,"FIBRAS_ALIMENTARES":2.5,"SODIO":3,"COLESTEROL":0}'::jsonb,'{}','{}'),
 ('USDA_FDC','FoodData Central 2026-07 (SR Legacy + Foundation)','https://fdc.nal.usda.gov/food-details/169705/nutrients','CC0-1.0','169705','Oats','Aveia em flocos','Grãos',100,'g',
  '{"ENERGIA_KCAL":389,"PROTEINAS":16.89,"CARBOIDRATOS":66.27,"ACUCARES_TOTAIS":0,"GORDURAS_TOTAIS":6.9,"GORDURAS_SATURADAS":1.217,"GORDURAS_TRANS":0,"FIBRAS_ALIMENTARES":10.6,"SODIO":2,"COLESTEROL":0}'::jsonb,'{}','{"Trigo/Glúten","Aveia","Cevada"}'),
 ('USDA_FDC','FoodData Central 2026-07 (SR Legacy + Foundation)','https://fdc.nal.usda.gov/food-details/172686/nutrients','CC0-1.0','172686','Bread, whole-wheat, commercially prepared','Pão integral','Panificação',100,'g',
  '{"ENERGIA_KCAL":247,"PROTEINAS":12.3,"CARBOIDRATOS":41.29,"ACUCARES_TOTAIS":4.31,"GORDURAS_TOTAIS":3.55,"GORDURAS_SATURADAS":0.797,"GORDURAS_TRANS":0,"FIBRAS_ALIMENTARES":6.8,"SODIO":400,"COLESTEROL":0}'::jsonb,'{"Trigo/Glúten"}','{"Soja","Leite","Ovo"}'),
 ('USDA_FDC','FoodData Central 2026-07 (SR Legacy + Foundation)','https://fdc.nal.usda.gov/food-details/173417/nutrients','CC0-1.0','173417','Cheese, cheddar','Queijo cheddar','Laticínios',100,'g',
  '{"ENERGIA_KCAL":403,"PROTEINAS":24.9,"CARBOIDRATOS":1.28,"ACUCARES_TOTAIS":0.52,"GORDURAS_TOTAIS":33.14,"GORDURAS_SATURADAS":21.09,"GORDURAS_TRANS":0,"FIBRAS_ALIMENTARES":0,"SODIO":653,"COLESTEROL":105}'::jsonb,'{"Leite"}','{}'),
 ('ROTULO_FABRICANTE','Rotulo do fabricante — Guarana Antarctica lata 350 ml (leitura 2026-09-01)',null,'Dado factual do produto','ROTULO-GUARANA-ANTARCTICA-350','Guarana Antarctica lata 350 ml','Guaraná Antarctica lata 350 ml',null,100,'ml',
  '{"ENERGIA_KCAL":39,"PROTEINAS":0,"CARBOIDRATOS":9.7,"ACUCARES_TOTAIS":9.7,"ACUCARES_ADICIONADOS":9.7,"GORDURAS_TOTAIS":0,"GORDURAS_SATURADAS":0,"GORDURAS_TRANS":0,"FIBRAS_ALIMENTARES":0,"SODIO":3}'::jsonb,'{}','{}'),
 ('ROTULO_FABRICANTE','Rotulo do fabricante — agua mineral sem gas 500 ml (leitura 2026-09-01)',null,'Dado factual do produto','ROTULO-AGUA-MINERAL-500','Agua mineral sem gas 500 ml','Água mineral sem gás 500 ml',null,100,'ml',
  '{"ENERGIA_KCAL":0,"PROTEINAS":0,"CARBOIDRATOS":0,"ACUCARES_TOTAIS":0,"ACUCARES_ADICIONADOS":0,"GORDURAS_TOTAIS":0,"GORDURAS_SATURADAS":0,"GORDURAS_TRANS":0,"FIBRAS_ALIMENTARES":0,"SODIO":1}'::jsonb,'{}','{}')
on conflict do nothing;

-- ── 1. Despensa ─────────────────────────────────────────────────────────────
insert into public.insumos (loja_id, nome, unidade_medida, tipo_item, categoria_insumo, preco_embalagem, qtd_embalagem, quantidade_atual, estoque_minimo, setor)
select :'loja'::uuid, v.nome, v.un, v.tipo, v.cat, v.preco, v.qtd, v.atual, v.minimo, v.setor
from (values
  ('Pão integral',            'un',  'INGREDIENTE','Ingrediente', 24.00, 8,    40,  10, 'dispensa'),
  ('Peito de frango',         'g',   'INGREDIENTE','Ingrediente', 28.90, 1000, 8000,2000,'geladeira'),
  ('Patinho moído',           'g',   'INGREDIENTE','Ingrediente', 42.90, 1000, 6000,1500,'geladeira'),
  ('Queijo muçarela fatiado', 'un',  'INGREDIENTE','Ingrediente', 26.00, 50,   120, 30,  'geladeira'),
  ('Queijo parmesão ralado',  'g',   'INGREDIENTE','Ingrediente', 18.00, 200,  600, 200, 'geladeira'),
  ('Ovo',                     'un',  'INGREDIENTE','Ingrediente', 24.00, 30,   90,  30,  'geladeira'),
  ('Azeite de oliva',         'ml',  'INGREDIENTE','Ingrediente', 39.90, 500,  1500,500, 'dispensa'),
  ('Iogurte natural',         'g',   'INGREDIENTE','Ingrediente',  9.90, 500,  2000,500, 'geladeira'),
  ('Suco de limão',           'ml',  'INGREDIENTE','Ingrediente',  8.00, 500,  1000,200, 'geladeira'),
  ('Aveia em flocos',         'g',   'INGREDIENTE','Ingrediente', 12.00, 500,  1500,300, 'dispensa'),
  ('Arroz integral',          'g',   'INGREDIENTE','Ingrediente', 18.00, 1000, 5000,1000,'dispensa'),
  ('Brócolis',                'g',   'INGREDIENTE','Ingrediente', 14.00, 500,  2000,500, 'geladeira'),
  ('Cenoura',                 'g',   'INGREDIENTE','Ingrediente',  6.00, 1000, 3000,500, 'geladeira'),
  ('Abobrinha',               'g',   'INGREDIENTE','Ingrediente',  7.00, 1000, 2000,500, 'geladeira'),
  ('Cogumelo Paris',          'g',   'INGREDIENTE','Ingrediente', 22.00, 500,  1000,300, 'geladeira'),
  ('Abacate',                 'g',   'INGREDIENTE','Ingrediente', 12.00, 1000, 2000,500, 'geladeira'),
  ('Batata doce',             'g',   'INGREDIENTE','Ingrediente',  6.90, 1000, 4000,1000,'dispensa'),
  ('Sal refinado',            'g',   'INGREDIENTE','Ingrediente',  4.00, 1000, 3000,500, 'dispensa'),
  ('Água mineral 500ml',      'un',  'REVENDA','Revenda Direta',  15.00, 12,   48,  12,  'dispensa')
) as v(nome, un, tipo, cat, preco, qtd, atual, minimo, setor)
where not exists (select 1 from public.insumos i where i.loja_id = :'loja'::uuid and i.nome = v.nome);

-- "Alface" em 'un' significava o pé inteiro (500 g) e a ficha pedia 2
-- "unidades" querendo dizer 2 folhas: um X-SALADA de 1,1 kg.
update public.insumos set unidade_medida = 'folha' where loja_id = :'loja'::uuid and nome = 'Alface';

update public.insumos set ativo = false
where loja_id = :'loja'::uuid
  and nome in ('Tomate (dup 2026-07-16)', 'Tomate (g, descontinuado)', 'salsinha (maço)', 'Alho (cabeça)');

update public.insumos set quantidade_atual = greatest(coalesce(quantidade_atual,0), coalesce(qtd_embalagem,1) * 5, 50)
where loja_id = :'loja'::uuid and ativo and not is_preparo;

-- ── 2. Nutrição dos insumos, derivada da base de referência ─────────────────
with mapa(nome, fdc, peso_un, dens, contem, pode) as (values
  ('Pão brioche',              '174925', 80::numeric,  null::numeric, array['Trigo/Glúten','Leite','Ovo'], array['Soja']),
  ('Pão integral',             '172686', 70,           null,          array['Trigo/Glúten'],               array['Soja','Leite','Ovo']),
  ('Carne Acém Moído',         '168608', null,         null,          array[]::text[],                     array[]::text[]),
  ('Patinho moído',            '169534', null,         null,          array[]::text[],                     array[]::text[]),
  ('Peito de frango',          '171077', null,         null,          array[]::text[],                     array[]::text[]),
  ('Bacon em fatias',          '170197', 16,           null,          array[]::text[],                     array['Soja']),
  ('Queijo cheddar fatiado',   '173417', 30,           null,          array['Leite'],                      array[]::text[]),
  ('Queijo muçarela fatiado',  '170845', 20,           null,          array['Leite'],                      array[]::text[]),
  ('Queijo parmesão ralado',   '171247', null,         null,          array['Leite'],                      array[]::text[]),
  ('Cheddar cremoso',          '173418', null,         null,          array['Leite'],                      array['Soja']),
  ('Alface',                   '169249', 10,           null,          array[]::text[],                     array[]::text[]),
  ('Tomate',                   '170457', 20,           null,          array[]::text[],                     array[]::text[]),
  ('Cebola',                   '170000', null,         null,          array[]::text[],                     array[]::text[]),
  ('Alho',                     '169230', 5,            null,          array[]::text[],                     array[]::text[]),
  ('Maionese',                 '171009', null,         null,          array['Ovo'],                        array['Soja','Leite']),
  ('Ketchup',                  '168556', null,         null,          array[]::text[],                     array[]::text[]),
  ('Mostarda',                 '172234', null,         null,          array[]::text[],                     array[]::text[]),
  ('Manteiga',                 '173410', null,         null,          array['Leite'],                      array[]::text[]),
  ('Creme de Leite',           '170859', null,         null,          array['Leite'],                      array[]::text[]),
  ('Oleo de Soja Liza',        '171411', null,         0.92,          array[]::text[],                     array['Soja']),
  ('Azeite de oliva',          '171413', null,         0.913,         array[]::text[],                     array[]::text[]),
  ('Batata doce',              '168482', null,         null,          array[]::text[],                     array[]::text[]),
  ('Ovo',                      '171287', 50,           null,          array['Ovo'],                        array[]::text[]),
  ('Iogurte natural',          '171284', null,         null,          array['Leite'],                      array[]::text[]),
  ('Suco de limão',            '167746', null,         1.03,          array[]::text[],                     array[]::text[]),
  ('Aveia em flocos',          '169705', null,         null,          array['Aveia'],                      array['Trigo/Glúten','Cevada','Centeio']),
  ('Arroz integral',           '169703', null,         null,          array[]::text[],                     array[]::text[]),
  ('Brócolis',                 '170379', null,         null,          array[]::text[],                     array[]::text[]),
  ('Cenoura',                  '170393', null,         null,          array[]::text[],                     array[]::text[]),
  ('Abobrinha',                '169291', null,         null,          array[]::text[],                     array[]::text[]),
  ('Cogumelo Paris',           '169251', null,         null,          array[]::text[],                     array[]::text[]),
  ('Abacate',                  '171706', null,         null,          array[]::text[],                     array[]::text[]),
  ('Sal refinado',             '173468', null,         null,          array[]::text[],                     array[]::text[]),
  ('Açúcar',                   '169655', null,         null,          array[]::text[],                     array[]::text[]),
  ('Salsinha',                 '170416', 15,           null,          array[]::text[],                     array[]::text[]),
  ('Cebolinha',                '169997', 15,           null,          array[]::text[],                     array[]::text[]),
  ('Coca-Cola lata',           '7894900010015', 350,   1.0,           array[]::text[],                     array[]::text[]),
  ('Guaraná lata',             'ROTULO-GUARANA-ANTARCTICA-350', 350, 1.0, array[]::text[],                 array[]::text[]),
  ('Água mineral 500ml',       'ROTULO-AGUA-MINERAL-500', 500, 1.0,   array[]::text[],                     array[]::text[])
)
insert into public.insumos_nutricao (
  insumo_id, loja_id, base_qtd, base_unidade, densidade_g_ml, peso_medio_un_g,
  nutrientes, alergenos_contem, alergenos_pode_conter,
  origem, fonte_ref, fonte_versao, fonte_url, confianca, revisado, revisado_em, atualizado_em
)
select
  i.id, i.loja_id, a.base_qtd, a.base_unidade, m.dens, m.peso_un,
  a.nutrientes,
  coalesce((select array_agg(distinct x) from unnest(m.contem || a.alergenos_contem) x), '{}'),
  coalesce((select array_agg(distinct x) from unnest(m.pode || a.alergenos_pode_conter) x
             where x <> all (m.contem || a.alergenos_contem)), '{}'),
  case a.fonte when 'USDA_FDC' then 'USDA' else 'ROTULO_EAN' end,
  a.id, a.fonte_versao, a.fonte_url, 1, true, now(), now()
from mapa m
join public.insumos i on i.nome = m.nome and i.loja_id = :'loja'::uuid
join public.alimentos_referencia a on a.codigo_fonte = m.fdc
on conflict (insumo_id) do update set
  base_qtd = excluded.base_qtd, base_unidade = excluded.base_unidade,
  densidade_g_ml = excluded.densidade_g_ml, peso_medio_un_g = excluded.peso_medio_un_g,
  nutrientes = excluded.nutrientes,
  alergenos_contem = excluded.alergenos_contem, alergenos_pode_conter = excluded.alergenos_pode_conter,
  origem = excluded.origem, fonte_ref = excluded.fonte_ref,
  fonte_versao = excluded.fonte_versao, fonte_url = excluded.fonte_url,
  confianca = 1, revisado = true, revisado_em = now(), atualizado_em = now();

-- A porção de batata frita é de 200 g. Mantém a origem IA de propósito: a
-- vitrine mostra "94% estimado" nesse prato, e isso é a feature funcionando.
update public.insumos_nutricao set peso_medio_un_g = 200, atualizado_em = now()
where loja_id = :'loja'::uuid
  and insumo_id = (select id from public.insumos where loja_id = :'loja'::uuid and nome='Batata congelada');

-- ── 3. Preparos (o que a cozinha produz em lote) ────────────────────────────
insert into public.insumos (loja_id, nome, unidade_medida, tipo_item, is_preparo, categoria_insumo, rendimento_porcoes, validade_horas, setor, preco_embalagem, qtd_embalagem)
select :'loja'::uuid, v.nome, v.un, 'PREPARO', true, 'Ingrediente', v.rend, v.validade, v.setor, 0, 1
from (values
  ('Smash Blend 90g',            'un', 20,  48, 'geladeira'),
  ('Burger Fit de Frango 130g',  'un', 10,  48, 'geladeira'),
  ('Smash Fit de Patinho 80g',   'un', 20,  48, 'geladeira'),
  ('Molho de Iogurte com Ervas', 'ml', 500, 72, 'geladeira'),
  ('Molho Caesar Fit',           'ml', 400, 72, 'geladeira'),
  ('Legumes Grelhados',          'g',  800, 48, 'geladeira'),
  ('Arroz Integral Cozido',      'g',  900, 24, 'geladeira')
) as v(nome, un, rend, validade, setor)
where not exists (select 1 from public.insumos i where i.loja_id = :'loja'::uuid and i.nome = v.nome);

-- Molho Verde estava em 'kg' com rendimento 1: a ficha somava 1,4 kg e o motor
-- dividia por 1.
update public.insumos set unidade_medida='ml', rendimento_porcoes=1200, validade_horas=72
where loja_id = :'loja'::uuid and nome='Molho Verde com Alho';

delete from public.fichas_preparos
where preparo_id in (
  select id from public.insumos where loja_id = :'loja'::uuid and is_preparo
    and nome in ('Blend Moldado 180g','Smash Blend 90g','Burger Fit de Frango 130g','Smash Fit de Patinho 80g',
                 'Molho de Iogurte com Ervas','Molho Caesar Fit','Legumes Grelhados','Arroz Integral Cozido','Molho Verde com Alho')
);

insert into public.fichas_preparos (loja_id, preparo_id, insumo_id, quantidade)
select :'loja'::uuid, pr.id, ig.id, v.qtd
from (values
  ('Blend Moldado 180g','Carne Acém Moído',1800::numeric), ('Blend Moldado 180g','Sal refinado',12),
  ('Smash Blend 90g','Carne Acém Moído',1800), ('Smash Blend 90g','Sal refinado',12),
  ('Burger Fit de Frango 130g','Peito de frango',1200), ('Burger Fit de Frango 130g','Aveia em flocos',120),
  ('Burger Fit de Frango 130g','Ovo',2), ('Burger Fit de Frango 130g','Cebola',100),
  ('Burger Fit de Frango 130g','Salsinha',1), ('Burger Fit de Frango 130g','Sal refinado',8),
  ('Smash Fit de Patinho 80g','Patinho moído',1600), ('Smash Fit de Patinho 80g','Sal refinado',12),
  ('Molho de Iogurte com Ervas','Iogurte natural',400), ('Molho de Iogurte com Ervas','Suco de limão',30),
  ('Molho de Iogurte com Ervas','Alho',2), ('Molho de Iogurte com Ervas','Salsinha',1),
  ('Molho de Iogurte com Ervas','Cebolinha',1), ('Molho de Iogurte com Ervas','Sal refinado',3),
  ('Molho Caesar Fit','Iogurte natural',300), ('Molho Caesar Fit','Queijo parmesão ralado',40),
  ('Molho Caesar Fit','Mostarda',15), ('Molho Caesar Fit','Suco de limão',20),
  ('Molho Caesar Fit','Alho',2), ('Molho Caesar Fit','Sal refinado',2),
  ('Legumes Grelhados','Brócolis',400), ('Legumes Grelhados','Cenoura',250),
  ('Legumes Grelhados','Abobrinha',250), ('Legumes Grelhados','Azeite de oliva',20),
  ('Legumes Grelhados','Sal refinado',5),
  ('Arroz Integral Cozido','Arroz integral',300), ('Arroz Integral Cozido','Azeite de oliva',10),
  ('Arroz Integral Cozido','Sal refinado',5),
  ('Molho Verde com Alho','Maionese',800), ('Molho Verde com Alho','Creme de Leite',200),
  ('Molho Verde com Alho','Oleo de Soja Liza',200), ('Molho Verde com Alho','Alho',6),
  ('Molho Verde com Alho','Salsinha',1), ('Molho Verde com Alho','Cebolinha',1)
) as v(preparo, insumo, qtd)
join public.insumos pr on pr.nome = v.preparo and pr.loja_id = :'loja'::uuid and pr.is_preparo
join public.insumos ig on ig.nome = v.insumo  and ig.loja_id = :'loja'::uuid;

-- ── 4. Cardápio ─────────────────────────────────────────────────────────────
insert into public.categorias (loja_id, nome, ordem, ativo)
select :'loja'::uuid, 'LINHA FIT', 3, true
where not exists (select 1 from public.categorias where loja_id = :'loja'::uuid and nome='LINHA FIT');

update public.categorias set ordem = case nome
  when 'DESTAQUES DA CASA' then 1 when 'BURGERS ARTESANAIS' then 2 when 'LINHA FIT' then 3
  when 'COMBOS' then 4 when 'ACOMPANHAMENTOS' then 5 when 'BEBIDAS' then 6 else 7 end
where loja_id = :'loja'::uuid;

insert into public.produtos (loja_id, categoria_id, nome, descricao, preco, disponivel, controla_estoque, ordem, estacao_preparo)
select :'loja'::uuid, c.id, v.nome, v.descricao, v.preco, true, true, v.ordem, v.estacao
from (values
  ('LINHA FIT','BURGER FIT DE FRANGO','Burger de peito de frango grelhado com aveia, no pão integral, com alface, tomate e molho de iogurte com ervas.', 32.90, 1, 'COZINHA'),
  ('LINHA FIT','SMASH FIT DE PATINHO','Dois smashes de patinho magro, muçarela, tomate e alface no pão integral. Proteína alta, gordura baixa.', 36.90, 2, 'COZINHA'),
  ('LINHA FIT','BOWL FIT DE FRANGO','Arroz integral, peito de frango grelhado e legumes na chapa com azeite. Sem pão, sem fritura.', 34.90, 3, 'COZINHA'),
  ('LINHA FIT','SALADA CAESAR FIT','Alface, frango grelhado, parmesão e molho caesar de iogurte — sem maionese e sem crouton.', 29.90, 4, 'COZINHA'),
  ('ACOMPANHAMENTOS','BATATA DOCE RÚSTICA','Batata doce assada em gomos com azeite e sal. Acompanhamento da linha fit.', 18.90, 3, 'COZINHA'),
  ('BEBIDAS','ÁGUA MINERAL 500ML','Água mineral sem gás, garrafa 500 ml.', 5.00, 3, 'DIRETO')
) as v(categoria, nome, descricao, preco, ordem, estacao)
join public.categorias c on c.nome = v.categoria and c.loja_id = :'loja'::uuid
where not exists (select 1 from public.produtos p where p.loja_id = :'loja'::uuid and p.nome = v.nome);

update public.produtos set estacao_preparo='DIRETO'
where loja_id = :'loja'::uuid
  and nome in ('COCA-COLA LATA 350ML','GUARANÁ LATA 350ML','Bombom Sonho de Valsa Lacta','ÁGUA MINERAL 500ML');

delete from public.fichas_tecnicas
where produto_id in (select id from public.produtos where loja_id = :'loja'::uuid);

insert into public.fichas_tecnicas (produto_id, insumo_id, quantidade_consumida)
select p.id, i.id, v.qtd
from (values
  ('X-SALADA','Pão brioche',1::numeric), ('X-SALADA','Blend Moldado 180g',1), ('X-SALADA','Queijo cheddar fatiado',1),
  ('X-SALADA','Alface',2), ('X-SALADA','Tomate',2), ('X-SALADA','Maionese',15),
  ('X-BACON','Pão brioche',1), ('X-BACON','Blend Moldado 180g',1), ('X-BACON','Queijo cheddar fatiado',2),
  ('X-BACON','Bacon em fatias',50), ('X-BACON','Molho da Casa',20), ('X-BACON','Alface',1), ('X-BACON','Tomate',2),
  ('X-PAULISTA','Pão brioche',1), ('X-PAULISTA','Blend Moldado 180g',1), ('X-PAULISTA','Queijo cheddar fatiado',1),
  ('X-PAULISTA','Bacon em fatias',30), ('X-PAULISTA','Cebola Caramelizada',30), ('X-PAULISTA','Molho da Casa',40),
  ('SMASH DUPLO','Pão brioche',1), ('SMASH DUPLO','Smash Blend 90g',2), ('SMASH DUPLO','Queijo cheddar fatiado',2),
  ('SMASH DUPLO','Cebola',20), ('SMASH DUPLO','Molho da Casa',20),
  ('BATATA FRITA','Batata congelada',1), ('BATATA FRITA','Oleo de Soja Liza',12), ('BATATA FRITA','Sal refinado',1),
  ('BATATA CHEDDAR E BACON','Batata congelada',1), ('BATATA CHEDDAR E BACON','Oleo de Soja Liza',12),
  ('BATATA CHEDDAR E BACON','Cheddar cremoso',60), ('BATATA CHEDDAR E BACON','Bacon em fatias',40),
  ('BATATA CHEDDAR E BACON','Cebolinha',1),
  ('COMBO X-BACON','Pão brioche',1), ('COMBO X-BACON','Blend Moldado 180g',1), ('COMBO X-BACON','Queijo cheddar fatiado',2),
  ('COMBO X-BACON','Bacon em fatias',50), ('COMBO X-BACON','Molho da Casa',20), ('COMBO X-BACON','Alface',1),
  ('COMBO X-BACON','Tomate',2), ('COMBO X-BACON','Batata congelada',0.5), ('COMBO X-BACON','Oleo de Soja Liza',6),
  ('BURGER FIT DE FRANGO','Pão integral',1), ('BURGER FIT DE FRANGO','Burger Fit de Frango 130g',1),
  ('BURGER FIT DE FRANGO','Alface',2), ('BURGER FIT DE FRANGO','Tomate',2),
  ('BURGER FIT DE FRANGO','Molho de Iogurte com Ervas',25),
  ('SMASH FIT DE PATINHO','Pão integral',1), ('SMASH FIT DE PATINHO','Smash Fit de Patinho 80g',2),
  ('SMASH FIT DE PATINHO','Queijo muçarela fatiado',1), ('SMASH FIT DE PATINHO','Alface',2),
  ('SMASH FIT DE PATINHO','Tomate',2), ('SMASH FIT DE PATINHO','Molho de Iogurte com Ervas',20),
  ('BOWL FIT DE FRANGO','Arroz Integral Cozido',150), ('BOWL FIT DE FRANGO','Peito de frango',150),
  ('BOWL FIT DE FRANGO','Legumes Grelhados',120), ('BOWL FIT DE FRANGO','Azeite de oliva',5),
  ('SALADA CAESAR FIT','Alface',8), ('SALADA CAESAR FIT','Peito de frango',120),
  ('SALADA CAESAR FIT','Molho Caesar Fit',40), ('SALADA CAESAR FIT','Queijo parmesão ralado',10),
  ('BATATA DOCE RÚSTICA','Batata doce',250), ('BATATA DOCE RÚSTICA','Azeite de oliva',10),
  ('BATATA DOCE RÚSTICA','Sal refinado',1)
) as v(produto, insumo, qtd)
join public.produtos p on p.nome = v.produto and p.loja_id = :'loja'::uuid
join public.insumos  i on i.nome = v.insumo  and i.loja_id = :'loja'::uuid;

-- ── 5. Como cada prato é servido ────────────────────────────────────────────
insert into public.produtos_nutricao_config (produto_id, loja_id, insumo_id, quantidade_insumo, porcoes, fator_coccao, metodo_coccao, exibir)
select p.id, p.loja_id, i.id, v.qtd, 1, 1, 'MONTADO', true
from (values
  ('COCA-COLA LATA 350ML','Coca-Cola lata',1::numeric),
  ('GUARANÁ LATA 350ML','Guaraná lata',1),
  ('ÁGUA MINERAL 500ML','Água mineral 500ml',1),
  ('Bombom Sonho de Valsa Lacta','Bombom Sonho de Valsa Lacta',1)
) as v(produto, insumo, qtd)
join public.produtos p on p.nome=v.produto and p.loja_id = :'loja'::uuid
join public.insumos  i on i.nome=v.insumo  and i.loja_id = :'loja'::uuid
on conflict (produto_id) do update set
  insumo_id=excluded.insumo_id, quantidade_insumo=excluded.quantidade_insumo, atualizado_em=now();

insert into public.produtos_nutricao_config (produto_id, loja_id, porcoes, fator_coccao, metodo_coccao, exibir)
select p.id, p.loja_id, 1, v.fator, v.metodo, true
from (values
  ('X-SALADA',0.88::numeric,'GRELHADO'), ('X-BACON',0.88,'GRELHADO'), ('X-PAULISTA',0.88,'GRELHADO'),
  ('SMASH DUPLO',0.88,'GRELHADO'), ('COMBO X-BACON',0.88,'GRELHADO'),
  ('BURGER FIT DE FRANGO',0.88,'GRELHADO'), ('SMASH FIT DE PATINHO',0.88,'GRELHADO'),
  ('BOWL FIT DE FRANGO',0.85,'GRELHADO'), ('SALADA CAESAR FIT',0.92,'GRELHADO'),
  ('BATATA FRITA',0.85,'FRITO'), ('BATATA CHEDDAR E BACON',0.85,'FRITO'),
  ('BATATA DOCE RÚSTICA',0.80,'ASSADO')
) as v(produto, fator, metodo)
join public.produtos p on p.nome=v.produto and p.loja_id = :'loja'::uuid
on conflict (produto_id) do update set
  fator_coccao=excluded.fator_coccao, metodo_coccao=excluded.metodo_coccao, atualizado_em=now();

-- ── 6. Adicionais ligados ao insumo (nutrição do que o cliente escolhe) ─────
update public.opcoes o set insumo_id = i.id, quantidade_insumo = v.qtd
from (values
  ('Coca-Cola lata','Coca-Cola lata',1::numeric), ('Guaraná lata','Guaraná lata',1),
  ('Água mineral','Água mineral 500ml',1), ('Bacon extra','Bacon em fatias',30),
  ('Cheddar extra','Queijo cheddar fatiado',1), ('Ovo','Ovo',1),
  ('Blend extra 180g','Blend Moldado 180g',1)
) as v(opcao, insumo, qtd)
join public.insumos i on i.nome=v.insumo and i.loja_id = :'loja'::uuid
where o.nome = v.opcao
  and o.grupo_id in (select g.id from public.grupos_opcoes g join public.produtos p on p.id=g.produto_id where p.loja_id = :'loja'::uuid);

insert into public.grupos_opcoes (produto_id, nome, min_escolhas, max_escolhas, ordem)
select p.id, 'Turbine seu fit', 0, 3, 1
from public.produtos p
where p.loja_id = :'loja'::uuid and p.nome='BURGER FIT DE FRANGO'
  and not exists (select 1 from public.grupos_opcoes g where g.produto_id=p.id and g.nome='Turbine seu fit');

insert into public.opcoes (grupo_id, nome, preco_adicional, insumo_id, quantidade_insumo, disponivel, ordem)
select g.id, v.nome, v.preco, i.id, v.qtd, true, v.ordem
from (values
  ('Ovo grelhado','Ovo',1::numeric,3.00,1),
  ('Abacate em fatias','Abacate',40,5.00,2),
  ('Muçarela extra','Queijo muçarela fatiado',1,4.00,3)
) as v(nome, insumo, qtd, preco, ordem)
join public.grupos_opcoes g on g.nome='Turbine seu fit'
join public.produtos p on p.id=g.produto_id and p.loja_id = :'loja'::uuid
join public.insumos i on i.nome=v.insumo and i.loja_id = :'loja'::uuid
where not exists (select 1 from public.opcoes o where o.grupo_id=g.id and o.nome=v.nome);

-- ── 7. Ordens de produção do dia ────────────────────────────────────────────
insert into public.producoes_preparo (loja_id, preparo_id, lotes, quantidade_produzida, produzido_em, vence_em, status)
select i.loja_id, i.id, 1, i.rendimento_porcoes, now() - interval '3 hours',
       now() - interval '3 hours' + make_interval(hours => coalesce(i.validade_horas, 48)::int), 'ATIVO'
from public.insumos i
where i.loja_id = :'loja'::uuid and i.is_preparo and i.ativo
  and not exists (
    select 1 from public.producoes_preparo pp
    where pp.preparo_id = i.id and pp.produzido_em > now() - interval '12 hours'
  );

update public.insumos i set quantidade_atual = i.rendimento_porcoes
where i.loja_id = :'loja'::uuid and i.is_preparo and i.ativo;

-- ── 8. Recalcula o cache ────────────────────────────────────────────────────
select public.fn_atualizar_cache_nutricao(p.id) from public.produtos p where p.loja_id = :'loja'::uuid;

-- Conferência: quantos publicam.
select count(*) filter (where publicavel) publicando, count(*) total
from public.vw_nutricao_cobertura where loja_id = :'loja'::uuid and disponivel;

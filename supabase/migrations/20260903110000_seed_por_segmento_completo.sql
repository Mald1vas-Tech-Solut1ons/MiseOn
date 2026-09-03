-- Amostra completa por nicho: seis segmentos, cada um com categorias, insumos,
-- produtos com preco sugerido e ficha tecnica ligando um ao outro.
--
-- Tres decisoes que so ficaram claras testando a vitrine com olho de dono:
--
--  1. Preco de VENDA nasce com sugestao de mercado. Zerado, o cardapio inteiro
--     marcava R$ 0,00 e parecia sistema quebrado — e o dono nao tem como saber
--     se e assim mesmo ou se deu erro.
--  2. Estoque e custo de compra do insumo nascem ZERADOS de proposito. Chutar
--     custo e pior que deixar em branco: contamina CMV e margem sem aviso.
--  3. `controla_estoque` nasce FALSO. Verdadeiro com estoque zero fazia a loja
--     nova abrir com o cardapio inteiro marcado como ESGOTADO.
--
-- Nomes vao acentuados: e texto que o CLIENTE le no cardapio.
-- Idempotente: nao semeia loja que ja tem produto. So o admin da loja executa.

create or replace function public.fn_semear_loja(p_loja uuid, p_segmento text default null)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare
  v_seg text; v_existe int; v_cats int:=0; v_ins int:=0; v_prods int:=0; v_fichas int:=0;
begin
  if p_loja is null then raise exception 'loja obrigatoria'; end if;
  if auth.uid() is not null and coalesce(fn_meu_papel(p_loja),'') <> 'admin' then
    raise exception 'Apenas o administrador da loja pode aplicar a base do segmento.';
  end if;
  v_seg := upper(coalesce(nullif(btrim(p_segmento),''),(select segmento_negocio from lojas where id=p_loja),'GERAL'));
  if v_seg = 'GERAL' then v_seg := 'HAMBURGUERIA'; end if;
  select count(*) into v_existe from produtos where loja_id=p_loja;
  if v_existe > 0 then return jsonb_build_object('semeado',false,'motivo','a loja ja tem produtos cadastrados'); end if;

  with base(nome,ordem) as (
    select * from (values ('Hambúrgueres',1),('Acompanhamentos',2),('Bebidas',3),('Sobremesas',4)) t where v_seg in ('HAMBURGUERIA','DARK_KITCHEN')
    union all select * from (values ('Pizzas Salgadas',1),('Pizzas Doces',2),('Bordas',3),('Bebidas',4)) t where v_seg='PIZZARIA'
    union all select * from (values ('Açaí',1),('Complementos',2),('Bebidas',3)) t where v_seg='ACAITERIA'
    union all select * from (values ('Entradas',1),('Pratos Principais',2),('Guarnições',3),('Bebidas',4),('Sobremesas',5)) t where v_seg='RESTAURANTE_A_LA_CARTE'
    union all select * from (values ('Buffet',1),('Grelhados',2),('Bebidas',3),('Sobremesas',4)) t where v_seg='RESTAURANTE_POR_QUILO'
    union all select * from (values ('Porções',1),('Chopes e Cervejas',2),('Drinks',3),('Bebidas sem Álcool',4)) t where v_seg='BAR_PUB'
  )
  insert into categorias (loja_id,nome,ordem,ativo) select p_loja, base.nome, base.ordem, true from base;
  get diagnostics v_cats = row_count;

  with base(nome,unidade,categoria) as (
    select * from (values
      ('Pão brioche','un','Padaria'),('Blend bovino 180g','un','Carnes'),('Queijo cheddar fatiado','fatias','Frios'),
      ('Bacon em fatias','g','Frios'),('Alface','folha','Hortifrúti'),('Tomate','fatias','Hortifrúti'),
      ('Cebola','g','Hortifrúti'),('Molho da casa','ml','Ingrediente'),('Batata congelada','g','Congelados'),
      ('Refrigerante lata 350ml','un','Bebidas'),('Ovo','un','Mercearia'),('Frango desfiado','g','Carnes'),
      ('Sorvete de creme','g','Congelados'),('Calda de chocolate','ml','Mercearia')
    ) t where v_seg in ('HAMBURGUERIA','DARK_KITCHEN')
    union all select * from (values
      ('Massa de pizza','un','Padaria'),('Molho de tomate','ml','Ingrediente'),('Muçarela','g','Laticínios'),
      ('Calabresa','g','Frios'),('Presunto','g','Frios'),('Catupiry','g','Laticínios'),('Orégano','g','Mercearia'),
      ('Azeitona','g','Mercearia'),('Creme de avelã','g','Mercearia'),('Refrigerante 2L','un','Bebidas'),
      ('Cebola','g','Hortifrúti'),('Ovo','un','Mercearia'),('Bacon em fatias','g','Frios'),('Banana','un','Hortifrúti')
    ) t where v_seg='PIZZARIA'
    union all select * from (values
      ('Polpa de açaí','g','Congelados'),('Banana','un','Hortifrúti'),('Morango','g','Hortifrúti'),
      ('Leite condensado','ml','Mercearia'),('Leite em pó','g','Mercearia'),('Granola','g','Mercearia'),
      ('Paçoca','un','Mercearia'),('Creme de avelã','g','Mercearia'),('Copo 300ml','un','Descartáveis'),
      ('Copo 500ml','un','Descartáveis'),('Copo 700ml','un','Descartáveis'),('Água mineral 500ml','un','Bebidas'),
      ('Kiwi','un','Hortifrúti'),('Amendoim triturado','g','Mercearia')
    ) t where v_seg='ACAITERIA'
    union all select * from (values
      ('Filé mignon','g','Carnes'),('Peito de frango','g','Carnes'),('Salmão','g','Pescados'),('Arroz','g','Mercearia'),
      ('Feijão','g','Mercearia'),('Batata','g','Hortifrúti'),('Manteiga','g','Laticínios'),('Alho','dente','Hortifrúti'),
      ('Queijo parmesão ralado','g','Laticínios'),('Farinha de mandioca','g','Mercearia'),('Vinho tinto','ml','Bebidas'),
      ('Refrigerante lata 350ml','un','Bebidas'),('Pudim pronto','un','Mercearia'),('Alface','folha','Hortifrúti')
    ) t where v_seg='RESTAURANTE_A_LA_CARTE'
    union all select * from (values
      ('Arroz','g','Mercearia'),('Feijão','g','Mercearia'),('Peito de frango','g','Carnes'),
      ('Carne bovina em cubos','g','Carnes'),('Batata','g','Hortifrúti'),('Alface','folha','Hortifrúti'),
      ('Tomate','fatias','Hortifrúti'),('Cenoura','g','Hortifrúti'),('Beterraba','g','Hortifrúti'),
      ('Macarrão','g','Mercearia'),('Refrigerante lata 350ml','un','Bebidas'),('Suco natural','ml','Bebidas'),
      ('Gelatina','g','Mercearia'),('Embalagem marmita','un','Descartáveis')
    ) t where v_seg='RESTAURANTE_POR_QUILO'
    union all select * from (values
      ('Batata congelada','g','Congelados'),('Frango em cubos','g','Carnes'),('Calabresa','g','Frios'),
      ('Queijo coalho','g','Laticínios'),('Chopp claro','ml','Bebidas'),('Cerveja long neck','un','Bebidas'),
      ('Vodka','ml','Bebidas'),('Gin','ml','Bebidas'),('Limão','un','Hortifrúti'),('Açúcar','g','Mercearia'),
      ('Água tônica','un','Bebidas'),('Refrigerante lata 350ml','un','Bebidas'),('Gelo','g','Mercearia'),
      ('Molho barbecue','ml','Ingrediente')
    ) t where v_seg='BAR_PUB'
  )
  insert into insumos (loja_id,nome,unidade_medida,categoria_insumo,quantidade_atual,estoque_minimo,preco_embalagem,qtd_embalagem)
  select p_loja, base.nome, base.unidade, base.categoria, 0,0,0,1 from base;
  get diagnostics v_ins = row_count;

  with base(categoria,nome,descricao,preco,ordem) as (
    select * from (values
      ('Hambúrgueres','X-Burger','Pão brioche, blend 180g e queijo cheddar.',24.90,1),
      ('Hambúrgueres','X-Salada','Blend 180g, queijo, alface e tomate.',26.90,2),
      ('Hambúrgueres','X-Bacon','Blend 180g, queijo e bacon crocante.',29.90,3),
      ('Hambúrgueres','X-Frango','Frango desfiado, queijo e molho da casa.',27.90,4),
      ('Hambúrgueres','X-Egg','Blend 180g, queijo e ovo.',27.90,5),
      ('Acompanhamentos','Batata frita','Porção de batata frita crocante.',18.90,1),
      ('Acompanhamentos','Batata com cheddar e bacon','Batata frita coberta.',26.90,2),
      ('Bebidas','Refrigerante lata','Lata 350ml gelada.',7.00,1),
      ('Sobremesas','Sundae de chocolate','Sorvete de creme com calda.',12.90,1)
    ) t where v_seg in ('HAMBURGUERIA','DARK_KITCHEN')
    union all select * from (values
      ('Pizzas Salgadas','Pizza Muçarela','Molho, muçarela e orégano.',42.00,1),
      ('Pizzas Salgadas','Pizza Calabresa','Molho, muçarela, calabresa e cebola.',46.00,2),
      ('Pizzas Salgadas','Pizza Portuguesa','Presunto, ovo, cebola e azeitona.',52.00,3),
      ('Pizzas Salgadas','Pizza Frango com Catupiry','Frango desfiado e catupiry.',52.00,4),
      ('Pizzas Salgadas','Pizza Bacon','Muçarela e bacon crocante.',49.00,5),
      ('Pizzas Doces','Pizza de Avelã','Massa doce com creme de avelã.',48.00,1),
      ('Pizzas Doces','Pizza Banana com Canela','Banana, açúcar e canela.',42.00,2),
      ('Bordas','Borda de Catupiry','Borda recheada com catupiry.',8.00,1),
      ('Bebidas','Refrigerante 2L','Garrafa 2 litros.',14.00,1)
    ) t where v_seg='PIZZARIA'
    union all select * from (values
      ('Açaí','Açaí 300ml','Copo 300ml com dois complementos.',16.90,1),
      ('Açaí','Açaí 500ml','Copo 500ml com três complementos.',22.90,2),
      ('Açaí','Açaí 700ml','Copo 700ml com quatro complementos.',28.90,3),
      ('Açaí','Barca de Açaí','Serve duas pessoas.',44.90,4),
      ('Complementos','Adicional de Granola','Porção extra de granola.',3.00,1),
      ('Complementos','Adicional de Morango','Porção de morango fresco.',5.00,2),
      ('Complementos','Adicional de Leite Condensado','Fio de leite condensado.',3.00,3),
      ('Complementos','Adicional de Paçoca','Paçoca triturada.',3.00,4),
      ('Bebidas','Água mineral 500ml','Garrafa 500ml.',5.00,1)
    ) t where v_seg='ACAITERIA'
    union all select * from (values
      ('Entradas','Bolinho de Feijoada','Seis unidades com farofa.',34.00,1),
      ('Entradas','Salada da Casa','Folhas, tomate e parmesão.',28.00,2),
      ('Pratos Principais','Filé Mignon ao Molho Madeira','Acompanha arroz e batata.',78.00,1),
      ('Pratos Principais','Frango Grelhado','Peito grelhado com legumes.',52.00,2),
      ('Pratos Principais','Salmão Grelhado','Salmão com arroz de alho.',89.00,3),
      ('Guarnições','Arroz de Alho','Porção individual.',16.00,1),
      ('Guarnições','Batata Rústica','Porção individual.',22.00,2),
      ('Bebidas','Taça de Vinho Tinto','Taça 150ml.',24.00,1),
      ('Sobremesas','Pudim da Casa','Fatia individual.',18.00,1)
    ) t where v_seg='RESTAURANTE_A_LA_CARTE'
    union all select * from (values
      ('Buffet','Buffet por Quilo','Preço por quilo, pesado no balcão.',69.90,1),
      ('Buffet','Marmita P','Marmita pequena montada.',22.00,2),
      ('Buffet','Marmita M','Marmita média montada.',28.00,3),
      ('Buffet','Marmita G','Marmita grande montada.',34.00,4),
      ('Grelhados','Frango Grelhado','Porção de frango grelhado.',18.00,1),
      ('Grelhados','Carne em Cubos','Porção de carne bovina.',24.00,2),
      ('Bebidas','Refrigerante lata','Lata 350ml gelada.',7.00,1),
      ('Bebidas','Suco Natural 400ml','Suco da fruta do dia.',9.00,2),
      ('Sobremesas','Gelatina','Pote individual.',5.00,1)
    ) t where v_seg='RESTAURANTE_POR_QUILO'
    union all select * from (values
      ('Porções','Batata Frita','Porção para dividir.',32.00,1),
      ('Porções','Frango a Passarinho','Porção com limão.',48.00,2),
      ('Porções','Calabresa Acebolada','Porção com cebola.',42.00,3),
      ('Porções','Queijo Coalho na Brasa','Seis espetos.',36.00,4),
      ('Chopes e Cervejas','Chopp Claro 300ml','Tirado na hora.',12.00,1),
      ('Chopes e Cervejas','Cerveja Long Neck','Garrafa 330ml.',12.00,2),
      ('Drinks','Caipirinha de Limão','Limão, açúcar e gelo.',24.00,1),
      ('Drinks','Gin Tônica','Gin, tônica e limão.',32.00,2),
      ('Bebidas sem Álcool','Refrigerante lata','Lata 350ml gelada.',8.00,1)
    ) t where v_seg='BAR_PUB'
  )
  insert into produtos (loja_id,categoria_id,nome,descricao,preco,ordem,disponivel,controla_estoque)
  select p_loja, c.id, base.nome, base.descricao, base.preco, base.ordem, true, false
  from base join categorias c on c.loja_id=p_loja and c.nome=base.categoria;
  get diagnostics v_prods = row_count;

  with base(produto,insumo,qtd) as (
    select * from (values
      ('X-Burger','Pão brioche',1),('X-Burger','Blend bovino 180g',1),('X-Burger','Queijo cheddar fatiado',1),
      ('X-Salada','Pão brioche',1),('X-Salada','Blend bovino 180g',1),('X-Salada','Queijo cheddar fatiado',1),
      ('X-Salada','Alface',1),('X-Salada','Tomate',2),
      ('X-Bacon','Pão brioche',1),('X-Bacon','Blend bovino 180g',1),('X-Bacon','Queijo cheddar fatiado',1),('X-Bacon','Bacon em fatias',40),
      ('X-Frango','Pão brioche',1),('X-Frango','Frango desfiado',120),('X-Frango','Queijo cheddar fatiado',1),('X-Frango','Molho da casa',20),
      ('X-Egg','Pão brioche',1),('X-Egg','Blend bovino 180g',1),('X-Egg','Queijo cheddar fatiado',1),('X-Egg','Ovo',1),
      ('Batata frita','Batata congelada',150),
      ('Batata com cheddar e bacon','Batata congelada',150),('Batata com cheddar e bacon','Queijo cheddar fatiado',2),('Batata com cheddar e bacon','Bacon em fatias',40),
      ('Refrigerante lata','Refrigerante lata 350ml',1),
      ('Sundae de chocolate','Sorvete de creme',150),('Sundae de chocolate','Calda de chocolate',30)
    ) t where v_seg in ('HAMBURGUERIA','DARK_KITCHEN')
    union all select * from (values
      ('Pizza Muçarela','Massa de pizza',1),('Pizza Muçarela','Molho de tomate',80),('Pizza Muçarela','Muçarela',200),('Pizza Muçarela','Orégano',2),
      ('Pizza Calabresa','Massa de pizza',1),('Pizza Calabresa','Molho de tomate',80),('Pizza Calabresa','Muçarela',150),('Pizza Calabresa','Calabresa',120),('Pizza Calabresa','Cebola',40),
      ('Pizza Portuguesa','Massa de pizza',1),('Pizza Portuguesa','Molho de tomate',80),('Pizza Portuguesa','Muçarela',150),('Pizza Portuguesa','Presunto',100),('Pizza Portuguesa','Ovo',1),('Pizza Portuguesa','Azeitona',30),
      ('Pizza Frango com Catupiry','Massa de pizza',1),('Pizza Frango com Catupiry','Molho de tomate',80),('Pizza Frango com Catupiry','Muçarela',120),('Pizza Frango com Catupiry','Catupiry',100),
      ('Pizza Bacon','Massa de pizza',1),('Pizza Bacon','Molho de tomate',80),('Pizza Bacon','Muçarela',180),('Pizza Bacon','Bacon em fatias',100),
      ('Pizza de Avelã','Massa de pizza',1),('Pizza de Avelã','Creme de avelã',120),
      ('Pizza Banana com Canela','Massa de pizza',1),('Pizza Banana com Canela','Banana',3),
      ('Borda de Catupiry','Catupiry',80),
      ('Refrigerante 2L','Refrigerante 2L',1)
    ) t where v_seg='PIZZARIA'
    union all select * from (values
      ('Açaí 300ml','Polpa de açaí',300),('Açaí 300ml','Copo 300ml',1),
      ('Açaí 500ml','Polpa de açaí',500),('Açaí 500ml','Copo 500ml',1),
      ('Açaí 700ml','Polpa de açaí',700),('Açaí 700ml','Copo 700ml',1),
      ('Barca de Açaí','Polpa de açaí',900),
      ('Adicional de Granola','Granola',40),('Adicional de Morango','Morango',60),
      ('Adicional de Leite Condensado','Leite condensado',30),('Adicional de Paçoca','Paçoca',1),
      ('Água mineral 500ml','Água mineral 500ml',1)
    ) t where v_seg='ACAITERIA'
    union all select * from (values
      ('Bolinho de Feijoada','Feijão',150),('Bolinho de Feijoada','Farinha de mandioca',60),
      ('Salada da Casa','Alface',4),('Salada da Casa','Queijo parmesão ralado',20),
      ('Filé Mignon ao Molho Madeira','Filé mignon',250),('Filé Mignon ao Molho Madeira','Arroz',150),('Filé Mignon ao Molho Madeira','Batata',150),('Filé Mignon ao Molho Madeira','Manteiga',20),
      ('Frango Grelhado','Peito de frango',250),('Frango Grelhado','Arroz',150),
      ('Salmão Grelhado','Salmão',220),('Salmão Grelhado','Arroz',150),('Salmão Grelhado','Alho',2),
      ('Arroz de Alho','Arroz',180),('Arroz de Alho','Alho',2),
      ('Batata Rústica','Batata',220),('Batata Rústica','Manteiga',15),
      ('Taça de Vinho Tinto','Vinho tinto',150),
      ('Pudim da Casa','Pudim pronto',1)
    ) t where v_seg='RESTAURANTE_A_LA_CARTE'
    union all select * from (values
      ('Marmita P','Arroz',150),('Marmita P','Feijão',100),('Marmita P','Peito de frango',120),('Marmita P','Embalagem marmita',1),
      ('Marmita M','Arroz',200),('Marmita M','Feijão',150),('Marmita M','Peito de frango',180),('Marmita M','Embalagem marmita',1),
      ('Marmita G','Arroz',250),('Marmita G','Feijão',200),('Marmita G','Carne bovina em cubos',220),('Marmita G','Embalagem marmita',1),
      ('Frango Grelhado','Peito de frango',200),('Carne em Cubos','Carne bovina em cubos',200),
      ('Refrigerante lata','Refrigerante lata 350ml',1),('Suco Natural 400ml','Suco natural',400),('Gelatina','Gelatina',120)
    ) t where v_seg='RESTAURANTE_POR_QUILO'
    union all select * from (values
      ('Batata Frita','Batata congelada',300),
      ('Frango a Passarinho','Frango em cubos',400),('Frango a Passarinho','Limão',1),
      ('Calabresa Acebolada','Calabresa',300),('Calabresa Acebolada','Limão',1),
      ('Queijo Coalho na Brasa','Queijo coalho',300),('Queijo Coalho na Brasa','Molho barbecue',40),
      ('Chopp Claro 300ml','Chopp claro',300),('Cerveja Long Neck','Cerveja long neck',1),
      ('Caipirinha de Limão','Vodka',60),('Caipirinha de Limão','Limão',1),('Caipirinha de Limão','Açúcar',20),('Caipirinha de Limão','Gelo',80),
      ('Gin Tônica','Gin',50),('Gin Tônica','Água tônica',1),('Gin Tônica','Limão',1),('Gin Tônica','Gelo',80),
      ('Refrigerante lata','Refrigerante lata 350ml',1)
    ) t where v_seg='BAR_PUB'
  )
  insert into fichas_tecnicas (produto_id,insumo_id,quantidade_consumida)
  select pr.id, i.id, base.qtd from base
  join produtos pr on pr.loja_id=p_loja and pr.nome=base.produto
  join insumos i on i.loja_id=p_loja and i.nome=base.insumo
  on conflict do nothing;
  get diagnostics v_fichas = row_count;

  return jsonb_build_object('semeado',true,'segmento',v_seg,'categorias',v_cats,'insumos',v_ins,'produtos',v_prods,'fichas',v_fichas);
end;
$function$;

revoke all on function public.fn_semear_loja(uuid, text) from public;
grant execute on function public.fn_semear_loja(uuid, text) to authenticated;

comment on function public.fn_semear_loja(uuid, text) is
  'Base inicial do segmento: categorias, insumos, produtos com preco sugerido e ficha tecnica ligada. Estoque e custo de insumo nascem zerados; controla_estoque nasce falso. Nao roda em loja que ja tem produto.';

-- ── Regras operacionais por nicho ─────────────────────────────────────────
-- Aplicadas logo depois do seed (a tela de Configuracoes chama as duas em
-- sequencia). Ficam separadas porque valem para qualquer loja, nao so para a
-- recem-semeada: o lojista pode rodar de novo depois de mexer no cardapio.
create or replace function public.fn_ajustar_operacao_nicho(p_loja uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare v_direto int:=0; v_peso int:=0;
begin
  -- Refrigerante, borda, complemento e sobremesa pronta nao passam pela
  -- cozinha. Sem isso o KDS recebe "1 lata de refrigerante" como comanda de
  -- preparo e a cozinha aprende a ignorar a tela — que e como se perde pedido.
  update produtos p set estacao_preparo='DIRETO'
  from categorias c
  where c.id = p.categoria_id and p.loja_id = p_loja
    and c.nome in ('Bebidas','Bebidas sem Álcool','Complementos','Bordas',
                   'Chopes e Cervejas','Drinks','Sobremesas','Açaí');
  get diagnostics v_direto = row_count;

  -- Buffet e venda POR PESO: preco fixo num restaurante por quilo esta errado
  -- por definicao, e quebra a balanca.
  update produtos set tipo_venda='POR_PESO', preco_por_quilo=preco, preco=0
  where loja_id = p_loja and nome = 'Buffet por Quilo' and tipo_venda <> 'POR_PESO';
  get diagnostics v_peso = row_count;

  return jsonb_build_object('direto', v_direto, 'por_peso', v_peso);
end;
$function$;

revoke all on function public.fn_ajustar_operacao_nicho(uuid) from public;
grant execute on function public.fn_ajustar_operacao_nicho(uuid) to authenticated;

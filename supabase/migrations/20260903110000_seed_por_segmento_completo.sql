-- Amostra completa por nicho.
--
-- A primeira versao semeava so 3 segmentos e deixava PRECO ZERADO. Testando com
-- olho de dono: cardapio inteiro marcando R$ 0,00 parece sistema quebrado, e o
-- dono nao tem como saber se e assim mesmo ou se deu erro. Entao o preco de
-- VENDA agora nasce com uma sugestao de mercado — numero que ele confere e
-- ajusta, nao numero que ele precisa inventar do zero.
--
-- O que continua zerado, de proposito, e o que so a loja dele sabe: quantidade
-- em estoque e custo de compra do insumo. Chutar custo e pior que deixar em
-- branco, porque contamina CMV e margem sem ninguem perceber.
--
-- Cobre os seis segmentos do produto. Idempotente: nao semeia loja que ja tem
-- produto.

create or replace function public.fn_semear_loja(
  p_loja     uuid,
  p_segmento text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_seg     text;
  v_existe  int;
  v_cats    int := 0;
  v_ins     int := 0;
  v_prods   int := 0;
  v_fichas  int := 0;
begin
  if p_loja is null then
    raise exception 'loja obrigatoria';
  end if;

  if auth.uid() is not null and coalesce(fn_meu_papel(p_loja), '') <> 'admin' then
    raise exception 'Apenas o administrador da loja pode aplicar a base do segmento.';
  end if;

  v_seg := upper(coalesce(nullif(btrim(p_segmento), ''),
                          (select segmento_negocio from lojas where id = p_loja), 'GERAL'));

  -- GERAL nao tem cardapio proprio: cai na base de lanchonete, que e a mais
  -- comum e a mais facil de podar.
  if v_seg = 'GERAL' then v_seg := 'HAMBURGUERIA'; end if;

  select count(*) into v_existe from produtos where loja_id = p_loja;
  if v_existe > 0 then
    return jsonb_build_object('semeado', false, 'motivo', 'a loja ja tem produtos cadastrados');
  end if;

  -- ── Categorias ────────────────────────────────────────────────────────
  with base(nome, ordem) as (
    select * from (values ('Hamburgueres',1),('Acompanhamentos',2),('Bebidas',3),('Sobremesas',4)) t
      where v_seg in ('HAMBURGUERIA','DARK_KITCHEN')
    union all select * from (values ('Pizzas Salgadas',1),('Pizzas Doces',2),('Bordas',3),('Bebidas',4)) t
      where v_seg = 'PIZZARIA'
    union all select * from (values ('Acai',1),('Complementos',2),('Bebidas',3)) t
      where v_seg = 'ACAITERIA'
    union all select * from (values ('Entradas',1),('Pratos Principais',2),('Guarnicoes',3),('Bebidas',4),('Sobremesas',5)) t
      where v_seg = 'RESTAURANTE_A_LA_CARTE'
    union all select * from (values ('Buffet',1),('Grelhados',2),('Bebidas',3),('Sobremesas',4)) t
      where v_seg = 'RESTAURANTE_POR_QUILO'
    union all select * from (values ('Porcoes',1),('Chopes e Cervejas',2),('Drinks',3),('Bebidas sem Alcool',4)) t
      where v_seg = 'BAR_PUB'
  )
  insert into categorias (loja_id, nome, ordem, ativo)
  select p_loja, base.nome, base.ordem, true from base;
  get diagnostics v_cats = row_count;

  -- ── Insumos (quantidade e custo zerados de proposito) ─────────────────
  with base(nome, unidade, categoria) as (
    select * from (values
      ('Pao brioche','un','Padaria'),('Blend bovino 180g','un','Carnes'),
      ('Queijo cheddar fatiado','fatias','Frios'),('Bacon em fatias','g','Frios'),
      ('Alface','folha','Hortifruti'),('Tomate','fatias','Hortifruti'),
      ('Cebola','g','Hortifruti'),('Molho da casa','ml','Ingrediente'),
      ('Batata congelada','g','Congelados'),('Refrigerante lata 350ml','un','Bebidas'),
      ('Ovo','un','Mercearia'),('Frango desfiado','g','Carnes'),
      ('Sorvete de creme','g','Congelados'),('Calda de chocolate','ml','Mercearia')
    ) t where v_seg in ('HAMBURGUERIA','DARK_KITCHEN')
    union all select * from (values
      ('Massa de pizza','un','Padaria'),('Molho de tomate','ml','Ingrediente'),
      ('Mucarela','g','Laticinios'),('Calabresa','g','Frios'),
      ('Presunto','g','Frios'),('Catupiry','g','Laticinios'),
      ('Oregano','g','Mercearia'),('Azeitona','g','Mercearia'),
      ('Creme de avela','g','Mercearia'),('Refrigerante 2L','un','Bebidas'),
      ('Cebola','g','Hortifruti'),('Ovo','un','Mercearia'),
      ('Bacon em fatias','g','Frios'),('Banana','un','Hortifruti')
    ) t where v_seg = 'PIZZARIA'
    union all select * from (values
      ('Polpa de acai','g','Congelados'),('Banana','un','Hortifruti'),
      ('Morango','g','Hortifruti'),('Leite condensado','ml','Mercearia'),
      ('Leite em po','g','Mercearia'),('Granola','g','Mercearia'),
      ('Pacoca','un','Mercearia'),('Creme de avela','g','Mercearia'),
      ('Copo 300ml','un','Descartaveis'),('Copo 500ml','un','Descartaveis'),
      ('Copo 700ml','un','Descartaveis'),('Agua mineral 500ml','un','Bebidas'),
      ('Kiwi','un','Hortifruti'),('Amendoim triturado','g','Mercearia')
    ) t where v_seg = 'ACAITERIA'
    union all select * from (values
      ('File mignon','g','Carnes'),('Peito de frango','g','Carnes'),
      ('Salmao','g','Pescados'),('Arroz','g','Mercearia'),
      ('Feijao','g','Mercearia'),('Batata','g','Hortifruti'),
      ('Manteiga','g','Laticinios'),('Alho','dente','Hortifruti'),
      ('Queijo parmesao ralado','g','Laticinios'),('Farinha de mandioca','g','Mercearia'),
      ('Vinho tinto','ml','Bebidas'),('Refrigerante lata 350ml','un','Bebidas'),
      ('Pudim pronto','un','Sobremesas'),('Alface','folha','Hortifruti')
    ) t where v_seg = 'RESTAURANTE_A_LA_CARTE'
    union all select * from (values
      ('Arroz','g','Mercearia'),('Feijao','g','Mercearia'),
      ('Peito de frango','g','Carnes'),('Carne bovina em cubos','g','Carnes'),
      ('Batata','g','Hortifruti'),('Alface','folha','Hortifruti'),
      ('Tomate','fatias','Hortifruti'),('Cenoura','g','Hortifruti'),
      ('Beterraba','g','Hortifruti'),('Macarrao','g','Mercearia'),
      ('Refrigerante lata 350ml','un','Bebidas'),('Suco natural','ml','Bebidas'),
      ('Gelatina','g','Sobremesas'),('Embalagem marmita','un','Descartaveis')
    ) t where v_seg = 'RESTAURANTE_POR_QUILO'
    union all select * from (values
      ('Batata congelada','g','Congelados'),('Frango em cubos','g','Carnes'),
      ('Calabresa','g','Frios'),('Queijo coalho','g','Laticinios'),
      ('Chopp claro','ml','Bebidas'),('Cerveja long neck','un','Bebidas'),
      ('Vodka','ml','Bebidas'),('Gin','ml','Bebidas'),
      ('Limao','un','Hortifruti'),('Acucar','g','Mercearia'),
      ('Agua tonica','un','Bebidas'),('Refrigerante lata 350ml','un','Bebidas'),
      ('Gelo','g','Mercearia'),('Molho barbecue','ml','Ingrediente')
    ) t where v_seg = 'BAR_PUB'
  )
  insert into insumos (loja_id, nome, unidade_medida, categoria_insumo,
                       quantidade_atual, estoque_minimo, preco_embalagem, qtd_embalagem)
  select p_loja, base.nome, base.unidade, base.categoria, 0, 0, 0, 1 from base;
  get diagnostics v_ins = row_count;

  -- ── Produtos (preco e SUGESTAO de mercado, para conferir e ajustar) ────
  with base(categoria, nome, descricao, preco, ordem) as (
    select * from (values
      ('Hamburgueres','X-Burger','Pao brioche, blend 180g e queijo cheddar.',24.90,1),
      ('Hamburgueres','X-Salada','Blend 180g, queijo, alface e tomate.',26.90,2),
      ('Hamburgueres','X-Bacon','Blend 180g, queijo e bacon crocante.',29.90,3),
      ('Hamburgueres','X-Frango','Frango desfiado, queijo e molho da casa.',27.90,4),
      ('Hamburgueres','X-Egg','Blend 180g, queijo e ovo.',27.90,5),
      ('Acompanhamentos','Batata frita','Porcao de batata frita crocante.',18.90,1),
      ('Acompanhamentos','Batata com cheddar e bacon','Batata frita coberta.',26.90,2),
      ('Bebidas','Refrigerante lata','Lata 350ml gelada.',7.00,1),
      ('Sobremesas','Sundae de chocolate','Sorvete de creme com calda.',12.90,1)
    ) t where v_seg in ('HAMBURGUERIA','DARK_KITCHEN')
    union all select * from (values
      ('Pizzas Salgadas','Pizza Mucarela','Molho, mucarela e oregano.',42.00,1),
      ('Pizzas Salgadas','Pizza Calabresa','Molho, mucarela, calabresa e cebola.',46.00,2),
      ('Pizzas Salgadas','Pizza Portuguesa','Presunto, ovo, cebola e azeitona.',52.00,3),
      ('Pizzas Salgadas','Pizza Frango com Catupiry','Frango desfiado e catupiry.',52.00,4),
      ('Pizzas Salgadas','Pizza Bacon','Mucarela e bacon crocante.',49.00,5),
      ('Pizzas Doces','Pizza de Avela','Massa doce com creme de avela.',48.00,1),
      ('Pizzas Doces','Pizza Banana com Canela','Banana, acucar e canela.',42.00,2),
      ('Bordas','Borda de Catupiry','Borda recheada com catupiry.',8.00,1),
      ('Bebidas','Refrigerante 2L','Garrafa 2 litros.',14.00,1)
    ) t where v_seg = 'PIZZARIA'
    union all select * from (values
      ('Acai','Acai 300ml','Copo 300ml com dois complementos.',16.90,1),
      ('Acai','Acai 500ml','Copo 500ml com tres complementos.',22.90,2),
      ('Acai','Acai 700ml','Copo 700ml com quatro complementos.',28.90,3),
      ('Acai','Barca de Acai','Serve duas pessoas.',44.90,4),
      ('Complementos','Adicional de Granola','Porcao extra de granola.',3.00,1),
      ('Complementos','Adicional de Morango','Porcao de morango fresco.',5.00,2),
      ('Complementos','Adicional de Leite Condensado','Fio de leite condensado.',3.00,3),
      ('Complementos','Adicional de Pacoca','Pacoca triturada.',3.00,4),
      ('Bebidas','Agua mineral 500ml','Garrafa 500ml.',5.00,1)
    ) t where v_seg = 'ACAITERIA'
    union all select * from (values
      ('Entradas','Bolinho de Feijoada','Seis unidades com farofa.',34.00,1),
      ('Entradas','Salada da Casa','Folhas, tomate e parmesao.',28.00,2),
      ('Pratos Principais','File Mignon ao Molho Madeira','Acompanha arroz e batata.',78.00,1),
      ('Pratos Principais','Frango Grelhado','Peito grelhado com legumes.',52.00,2),
      ('Pratos Principais','Salmao Grelhado','Salmao com arroz de alho.',89.00,3),
      ('Guarnicoes','Arroz de Alho','Porcao individual.',16.00,1),
      ('Guarnicoes','Batata Rustica','Porcao individual.',22.00,2),
      ('Bebidas','Taca de Vinho Tinto','Taca 150ml.',24.00,1),
      ('Sobremesas','Pudim da Casa','Fatia individual.',18.00,1)
    ) t where v_seg = 'RESTAURANTE_A_LA_CARTE'
    union all select * from (values
      ('Buffet','Buffet por Quilo','Preco por quilo, pesado no balcao.',69.90,1),
      ('Buffet','Marmita P','Marmita pequena montada.',22.00,2),
      ('Buffet','Marmita M','Marmita media montada.',28.00,3),
      ('Buffet','Marmita G','Marmita grande montada.',34.00,4),
      ('Grelhados','Frango Grelhado','Porcao de frango grelhado.',18.00,1),
      ('Grelhados','Carne em Cubos','Porcao de carne bovina.',24.00,2),
      ('Bebidas','Refrigerante lata','Lata 350ml gelada.',7.00,1),
      ('Bebidas','Suco Natural 400ml','Suco da fruta do dia.',9.00,2),
      ('Sobremesas','Gelatina','Pote individual.',5.00,1)
    ) t where v_seg = 'RESTAURANTE_POR_QUILO'
    union all select * from (values
      ('Porcoes','Batata Frita','Porcao para dividir.',32.00,1),
      ('Porcoes','Frango a Passarinho','Porcao com limao.',48.00,2),
      ('Porcoes','Calabresa Acebolada','Porcao com cebola.',42.00,3),
      ('Porcoes','Queijo Coalho na Brasa','Seis espetos.',36.00,4),
      ('Chopes e Cervejas','Chopp Claro 300ml','Tirado na hora.',12.00,1),
      ('Chopes e Cervejas','Cerveja Long Neck','Garrafa 330ml.',12.00,2),
      ('Drinks','Caipirinha de Limao','Limao, acucar e gelo.',24.00,1),
      ('Drinks','Gin Tonica','Gin, tonica e limao.',32.00,2),
      ('Bebidas sem Alcool','Refrigerante lata','Lata 350ml gelada.',8.00,1)
    ) t where v_seg = 'BAR_PUB'
  )
  insert into produtos (loja_id, categoria_id, nome, descricao, preco, ordem, disponivel, controla_estoque)
  select p_loja, c.id, base.nome, base.descricao, base.preco, base.ordem, true, true
  from base join categorias c on c.loja_id = p_loja and c.nome = base.categoria;
  get diagnostics v_prods = row_count;

  -- ── Fichas tecnicas ───────────────────────────────────────────────────
  with base(produto, insumo, qtd) as (
    select * from (values
      ('X-Burger','Pao brioche',1),('X-Burger','Blend bovino 180g',1),('X-Burger','Queijo cheddar fatiado',1),
      ('X-Salada','Pao brioche',1),('X-Salada','Blend bovino 180g',1),('X-Salada','Queijo cheddar fatiado',1),
      ('X-Salada','Alface',1),('X-Salada','Tomate',2),
      ('X-Bacon','Pao brioche',1),('X-Bacon','Blend bovino 180g',1),('X-Bacon','Queijo cheddar fatiado',1),
      ('X-Bacon','Bacon em fatias',40),
      ('X-Frango','Pao brioche',1),('X-Frango','Frango desfiado',120),('X-Frango','Queijo cheddar fatiado',1),
      ('X-Frango','Molho da casa',20),
      ('X-Egg','Pao brioche',1),('X-Egg','Blend bovino 180g',1),('X-Egg','Queijo cheddar fatiado',1),('X-Egg','Ovo',1),
      ('Batata frita','Batata congelada',150),
      ('Batata com cheddar e bacon','Batata congelada',150),
      ('Batata com cheddar e bacon','Queijo cheddar fatiado',2),
      ('Batata com cheddar e bacon','Bacon em fatias',40),
      ('Refrigerante lata','Refrigerante lata 350ml',1),
      ('Sundae de chocolate','Sorvete de creme',150),('Sundae de chocolate','Calda de chocolate',30)
    ) t where v_seg in ('HAMBURGUERIA','DARK_KITCHEN')
    union all select * from (values
      ('Pizza Mucarela','Massa de pizza',1),('Pizza Mucarela','Molho de tomate',80),('Pizza Mucarela','Mucarela',200),
      ('Pizza Mucarela','Oregano',2),
      ('Pizza Calabresa','Massa de pizza',1),('Pizza Calabresa','Molho de tomate',80),
      ('Pizza Calabresa','Mucarela',150),('Pizza Calabresa','Calabresa',120),('Pizza Calabresa','Cebola',40),
      ('Pizza Portuguesa','Massa de pizza',1),('Pizza Portuguesa','Molho de tomate',80),
      ('Pizza Portuguesa','Mucarela',150),('Pizza Portuguesa','Presunto',100),
      ('Pizza Portuguesa','Ovo',1),('Pizza Portuguesa','Azeitona',30),
      ('Pizza Frango com Catupiry','Massa de pizza',1),('Pizza Frango com Catupiry','Molho de tomate',80),
      ('Pizza Frango com Catupiry','Mucarela',120),('Pizza Frango com Catupiry','Catupiry',100),
      ('Pizza Bacon','Massa de pizza',1),('Pizza Bacon','Molho de tomate',80),
      ('Pizza Bacon','Mucarela',180),('Pizza Bacon','Bacon em fatias',100),
      ('Pizza de Avela','Massa de pizza',1),('Pizza de Avela','Creme de avela',120),
      ('Pizza Banana com Canela','Massa de pizza',1),('Pizza Banana com Canela','Banana',3),
      ('Borda de Catupiry','Catupiry',80),
      ('Refrigerante 2L','Refrigerante 2L',1)
    ) t where v_seg = 'PIZZARIA'
    union all select * from (values
      ('Acai 300ml','Polpa de acai',300),('Acai 300ml','Copo 300ml',1),
      ('Acai 500ml','Polpa de acai',500),('Acai 500ml','Copo 500ml',1),
      ('Acai 700ml','Polpa de acai',700),('Acai 700ml','Copo 700ml',1),
      ('Barca de Acai','Polpa de acai',900),
      ('Adicional de Granola','Granola',40),
      ('Adicional de Morango','Morango',60),
      ('Adicional de Leite Condensado','Leite condensado',30),
      ('Adicional de Pacoca','Pacoca',1),
      ('Agua mineral 500ml','Agua mineral 500ml',1)
    ) t where v_seg = 'ACAITERIA'
    union all select * from (values
      ('Bolinho de Feijoada','Feijao',150),('Bolinho de Feijoada','Farinha de mandioca',60),
      ('Salada da Casa','Alface',4),('Salada da Casa','Queijo parmesao ralado',20),
      ('File Mignon ao Molho Madeira','File mignon',250),('File Mignon ao Molho Madeira','Arroz',150),
      ('File Mignon ao Molho Madeira','Batata',150),('File Mignon ao Molho Madeira','Manteiga',20),
      ('Frango Grelhado','Peito de frango',250),('Frango Grelhado','Arroz',150),
      ('Salmao Grelhado','Salmao',220),('Salmao Grelhado','Arroz',150),('Salmao Grelhado','Alho',2),
      ('Arroz de Alho','Arroz',180),('Arroz de Alho','Alho',2),
      ('Batata Rustica','Batata',220),('Batata Rustica','Manteiga',15),
      ('Taca de Vinho Tinto','Vinho tinto',150),
      ('Pudim da Casa','Pudim pronto',1)
    ) t where v_seg = 'RESTAURANTE_A_LA_CARTE'
    union all select * from (values
      ('Marmita P','Arroz',150),('Marmita P','Feijao',100),('Marmita P','Peito de frango',120),
      ('Marmita P','Embalagem marmita',1),
      ('Marmita M','Arroz',200),('Marmita M','Feijao',150),('Marmita M','Peito de frango',180),
      ('Marmita M','Embalagem marmita',1),
      ('Marmita G','Arroz',250),('Marmita G','Feijao',200),('Marmita G','Carne bovina em cubos',220),
      ('Marmita G','Embalagem marmita',1),
      ('Frango Grelhado','Peito de frango',200),
      ('Carne em Cubos','Carne bovina em cubos',200),
      ('Refrigerante lata','Refrigerante lata 350ml',1),
      ('Suco Natural 400ml','Suco natural',400),
      ('Gelatina','Gelatina',120)
    ) t where v_seg = 'RESTAURANTE_POR_QUILO'
    union all select * from (values
      ('Batata Frita','Batata congelada',300),
      ('Frango a Passarinho','Frango em cubos',400),('Frango a Passarinho','Limao',1),
      ('Calabresa Acebolada','Calabresa',300),('Calabresa Acebolada','Limao',1),
      ('Queijo Coalho na Brasa','Queijo coalho',300),('Queijo Coalho na Brasa','Molho barbecue',40),
      ('Chopp Claro 300ml','Chopp claro',300),
      ('Cerveja Long Neck','Cerveja long neck',1),
      ('Caipirinha de Limao','Vodka',60),('Caipirinha de Limao','Limao',1),
      ('Caipirinha de Limao','Acucar',20),('Caipirinha de Limao','Gelo',80),
      ('Gin Tonica','Gin',50),('Gin Tonica','Agua tonica',1),('Gin Tonica','Limao',1),('Gin Tonica','Gelo',80),
      ('Refrigerante lata','Refrigerante lata 350ml',1)
    ) t where v_seg = 'BAR_PUB'
  )
  insert into fichas_tecnicas (produto_id, insumo_id, quantidade_consumida)
  select pr.id, i.id, base.qtd
  from base
  join produtos pr on pr.loja_id = p_loja and pr.nome = base.produto
  join insumos  i  on i.loja_id  = p_loja and i.nome  = base.insumo
  on conflict do nothing;
  get diagnostics v_fichas = row_count;

  return jsonb_build_object(
    'semeado', true, 'segmento', v_seg,
    'categorias', v_cats, 'insumos', v_ins, 'produtos', v_prods, 'fichas', v_fichas
  );
end;
$function$;

revoke all on function public.fn_semear_loja(uuid, text) from public;
grant execute on function public.fn_semear_loja(uuid, text) to authenticated;

comment on function public.fn_semear_loja(uuid, text) is
  'Base inicial do segmento: categorias, insumos, produtos com preco sugerido e ficha tecnica ligada. Estoque e custo de insumo nascem zerados de proposito. Nao roda em loja que ja tem produto.';

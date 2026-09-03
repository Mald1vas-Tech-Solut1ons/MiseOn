-- Loja nova nascia vazia: o dono abria o painel e tinha que inventar tudo do
-- zero — categoria, insumo, produto e ficha tecnica, item por item. E o passo
-- em que mais gente desiste, porque cadastrar cardapio inteiro na mao antes de
-- vender o primeiro lanche nao parece trabalho de dono de restaurante.
--
-- Agora a loja nasce com uma base do segmento dela, para AJUSTAR em vez de
-- criar. Preco e estoque entram zerados de proposito: numero chutado no sistema
-- e pior que numero em branco, porque vira custo errado sem ninguem perceber.
--
-- Idempotente: nao semeia loja que ja tem produto. Rodar duas vezes nao duplica.

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

  -- So o admin da propria loja semeia (service role ignora RLS e passa direto).
  if auth.uid() is not null and coalesce(fn_meu_papel(p_loja), '') <> 'admin' then
    raise exception 'Apenas o administrador da loja pode aplicar a base do segmento.';
  end if;

  v_seg := upper(coalesce(nullif(btrim(p_segmento), ''),
                          (select segmento_negocio from lojas where id = p_loja), 'GERAL'));

  select count(*) into v_existe from produtos where loja_id = p_loja;
  if v_existe > 0 then
    return jsonb_build_object('semeado', false, 'motivo', 'a loja ja tem produtos cadastrados');
  end if;

  with base(nome, ordem) as (
    select * from (values
      ('Hamburgueres', 1), ('Acompanhamentos', 2), ('Bebidas', 3), ('Sobremesas', 4)
    ) t where v_seg in ('HAMBURGUERIA', 'DARK_KITCHEN')
    union all
    select * from (values
      ('Pizzas Salgadas', 1), ('Pizzas Doces', 2), ('Bordas', 3), ('Bebidas', 4)
    ) t where v_seg = 'PIZZARIA'
    union all
    select * from (values
      ('Acai', 1), ('Complementos', 2), ('Bebidas', 3)
    ) t where v_seg = 'ACAITERIA'
  )
  insert into categorias (loja_id, nome, ordem, ativo)
  select p_loja, base.nome, base.ordem, true from base;
  get diagnostics v_cats = row_count;

  with base(nome, unidade, categoria) as (
    select * from (values
      ('Pao brioche','un','Padaria'), ('Blend bovino 180g','un','Carnes'),
      ('Queijo cheddar fatiado','fatias','Frios'), ('Bacon em fatias','g','Frios'),
      ('Alface','folha','Hortifruti'), ('Tomate','fatias','Hortifruti'),
      ('Cebola','g','Hortifruti'), ('Molho da casa','ml','Ingrediente'),
      ('Batata congelada','g','Congelados'), ('Refrigerante lata 350ml','un','Bebidas')
    ) t where v_seg in ('HAMBURGUERIA', 'DARK_KITCHEN')
    union all
    select * from (values
      ('Massa de pizza','un','Padaria'), ('Molho de tomate','ml','Ingrediente'),
      ('Mucarela','g','Laticinios'), ('Calabresa','g','Frios'),
      ('Presunto','g','Frios'), ('Catupiry','g','Laticinios'),
      ('Oregano','g','Mercearia'), ('Azeitona','g','Mercearia'),
      ('Creme de avela','g','Mercearia'), ('Refrigerante 2L','un','Bebidas')
    ) t where v_seg = 'PIZZARIA'
    union all
    select * from (values
      ('Polpa de acai','g','Congelados'), ('Banana','un','Hortifruti'),
      ('Morango','g','Hortifruti'), ('Leite condensado','ml','Mercearia'),
      ('Leite em po','g','Mercearia'), ('Granola','g','Mercearia'),
      ('Pacoca','un','Mercearia'), ('Creme de avela','g','Mercearia'),
      ('Copo 300ml','un','Descartaveis'), ('Copo 500ml','un','Descartaveis')
    ) t where v_seg = 'ACAITERIA'
  )
  insert into insumos (loja_id, nome, unidade_medida, categoria_insumo,
                       quantidade_atual, estoque_minimo, preco_embalagem, qtd_embalagem)
  select p_loja, base.nome, base.unidade, base.categoria, 0, 0, 0, 1 from base;
  get diagnostics v_ins = row_count;

  with base(categoria, nome, descricao, ordem) as (
    select * from (values
      ('Hamburgueres','X-Burger','Pao brioche, blend 180g e queijo.',1),
      ('Hamburgueres','X-Salada','Pao brioche, blend 180g, queijo, alface e tomate.',2),
      ('Hamburgueres','X-Bacon','Pao brioche, blend 180g, queijo e bacon.',3),
      ('Acompanhamentos','Batata frita','Porcao de batata frita crocante.',1),
      ('Bebidas','Refrigerante lata','Lata 350ml gelada.',1)
    ) t where v_seg in ('HAMBURGUERIA', 'DARK_KITCHEN')
    union all
    select * from (values
      ('Pizzas Salgadas','Pizza Mucarela','Molho, mucarela e oregano.',1),
      ('Pizzas Salgadas','Pizza Calabresa','Molho, mucarela, calabresa e cebola.',2),
      ('Pizzas Salgadas','Pizza Portuguesa','Molho, mucarela, presunto e azeitona.',3),
      ('Pizzas Doces','Pizza de Avela','Massa doce com creme de avela.',1),
      ('Bebidas','Refrigerante 2L','Garrafa 2 litros.',1)
    ) t where v_seg = 'PIZZARIA'
    union all
    select * from (values
      ('Acai','Acai 300ml','Copo de 300ml com dois complementos.',1),
      ('Acai','Acai 500ml','Copo de 500ml com tres complementos.',2),
      ('Acai','Barca de Acai','Serve duas pessoas, com complementos a escolha.',3),
      ('Complementos','Adicional de Granola','Porcao extra de granola.',1),
      ('Bebidas','Agua mineral 500ml','Garrafa 500ml.',1)
    ) t where v_seg = 'ACAITERIA'
  )
  insert into produtos (loja_id, categoria_id, nome, descricao, preco, ordem, disponivel, controla_estoque)
  select p_loja, c.id, base.nome, base.descricao, 0, base.ordem, true, true
  from base join categorias c on c.loja_id = p_loja and c.nome = base.categoria;
  get diagnostics v_prods = row_count;

  with base(produto, insumo, qtd) as (
    select * from (values
      ('X-Burger','Pao brioche',1), ('X-Burger','Blend bovino 180g',1),
      ('X-Burger','Queijo cheddar fatiado',1),
      ('X-Salada','Pao brioche',1), ('X-Salada','Blend bovino 180g',1),
      ('X-Salada','Queijo cheddar fatiado',1), ('X-Salada','Alface',1), ('X-Salada','Tomate',2),
      ('X-Bacon','Pao brioche',1), ('X-Bacon','Blend bovino 180g',1),
      ('X-Bacon','Queijo cheddar fatiado',1), ('X-Bacon','Bacon em fatias',40),
      ('Batata frita','Batata congelada',150),
      ('Refrigerante lata','Refrigerante lata 350ml',1)
    ) t where v_seg in ('HAMBURGUERIA', 'DARK_KITCHEN')
    union all
    select * from (values
      ('Pizza Mucarela','Massa de pizza',1), ('Pizza Mucarela','Molho de tomate',80),
      ('Pizza Mucarela','Mucarela',200),
      ('Pizza Calabresa','Massa de pizza',1), ('Pizza Calabresa','Molho de tomate',80),
      ('Pizza Calabresa','Mucarela',150), ('Pizza Calabresa','Calabresa',120),
      ('Pizza Portuguesa','Massa de pizza',1), ('Pizza Portuguesa','Molho de tomate',80),
      ('Pizza Portuguesa','Mucarela',150), ('Pizza Portuguesa','Presunto',100),
      ('Pizza Portuguesa','Azeitona',30),
      ('Pizza de Avela','Massa de pizza',1), ('Pizza de Avela','Creme de avela',120),
      ('Refrigerante 2L','Refrigerante 2L',1)
    ) t where v_seg = 'PIZZARIA'
    union all
    select * from (values
      ('Acai 300ml','Polpa de acai',300), ('Acai 300ml','Copo 300ml',1),
      ('Acai 500ml','Polpa de acai',500), ('Acai 500ml','Copo 500ml',1),
      ('Barca de Acai','Polpa de acai',900),
      ('Adicional de Granola','Granola',40)
    ) t where v_seg = 'ACAITERIA'
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
  'Base inicial do segmento (categorias, insumos, produtos e fichas). Nao roda em loja que ja tem produto. Preco e estoque nascem zerados: numero chutado e pior que campo em branco.';

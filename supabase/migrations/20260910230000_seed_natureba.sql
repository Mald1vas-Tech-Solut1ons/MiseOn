-- ============================================================================
-- SEED OFICIAL — "N" de NATUREBA!
--
-- Cardápio real da loja, transcrito do que ela publica hoje (Av. Sapopemba
-- 7750, Box 2 — pedido mínimo R$ 15, atende até 22h30). Preços copiados um a
-- um: nada aqui é estimativa, e nenhum valor foi "arredondado para ficar
-- bonito". Se o preço mudou desde a leitura, quem manda é a loja.
--
-- ─── A DECISÃO DE MODELAGEM, E POR QUE ELA IMPORTA ─────────────────────────
--
-- No cardápio atual cada lanche existe DUAS vezes: "BAGUETE DE FRANGO - 15CM"
-- e "COMBO BAGUETE DE FRANGO - 15CM". São 32 cadastros para 16 lanches. E o
-- efeito colateral do cadastro duplicado é visível nos próprios preços: a
-- bebida do combo custa +R$ 3,00 no frango de 15 cm e +R$ 10,00 no de 30 cm;
-- +R$ 6,00 no presunto de 15 cm e +R$ 9,00 no de 30 cm. Ninguém decidiu isso —
-- é a duplicação apodrecendo sozinha, cada linha editada num dia diferente.
--
-- Aqui o combo vira um GRUPO DE OPÇÕES do próprio lanche. Ganhos concretos:
--   • 32 cadastros viram 16: mudar o preço do frango é um lugar, não dois;
--   • o cliente ESCOLHE a bebida na hora do pedido. Hoje o combo diz "bebida a
--     sua escolha" e a escolha acontece fora do sistema — alguém pergunta no
--     WhatsApp ou adivinha na cozinha;
--   • a diferença de preço entre tamanhos fica explícita, em vez de escondida
--     em dois cadastros que ninguém compara.
--
-- Os valores de combo foram preservados EXATAMENTE como estão hoje, inclusive
-- as inconsistências. Corrigi-las é decisão comercial da loja, não minha: a
-- migration só torna a inconsistência visível.
--
-- ─── MODIFICADORES QUE TIRAM TRABALHO DA LOJA ──────────────────────────────
--
-- Duas coisas que hoje vivem em texto livre e passam a ser escolha estruturada:
--
--   • MARMITA: o cardápio atual pede, em maiúsculas e com emoji, que o cliente
--     escreva "para que aqueça" NA OBSERVAÇÃO DO PEDIDO. Observação livre é
--     onde pedido se perde — ninguém filtra, ninguém conta, e o entregador
--     descobre na hora. Virou grupo obrigatório "Como enviar": congelada ou
--     aquecida. A cozinha lê na comanda.
--   • SALADA: "molho à sua escolha" virou grupo obrigatório com os molhos, em
--     vez de uma frase que o cliente pode ignorar.
--
-- ─── FOTOS ─────────────────────────────────────────────────────────────────
-- Esta seed NÃO traz imagem. As fotos que a loja usa hoje estão hospedadas no
-- sistema do concorrente; copiá-las de lá não é meu papel. Enquanto não
-- chegarem as originais, o cardápio usa o fallback por nome do produto, que já
-- existe no front (`obterFotoFallback`) — a vitrine não fica quebrada.
--
-- ─── IDEMPOTÊNCIA ──────────────────────────────────────────────────────────
-- Roda quantas vezes for preciso: categoria e produto já existentes pelo nome
-- são pulados, e grupo de opções já criado pelo lojista nunca é sobrescrito.
-- ============================================================================

create or replace function public.fn_semear_natureba(p_loja uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_cats   int := 0;
  v_prods  int := 0;
  v_grupos int := 0;
  v_ops    int := 0;
  r        record;
  v_cat    uuid;
  v_prod   uuid;
  v_grupo  uuid;
begin
  if p_loja is null then raise exception 'loja obrigatoria'; end if;
  if auth.uid() is not null and coalesce(fn_meu_papel(p_loja), '') <> 'admin' then
    raise exception 'Apenas o administrador da loja pode aplicar a base do cardapio.';
  end if;

  -- ── Categorias ────────────────────────────────────────────────────────────
  for r in
    select * from (values
      ('Lanche do dia',      1),
      ('Baguetes 15 cm',     2),
      ('Baguetes 30 cm',     3),
      ('Marmitas fitness',   4),
      ('Saladas',            5),
      ('Caldos',             6),
      ('Bebidas',            7)
    ) t(nome, ordem)
  loop
    if not exists (select 1 from categorias c where c.loja_id = p_loja and lower(c.nome) = lower(r.nome)) then
      insert into categorias (loja_id, nome, ordem) values (p_loja, r.nome, r.ordem);
      v_cats := v_cats + 1;
    end if;
  end loop;

  -- ── Produtos ──────────────────────────────────────────────────────────────
  -- combo_delta: quanto a loja cobra hoje para transformar o item em combo
  -- (preco do "COMBO ..." menos o preco do lanche solto). NULL = sem combo.
  for r in
    select * from (values
      -- Lanche do dia
      ('Lanche do dia', 'Baguete de salame 15 cm (lanche do dia)', 19.99,
       'Baguete de parmesão de 15 cm, com maionese cremosa, salame fatiado, queijo prato, alface americana crocante e tomate fresco. O lanche do dia muda conforme o dia da semana.',
       null::numeric, true),

      -- Baguetes 15 cm (base: preco solto | combo_delta: o que a loja cobra pela bebida)
      ('Baguetes 15 cm', 'Baguete de carne louca 15 cm', 28.00,
       'Baguete artesanal de fermentação natural, sem conservante. Carne desfiada com tempero caseiro, alface americana e tomate em rodelas.', 4.00, false),
      ('Baguetes 15 cm', 'Baguete de carne louca com queijo 15 cm', 32.00,
       'Baguete artesanal de fermentação natural, sem conservante. Carne desfiada com tempero caseiro, queijo prato, alface americana e tomate em rodelas.', 4.00, false),
      ('Baguetes 15 cm', 'Baguete de atum 15 cm', 24.00,
       'Baguete artesanal de fermentação natural, sem conservante. Patê de atum com tempero caseiro, queijo prato, alface americana e tomate em rodelas.', 3.00, false),
      ('Baguetes 15 cm', 'Baguete de frango 15 cm', 24.00,
       'Baguete artesanal de fermentação natural, sem conservante. Patê de frango com tempero caseiro, queijo prato, alface americana e tomate em rodelas.', 3.00, true),
      ('Baguetes 15 cm', 'Baguete de peito de peru 15 cm', 25.00,
       'Baguete artesanal de fermentação natural, sem conservante. Requeijão cremoso, peito de peru fatiado, alface americana e tomate em rodelas.', 4.00, false),
      ('Baguetes 15 cm', 'Baguete de presunto e queijo 15 cm', 16.00,
       'Baguete artesanal de fermentação natural, sem conservante. Maionese tradicional, queijo prato, presunto, alface americana e tomate em rodelas.', 6.00, false),
      ('Baguetes 15 cm', 'Baguete de salame 15 cm', 25.00,
       'Baguete artesanal de fermentação natural, sem conservante. Maionese tradicional, salame, queijo prato, alface americana e tomate em rodelas.', 4.00, false),
      ('Baguetes 15 cm', 'Baguete vegetariana 15 cm', 16.99,
       'Baguete artesanal de fermentação natural, sem conservante. Requeijão cremoso, queijo prato, alface americana e tomate em rodelas.', 7.00, false),

      -- Baguetes 30 cm
      ('Baguetes 30 cm', 'Baguete de carne louca 30 cm', 32.00,
       'Baguete artesanal de fermentação natural, sem conservante. Carne desfiada com tempero caseiro, alface americana e tomate em rodelas.', 6.00, false),
      ('Baguetes 30 cm', 'Baguete de carne louca com queijo 30 cm', 35.00,
       'Baguete artesanal de fermentação natural, sem conservante. Carne desfiada com tempero caseiro, queijo prato, alface americana e tomate em rodelas. Pode ir com ou sem pimenta.', 7.99, false),
      ('Baguetes 30 cm', 'Baguete de atum 30 cm', 27.00,
       'Baguete artesanal de fermentação natural, sem conservante. Patê de atum com tempero caseiro, queijo prato, alface americana e tomate em rodelas.', 10.00, false),
      ('Baguetes 30 cm', 'Baguete de frango 30 cm', 27.00,
       'Baguete artesanal de fermentação natural, sem conservante. Patê de frango com tempero caseiro, queijo prato, alface americana e tomate em rodelas.', 10.00, true),
      ('Baguetes 30 cm', 'Baguete de peito de peru 30 cm', 28.00,
       'Baguete artesanal de fermentação natural, sem conservante. Requeijão cremoso, peito de peru fatiado, alface americana e tomate em rodelas.', 9.00, false),
      ('Baguetes 30 cm', 'Baguete de presunto e queijo 30 cm', 18.00,
       'Baguete artesanal de fermentação natural, sem conservante. Maionese tradicional, queijo prato, presunto, alface americana e tomate em rodelas.', 9.00, false),
      ('Baguetes 30 cm', 'Baguete de salame 30 cm', 28.00,
       'Baguete artesanal de fermentação natural, sem conservante. Maionese tradicional, salame, queijo prato, alface americana e tomate em rodelas.', 9.00, false),
      ('Baguetes 30 cm', 'Baguete vegetariana 30 cm', 19.99,
       'Baguete artesanal de fermentação natural, sem conservante. Requeijão cremoso, queijo prato, alface americana e tomate em rodelas.', 10.00, false),

      -- Marmitas fitness
      ('Marmitas fitness', 'Marmita fitness de frango grelhado', 22.99,
       'Arroz branco soltinho, frango grelhado macio e legumes refogados variados. Congelada para preservar sabor e valor nutricional. Para consumo imediato, aqueça 5 minutos no micro-ondas.', null, false),
      ('Marmitas fitness', 'Marmita fitness de patinho moído', 24.99,
       'Arroz branco, patinho moído e legumes variados refogados. Congelada para preservar sabor e valor nutricional. Para consumo imediato, aqueça 5 minutos no micro-ondas.', null, false),

      -- Saladas
      ('Saladas', 'Salada proteica de atum', 29.98,
       'Alface americana, tomate-cereja, cenoura ralada, palmito fatiado e pepino em rodelas, com patê de atum caseiro e croutons crocantes. Pote de 750 ml, cerca de 500 g. Montada diariamente e servida gelada.', null, false),
      ('Saladas', 'Salada de frango cremoso', 29.98,
       'Alface americana, tomate-cereja, cenoura ralada, palmito fatiado e pepino em rodelas, com patê de frango caseiro e croutons. Pote de 750 ml, cerca de 500 g. Montada diariamente e servida gelada.', null, false),
      ('Saladas', 'Salada fresh com frango grelhado', 35.00,
       'Alface americana, tomate-cereja, cenoura ralada, palmito fatiado, pepino em rodelas, croutons e filé de frango grelhado em tiras. Pote de 750 ml, cerca de 500 g. Montada diariamente e servida gelada.', null, false),

      -- Caldos
      ('Caldos', 'Caldo de frango desfiado', 22.99, 'Caldo quente de frango desfiado.', null, false),
      ('Caldos', 'Caldo verde', 22.99, 'Caldo verde tradicional.', null, false),

      -- Bebidas
      ('Bebidas', 'Água mineral 510 ml', 3.99, 'Chega geladinha, quase trincando.', null, false),
      ('Bebidas', 'Água mineral com gás 510 ml', 4.99, 'Chega geladinha, quase trincando.', null, false),
      ('Bebidas', 'Água tônica', 7.99, 'Bem geladinha.', null, false),
      ('Bebidas', 'Coca-Cola 350 ml', 7.99, 'Chega geladinha, quase trincando.', null, true),
      ('Bebidas', 'Coca-Cola Zero 350 ml', 7.99, 'Chega geladinha, quase trincando.', null, true),
      ('Bebidas', 'Fanta Laranja 350 ml', 7.99, 'Chega geladinha, quase trincando.', null, false),
      ('Bebidas', 'Fanta Uva 350 ml', 7.99, 'Chega geladinha, quase trincando.', null, false),
      ('Bebidas', 'Guaraná Antarctica 350 ml', 7.99, 'Chega geladinha, quase trincando.', null, false),
      ('Bebidas', 'Guaraná Antarctica Zero 350 ml', 7.99, 'Chega geladinha, quase trincando.', null, false),
      ('Bebidas', 'Sprite 350 ml', 7.99, 'Chega geladinha, quase trincando.', null, false),
      ('Bebidas', 'Soda Limonada 350 ml', 7.99, 'Chega geladinha, quase trincando.', null, false),
      ('Bebidas', 'Coca-Cola 600 ml', 10.00, 'Chega geladinha, quase trincando.', null, false),
      ('Bebidas', 'Coca-Cola Zero 600 ml', 10.00, 'Chega geladinha, quase trincando.', null, false),
      ('Bebidas', 'Guaraná Antarctica 600 ml', 10.00, 'Chega geladinha, quase trincando.', null, false),
      ('Bebidas', 'Guaraná Antarctica Zero 600 ml', 10.00, 'Chega geladinha, quase trincando.', null, false),
      ('Bebidas', 'Fanta Laranja 600 ml', 10.00, 'Chega geladinha, quase trincando.', null, false),
      ('Bebidas', 'Sprite 510 ml', 10.00, 'Chega geladinha, quase trincando.', null, false),
      ('Bebidas', 'Itubaína 500 ml', 10.00, 'Chega geladinha, quase trincando.', null, false),
      ('Bebidas', 'H2OH! Limoneto 500 ml', 10.00, 'Levemente gaseificada, com toque de limão. Sem açúcar e sem calorias.', null, false),
      ('Bebidas', 'Red Bull 250 ml', 14.99, 'Energético.', null, false),
      ('Bebidas', 'Red Bull Zero 250 ml', 14.99, 'Energético sem açúcar.', null, false),
      ('Bebidas', 'Monster Energy 473 ml', 17.99, 'Energético.', null, false),
      ('Bebidas', 'Suco de abacaxi 1 L', 10.00, 'Suco de caixa, 1 litro. Chega geladinho.', null, false),
      ('Bebidas', 'Suco de caju 1 L', 10.00, 'Suco de caixa, 1 litro. Chega geladinho.', null, false),
      ('Bebidas', 'Suco de laranja 1 L', 10.00, 'Suco de caixa, 1 litro. Chega geladinho.', null, false),
      ('Bebidas', 'Suco de uva 1 L', 10.00, 'Suco de caixa, 1 litro. Chega geladinho.', null, false)
    ) t(categoria, nome, preco, descricao, combo_delta, destaque)
  loop
    if exists (select 1 from produtos p where p.loja_id = p_loja and lower(p.nome) = lower(r.nome)) then
      continue;
    end if;

    select c.id into v_cat from categorias c
     where c.loja_id = p_loja and lower(c.nome) = lower(r.categoria) limit 1;

    insert into produtos (loja_id, categoria_id, nome, descricao, preco, destaque, disponivel, controla_estoque)
    values (p_loja, v_cat, r.nome, r.descricao, r.preco, r.destaque, true, false)
    returning id into v_prod;
    v_prods := v_prods + 1;

    -- ── Combo: a bebida vira escolha, com o preco que a loja ja pratica ─────
    if r.combo_delta is not null then
      insert into grupos_opcoes (produto_id, nome, min_escolhas, max_escolhas, ordem)
      values (v_prod, 'Transformar em combo', 0, 1, 1)
      returning id into v_grupo;
      v_grupos := v_grupos + 1;

      insert into opcoes (grupo_id, nome, preco_adicional, ordem)
      select v_grupo, b.nome, r.combo_delta, b.ordem
        from (values
          ('Coca-Cola 350 ml', 0), ('Coca-Cola Zero 350 ml', 1),
          ('Guaraná Antarctica 350 ml', 2), ('Guaraná Antarctica Zero 350 ml', 3),
          ('Fanta Laranja 350 ml', 4), ('Fanta Uva 350 ml', 5),
          ('Sprite 350 ml', 6), ('Soda Limonada 350 ml', 7),
          ('Água mineral 510 ml', 8), ('Água mineral com gás 510 ml', 9)
        ) b(nome, ordem);
      v_ops := v_ops + 10;
    end if;

    -- ── Adicionais e retiradas do lanche ───────────────────────────────────
    if r.categoria in ('Baguetes 15 cm', 'Baguetes 30 cm', 'Lanche do dia') then
      insert into grupos_opcoes (produto_id, nome, min_escolhas, max_escolhas, ordem)
      values (v_prod, 'Turbine seu lanche', 0, 5, 2)
      returning id into v_grupo;
      v_grupos := v_grupos + 1;
      insert into opcoes (grupo_id, nome, preco_adicional, ordem)
      select v_grupo, a.nome, a.preco, a.ordem
        from (values
          ('Queijo prato extra', 4.00, 0),
          ('Requeijão cremoso', 3.00, 1),
          ('Ovo grelhado', 3.00, 2),
          ('Cebola roxa', 2.00, 3),
          ('Pimenta', 0.00, 4)
        ) a(nome, preco, ordem);
      v_ops := v_ops + 5;

      insert into grupos_opcoes (produto_id, nome, min_escolhas, max_escolhas, ordem)
      values (v_prod, 'Tirar ingrediente', 0, 4, 3)
      returning id into v_grupo;
      v_grupos := v_grupos + 1;
      insert into opcoes (grupo_id, nome, preco_adicional, ordem)
      select v_grupo, x.nome, 0, x.ordem
        from (values ('Sem alface', 0), ('Sem tomate', 1), ('Sem maionese', 2), ('Sem cebola', 3)) x(nome, ordem);
      v_ops := v_ops + 4;
    end if;

    -- ── Marmita: "aqueça" sai da observacao e vira escolha ──────────────────
    if r.categoria = 'Marmitas fitness' then
      insert into grupos_opcoes (produto_id, nome, min_escolhas, max_escolhas, ordem)
      values (v_prod, 'Como enviar', 1, 1, 1)
      returning id into v_grupo;
      v_grupos := v_grupos + 1;
      insert into opcoes (grupo_id, nome, preco_adicional, ordem)
      select v_grupo, m.nome, 0, m.ordem
        from (values
          ('Congelada, para guardar', 0),
          ('Aquecida, para comer agora', 1)
        ) m(nome, ordem);
      v_ops := v_ops + 2;
    end if;

    -- ── Salada: "molho a sua escolha" vira escolha de verdade ───────────────
    if r.categoria = 'Saladas' then
      insert into grupos_opcoes (produto_id, nome, min_escolhas, max_escolhas, ordem)
      values (v_prod, 'Molho', 1, 1, 1)
      returning id into v_grupo;
      v_grupos := v_grupos + 1;
      insert into opcoes (grupo_id, nome, preco_adicional, ordem)
      select v_grupo, s.nome, 0, s.ordem
        from (values
          ('Molho da casa', 0), ('Azeite e limão', 1), ('Mostarda e mel', 2), ('Sem molho', 3)
        ) s(nome, ordem);
      v_ops := v_ops + 4;

      insert into grupos_opcoes (produto_id, nome, min_escolhas, max_escolhas, ordem)
      values (v_prod, 'Adicionais', 0, 3, 2)
      returning id into v_grupo;
      v_grupos := v_grupos + 1;
      insert into opcoes (grupo_id, nome, preco_adicional, ordem)
      select v_grupo, s.nome, s.preco, s.ordem
        from (values
          ('Cebola roxa', 2.00, 0),
          ('Patê de frango', 6.00, 1),
          ('Croutons extra', 3.00, 2)
        ) s(nome, preco, ordem);
      v_ops := v_ops + 3;
    end if;
  end loop;

  return jsonb_build_object(
    'categorias', v_cats, 'produtos', v_prods, 'grupos', v_grupos, 'opcoes', v_ops
  );
end;
$function$;

comment on function public.fn_semear_natureba(uuid) is
  'Cardapio real da "N" de NATUREBA! transcrito do que a loja publica hoje. O combo virou grupo de opcoes: 32 cadastros duplicados viram 16 produtos, e o cliente escolhe a bebida. Idempotente por nome.';

revoke execute on function public.fn_semear_natureba(uuid) from public, anon;
grant execute on function public.fn_semear_natureba(uuid) to authenticated;

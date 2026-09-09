-- Tomate cru e um insumo armazenavel, nao um preparo imposto pelo sistema.
-- O seed antigo misturava a unidade de estoque (kg/un) com a forma de uso
-- (fatias). Para lojas novas, redefine a funcao de seed sem duplicar toda a
-- funcao nesta migration; em um replay novo, a migration original ja contem a
-- versao corrigida e este bloco apenas confirma o estado esperado.

do $migration$
declare
  v_definicao text;
  v_original text;
begin
  select pg_get_functiondef('public.fn_semear_loja(uuid,text)'::regprocedure)
    into v_definicao;
  v_original := v_definicao;

  v_definicao := replace(
    v_definicao,
    '(''Tomate'',''fatias'',''Hortifrúti'')',
    '(''Tomate'',''kg'',''Hortifrúti'')'
  );
  v_definicao := replace(
    v_definicao,
    '(''Tomate'',''fatias'',''Hortifruti'')',
    '(''Tomate'',''kg'',''Hortifruti'')'
  );
  v_definicao := replace(
    v_definicao,
    '(''X-Salada'',''Tomate'',2)',
    '(''X-Salada'',''Tomate'',0.040)'
  );

  if v_definicao <> v_original then
    execute v_definicao;
  elsif position('(''Tomate'',''kg'',''Hortifrúti'')' in v_definicao) = 0
    and position('(''Tomate'',''kg'',''Hortifruti'')' in v_definicao) = 0 then
    raise exception 'fn_semear_loja nao contem a regra esperada para Tomate; correcao manual necessaria';
  end if;
end;
$migration$;

-- Corrige somente registros com a assinatura exata do seed e ainda virgens.
-- Qualquer saldo, custo, movimento, lote, conversao ou ficha personalizada faz
-- a linha ser preservada: trocar sua unidade sem um fator declarado corromperia
-- quantidade, custo e CMV. Esses casos devem passar pela decisao do usuario.
do $migration$
declare
  v_tomate record;
begin
  for v_tomate in
    select i.id
    from public.insumos i
    where lower(btrim(i.nome)) = 'tomate'
      and i.unidade_medida = 'fatias'
      and coalesce(i.is_preparo, false) = false
      and coalesce(i.quantidade_atual, 0) = 0
      and coalesce(i.estoque_minimo, 0) = 0
      and coalesce(i.preco_embalagem, 0) = 0
      and coalesce(i.qtd_embalagem, 1) = 1
      and not exists (
        select 1 from public.movimentacoes_estoque m where m.insumo_id = i.id
      )
      and not exists (
        select 1 from public.lotes_estoque l where l.insumo_id = i.id
      )
      and not exists (
        select 1 from public.fatores_conversao f where f.item_id = i.id
      )
      and not exists (
        select 1
        from public.fichas_tecnicas ft
        join public.produtos p on p.id = ft.produto_id
        where ft.insumo_id = i.id
          and not (
            p.loja_id = i.loja_id
            and p.nome = 'X-Salada'
            and ft.quantidade_consumida = 2
          )
      )
      and (
        exists (
          select 1 from public.produtos p
          where p.loja_id = i.loja_id and p.nome = 'X-Salada'
        )
        or exists (
          select 1 from public.produtos p
          where p.loja_id = i.loja_id and p.nome = 'Buffet por Quilo'
        )
      )
  loop
    update public.fichas_tecnicas ft
       set quantidade_consumida = 0.040
      from public.produtos p
     where ft.produto_id = p.id
       and ft.insumo_id = v_tomate.id
       and p.nome = 'X-Salada'
       and ft.quantidade_consumida = 2;

    update public.insumos
       set unidade_medida = 'kg'
     where id = v_tomate.id;
  end loop;
end;
$migration$;

comment on function public.fn_semear_loja(uuid, text) is
  'Base inicial do segmento. Insumos nascem em unidades fisicas/comerciais; cortes e porcionamentos dependem de preparo e rendimento declarados pelo usuario.';

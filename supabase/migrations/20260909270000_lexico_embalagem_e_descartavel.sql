-- Sacola nao e ingrediente. Nem canudo, nem marmitex, nem papel aluminio.
--
-- O lexico da migration 20260909230000 so cobria o que NAO entra na ficha
-- (limpeza, higiene, EPI, manutencao). Embalagem e descartavel entram na
-- ficha -- fazem parte do custo do lote -- mas entram como EMBALAGEM e
-- DESCARTAVEL, no grupo proprio da tela, nunca como materia-prima. Faltando
-- esses termos, "Sacola" cadastrada com categoria "Ingrediente" continuava
-- aparecendo junto do tomate e do queijo.

insert into public.classificacao_lexico (termo, categoria, prioridade) values
  -- Embalagem: leva o produto ate o cliente
  ('sacola',              'Embalagem', 2),
  ('sacola plastica',     'Embalagem', 3),
  ('embalagem',           'Embalagem', 1),
  ('embalagem marmita',   'Embalagem', 3),
  ('marmitex',            'Embalagem', 2),
  ('caixa de pizza',      'Embalagem', 3),
  ('caixa para pizza',    'Embalagem', 3),
  ('pote descartavel',    'Embalagem', 3),
  ('pote para viagem',    'Embalagem', 3),
  ('bandeja de isopor',   'Embalagem', 3),
  ('isopor',              'Embalagem', 2),
  ('filme pvc',           'Embalagem', 3),
  ('papel filme',         'Embalagem', 3),
  ('papel aluminio',      'Embalagem', 3),
  ('papel manteiga',      'Embalagem', 3),
  ('saco kraft',          'Embalagem', 3),
  ('saco de papel',       'Embalagem', 3),
  ('lacre',               'Embalagem', 2),
  ('etiqueta',            'Embalagem', 2),
  ('rotulo',              'Embalagem', 2),
  ('tampa',               'Embalagem', 1),
  -- Descartaveis: acompanham o consumo
  ('descartavel',         'Descartáveis', 1),
  ('copo descartavel',    'Descartáveis', 3),
  ('copo plastico',       'Descartáveis', 3),
  ('canudo',              'Descartáveis', 2),
  ('guardanapo',          'Descartáveis', 2),
  ('talher descartavel',  'Descartáveis', 3),
  ('garfo descartavel',   'Descartáveis', 3),
  ('colher descartavel',  'Descartáveis', 3),
  ('faca descartavel',    'Descartáveis', 3),
  ('prato descartavel',   'Descartáveis', 3),
  ('palito de dente',     'Descartáveis', 3)
on conflict (termo) do nothing;

-- O backfill anterior so corrigia o que estava FORA da ficha tecnica, entao
-- nao alcancava embalagem. Agora qualquer divergencia entre o nome e o tipo e
-- corrigida -- o lexico so contem termos de nao-alimento, entao nao ha risco
-- de rebaixar comida. A decisao do lojista continua intocada.
do $migration$
declare
  v_corrigidos int;
begin
  with alvo as (
    select i.id, c.categoria, c.tipo_item
      from public.insumos i
      join public.classificacao_categorias c
        on c.categoria = public.fn_lexico_do_nome(i.nome)
     where coalesce(i.is_preparo, false) = false
       and coalesce(i.classificacao_origem, '') <> 'USUARIO'
       and coalesce(i.classificacao_revisada, false) = false
       and i.tipo_item is distinct from c.tipo_item
  )
  update public.insumos i
     set tipo_item               = a.tipo_item,
         categoria_insumo        = a.categoria,
         classificacao_origem    = 'NOME',
         classificacao_confianca = 'alta'
    from alvo a
   where i.id = a.id;

  get diagnostics v_corrigidos = row_count;
  raise notice 'lexico de embalagem/descartavel: % itens reclassificados', v_corrigidos;
end;
$migration$;

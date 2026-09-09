-- Material de limpeza aparecendo como ingrediente de receita e um defeito de
-- seguranca alimentar, nao de layout. A causa raiz: fn_classificar_insumo
-- recebia p_nome e nunca usava. Quem cadastrava "Limpador multiuso" com a
-- categoria "Ingrediente" recebia tipo_item = INGREDIENTE, legitimamente pela
-- regra antiga -- e ai o item entrava na lista de ficha tecnica.
--
-- A correcao e por regra geral e orientada a dado: um lexico versionado de
-- termos que denunciam nao-alimento. Nada de lista de nomes dentro de um CASE
-- no codigo: o lojista e o suporte precisam poder estender isso sem deploy.

-- Bug latente encontrado no caminho: classificacao_categorias aponta para os
-- tipos OPERACIONAL e OUTROS, que nunca existiram em tipos_item. Como a view
-- `itens` faz INNER JOIN com tipos_item, qualquer insumo nesses tipos
-- desaparecia de itens/vw_itens_* -- some do almoxarifado e da ficha sem erro
-- nenhum. Os dois tipos passam a existir, fora da ficha tecnica.
insert into public.tipos_item (codigo, rotulo, natureza, entra_ficha_tecnica, conta_estoque, conta_consumo, controla_validade, icone)
values
  ('OPERACIONAL', 'Uso operacional', 'ALMOXARIFADO', false, '1.1.04', '4.2.04', false, 'wrench'),
  ('OUTROS',      'Outros',          'ALMOXARIFADO', false, '1.1.04', '4.2.06', false, 'package')
on conflict (codigo) do nothing;

-- A origem NOME entra no dominio de classificacao_origem: e uma procedencia
-- nova e auditavel, no mesmo nivel de NCM/CATALOGO/IA/USUARIO.
alter table public.insumos drop constraint if exists insumos_classificacao_origem_check;
alter table public.insumos add constraint insumos_classificacao_origem_check
  check (classificacao_origem is null or classificacao_origem = any (array[
    'XML', 'NCM', 'NOME', 'REGRA', 'CATALOGO', 'IA', 'USUARIO'
  ]));

create table if not exists public.classificacao_lexico (
  termo       text primary key,
  categoria   text not null references public.classificacao_categorias(categoria),
  -- Quanto maior, mais especifico: "papel toalha" (2) ganha de "papel" (1).
  prioridade  smallint not null default 1,
  criado_em   timestamptz not null default now()
);

alter table public.classificacao_lexico enable row level security;

drop policy if exists lexico_leitura on public.classificacao_lexico;
create policy lexico_leitura on public.classificacao_lexico
  for select to authenticated using (true);

grant select on public.classificacao_lexico to authenticated, service_role;

insert into public.classificacao_lexico (termo, categoria, prioridade) values
  -- Limpeza
  ('detergente', 'Limpeza', 2), ('desinfetante', 'Limpeza', 2),
  ('agua sanitaria', 'Limpeza', 2), ('alvejante', 'Limpeza', 2),
  ('lava roupa', 'Limpeza', 2), ('lava roupas', 'Limpeza', 2),
  ('lava loucas', 'Limpeza', 2), ('amaciante', 'Limpeza', 2),
  ('limpador', 'Limpeza', 2), ('multiuso', 'Limpeza', 1),
  ('desengordurante', 'Limpeza', 2), ('cloro', 'Limpeza', 2),
  ('soda caustica', 'Limpeza', 2), ('sabao', 'Limpeza', 2),
  ('saponaceo', 'Limpeza', 2), ('esponja', 'Limpeza', 2),
  ('rodo', 'Limpeza', 2), ('vassoura', 'Limpeza', 2),
  ('pano de chao', 'Limpeza', 2), ('saco de lixo', 'Limpeza', 2),
  ('inseticida', 'Limpeza', 2), ('raticida', 'Limpeza', 2),
  -- Higiene
  ('papel higienico', 'Higiene', 2), ('sabonete', 'Higiene', 2),
  ('alcool em gel', 'Higiene', 2), ('alcool 70', 'Higiene', 2),
  ('papel toalha', 'Higiene', 2), ('toalha de papel', 'Higiene', 2),
  -- EPI / uniforme
  ('luva', 'Utensílios', 1), ('touca', 'Utensílios', 1),
  ('avental', 'Utensílios', 1), ('mascara', 'Utensílios', 1),
  ('bota de seguranca', 'Utensílios', 2),
  -- Manutencao / escritorio
  ('lampada', 'Manutenção', 2), ('fita crepe', 'Manutenção', 1),
  ('parafuso', 'Manutenção', 2), ('cartucho de tinta', 'Manutenção', 2),
  ('papel sulfite', 'Manutenção', 2), ('bobina', 'Manutenção', 1),
  ('caneta', 'Manutenção', 1)
on conflict (termo) do nothing;

comment on table public.classificacao_lexico is
  'Termos que denunciam nao-alimento no nome do item. Consultado por fn_classificar_insumo entre o NCM (verdade fiscal) e o catalogo de categorias. Extensivel sem deploy.';




-- unaccent nem sempre esta disponivel na instancia; translate cobre o
-- portugues sem depender de extensao.
create or replace function public.unaccent_simples(p_texto text)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $function$
  select translate(
    coalesce(p_texto, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
  );
$function$;

create or replace function public.fn_normalizar_para_lexico(p_texto text)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $function$
  select lower(public.unaccent_simples(coalesce(p_texto, '')));
$function$;

-- Casa o lexico contra um nome ja normalizado (minusculo, sem acento). Vence o
-- termo mais especifico; empate resolve pelo termo mais longo.
create or replace function public.fn_lexico_do_nome(p_nome text)
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select l.categoria
    from public.classificacao_lexico l
   where public.fn_normalizar_para_lexico(p_nome) ~ ('(^|[^a-z0-9])' || l.termo || '($|[^a-z0-9])')
   order by l.prioridade desc, length(l.termo) desc
   limit 1;
$function$;

-- fn_classificar_insumo com o nome finalmente valendo algo.
-- Ordem de autoridade: NCM (verdade fiscal) > lexico do nome (evidencia forte
-- e verificavel) > catalogo de categoria (o que digitaram) > Outros.
create or replace function public.fn_classificar_insumo(
  p_categoria text,
  p_nome text default null::text,
  p_ncm text default null::text
) returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  r        record;
  v_ncm    text := regexp_replace(coalesce(p_ncm, ''), '\D', '', 'g');
  v_cat    text;
  v_origem text;
  v_conf   text;
begin
  if length(v_ncm) >= 2 then
    v_cat := case substr(v_ncm, 1, 2)
      when '34' then 'Limpeza'
      when '39' then 'Descartáveis'
      when '48' then 'Descartáveis'
      when '22' then 'Bebidas'
      when '02' then 'Carnes'
      when '03' then 'Pescados'
      when '07' then 'Hortifrúti'
      when '08' then 'Hortifrúti'
      when '04' then 'Laticínios'
      when '19' then 'Padaria'
      else null
    end;
    if v_cat is not null then
      v_origem := 'NCM';
      v_conf   := 'alta';
    end if;
  end if;

  if v_cat is null then
    v_cat := public.fn_lexico_do_nome(p_nome);
    if v_cat is not null then
      v_origem := 'NOME';
      v_conf   := 'alta';
    end if;
  end if;

  if v_cat is null and nullif(btrim(coalesce(p_categoria, '')), '') is not null then
    select categoria into v_cat
      from public.classificacao_categorias
     where lower(categoria) = lower(btrim(p_categoria));
    if v_cat is not null then
      v_origem := 'CATALOGO';
      v_conf   := 'media';
    end if;
  end if;

  if v_cat is null then
    v_cat    := 'Outros';
    v_origem := 'REGRA';
    v_conf   := 'baixa';
  end if;

  select * into r from public.classificacao_categorias where categoria = v_cat;

  return jsonb_build_object(
    'categoria',           r.categoria,
    'natureza',            r.natureza,
    'tipo_item',           r.tipo_item,
    'entra_ficha_tecnica', r.entra_ficha_tecnica,
    'entra_nutricao',      r.entra_nutricao,
    'origem',              v_origem,
    'confianca',           v_conf
  );
end;
$function$;

-- Corrige o passivo: itens cujo NOME denuncia nao-alimento mas que estao
-- classificados como comida. Preserva integralmente o que o lojista decidiu
-- (origem USUARIO ou classificacao_revisada) -- essa decisao nunca e
-- sobrescrita por regra automatica.
do $migration$
declare
  v_corrigidos int;
begin
  with alvo as (
    select i.id, c.categoria, c.tipo_item
      from public.insumos i
      join public.classificacao_categorias c
        on c.categoria = public.fn_lexico_do_nome(i.nome)
     where c.entra_ficha_tecnica is false
       and coalesce(i.is_preparo, false) = false
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
  raise notice 'classificador por nome: % itens reclassificados', v_corrigidos;
end;
$migration$;

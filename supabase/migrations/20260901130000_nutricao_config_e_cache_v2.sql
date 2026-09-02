-- ============================================================================
-- NUTRIÇÃO — CONFIG DO PRATO E CACHE v2 (Onda V, Fatia 2)
-- ============================================================================
-- docs/PLANO-NUTRICIONAL-VITRINE.md §2.3, §2.4, §2.5, §2.6 e §3.1.
--
-- O motor v2 já conta a verdade sobre a receita. Falta o prato saber COMO é
-- servido — quantas porções rende, quanto pesa a porção, o que a cocção fez com
-- a massa — e falta caminho para o produto que não tem receita nenhuma: a lata
-- de refrigerante, o bombom, a água. Eles não têm ficha técnica porque não têm
-- preparo, mas têm rótulo, que é a melhor fonte de todas.
--
-- Decisão sobre fator de cocção (R-03 do plano-mãe): o fator ajusta a MASSA
-- SERVIDA, não os nutrientes. Perder água na chapa não destrói proteína — muda
-- o peso do que chega ao prato e, portanto, o valor por 100 g. Óleo absorvido
-- na fritura entra pela ficha técnica, onde já precisa entrar para o custo
-- fechar. Inventar gordura no cálculo seria criar número sem origem.
-- ============================================================================

-- ── 1. Configuração de exibição por loja (§3.1: tudo configurável) ──────────

alter table public.lojas
  add column if not exists nutricao_ativo boolean not null default true,
  -- COMPLETA: número + alérgenos quando o prato fecha; só alérgenos quando não.
  -- SO_ALERGENOS: nunca publica número, só o aviso de alérgeno.
  -- PARCIAL_COM_AVISO: publica também prato incompleto, marcado como parcial.
  add column if not exists nutricao_exibicao text not null default 'COMPLETA'
    check (nutricao_exibicao in ('COMPLETA', 'SO_ALERGENOS', 'PARCIAL_COM_AVISO')),
  add column if not exists nutricao_selos_atributo boolean not null default true,
  add column if not exists nutricao_disclaimer text;

comment on column public.lojas.nutricao_exibicao is
  'Como a vitrine publica nutrição. COMPLETA e o padrao profissional: numero so em prato fechado, alergeno sempre que houver.';

-- ── 2. Configuração por prato ───────────────────────────────────────────────

create table if not exists public.produtos_nutricao_config (
  produto_id  uuid primary key references public.produtos(id) on delete cascade,
  loja_id     uuid not null references public.lojas(id) on delete cascade,

  exibir      boolean not null default true,

  -- Como é servido.
  porcoes       numeric not null default 1 check (porcoes > 0),
  peso_porcao_g numeric check (peso_porcao_g is null or peso_porcao_g > 0),

  -- O que a cocção faz com a massa. 1,00 = servido como somado (cru/montado).
  fator_coccao  numeric not null default 1 check (fator_coccao between 0.3 and 2),
  metodo_coccao text check (metodo_coccao in ('MONTADO','GRELHADO','FRITO','COZIDO','ASSADO','OUTRO')),

  -- Revenda (§2.5): o produto É este insumo. Refrigerante em lata, bombom,
  -- água — sem receita, com rótulo. Só vale quando não há ficha técnica.
  insumo_id         uuid references public.insumos(id) on delete set null,
  quantidade_insumo numeric check (quantidade_insumo is null or quantidade_insumo > 0),

  observacao    text,
  atualizado_em timestamptz not null default now()
);

comment on table public.produtos_nutricao_config is
  'Como o prato e servido e publicado. Ver docs/PLANO-NUTRICIONAL-VITRINE.md Fatia 2.';
comment on column public.produtos_nutricao_config.fator_coccao is
  'Multiplicador da MASSA servida, nunca dos nutrientes. Grelhado ~0,75 / assado ~0,80 / frito ~0,85 / cozido ~1,05.';
comment on column public.produtos_nutricao_config.insumo_id is
  'Produto de revenda: aponta para o insumo que ele e. Usado apenas quando o produto nao tem ficha tecnica.';

create index if not exists idx_produtos_nutricao_config_loja on public.produtos_nutricao_config (loja_id);
create index if not exists idx_produtos_nutricao_config_insumo on public.produtos_nutricao_config (insumo_id);

alter table public.produtos_nutricao_config enable row level security;

drop policy if exists produtos_nutricao_config_acesso on public.produtos_nutricao_config;
create policy produtos_nutricao_config_acesso
  on public.produtos_nutricao_config for all
  using (public.fn_tem_papel(loja_id, array['admin','operador']))
  with check (public.fn_tem_papel(loja_id, array['admin','operador']));

-- ── 3. Cache v2 ─────────────────────────────────────────────────────────────

alter table public.produtos_nutricao_cache
  add column if not exists por_porcao            jsonb   not null default '{}'::jsonb,
  add column if not exists por_100g              jsonb   not null default '{}'::jsonb,
  add column if not exists massa_servida_g       numeric not null default 0,
  add column if not exists peso_porcao_g         numeric,
  add column if not exists porcoes               numeric not null default 1,
  add column if not exists alergenos_contem      text[]  not null default '{}',
  add column if not exists alergenos_pode_conter text[]  not null default '{}',
  add column if not exists itens_total           integer not null default 0,
  add column if not exists itens_com_dado        integer not null default 0,
  add column if not exists composicao_fontes     jsonb   not null default '{}'::jsonb,
  add column if not exists alertas               jsonb   not null default '[]'::jsonb,
  add column if not exists atributos             text[]  not null default '{}',
  add column if not exists faltantes_detalhe     jsonb   not null default '[]'::jsonb,
  add column if not exists publicavel            boolean not null default false;

comment on column public.produtos_nutricao_cache.publicavel is
  'Verdadeiro so quando o prato fecha: status COMPLETO, sem alerta de sanidade e exibicao ligada. E a unica coluna que a vitrine consulta para decidir se mostra numero.';
comment on column public.produtos_nutricao_cache.atributos is
  'Selos calculados pelos criterios da RDC 54/2012 sobre a coluna por_100g. Objetivos e conferiveis, nunca inferidos por IA.';

-- ── 4. Selos de atributo (RDC 54/2012) ──────────────────────────────────────
--
-- "A marmita é fit mesmo?" vira pergunta respondível: o critério é numérico,
-- público e o mesmo para todo mundo. Aplicado sobre 100 g/100 ml do produto
-- como servido, e só quando o prato está completo — atributo em cima de dado
-- pela metade seria propaganda.

create or replace function public.fn_atributos_nutricionais(p_por_100g jsonb, p_base text default 'g')
returns text[]
language sql immutable
set search_path = public
as $$
  select array_remove(array[
    case when (p_por_100g->>'PROTEINAS')::numeric >= case when p_base = 'ml' then 6 else 12 end
         then 'ALTO_PROTEINA' end,
    case when (p_por_100g->>'PROTEINAS')::numeric >= case when p_base = 'ml' then 3 else 6 end
          and (p_por_100g->>'PROTEINAS')::numeric <  case when p_base = 'ml' then 6 else 12 end
         then 'FONTE_PROTEINA' end,
    case when (p_por_100g->>'FIBRAS_ALIMENTARES')::numeric >= 6 then 'ALTO_FIBRAS'
         when (p_por_100g->>'FIBRAS_ALIMENTARES')::numeric >= 3 then 'FONTE_FIBRAS' end,
    case when (p_por_100g->>'SODIO')::numeric <= 120 then 'BAIXO_SODIO' end,
    case when (p_por_100g->>'GORDURAS_SATURADAS')::numeric <= 1.5 then 'BAIXO_GORDURA_SATURADA' end,
    case when (p_por_100g->>'ENERGIA_KCAL')::numeric <= case when p_base = 'ml' then 20 else 40 end
         then 'BAIXO_CALORIAS' end,
    case when p_por_100g ? 'ACUCARES_ADICIONADOS'
          and (p_por_100g->>'ACUCARES_ADICIONADOS')::numeric = 0 then 'SEM_ACUCAR_ADICIONADO' end
  ], null);
$$;

comment on function public.fn_atributos_nutricionais(jsonb, text) is
  'Selos de atributo pelos limites da RDC 54/2012, calculados sobre 100 g (solidos) ou 100 ml (liquidos).';

revoke execute on function public.fn_atributos_nutricionais(jsonb, text) from public;
grant  execute on function public.fn_atributos_nutricionais(jsonb, text) to anon, authenticated;

-- ── 5. Recálculo do produto, agora ciente de como ele é servido ─────────────

create or replace function public.fn_recalcular_nutricao_produto(p_produto_id uuid)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_prod    record;
  v_cfg     record;
  v_linhas  jsonb;
  v_base    jsonb;
  v_massa   numeric;
  v_servida numeric;
  v_porcoes numeric;
  v_peso    numeric;
  v_100g    jsonb;
  v_porcao  jsonb;
  v_alertas jsonb;
  v_publicavel boolean;
begin
  select p.id, p.loja_id, p.nome, p.tipo_venda into v_prod
  from public.produtos p where p.id = p_produto_id;
  if not found then
    raise exception 'Produto % nao encontrado.', p_produto_id;
  end if;

  select * into v_cfg from public.produtos_nutricao_config where produto_id = p_produto_id;

  -- Linhas: a ficha técnica manda. Não havendo ficha, o vínculo de revenda.
  select coalesce(jsonb_agg(jsonb_build_object('insumo_id', ft.insumo_id, 'quantidade', ft.quantidade_consumida)), '[]'::jsonb)
    into v_linhas
  from public.fichas_tecnicas ft
  where ft.produto_id = p_produto_id;

  if v_linhas = '[]'::jsonb and v_cfg.insumo_id is not null then
    v_linhas := jsonb_build_array(jsonb_build_object(
      'insumo_id', v_cfg.insumo_id,
      'quantidade', coalesce(v_cfg.quantidade_insumo, 1)
    ));
  end if;

  v_base := public.fn_calcular_nutricao_receita(v_linhas, v_prod.loja_id, false);

  v_massa   := coalesce((v_base->>'massa_g')::numeric, 0);
  v_servida := round(v_massa * coalesce(v_cfg.fator_coccao, 1), 2);
  v_porcoes := coalesce(v_cfg.porcoes, 1);
  v_peso    := coalesce(v_cfg.peso_porcao_g, case when v_servida > 0 then round(v_servida / v_porcoes, 2) end);
  v_alertas := coalesce(v_base->'alertas', '[]'::jsonb);

  if v_servida > 0 then
    select coalesce(jsonb_object_agg(k, round(v::numeric * 100 / v_servida, 4)), '{}'::jsonb)
      into v_100g
    from jsonb_each_text(coalesce(v_base->'nutrientes', '{}'::jsonb)) as e(k, v);

    select coalesce(jsonb_object_agg(k, round(v::numeric * coalesce(v_peso, v_servida) / v_servida, 4)), '{}'::jsonb)
      into v_porcao
    from jsonb_each_text(coalesce(v_base->'nutrientes', '{}'::jsonb)) as e(k, v);
  else
    v_100g   := '{}'::jsonb;
    v_porcao := '{}'::jsonb;
  end if;

  -- Plausibilidade da porção (§2.7). Produto vendido por peso não entra: lá o
  -- cliente é quem define quanto leva.
  if v_prod.tipo_venda is distinct from 'POR_PESO' and v_peso is not null
     and (v_peso < 15 or v_peso > 900) then
    v_alertas := v_alertas || jsonb_build_array(jsonb_build_object(
      'codigo', 'MASSA_IMPLAUSIVEL',
      'detalhe', format('A porcao calculada e de %s g. Confira as quantidades da ficha e o peso medio dos itens lancados em unidade.', round(v_peso))
    ));
  end if;

  v_publicavel := (
    (v_base->>'status') = 'COMPLETO'
    and jsonb_array_length(v_alertas) = 0
    and coalesce(v_cfg.exibir, true)
    and v_100g <> '{}'::jsonb
  );

  return v_base || jsonb_build_object(
    'massa_servida_g', v_servida,
    'porcoes',         v_porcoes,
    'peso_porcao_g',   v_peso,
    'por_100g',        v_100g,
    'por_porcao',      v_porcao,
    'fator_coccao',    coalesce(v_cfg.fator_coccao, 1),
    'metodo_coccao',   v_cfg.metodo_coccao,
    'exibir',          coalesce(v_cfg.exibir, true),
    'alertas',         v_alertas,
    'atributos',       case when v_publicavel
                         then to_jsonb(public.fn_atributos_nutricionais(v_100g, 'g'))
                         else '[]'::jsonb end,
    'publicavel',      v_publicavel
  );
end;
$$;

comment on function public.fn_recalcular_nutricao_produto(uuid) is
  'Nutricao do produto como ele e SERVIDO: ficha tecnica ou vinculo de revenda, ajustada por porcoes, peso da porcao e fator de coccao. Ver PLANO-NUTRICIONAL-VITRINE Fatia 2.';

revoke execute on function public.fn_recalcular_nutricao_produto(uuid) from public;
grant  execute on function public.fn_recalcular_nutricao_produto(uuid) to authenticated;

-- ── 6. Cache: grava tudo que a vitrine e o admin precisam ───────────────────

create or replace function public.fn_atualizar_cache_nutricao(p_produto_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_loja uuid;
  n jsonb;
begin
  select loja_id into v_loja from public.produtos where id = p_produto_id;
  if not found then return; end if;

  n := public.fn_recalcular_nutricao_produto(p_produto_id);

  insert into public.produtos_nutricao_cache (
    produto_id, loja_id, status, cobertura_pct, massa_g, insumos_faltantes, nutrientes,
    por_porcao, por_100g, massa_servida_g, peso_porcao_g, porcoes,
    alergenos_contem, alergenos_pode_conter, itens_total, itens_com_dado,
    composicao_fontes, alertas, atributos, faltantes_detalhe, publicavel, atualizado_em
  )
  values (
    p_produto_id, v_loja,
    coalesce(n->>'status', 'SEM_DADOS'),
    coalesce((n->>'cobertura_pct')::numeric, 0),
    coalesce((n->>'massa_g')::numeric, 0),
    coalesce(jsonb_array_length(n->'insumos_faltantes'), 0),
    coalesce(n->'nutrientes', '{}'::jsonb),
    coalesce(n->'por_porcao', '{}'::jsonb),
    coalesce(n->'por_100g', '{}'::jsonb),
    coalesce((n->>'massa_servida_g')::numeric, 0),
    (n->>'peso_porcao_g')::numeric,
    coalesce((n->>'porcoes')::numeric, 1),
    coalesce(array(select jsonb_array_elements_text(n->'alergenos_contem')), '{}'),
    coalesce(array(select jsonb_array_elements_text(n->'alergenos_pode_conter')), '{}'),
    coalesce((n->>'itens_total')::integer, 0),
    coalesce((n->>'itens_com_dado')::integer, 0),
    coalesce(n->'composicao_fontes', '{}'::jsonb),
    coalesce(n->'alertas', '[]'::jsonb),
    coalesce(array(select jsonb_array_elements_text(n->'atributos')), '{}'),
    coalesce(n->'insumos_faltantes', '[]'::jsonb),
    coalesce((n->>'publicavel')::boolean, false),
    now()
  )
  on conflict (produto_id) do update set
    loja_id = excluded.loja_id, status = excluded.status,
    cobertura_pct = excluded.cobertura_pct, massa_g = excluded.massa_g,
    insumos_faltantes = excluded.insumos_faltantes, nutrientes = excluded.nutrientes,
    por_porcao = excluded.por_porcao, por_100g = excluded.por_100g,
    massa_servida_g = excluded.massa_servida_g, peso_porcao_g = excluded.peso_porcao_g,
    porcoes = excluded.porcoes,
    alergenos_contem = excluded.alergenos_contem,
    alergenos_pode_conter = excluded.alergenos_pode_conter,
    itens_total = excluded.itens_total, itens_com_dado = excluded.itens_com_dado,
    composicao_fontes = excluded.composicao_fontes, alertas = excluded.alertas,
    atributos = excluded.atributos, faltantes_detalhe = excluded.faltantes_detalhe,
    publicavel = excluded.publicavel, atualizado_em = now();
end;
$$;

-- ── 7. Invalidação completa (§2.6) ──────────────────────────────────────────
--
-- Eram duas origens; são cinco. A que mais faltava: mexer na receita de um
-- PREPARO não recalculava nenhum prato que o usa — o número publicado passava
-- a descrever uma receita que não existe mais.

-- Todo produto que depende de um insumo, direta ou indiretamente (o insumo
-- pode estar dentro de um preparo, dentro de outro preparo).
create or replace function public.fn_produtos_que_usam_insumo(p_insumo_id uuid)
returns setof uuid
language sql
stable
set search_path = public
as $$
  with recursive sobe as (
    select p_insumo_id as insumo_id, 1 as nivel
    union all
    select fp.preparo_id, s.nivel + 1
    from sobe s
    join public.fichas_preparos fp on fp.insumo_id = s.insumo_id
    where s.nivel < 6
  )
  select distinct ft.produto_id
  from public.fichas_tecnicas ft
  join sobe s on s.insumo_id = ft.insumo_id
  union
  select c.produto_id
  from public.produtos_nutricao_config c
  where c.insumo_id = p_insumo_id;
$$;

comment on function public.fn_produtos_que_usam_insumo(uuid) is
  'Sobe a arvore de preparos ate os produtos. E o alcance de uma mudanca em um insumo — inclusive quando ele so aparece dentro de um preparo.';

create or replace function public.fn_trg_cache_nutricao_insumo()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_produto uuid;
begin
  for v_produto in select public.fn_produtos_que_usam_insumo(coalesce(new.insumo_id, old.insumo_id))
  loop
    perform public.fn_atualizar_cache_nutricao(v_produto);
  end loop;
  return null;
end;
$$;

-- Mudou a receita de um preparo: recalcula todo produto que o consome.
create or replace function public.fn_trg_cache_nutricao_preparo()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_produto uuid;
begin
  for v_produto in select public.fn_produtos_que_usam_insumo(coalesce(new.preparo_id, old.preparo_id))
  loop
    perform public.fn_atualizar_cache_nutricao(v_produto);
  end loop;
  return null;
end;
$$;

drop trigger if exists trg_cache_nutricao_preparo on public.fichas_preparos;
create trigger trg_cache_nutricao_preparo
  after insert or update or delete on public.fichas_preparos
  for each row execute function public.fn_trg_cache_nutricao_preparo();

-- Mudou a unidade de medida do insumo: a base de conversão do prato mudou.
create or replace function public.fn_trg_cache_nutricao_insumo_unidade()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_produto uuid;
begin
  for v_produto in select public.fn_produtos_que_usam_insumo(new.id)
  loop
    perform public.fn_atualizar_cache_nutricao(v_produto);
  end loop;
  return null;
end;
$$;

drop trigger if exists trg_cache_nutricao_insumo_unidade on public.insumos;
create trigger trg_cache_nutricao_insumo_unidade
  after update of unidade_medida, is_preparo, rendimento_padrao_kg, rendimento_porcoes
  on public.insumos
  for each row
  when (old.unidade_medida is distinct from new.unidade_medida
     or old.is_preparo is distinct from new.is_preparo
     or old.rendimento_padrao_kg is distinct from new.rendimento_padrao_kg
     or old.rendimento_porcoes is distinct from new.rendimento_porcoes)
  execute function public.fn_trg_cache_nutricao_insumo_unidade();

-- Produto novo nasce com linha no cache — sem isso ele nasce invisível, sem
-- sinal nenhum para o lojista de que falta ficha.
create or replace function public.fn_trg_cache_nutricao_produto()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  perform public.fn_atualizar_cache_nutricao(new.id);
  return null;
end;
$$;

drop trigger if exists trg_cache_nutricao_produto on public.produtos;
create trigger trg_cache_nutricao_produto
  after insert on public.produtos
  for each row execute function public.fn_trg_cache_nutricao_produto();

-- Mudou a configuração de exibição/porção/cocção do prato.
create or replace function public.fn_trg_cache_nutricao_produto_config()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  perform public.fn_atualizar_cache_nutricao(coalesce(new.produto_id, old.produto_id));
  return null;
end;
$$;

drop trigger if exists trg_cache_nutricao_config on public.produtos_nutricao_config;
create trigger trg_cache_nutricao_config
  after insert or update or delete on public.produtos_nutricao_config
  for each row execute function public.fn_trg_cache_nutricao_produto_config();

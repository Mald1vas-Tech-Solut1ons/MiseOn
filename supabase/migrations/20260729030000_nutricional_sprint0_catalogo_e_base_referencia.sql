-- ============================================================================
-- NUTRICIONAL — SPRINT 0: CATÁLOGO E BASE DE REFERÊNCIA
-- ============================================================================
-- NUT-01 + NUT-02 do docs/PLANO-NUTRICIONAL.md.
--
-- O que entra aqui é a FUNDAÇÃO DE DADOS: o catálogo oficial de nutrientes na
-- ordem em que a ANVISA manda declarar, e a tabela onde vive a base científica
-- de composição de alimentos. Nada de cálculo, nada de IA, nada de tela.
--
-- ─── POR QUE OS NÚMEROS SÃO ESTES ──────────────────────────────────────────
-- Ordem, indentação, unidades e VDR vêm do texto oficial da IN nº 75/2020
-- (Anexos II, XI e XXII), lido na fonte primária — não de resumo de blog.
-- Isso importa porque fontes secundárias divergem: várias ainda publicam os
-- VDR da RDC 360/2003 (gorduras totais 55 g, saturadas 22 g) como se fossem os
-- atuais. Os corretos, pelo Anexo II da IN 75/2020, são 65 g e 20 g.
--
-- ─── POR QUE A PROVENIÊNCIA É COLUNA, E NÃO COMENTÁRIO ─────────────────────
-- A orientação da ANVISA é que a informação nutricional pode ser obtida por
-- cálculo a partir de tabela de composição — e que a FONTE usada, embora não
-- precise constar do rótulo, PODE SER EXIGIDA pela vigilância sanitária.
-- Por isso fonte, versão, licença e URL são colunas obrigatórias e não
-- metadados opcionais: elas são o que torna o dado defensável numa fiscalização
-- e o que sustenta o nível 2 do selo.
-- ============================================================================

create extension if not exists pg_trgm  with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ── 0. Normalização de texto para busca ─────────────────────────────────────
-- unaccent(text) de um argumento é STABLE, então não serve para índice nem para
-- coluna gerada. A forma de dois argumentos é IMMUTABLE. Este wrapper existe só
-- para tornar isso explícito e reutilizável.
create or replace function public.fn_normalizar_texto(t text) returns text
language sql immutable strict parallel safe
set search_path = public, extensions
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, t));
$$;

comment on function public.fn_normalizar_texto(text) is
  'Minúsculas sem acento, IMMUTABLE — pode ser usada em índice e coluna gerada. "Açúcar" e "acucar" precisam casar na busca.';

-- ── 1. Catálogo de nutrientes (NUT-01) ──────────────────────────────────────

create table if not exists public.nutrientes (
  codigo              text primary key,
  rotulo              text not null,        -- como aparece no rótulo, em pt-BR
  abreviacao          text,
  unidade             text not null check (unidade in ('kcal', 'g', 'mg', 'µg')),
  -- ordem e indentação do Anexo XI: a tabela nutricional tem hierarquia visual
  -- (açúcares totais é filho de carboidratos), e renderizar fora de ordem
  -- descaracteriza o rótulo que o consumidor brasileiro reconhece.
  ordem               int not null,
  indentacao          int not null default 0 check (indentacao between 0 and 3),
  obrigatorio_anvisa  boolean not null default false,
  vdr                 numeric,              -- Anexo II; null = sem VD estabelecido
  -- Anexo XXII. Serve à checagem de sanidade do OCR de rótulo (NUT-11):
  -- Σ(macro × fator) deve bater com a kcal declarada dentro de ±20%.
  fator_energetico    numeric,
  -- Ponte declarativa para o USDA FoodData Central. Deixar o de-para no dado e
  -- não no script é o que permite trocar/estender fonte sem reescrever código.
  usda_nutrient_number text,
  ativo               boolean not null default true
);

comment on table public.nutrientes is
  'Catálogo de plataforma. Ordem, indentação, unidade e VDR conforme Anexos II, XI e XXII da IN 75/2020 da ANVISA.';

insert into public.nutrientes
  (codigo, rotulo, abreviacao, unidade, ordem, indentacao, obrigatorio_anvisa, vdr, fator_energetico, usda_nutrient_number) values
  ('ENERGIA_KCAL',          'Valor energético',      'kcal',      'kcal',  10,  0, true,  2000, null, '208'),
  ('CARBOIDRATOS',          'Carboidratos totais',   'Carb.',     'g',     20,  0, true,   300,    4, '205'),
  ('ACUCARES_TOTAIS',       'Açúcares totais',       null,        'g',     30,  1, true,  null,    4, '269'),
  ('ACUCARES_ADICIONADOS',  'Açúcares adicionados',  null,        'g',     40,  2, true,    50,    4, '539'),
  ('PROTEINAS',             'Proteínas',             'Prot.',     'g',     50,  0, true,    50,    4, '203'),
  ('GORDURAS_TOTAIS',       'Gorduras totais',       'Gord.',     'g',     60,  0, true,    65,    9, '204'),
  ('GORDURAS_SATURADAS',    'Gorduras saturadas',    'Gord. sat.','g',     70,  1, true,    20,    9, '606'),
  ('GORDURAS_TRANS',        'Gorduras trans',        null,        'g',     80,  1, true,     2,    9, '605'),
  ('COLESTEROL',            'Colesterol',            null,        'mg',    90,  1, false,  300, null, '601'),
  ('FIBRAS_ALIMENTARES',    'Fibras alimentares',    'Fibras',    'g',    100,  0, true,    25,    2, '291'),
  ('SODIO',                 'Sódio',                 null,        'mg',   110,  0, true,  2000, null, '307'),
  -- Não obrigatório, mas o segmento BAR_PUB existe e o fator entra na checagem
  -- de sanidade energética de qualquer preparação alcoólica.
  ('ALCOOL',                'Álcool (etanol)',       null,        'g',    120,  0, false, null,    7, '221')
on conflict (codigo) do nothing;

alter table public.nutrientes enable row level security;

drop policy if exists nutrientes_leitura_publica on public.nutrientes;
create policy nutrientes_leitura_publica
  on public.nutrientes for select
  to anon, authenticated
  using (true);

-- ── 2. Base de referência científica (NUT-02) ───────────────────────────────

create table if not exists public.alimentos_referencia (
  id             uuid primary key default gen_random_uuid(),

  -- PROVENIÊNCIA — obrigatória por construção (ver cabeçalho)
  fonte          text not null check (fonte in ('USDA_FDC', 'TBCA', 'IBGE_POF', 'ROTULO_FABRICANTE')),
  fonte_versao   text not null,
  fonte_url      text,
  licenca        text not null,          -- 'CC0-1.0' para USDA; TBCA exige licença paga
  codigo_fonte   text not null,          -- fdcId no USDA; código próprio nas demais

  nome           text not null,          -- descrição na língua original da fonte
  nome_pt        text,                   -- termo de busca em português
  -- Coluna gerada: "Açúcar mascavo" e "acucar mascavo" precisam casar. O índice
  -- trigram vive aqui, e é ele que faz o match determinístico do §5.1 ③.
  nome_normalizado text generated always as (public.fn_normalizar_texto(coalesce(nome_pt, nome))) stored,
  grupo          text,

  -- Base de expressão dos nutrientes. Sempre 100 g ou 100 ml — nunca "por
  -- porção", porque porção é decisão do prato e não do alimento.
  base_qtd       numeric not null default 100 check (base_qtd > 0),
  base_unidade   text not null default 'g' check (base_unidade in ('g', 'ml')),
  -- Ponte massa↔volume. Sem densidade, converter 200 ml de óleo em gramas seria
  -- chute — e chute silencioso é exatamente o que unidades.ts existe para impedir.
  densidade_g_ml numeric check (densidade_g_ml is null or densidade_g_ml > 0),

  -- { "ENERGIA_KCAL": 165, "PROTEINAS": 31.0, ... } — chaves de public.nutrientes
  nutrientes     jsonb not null default '{}'::jsonb,

  -- Alérgeno tem TRÊS estados e nenhum deles é "não contém" (ADR-03).
  -- A ausência de um alérgeno nestas colunas significa NÃO AVALIADO, jamais
  -- ausência do alérgeno no alimento.
  alergenos_contem      text[] not null default '{}',
  alergenos_pode_conter text[] not null default '{}',

  importado_em   timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),

  unique (fonte, codigo_fonte)
);

comment on table public.alimentos_referencia is
  'Base científica de composição de alimentos. Catálogo de plataforma, sem loja_id. Toda linha carrega fonte, versão e licença: a vigilância sanitária pode exigir a origem do dado usado no cálculo.';

comment on column public.alimentos_referencia.alergenos_contem is
  'Ausência aqui significa NÃO AVALIADO, nunca "não contém". Ver ADR-03 do PLANO-NUTRICIONAL.';

create index if not exists idx_alimentos_ref_trigram
  on public.alimentos_referencia using gin (nome_normalizado extensions.gin_trgm_ops);

create index if not exists idx_alimentos_ref_fonte  on public.alimentos_referencia (fonte, grupo);
create index if not exists idx_alimentos_ref_gtin   on public.alimentos_referencia (codigo_fonte) where fonte = 'ROTULO_FABRICANTE';

alter table public.alimentos_referencia enable row level security;

-- Catálogo compartilhado: a UI precisa buscar candidatos para o lojista
-- escolher. Escrita só por service_role (o importador), que ignora RLS.
drop policy if exists alimentos_referencia_leitura_publica on public.alimentos_referencia;
create policy alimentos_referencia_leitura_publica
  on public.alimentos_referencia for select
  to anon, authenticated
  using (true);

-- ── 3. Busca por similaridade ───────────────────────────────────────────────
-- É a camada ③ do §5.1: antes de gastar um token de LLM, tenta resolver por
-- trigram. A maior parte dos in natura ("peito de frango", "tomate", "arroz")
-- resolve aqui, de graça e com fonte rastreável.

create or replace function public.fn_buscar_alimento_referencia(
  p_termo   text,
  p_limite  int  default 10,
  p_minimo  real default 0.20
)
returns table (
  id            uuid,
  nome          text,
  nome_pt       text,
  grupo         text,
  fonte         text,
  fonte_versao  text,
  base_qtd      numeric,
  base_unidade  text,
  nutrientes    jsonb,
  similaridade  real
)
language sql stable parallel safe
set search_path = public, extensions
as $$
  select a.id, a.nome, a.nome_pt, a.grupo, a.fonte, a.fonte_versao,
         a.base_qtd, a.base_unidade, a.nutrientes,
         extensions.similarity(a.nome_normalizado, public.fn_normalizar_texto(p_termo)) as similaridade
  from public.alimentos_referencia a
  where extensions.similarity(a.nome_normalizado, public.fn_normalizar_texto(p_termo)) >= p_minimo
  order by similaridade desc, a.nome
  limit greatest(p_limite, 1);
$$;

comment on function public.fn_buscar_alimento_referencia(text, int, real) is
  'Camada determinística do match insumo→alimento. Roda antes da IA: o que o trigram resolve não custa token nem precisa de revisão de estimativa.';

revoke execute on function public.fn_buscar_alimento_referencia(text, int, real) from public;
grant  execute on function public.fn_buscar_alimento_referencia(text, int, real) to authenticated;

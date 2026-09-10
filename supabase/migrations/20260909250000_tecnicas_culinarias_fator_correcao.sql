-- Dominio da tecnica culinaria: fator de correcao (peso bruto x peso liquido).
--
-- O calculo mais basico e mais ignorado do food service. "5 tomates sem pele e
-- sem semente, em cubos" nao consome 5 tomates de tomate limpo: consome 5
-- tomates BRUTOS e entrega ~78% disso em produto util. Sem isso:
--   - o CMV mente (a loja pagou pela casca e o sistema nao contou);
--   - a caloria mente (a casca e a semente nao vao para o prato);
--   - a compra mente (falta materia-prima no meio do servico).
--
-- Modelado como DADO, nao como codigo, no mesmo padrao de classificacao_lexico:
-- suporte e lojista estendem sem deploy. E o rendimento MEDIDO pela loja sempre
-- vence a referencia de mercado -- o sistema domina a tecnica, mas quem tem a
-- balanca e a faca e a cozinha.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) O catalogo de tecnicas
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.tecnicas_culinarias (
  codigo     text primary key,
  rotulo     text not null,
  -- LIMPEZA e onde nasce a perda de peso (casca, semente, osso, aparas).
  -- CORTE define a forma; sozinho quase nao perde massa.
  -- COCCAO tem perda propria (evaporacao), tratada por lote, nao por ficha.
  tipo       text not null check (tipo in ('LIMPEZA', 'CORTE', 'COCCAO', 'PORCIONAMENTO')),
  descricao  text,
  ordem      smallint not null default 100,
  ativo      boolean not null default true
);

alter table public.tecnicas_culinarias enable row level security;
drop policy if exists tecnicas_leitura on public.tecnicas_culinarias;
create policy tecnicas_leitura on public.tecnicas_culinarias
  for select to authenticated using (true);
grant select on public.tecnicas_culinarias to authenticated, service_role;

insert into public.tecnicas_culinarias (codigo, rotulo, tipo, descricao, ordem) values
  -- Limpeza (onde o fator de correcao existe de verdade)
  ('DESCASCAR',          'Descascar',                 'LIMPEZA', 'Remove casca e talo. A perda depende do calibre: item pequeno perde mais.', 10),
  ('HIGIENIZAR',         'Higienizar',                'LIMPEZA', 'Lavagem e sanitizacao em solucao clorada, com descarte de folhas e partes impropias.', 11),
  ('PELE_E_SEMENTE',     'Retirar pele e semente',    'LIMPEZA', 'Base do concassé: escalda, retira a pele, corta e despreza a semente e o liquido.', 12),
  ('LIMPAR_APARAS',      'Limpar aparas e gordura',   'LIMPEZA', 'Retira gordura aparente, nervos e aparas de uma peca bovina ou suina.', 13),
  ('DESOSSAR',           'Desossar',                  'LIMPEZA', 'Separa a carne do osso. O rendimento cai muito em ave inteira.', 14),
  ('FILETAR',            'Filetar',                   'LIMPEZA', 'Transforma o peixe inteiro em filé, descartando cabeca, espinha e pele.', 15),
  ('DEBULHAR',           'Debulhar',                  'LIMPEZA', 'Separa graos ou bagos da vagem, espiga ou cacho.', 16),
  -- Corte (define a forma; a perda relevante ja aconteceu na limpeza)
  ('BRUNOISE',           'Brunoise (cubos pequenos)', 'CORTE',   'Cubos de 2 a 3 mm. Exige item ja limpo e faca afiada.', 30),
  ('MACEDOINE',          'Macédoine (cubos médios)',  'CORTE',   'Cubos de 5 a 10 mm, o corte de salada e de molho rustico.', 31),
  ('JULIENNE',           'Julienne (tiras finas)',    'CORTE',   'Tiras de 1 a 2 mm de espessura por 4 a 5 cm.', 32),
  ('JARDINEIRA',         'Jardineira (bastões)',      'CORTE',   'Bastoes de cerca de 5 mm, mais grossos que a julienne.', 33),
  ('CHIFFONADE',         'Chiffonade (folhas)',       'CORTE',   'Folha enrolada e cortada em tiras finissimas.', 34),
  ('RODELAS',            'Rodelas',                   'CORTE',   'Cortes transversais de espessura uniforme.', 35),
  ('FATIAR',             'Fatiar',                    'CORTE',   'Fatias longitudinais de espessura uniforme.', 36),
  ('RALAR',              'Ralar',                     'CORTE',   'Reduz a peca a fios ou po no ralador.', 37),
  ('PICAR',              'Picar',                     'CORTE',   'Corte irregular e rapido, sem geometria definida.', 38),
  -- Coccao e porcionamento (entram no roteiro; a perda de coccao e por lote)
  ('BRANQUEAR',          'Branquear',                 'COCCAO',  'Choque termico curto em agua fervente seguido de agua com gelo.', 50),
  ('REFOGAR',            'Refogar',                   'COCCAO',  'Suar em gordura quente ate liberar aroma, sem dourar em excesso.', 51),
  ('COZINHAR',           'Cozinhar',                  'COCCAO',  'Coccao em liquido ate o ponto desejado.', 52),
  ('ASSAR',              'Assar',                     'COCCAO',  'Coccao em forno, com calor seco.', 53),
  ('GRELHAR',            'Grelhar',                   'COCCAO',  'Coccao em chapa ou grelha, com marca e crosta.', 54),
  ('REDUZIR',            'Reduzir',                   'COCCAO',  'Evapora liquido para concentrar sabor e corpo.', 55),
  ('RESFRIAR',           'Resfriar',                  'COCCAO',  'Abaixa a temperatura rapido, saindo da zona de risco microbiologico.', 56),
  ('PORCIONAR',          'Porcionar',                 'PORCIONAMENTO', 'Divide o lote em porcoes de peso ou volume padronizado.', 70),
  ('ENVASAR_ETIQUETAR',  'Envasar e etiquetar',       'PORCIONAMENTO', 'Embala, identifica lote, data de fabricacao e validade.', 71)
on conflict (codigo) do nothing;

comment on table public.tecnicas_culinarias is
  'Catalogo de tecnicas de manipulacao. Extensivel sem deploy. O fator de correcao mora em tecnicas_rendimento_* -- aqui fica apenas o vocabulario.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Rendimento de referencia POR INGREDIENTE (casa por termo no nome)
--    Mesma mecanica de classificacao_lexico: o termo mais especifico vence.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.tecnicas_rendimento_ingrediente (
  tecnica_codigo text not null references public.tecnicas_culinarias(codigo) on delete cascade,
  termo          text not null,
  -- Peso liquido / peso bruto. 0,78 = sobram 78% do que saiu do estoque.
  rendimento_pct numeric(5,4) not null check (rendimento_pct > 0 and rendimento_pct <= 1),
  prioridade     smallint not null default 1,
  fonte          text not null default 'REFERENCIA_MERCADO',
  primary key (tecnica_codigo, termo)
);

alter table public.tecnicas_rendimento_ingrediente enable row level security;
drop policy if exists tecnicas_rend_ing_leitura on public.tecnicas_rendimento_ingrediente;
create policy tecnicas_rend_ing_leitura on public.tecnicas_rendimento_ingrediente
  for select to authenticated using (true);
grant select on public.tecnicas_rendimento_ingrediente to authenticated, service_role;

insert into public.tecnicas_rendimento_ingrediente (tecnica_codigo, termo, rendimento_pct, prioridade) values
  ('PELE_E_SEMENTE', 'tomate',            0.7800, 2),
  ('PELE_E_SEMENTE', 'pimentao',          0.8000, 2),
  ('PELE_E_SEMENTE', 'abobora',           0.7000, 2),
  ('PELE_E_SEMENTE', 'pepino',            0.8200, 2),
  ('DESCASCAR',      'batata',            0.8000, 2),
  ('DESCASCAR',      'batata doce',       0.8200, 3),
  ('DESCASCAR',      'cebola',            0.9000, 2),
  ('DESCASCAR',      'alho',              0.7500, 2),
  ('DESCASCAR',      'cenoura',           0.8500, 2),
  ('DESCASCAR',      'mandioca',          0.7500, 2),
  ('DESCASCAR',      'beterraba',         0.8300, 2),
  ('DESCASCAR',      'abacaxi',           0.5000, 2),
  ('DESCASCAR',      'manga',             0.6500, 2),
  ('DESCASCAR',      'laranja',           0.7000, 2),
  ('DESCASCAR',      'banana',            0.6500, 2),
  ('DESCASCAR',      'gengibre',          0.8000, 2),
  ('DESCASCAR',      'inhame',            0.7800, 2),
  ('DESCASCAR',      'chuchu',            0.8500, 2),
  ('DESCASCAR',      'berinjela',         0.9000, 2),
  ('HIGIENIZAR',     'alface',            0.7500, 2),
  ('HIGIENIZAR',     'rucula',            0.7000, 2),
  ('HIGIENIZAR',     'agriao',            0.6500, 2),
  ('HIGIENIZAR',     'espinafre',         0.7000, 2),
  ('HIGIENIZAR',     'couve',             0.8000, 2),
  ('HIGIENIZAR',     'repolho',           0.8500, 2),
  ('HIGIENIZAR',     'brocolis',          0.6500, 2),
  ('HIGIENIZAR',     'couve flor',        0.6500, 2),
  ('HIGIENIZAR',     'cheiro verde',      0.7000, 2),
  ('HIGIENIZAR',     'salsinha',          0.7000, 2),
  ('HIGIENIZAR',     'cebolinha',         0.7500, 2),
  ('HIGIENIZAR',     'manjericao',        0.6500, 2),
  ('DESOSSAR',       'frango',            0.6000, 1),
  ('DESOSSAR',       'frango inteiro',    0.6000, 3),
  ('DESOSSAR',       'coxa',              0.6500, 2),
  ('DESOSSAR',       'sobrecoxa',         0.7000, 2),
  ('DESOSSAR',       'costela',           0.6000, 2),
  ('DESOSSAR',       'pernil',            0.7500, 2),
  ('FILETAR',        'peixe',             0.4500, 1),
  ('FILETAR',        'tilapia',           0.5000, 2),
  ('FILETAR',        'salmao',            0.5500, 2),
  ('FILETAR',        'merluza',           0.5000, 2),
  ('LIMPAR_APARAS',  'alcatra',           0.9000, 2),
  ('LIMPAR_APARAS',  'coxao',             0.8800, 2),
  ('LIMPAR_APARAS',  'picanha',           0.8500, 2),
  ('LIMPAR_APARAS',  'contra file',       0.8500, 2),
  ('LIMPAR_APARAS',  'file mignon',       0.8000, 2),
  ('LIMPAR_APARAS',  'maminha',           0.8800, 2),
  ('LIMPAR_APARAS',  'patinho',           0.9000, 2),
  ('LIMPAR_APARAS',  'peito de frango',   0.9200, 2),
  ('DEBULHAR',       'milho',             0.5000, 2),
  ('DEBULHAR',       'ervilha',           0.4000, 2),
  ('DEBULHAR',       'uva',               0.9000, 2)
on conflict (tecnica_codigo, termo) do nothing;

comment on table public.tecnicas_rendimento_ingrediente is
  'Fator de correcao de referencia por ingrediente, casado pelo nome (mesma mecanica de classificacao_lexico). E ponto de partida, nunca medicao: o rendimento medido pela loja sempre vence.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Rendimento de referencia POR CATEGORIA (rede de seguranca)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.tecnicas_rendimento_categoria (
  tecnica_codigo text not null references public.tecnicas_culinarias(codigo) on delete cascade,
  categoria      text not null references public.classificacao_categorias(categoria),
  rendimento_pct numeric(5,4) not null check (rendimento_pct > 0 and rendimento_pct <= 1),
  fonte          text not null default 'REFERENCIA_MERCADO',
  primary key (tecnica_codigo, categoria)
);

alter table public.tecnicas_rendimento_categoria enable row level security;
drop policy if exists tecnicas_rend_cat_leitura on public.tecnicas_rendimento_categoria;
create policy tecnicas_rend_cat_leitura on public.tecnicas_rendimento_categoria
  for select to authenticated using (true);
grant select on public.tecnicas_rendimento_categoria to authenticated, service_role;

insert into public.tecnicas_rendimento_categoria (tecnica_codigo, categoria, rendimento_pct) values
  ('DESCASCAR',      'Hortifrúti', 0.8200),
  ('HIGIENIZAR',     'Hortifrúti', 0.7500),
  ('PELE_E_SEMENTE', 'Hortifrúti', 0.7800),
  ('LIMPAR_APARAS',  'Carnes',     0.8500),
  ('DESOSSAR',       'Carnes',     0.6000),
  ('FILETAR',        'Pescados',   0.4500),
  ('DEBULHAR',       'Hortifrúti', 0.5000)
on conflict (tecnica_codigo, categoria) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) O que a loja MEDIU. Vence tudo.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.insumos_tecnica_rendimento (
  loja_id        uuid not null references public.lojas(id) on delete cascade,
  insumo_id      uuid not null references public.insumos(id) on delete cascade,
  tecnica_codigo text not null references public.tecnicas_culinarias(codigo) on delete cascade,
  rendimento_pct numeric(5,4) not null check (rendimento_pct > 0 and rendimento_pct <= 1),
  -- Quantas pesagens sustentam esse numero. Uma amostra e um palpite bom;
  -- dez amostras e o padrao da casa.
  amostras       integer not null default 1 check (amostras > 0),
  peso_bruto_kg  numeric(12,4),
  peso_liquido_kg numeric(12,4),
  medido_em      timestamptz not null default now(),
  medido_por     uuid references auth.users(id) on delete set null,
  primary key (insumo_id, tecnica_codigo)
);

create index if not exists idx_insumos_tecnica_rend_loja
  on public.insumos_tecnica_rendimento (loja_id);

alter table public.insumos_tecnica_rendimento enable row level security;

drop policy if exists itr_leitura on public.insumos_tecnica_rendimento;
create policy itr_leitura on public.insumos_tecnica_rendimento
  for select to authenticated using (public.fn_meu_acesso(loja_id));

drop policy if exists itr_escrita on public.insumos_tecnica_rendimento;
create policy itr_escrita on public.insumos_tecnica_rendimento
  for all to authenticated
  using (public.fn_tem_papel(loja_id, array['admin', 'operador']))
  with check (public.fn_tem_papel(loja_id, array['admin', 'operador']));

grant select, insert, update, delete on public.insumos_tecnica_rendimento to authenticated;
grant all on public.insumos_tecnica_rendimento to service_role;

comment on table public.insumos_tecnica_rendimento is
  'Fator de correcao MEDIDO pela loja, por insumo e tecnica. Tem precedencia absoluta sobre qualquer referencia de mercado.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) A resolucao: medido da loja > referencia por ingrediente > por categoria
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_rendimento_tecnica(
  p_insumo_id uuid,
  p_tecnica_codigo text
) returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_insumo public.insumos%rowtype;
  v_pct numeric;
  v_origem text;
  v_amostras integer;
begin
  select * into v_insumo from public.insumos where id = p_insumo_id;
  if v_insumo.id is null or p_tecnica_codigo is null then
    return jsonb_build_object('rendimento_pct', null, 'origem', null);
  end if;

  select r.rendimento_pct, r.amostras into v_pct, v_amostras
    from public.insumos_tecnica_rendimento r
   where r.insumo_id = p_insumo_id and r.tecnica_codigo = p_tecnica_codigo;
  if v_pct is not null then
    return jsonb_build_object(
      'rendimento_pct', v_pct, 'origem', 'MEDIDO_LOJA', 'amostras', v_amostras
    );
  end if;

  select ri.rendimento_pct into v_pct
    from public.tecnicas_rendimento_ingrediente ri
   where ri.tecnica_codigo = p_tecnica_codigo
     and public.fn_normalizar_para_lexico(v_insumo.nome)
         ~ ('(^|[^a-z0-9])' || ri.termo || '($|[^a-z0-9])')
   order by ri.prioridade desc, length(ri.termo) desc
   limit 1;
  if v_pct is not null then
    return jsonb_build_object('rendimento_pct', v_pct, 'origem', 'REFERENCIA_INGREDIENTE');
  end if;

  select rc.rendimento_pct into v_pct
    from public.tecnicas_rendimento_categoria rc
   where rc.tecnica_codigo = p_tecnica_codigo
     and rc.categoria = v_insumo.categoria_insumo
   limit 1;
  if v_pct is not null then
    return jsonb_build_object('rendimento_pct', v_pct, 'origem', 'REFERENCIA_CATEGORIA');
  end if;

  -- Sem referencia: o sistema NAO inventa. Quem mede e a cozinha.
  return jsonb_build_object('rendimento_pct', null, 'origem', null);
end;
$function$;

revoke all on function public.fn_rendimento_tecnica(uuid, text) from public, anon;
grant execute on function public.fn_rendimento_tecnica(uuid, text) to authenticated, service_role;

comment on function public.fn_rendimento_tecnica(uuid, text) is
  'Fator de correcao aplicavel: medido da loja > referencia por nome do ingrediente > referencia por categoria > nulo (o sistema nao chuta).';

-- Registra uma pesagem real e faz a media movel com as amostras anteriores.
create or replace function public.fn_registrar_rendimento_medido(
  p_insumo_id uuid,
  p_tecnica_codigo text,
  p_peso_bruto numeric,
  p_peso_liquido numeric
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_loja uuid;
  v_pct numeric;
  v_atual public.insumos_tecnica_rendimento%rowtype;
  v_novo_pct numeric;
  v_amostras integer;
begin
  select loja_id into v_loja from public.insumos where id = p_insumo_id;
  if v_loja is null then
    raise exception 'Insumo nao encontrado.';
  end if;
  if not public.fn_tem_papel(v_loja, array['admin', 'operador']) then
    raise exception 'Sem permissao para registrar rendimento nesta loja.';
  end if;
  if coalesce(p_peso_bruto, 0) <= 0 or coalesce(p_peso_liquido, 0) <= 0 then
    raise exception 'Informe o peso bruto e o peso liquido, ambos maiores que zero.';
  end if;
  if p_peso_liquido > p_peso_bruto then
    raise exception 'O peso liquido nao pode ser maior que o bruto: limpar nao cria materia.';
  end if;

  v_pct := p_peso_liquido / p_peso_bruto;

  select * into v_atual
    from public.insumos_tecnica_rendimento
   where insumo_id = p_insumo_id and tecnica_codigo = p_tecnica_codigo;

  if v_atual.insumo_id is null then
    v_novo_pct := v_pct;
    v_amostras := 1;
  else
    -- Media ponderada pelas amostras: a medicao nova nao apaga o historico,
    -- so desloca a media -- e uma pesagem torta nao destroi o padrao da casa.
    v_amostras := v_atual.amostras + 1;
    v_novo_pct := ((v_atual.rendimento_pct * v_atual.amostras) + v_pct) / v_amostras;
  end if;

  insert into public.insumos_tecnica_rendimento (
    loja_id, insumo_id, tecnica_codigo, rendimento_pct, amostras,
    peso_bruto_kg, peso_liquido_kg, medido_em, medido_por
  ) values (
    v_loja, p_insumo_id, p_tecnica_codigo, round(v_novo_pct, 4), v_amostras,
    p_peso_bruto, p_peso_liquido, now(), auth.uid()
  )
  on conflict (insumo_id, tecnica_codigo) do update set
    rendimento_pct  = round(v_novo_pct, 4),
    amostras        = v_amostras,
    peso_bruto_kg   = p_peso_bruto,
    peso_liquido_kg = p_peso_liquido,
    medido_em       = now(),
    medido_por      = auth.uid(),
    loja_id         = v_loja;

  return jsonb_build_object(
    'rendimento_pct', round(v_novo_pct, 4),
    'rendimento_desta_medicao', round(v_pct, 4),
    'amostras', v_amostras,
    'origem', 'MEDIDO_LOJA'
  );
end;
$function$;

revoke all on function public.fn_registrar_rendimento_medido(uuid, text, numeric, numeric) from public, anon;
grant execute on function public.fn_registrar_rendimento_medido(uuid, text, numeric, numeric) to authenticated;

comment on function public.fn_registrar_rendimento_medido(uuid, text, numeric, numeric) is
  'Registra uma pesagem bruto/liquido e atualiza a media movel do rendimento da loja para aquele insumo e tecnica.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) A linha da ficha passa a carregar bruto, liquido, tecnica e a intencao
--    original do usuario ("5 unidades", mesmo com o estoque em kg).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.fichas_preparos
  -- `quantidade` continua sendo o BRUTO na unidade de estoque: e o que sai do
  -- estoque, e o que a RPC de producao consome. Nada muda para ela.
  add column if not exists quantidade_liquida numeric,
  add column if not exists tecnica_codigo text references public.tecnicas_culinarias(codigo),
  -- Snapshot: se a referencia de mercado mudar amanha, a ficha ja salva nao
  -- muda sozinha. Auditoria exige saber com que numero ela foi fechada.
  add column if not exists rendimento_pct_aplicado numeric(5,4),
  add column if not exists rendimento_origem text,
  -- A intencao do lojista, preservada para exibir de volta: ele digitou
  -- "5 un" e o sistema gravou 0,6 kg. As duas informacoes importam.
  add column if not exists quantidade_informada numeric,
  add column if not exists unidade_informada text;

alter table public.fichas_preparos
  drop constraint if exists fichas_preparos_liquida_nao_excede_bruto;
alter table public.fichas_preparos
  add constraint fichas_preparos_liquida_nao_excede_bruto
  check (
    quantidade_liquida is null
    or (quantidade_liquida > 0 and quantidade_liquida <= quantidade * 1.0001)
  );

alter table public.fichas_preparos
  drop constraint if exists fichas_preparos_rendimento_origem_valida;
alter table public.fichas_preparos
  add constraint fichas_preparos_rendimento_origem_valida
  check (rendimento_origem is null or rendimento_origem in (
    'MEDIDO_LOJA', 'REFERENCIA_INGREDIENTE', 'REFERENCIA_CATEGORIA', 'USUARIO'
  ));

comment on column public.fichas_preparos.quantidade is
  'Peso BRUTO na unidade de estoque do insumo: o que sai do estoque e vira custo.';
comment on column public.fichas_preparos.quantidade_liquida is
  'Peso LIQUIDO que entra no preparo depois da tecnica. Base do calculo nutricional. Nulo = sem perda declarada (liquido = bruto).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7) A caloria passa a contar o LIQUIDO
--    A casca do tomate e a semente saem do estoque, mas nao vao para o prato.
--    Contar o bruto na nutricao inflaria caloria, carboidrato e sodio do prato.
--
--    O motor nutricional em producao se chama fn_calcular_nutricao_receita e o
--    corpo dele divergiu do arquivo versionado do motor v2. Em vez de reescrever
--    200 linhas a partir de uma copia possivelmente defasada, a alteracao e
--    cirurgica: le a definicao real, troca a expressao da recursao e reinstala.
--    Se a expressao nao existir mais, aborta em voz alta em vez de seguir com
--    uma nutricao que conta casca.
do $migration$
declare
  v_alvos text[] := array[
    'public.fn_calcular_nutricao_receita(jsonb,uuid,boolean)',
    'public.fn_nutricao_de_linhas(jsonb,uuid,boolean)'
  ];
  v_alvo text;
  v_definicao text;
  v_nova text;
  v_aplicou boolean := false;
begin
  foreach v_alvo in array v_alvos loop
    if to_regprocedure(v_alvo) is null then
      continue;
    end if;

    v_definicao := pg_get_functiondef(v_alvo::regprocedure);

    -- Ja migrada em um replay anterior: nada a fazer.
    if position('coalesce(fp.quantidade_liquida, fp.quantidade)' in v_definicao) > 0 then
      v_aplicou := true;
      continue;
    end if;

    v_nova := replace(
      v_definicao,
      E'    fp.quantidade * (\n',
      E'    -- coalesce no liquido: a nutricao segue o que entrou no preparo,\n'
      || E'    -- nao o que saiu do estoque (fator de correcao da tecnica).\n'
      || E'    coalesce(fp.quantidade_liquida, fp.quantidade) * (\n'
    );

    if v_nova = v_definicao then
      raise exception
        'Nao encontrei a expressao "fp.quantidade * (" em %. O motor nutricional mudou; ajuste manual necessario antes de confiar na caloria.',
        v_alvo;
    end if;

    execute v_nova;
    v_aplicou := true;
    raise notice 'nutricao passou a usar o peso liquido em %', v_alvo;
  end loop;

  if not v_aplicou then
    raise exception 'Nenhum motor nutricional encontrado (fn_calcular_nutricao_receita / fn_nutricao_de_linhas).';
  end if;
end;
$migration$;

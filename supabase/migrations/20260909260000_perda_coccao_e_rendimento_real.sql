-- Perda (e ganho) de coccao: o segundo fator do food service.
--
-- O fator de correcao da migration anterior resolve a LIMPEZA: casca, semente,
-- osso, apara. Sobra o que acontece no fogo, que e diferente e as vezes vai na
-- direcao oposta:
--   - um molho reduz 30% e SAI menos do que entrou;
--   - o arroz hidrata e SAI 2,5x o que entrou.
-- Por isso o teto de 100% cai aqui: coccao nao e so perda.
--
-- Onde isso vive: o rendimento do lote (`insumos.rendimento_porcoes`) ja e
-- declarado DEPOIS da coccao. O que faltava nao era a matematica, era
--   (a) o sistema saber o indice tipico para ajudar a declarar, e
--   (b) medir o que saiu de VERDADE e aprender com a operacao.
-- Estimativa de catalogo nunca substitui a panela.

alter table public.tecnicas_rendimento_ingrediente
  drop constraint if exists tecnicas_rendimento_ingrediente_rendimento_pct_check;
alter table public.tecnicas_rendimento_ingrediente
  add constraint tecnicas_rendimento_ingrediente_rendimento_pct_check
  check (rendimento_pct > 0 and rendimento_pct <= 9.9999);

alter table public.tecnicas_rendimento_categoria
  drop constraint if exists tecnicas_rendimento_categoria_rendimento_pct_check;
alter table public.tecnicas_rendimento_categoria
  add constraint tecnicas_rendimento_categoria_rendimento_pct_check
  check (rendimento_pct > 0 and rendimento_pct <= 9.9999);

alter table public.insumos_tecnica_rendimento
  drop constraint if exists insumos_tecnica_rendimento_rendimento_pct_check;
alter table public.insumos_tecnica_rendimento
  add constraint insumos_tecnica_rendimento_rendimento_pct_check
  check (rendimento_pct > 0 and rendimento_pct <= 9.9999);

comment on column public.tecnicas_rendimento_ingrediente.rendimento_pct is
  'Peso final / peso inicial. Menor que 1 em limpeza e coccao seca; MAIOR que 1 em graos e massas que hidratam.';

-- Indices de coccao de referencia. Mesma mecanica de casamento por nome.
insert into public.tecnicas_rendimento_ingrediente (tecnica_codigo, termo, rendimento_pct, prioridade) values
  -- Hidratacao: sai mais do que entrou
  ('COZINHAR', 'arroz',            2.5000, 2),
  ('COZINHAR', 'feijao',           2.2000, 2),
  ('COZINHAR', 'macarrao',         2.4000, 2),
  ('COZINHAR', 'lentilha',         2.2000, 2),
  ('COZINHAR', 'grao de bico',     2.3000, 2),
  ('COZINHAR', 'batata',           0.9500, 2),
  ('COZINHAR', 'legumes',          0.9000, 2),
  -- Calor seco: sai menos
  ('ASSAR',    'frango',           0.7000, 2),
  ('ASSAR',    'pernil',           0.6500, 2),
  ('ASSAR',    'batata',           0.7500, 2),
  ('ASSAR',    'legumes',          0.7000, 2),
  ('GRELHAR',  'peito de frango',  0.7500, 2),
  ('GRELHAR',  'file mignon',      0.7500, 2),
  ('GRELHAR',  'picanha',          0.7000, 2),
  ('GRELHAR',  'hamburguer',       0.7500, 2),
  ('GRELHAR',  'blend',            0.7500, 2),
  ('GRELHAR',  'peixe',            0.8000, 2),
  ('REFOGAR',  'cebola',           0.6500, 2),
  ('REFOGAR',  'legumes',          0.8000, 2),
  ('BRANQUEAR','legumes',          0.9500, 2),
  ('BRANQUEAR','brocolis',         0.9500, 2)
on conflict (tecnica_codigo, termo) do nothing;

insert into public.tecnicas_rendimento_categoria (tecnica_codigo, categoria, rendimento_pct) values
  ('ASSAR',    'Carnes',     0.7000),
  ('GRELHAR',  'Carnes',     0.7500),
  ('COZINHAR', 'Carnes',     0.7500),
  ('GRELHAR',  'Pescados',   0.8000),
  ('COZINHAR', 'Mercearia',  2.3000),
  ('REFOGAR',  'Hortifrúti', 0.8000),
  ('ASSAR',    'Hortifrúti', 0.7000),
  ('BRANQUEAR','Hortifrúti', 0.9500),
  -- Reduzir e sempre concentracao: nao depende do ingrediente, depende do ponto
  ('REDUZIR',  'Ingrediente', 0.7000)
on conflict (tecnica_codigo, categoria) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- O que a panela devolveu de verdade
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.producoes_preparo
  -- O que a ficha prometia para esta OS (rendimento x lotes).
  add column if not exists quantidade_esperada numeric(14,4);

comment on column public.producoes_preparo.quantidade_produzida is
  'O que REALMENTE entrou no estoque. Igual a esperada quando a equipe nao pesou o lote pronto.';
comment on column public.producoes_preparo.quantidade_esperada is
  'O que a ficha prometia. A diferenca para quantidade_produzida e a perda ou o ganho de coccao medido.';

-- Historico real de rendimento de uma ficha, para a tela mostrar ao lojista o
-- que a COZINHA DELE entrega, e nao o que o catalogo imagina.
create or replace function public.fn_rendimento_real_preparo(p_preparo_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  with medidas as (
    select
      pp.produzido_em,
      pp.quantidade_produzida / nullif(pp.quantidade_esperada, 0) as pct
    from public.producoes_preparo pp
    where pp.preparo_id = p_preparo_id
      and pp.quantidade_esperada is not null
      and pp.quantidade_esperada > 0
      and pp.status <> 'DESCARTADO'
    order by pp.produzido_em desc
    limit 20
  )
  select jsonb_build_object(
    'producoes',  (select count(*) from medidas),
    'media_pct',  (select round(avg(pct), 4) from medidas),
    'ultima_pct', (select round(pct, 4) from medidas order by produzido_em desc limit 1),
    'menor_pct',  (select round(min(pct), 4) from medidas),
    'maior_pct',  (select round(max(pct), 4) from medidas)
  );
$function$;

revoke all on function public.fn_rendimento_real_preparo(uuid) from public, anon;
grant execute on function public.fn_rendimento_real_preparo(uuid) to authenticated, service_role;

comment on function public.fn_rendimento_real_preparo(uuid) is
  'Rendimento real das ultimas 20 producoes desta ficha (produzido / esperado). E a perda ou o ganho de coccao medido na cozinha do lojista.';

-- ─────────────────────────────────────────────────────────────────────────────
-- A OS aceita o rendimento REAL pesado na bancada
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.fn_produzir_preparo(uuid, numeric, numeric, numeric);
drop function if exists public.fn_produzir_preparo(uuid, numeric);
drop function if exists public.fn_produzir_preparo(uuid, integer);

create or replace function public.fn_produzir_preparo(
  p_preparo_id uuid,
  p_multiplicador numeric default 1,
  p_segundos_totais numeric default null,
  p_segundos_fogo numeric default null,
  -- Quanto saiu de verdade. Nulo = a equipe nao pesou; vale o esperado.
  p_quantidade_real numeric default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_preparo public.insumos%rowtype;
  v_cfg public.configuracoes_custo%rowtype;
  v_linha record;
  v_mov jsonb;
  v_rendimento numeric;
  v_esperada numeric;
  v_quantidade numeric;
  v_custo_total numeric := 0;
  v_custo_linha numeric;
  v_vence_em timestamptz;
  v_producao_id uuid;
  v_ingredientes jsonb := '[]'::jsonb;
  v_min_totais numeric;
  v_min_fogo numeric;
  v_tempo_origem text;
  v_custo_gas numeric := 0;
  v_custo_mao_obra numeric := 0;
  v_gas_hora numeric := 0;
begin
  if coalesce(p_multiplicador, 0) <= 0 then
    raise exception 'A quantidade de lotes deve ser maior que zero.';
  end if;
  if p_multiplicador <> trunc(p_multiplicador) then
    raise exception 'A quantidade de lotes deve ser um numero inteiro.';
  end if;

  select * into v_preparo from public.insumos where id = p_preparo_id for update;

  if v_preparo.id is null or not coalesce(v_preparo.is_preparo, false) then
    raise exception 'Ficha de producao nao encontrada.';
  end if;
  if not public.fn_pode_operar_loja(v_preparo.loja_id) then
    raise exception 'Sem permissao para produzir nesta loja.';
  end if;

  v_rendimento := public.fn_rendimento_na_unidade_do_preparo(
    v_preparo.unidade_medida, v_preparo.rendimento_padrao_kg, v_preparo.rendimento_porcoes
  );
  if coalesce(v_rendimento, 0) <= 0 then
    raise exception 'Defina o rendimento de um lote antes de produzir.';
  end if;

  if not exists (select 1 from public.fichas_preparos fp where fp.preparo_id = v_preparo.id) then
    raise exception 'A ficha precisa de pelo menos uma materia-prima.';
  end if;

  for v_linha in
    select fp.insumo_id, fp.quantidade, i.nome, i.unidade_medida
    from public.fichas_preparos fp
    join public.insumos i on i.id = fp.insumo_id
    where fp.preparo_id = v_preparo.id
      and i.loja_id = v_preparo.loja_id
      and coalesce(fp.loja_id, v_preparo.loja_id) = v_preparo.loja_id
    order by fp.created_at, fp.id
  loop
    if coalesce(v_linha.quantidade, 0) <= 0 then
      raise exception 'A quantidade de % deve ser maior que zero.', v_linha.nome;
    end if;

    -- Consome sempre o BRUTO da ficha: a loja pagou pela casca e pelo osso.
    v_mov := public.fn_movimentar_estoque(
      v_linha.insumo_id, 'SAIDA', -(v_linha.quantidade * p_multiplicador), null,
      format('OS de producao - %s (%s lote(s))', v_preparo.nome, p_multiplicador)
    );
    v_custo_linha := coalesce((v_mov->>'custo_total')::numeric, 0);
    v_custo_total := v_custo_total + v_custo_linha;
    v_ingredientes := v_ingredientes || jsonb_build_array(jsonb_build_object(
      'insumo', v_linha.nome,
      'quantidade', v_linha.quantidade * p_multiplicador,
      'unidade', v_linha.unidade_medida,
      'custo', round(v_custo_linha, 4)
    ));
  end loop;

  if jsonb_array_length(v_ingredientes) = 0 then
    raise exception 'A ficha contem itens invalidos ou de outra loja.';
  end if;

  if coalesce(p_segundos_totais, 0) > 0 then
    v_min_totais := p_segundos_totais / 60.0;
    v_min_fogo   := coalesce(p_segundos_fogo, 0) / 60.0;
    v_tempo_origem := 'MEDIDO';
  else
    select
      coalesce(sum((passo->>'minutos')::numeric), 0),
      coalesce(sum((passo->>'minutos')::numeric) filter (where (passo->>'fogo')::boolean), 0)
      into v_min_totais, v_min_fogo
    from jsonb_array_elements(coalesce(v_preparo.modo_preparo, '[]'::jsonb)) as passo
    where jsonb_typeof(passo) = 'object'
      and (passo->>'minutos') ~ '^[0-9]+(\.[0-9]+)?$';
    v_tempo_origem := case when coalesce(v_min_totais, 0) > 0 then 'ESTIMADO' end;
  end if;

  select * into v_cfg from public.configuracoes_custo where loja_id = v_preparo.loja_id;

  if v_cfg.loja_id is not null then
    if coalesce(v_cfg.gas_peso_kg, 0) > 0 then
      v_gas_hora := (coalesce(v_cfg.gas_preco_botijao, 0) / v_cfg.gas_peso_kg)
                    * coalesce(v_cfg.gas_consumo_kg_h, 0);
    end if;
    v_custo_gas := v_gas_hora * (coalesce(v_min_fogo, 0) / 60.0);
    v_custo_mao_obra := coalesce(v_cfg.mao_obra_valor_hora, 0) * (coalesce(v_min_totais, 0) / 60.0);
  end if;

  -- Esperado pela ficha x pesado na bancada. Entra no estoque o que existe de
  -- fato: dizer que entraram 3 L quando sairam 2,4 e estoque fantasma.
  v_esperada := v_rendimento * p_multiplicador;
  v_quantidade := case
    when p_quantidade_real is not null and p_quantidade_real > 0 then p_quantidade_real
    else v_esperada
  end;

  -- Um lote que rende 10x o previsto e erro de digitacao, nao coccao.
  if v_quantidade > v_esperada * 10 then
    raise exception 'Rendimento informado (%) e mais de 10x o previsto (%). Confira a unidade e a quantidade.',
      v_quantidade, v_esperada;
  end if;

  if coalesce(v_preparo.validade_horas, 0) > 0 then
    v_vence_em := now() + make_interval(secs => (v_preparo.validade_horas * 3600)::double precision);
  end if;

  perform public.fn_movimentar_estoque(
    v_preparo.id, 'ENTRADA', v_quantidade, nullif(v_custo_total, 0),
    format('OS de producao concluida - %s lote(s)', p_multiplicador),
    null, null, v_vence_em::date
  );

  insert into public.producoes_preparo (
    loja_id, preparo_id, lotes, quantidade_produzida, quantidade_esperada,
    vence_em, status, custo_insumos, custo_gas, custo_mao_obra, custo_total,
    minutos_totais, minutos_fogo, tempo_origem
  ) values (
    v_preparo.loja_id, v_preparo.id, p_multiplicador::int, v_quantidade, v_esperada,
    v_vence_em, 'ATIVO', round(v_custo_total, 4), round(v_custo_gas, 4),
    round(v_custo_mao_obra, 4), round(v_custo_total + v_custo_gas + v_custo_mao_obra, 4),
    round(coalesce(v_min_totais, 0), 2), round(coalesce(v_min_fogo, 0), 2), v_tempo_origem
  ) returning id into v_producao_id;

  return jsonb_build_object(
    'producao_id', v_producao_id,
    'preparo', v_preparo.nome,
    'quantidade', v_quantidade,
    'quantidade_esperada', v_esperada,
    'rendimento_coccao_pct', case when v_esperada > 0 then round(v_quantidade / v_esperada, 4) end,
    'unidade', v_preparo.unidade_medida,
    'custo_total', round(v_custo_total, 4),
    'custo_unitario', case when v_quantidade > 0 then round(v_custo_total / v_quantidade, 6) else 0 end,
    'custo_gas', round(v_custo_gas, 4),
    'custo_mao_obra', round(v_custo_mao_obra, 4),
    'custo_os', round(v_custo_total + v_custo_gas + v_custo_mao_obra, 4),
    'minutos_totais', round(coalesce(v_min_totais, 0), 2),
    'minutos_fogo', round(coalesce(v_min_fogo, 0), 2),
    'tempo_origem', v_tempo_origem,
    'gas_custo_hora', round(v_gas_hora, 4),
    'vence_em', v_vence_em,
    'ingredientes', v_ingredientes
  );
end;
$function$;

revoke all on function public.fn_produzir_preparo(uuid, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.fn_produzir_preparo(uuid, numeric, numeric, numeric, numeric) to authenticated, service_role;

comment on function public.fn_produzir_preparo(uuid, numeric, numeric, numeric, numeric) is
  'OS atomica: consome o bruto por PEPS, transfere o custo material ao resultado, apura gas e mao de obra pelo tempo medido e registra o rendimento real de coccao (pesado) contra o esperado pela ficha.';

-- Preenche o esperado das producoes anteriores, para o historico comecar a
-- servir de base em vez de ficar cego. Sem medicao real, esperado = produzido:
-- e o que o sistema podia afirmar naquela epoca, e nao inventa desvio nenhum.
update public.producoes_preparo
   set quantidade_esperada = quantidade_produzida
 where quantidade_esperada is null;

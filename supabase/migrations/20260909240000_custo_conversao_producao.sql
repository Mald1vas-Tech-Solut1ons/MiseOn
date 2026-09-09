-- Engenharia de custo de producao: gas e mao de obra por OS.
--
-- Ate aqui o MiseOn so sabia o custo do MATERIAL (PEPS dos insumos). Gas
-- entrava como custo fixo mensal rateado no preco de venda, o que esconde a
-- diferenca entre um molho que ferve 3 horas e uma salada que nao acende o
-- fogo. Com o Modo de Preparo cronometrando cada etapa, da para medir.
--
-- DECISAO CONTABIL EXPLICITA: gas e mao de obra ficam registrados na OS
-- (producoes_preparo) e aparecem no resultado, mas NAO sao capitalizados no
-- custo do lote que entra no estoque. O motivo: configuracoes_custo ja rateia
-- gas, energia e folha no preco de venda (Cardapio/Financeiro); somar de novo
-- no CMV contaria o mesmo real duas vezes. O lote continua valendo o material.

alter table public.configuracoes_custo
  add column if not exists gas_preco_botijao   numeric(10,2) not null default 0,
  add column if not exists gas_peso_kg         numeric(10,3) not null default 13,
  -- 0,225 kg/h e o consumo de referencia de um queimador em chama alta.
  add column if not exists gas_consumo_kg_h    numeric(10,4) not null default 0.225,
  add column if not exists mao_obra_valor_hora numeric(10,2) not null default 0;

comment on column public.configuracoes_custo.gas_consumo_kg_h is
  'Consumo do queimador em chama alta (kg/h). Referencia de mercado: 0,225.';
comment on column public.configuracoes_custo.mao_obra_valor_hora is
  'Valor da hora de bancada. Referencia: salario mensal / 220h.';

alter table public.producoes_preparo
  add column if not exists custo_insumos   numeric(14,4),
  add column if not exists custo_gas       numeric(14,4),
  add column if not exists custo_mao_obra  numeric(14,4),
  add column if not exists custo_total     numeric(14,4),
  add column if not exists minutos_totais  numeric(10,2),
  add column if not exists minutos_fogo    numeric(10,2),
  -- MEDIDO = cronometro do Modo de Preparo. ESTIMADO = tempos declarados na
  -- ficha, quando a equipe nao usou o cronometro. Nunca misturar os dois sem
  -- dizer qual foi: um e medicao, o outro e promessa.
  add column if not exists tempo_origem    text;

alter table public.producoes_preparo
  drop constraint if exists producoes_preparo_tempo_origem_valido;
alter table public.producoes_preparo
  add constraint producoes_preparo_tempo_origem_valido
  check (tempo_origem is null or tempo_origem in ('MEDIDO', 'ESTIMADO'));

-- A assinatura muda, entao a anterior sai de cena: manter as duas deixaria a
-- chamada de 2 argumentos ambigua para o PostgREST.
drop function if exists public.fn_produzir_preparo(uuid, numeric);
drop function if exists public.fn_produzir_preparo(uuid, integer);

create or replace function public.fn_produzir_preparo(
  p_preparo_id uuid,
  p_multiplicador numeric default 1,
  p_segundos_totais numeric default null,
  p_segundos_fogo numeric default null
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

  select * into v_preparo
  from public.insumos
  where id = p_preparo_id
  for update;

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

  if not exists (
    select 1 from public.fichas_preparos fp where fp.preparo_id = v_preparo.id
  ) then
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

    -- Negativo de proposito: a convencao do schema e "positivo entra, negativo
    -- sai", e so o sinal negativo dispara o custeio PEPS e consome os lotes.
    v_mov := public.fn_movimentar_estoque(
      v_linha.insumo_id,
      'SAIDA',
      -(v_linha.quantidade * p_multiplicador),
      null,
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

  -- Tempo: cronometro da bancada quando existe; senao, o roteiro declarado.
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

  v_quantidade := v_rendimento * p_multiplicador;
  if coalesce(v_preparo.validade_horas, 0) > 0 then
    v_vence_em := now() + make_interval(secs => (v_preparo.validade_horas * 3600)::double precision);
  end if;

  -- O lote entra valendo o MATERIAL. Gas e mao de obra ficam registrados na OS
  -- e nao inflam o CMV (ver nota contabil no topo desta migration).
  perform public.fn_movimentar_estoque(
    v_preparo.id,
    'ENTRADA',
    v_quantidade,
    nullif(v_custo_total, 0),
    format('OS de producao concluida - %s lote(s)', p_multiplicador),
    null,
    null,
    v_vence_em::date
  );

  insert into public.producoes_preparo (
    loja_id, preparo_id, lotes, quantidade_produzida, vence_em, status,
    custo_insumos, custo_gas, custo_mao_obra, custo_total,
    minutos_totais, minutos_fogo, tempo_origem
  ) values (
    v_preparo.loja_id, v_preparo.id, p_multiplicador::int, v_quantidade, v_vence_em, 'ATIVO',
    round(v_custo_total, 4), round(v_custo_gas, 4), round(v_custo_mao_obra, 4),
    round(v_custo_total + v_custo_gas + v_custo_mao_obra, 4),
    round(coalesce(v_min_totais, 0), 2), round(coalesce(v_min_fogo, 0), 2), v_tempo_origem
  ) returning id into v_producao_id;

  return jsonb_build_object(
    'producao_id', v_producao_id,
    'preparo', v_preparo.nome,
    'quantidade', v_quantidade,
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

revoke all on function public.fn_produzir_preparo(uuid, numeric, numeric, numeric) from public, anon;
grant execute on function public.fn_produzir_preparo(uuid, numeric, numeric, numeric) to authenticated, service_role;

comment on function public.fn_produzir_preparo(uuid, numeric, numeric, numeric) is
  'OS atomica: consome materias-primas por PEPS, transfere o custo material ao resultado, registra lote/validade e apura gas e mao de obra a partir do tempo medido na bancada.';

-- ============================================================================
-- NUTRIÇÃO — MOTOR v2 (Onda V, Fatia 1)
-- ============================================================================
-- docs/PLANO-NUTRICIONAL-VITRINE.md §2.1 a §2.4 e §2.8.
--
-- O motor da Sprint 1 calcula certo o que sabe medir. Esta versão conserta o
-- que ele fazia com o que NÃO sabe medir, e passa a carregar o dado que o
-- cliente mais precisa:
--
--   1. Alérgeno agora sobe pela recursão (§2.2). Um alérgeno dentro do molho é
--      alérgeno do prato. E — decisão de projeto — ele NÃO depende de massa:
--      pão sem peso médio informado continua contendo glúten. Alérgeno é
--      propriedade do item, não da quantidade.
--   2. Cobertura passa a ter dois eixos (§2.1): massa e CONTAGEM DE ITENS. O
--      insumo sem ponte de conversão sumia dos dois lados da fração e produzia
--      "100% de cobertura" sobre metade da receita. COMPLETO agora exige os
--      dois eixos fechados.
--   3. Rendimento do preparo é normalizado antes de dividir (§2.8):
--      rendimento_padrao_kg está em kg e rendimento_porcoes na unidade do
--      preparo. Somar as duas num coalesce dava erro de 1000x no dia em que
--      alguém preenchesse a primeira.
--   4. Coerência energética (§2.7): kcal declarada contra os fatores de
--      Atwater (4/4/9/2/7). Divergiu mais de 20%, vira alerta — e alerta
--      bloqueia publicação, não decora o admin.
--   5. Composição das fontes: quanto da massa veio de rótulo, de base
--      científica ou de estimativa. É o insumo do nível 2 do selo (§3.2 do
--      plano-mãe) e o que a vitrine mostra como proveniência.
--
-- Compatibilidade: o retorno só GANHA chaves. Quem lia status/nutrientes/
-- massa_g/cobertura_pct/insumos_faltantes continua lendo igual.
-- ============================================================================

-- ── Rendimento do preparo, na unidade em que o preparo é consumido ──────────
--
-- A ficha consome o preparo na unidade_medida DELE ("40 ml de molho", "1 un de
-- blend"). Para achar a fração da receita que isso representa, o rendimento
-- precisa estar nessa mesma unidade. rendimento_porcoes já está;
-- rendimento_padrao_kg está em kg e só converte quando o preparo é medido em
-- massa — kg -> ml exigiria densidade do preparo, que ninguém declarou.
create or replace function public.fn_rendimento_na_unidade_do_preparo(
  p_unidade_medida       text,
  p_rendimento_padrao_kg numeric,
  p_rendimento_porcoes   numeric
) returns numeric
language sql immutable
set search_path = public
as $$
  select coalesce(
    case
      when coalesce(p_rendimento_padrao_kg, 0) > 0
       and (select grandeza from public.unidades_medida where codigo = p_unidade_medida) = 'massa'
      then p_rendimento_padrao_kg
           / nullif((select fator_base from public.unidades_medida where codigo = p_unidade_medida), 0)
    end,
    nullif(p_rendimento_porcoes, 0),
    1
  );
$$;

comment on function public.fn_rendimento_na_unidade_do_preparo(text, numeric, numeric) is
  'Rendimento do preparo expresso na unidade em que ele é consumido pela ficha. Ver PLANO-NUTRICIONAL-VITRINE §2.8 — misturar kg com a unidade do preparo errava por 1000x.';

revoke execute on function public.fn_rendimento_na_unidade_do_preparo(text, numeric, numeric) from public;
grant  execute on function public.fn_rendimento_na_unidade_do_preparo(text, numeric, numeric) to authenticated;

-- ── Motor v2 ────────────────────────────────────────────────────────────────

create or replace function public.fn_calcular_nutricao_receita(
  p_linhas jsonb,
  p_loja_id uuid,
  p_incluir_nao_revisado boolean default false
) returns jsonb
language sql
stable
set search_path = public
as $$
with recursive arvore as (
  select
    (l->>'insumo_id')::uuid as insumo_id,
    (l->>'quantidade')::numeric as quantidade,
    array[(l->>'insumo_id')::uuid] as caminho,
    1 as profundidade,
    false as ciclo
  from jsonb_array_elements(coalesce(p_linhas, '[]'::jsonb)) l
  where (l->>'insumo_id') is not null and (l->>'quantidade')::numeric > 0

  union all

  select
    fp.insumo_id,
    fp.quantidade * (
      a.quantidade / nullif(
        public.fn_rendimento_na_unidade_do_preparo(
          ip.unidade_medida, ip.rendimento_padrao_kg, ip.rendimento_porcoes
        ), 0)
    ),
    a.caminho || fp.insumo_id,
    a.profundidade + 1,
    fp.insumo_id = any(a.caminho)
  from arvore a
  join public.insumos ip on ip.id = a.insumo_id and ip.is_preparo
  join public.fichas_preparos fp on fp.preparo_id = a.insumo_id
  where a.profundidade < 6 and not a.ciclo
),

diagnostico as (
  select
    bool_or(t.ciclo) as tem_ciclo,
    bool_or(t.profundidade = 6 and i.is_preparo) as profundidade_excedida
  from arvore t
  join public.insumos i on i.id = t.insumo_id
),

folhas as (
  select a.insumo_id, sum(a.quantidade) as quantidade_total
  from arvore a
  join public.insumos i on i.id = a.insumo_id
  where not i.is_preparo and not a.ciclo
  group by a.insumo_id
),

normalizado as (
  select
    f.insumo_id,
    i.nome,
    (um.fator_base is not null) as dimensional,
    (n.insumo_id is not null)   as tem_cadastro,
    coalesce(n.revisado, false) as revisado,
    n.base_qtd,
    n.nutrientes,
    n.origem,
    coalesce(n.alergenos_contem, '{}')      as alergenos_contem,
    coalesce(n.alergenos_pode_conter, '{}') as alergenos_pode_conter,
    public.fn_normalizar_para_nutricao(
      i.unidade_medida, f.quantidade_total,
      coalesce(n.base_unidade, 'g'), n.densidade_g_ml, n.peso_medio_un_g
    ) as massa_g
  from folhas f
  join public.insumos i on i.id = f.insumo_id
  join public.unidades_medida um on um.codigo = i.unidade_medida
  left join public.insumos_nutricao n on n.insumo_id = f.insumo_id
),

avaliado as (
  select *,
    -- "Publicável": entra na soma de nutrientes.
    (
      tem_cadastro and massa_g is not null
      and nutrientes is not null and nutrientes <> '{}'::jsonb
      and (revisado or p_incluir_nao_revisado)
    ) as confiavel,
    -- Alérgeno não depende de massa nem de nutriente preenchido: basta o item
    -- ter sido avaliado por alguém. É por isso que ele tem critério próprio.
    (tem_cadastro and (revisado or p_incluir_nao_revisado)) as alergeno_avaliado
  from normalizado
),

contribuicoes as (
  select av.insumo_id, chave as codigo,
    (av.massa_g / av.base_qtd) * (av.nutrientes ->> chave)::numeric as valor
  from avaliado av
  cross join lateral jsonb_object_keys(coalesce(av.nutrientes, '{}'::jsonb)) as chave
  where av.confiavel
),

totais_nutrientes as (
  select coalesce(jsonb_object_agg(codigo, round(soma, 4)), '{}'::jsonb) as nutrientes
  from (select codigo, sum(valor) as soma from contribuicoes group by codigo) x
),

-- Alérgenos consolidados. "pode conter" nunca engole o "contém": se um item
-- contém leite e outro pode conter leite, o prato CONTÉM leite.
alergenos_contem_flat as (
  select distinct a from avaliado av, unnest(av.alergenos_contem) a where av.alergeno_avaliado
),
alergenos_pode_flat as (
  select distinct a from avaliado av, unnest(av.alergenos_pode_conter) a where av.alergeno_avaliado
),
alergenos as (
  select
    coalesce((select array_agg(a order by a) from alergenos_contem_flat), '{}') as contem,
    coalesce((select array_agg(a order by a) from alergenos_pode_flat p
              where not exists (select 1 from alergenos_contem_flat c where c.a = p.a)), '{}') as pode_conter
),

faltantes as (
  select jsonb_agg(jsonb_build_object(
    'insumo_id', insumo_id, 'nome', nome,
    'motivo', case
      when not tem_cadastro then 'sem dado nutricional'
      when massa_g is null and not dimensional then 'peso médio não informado'
      when massa_g is null and dimensional then 'densidade não informada (conversão de volume para massa)'
      when nutrientes is null or nutrientes = '{}'::jsonb then 'cadastro sem nenhum nutriente preenchido'
      when not (revisado or p_incluir_nao_revisado) then 'aguardando revisão'
      else 'motivo desconhecido'
    end
  ) order by nome) as lista
  from avaliado
  where not confiavel
),

contagem as (
  select
    count(*)                                  as itens_total,
    count(*) filter (where confiavel)         as itens_com_dado,
    count(*) filter (where alergeno_avaliado) as itens_alergeno_avaliado
  from avaliado
),

massas as (
  select
    coalesce(sum(massa_g) filter (where massa_g is not null), 0) as massa_estimavel_g,
    coalesce(sum(massa_g) filter (where confiavel), 0)           as massa_com_nutricao_g
  from avaliado
),

-- Origem agrupada em classes que significam algo para quem lê o rótulo.
composicao as (
  select coalesce(jsonb_object_agg(classe, pct), '{}'::jsonb) as fontes
  from (
    select
      case origem
        when 'ROTULO_EAN'  then 'ROTULO'
        when 'ROTULO_FOTO' then 'ROTULO'
        when 'USDA'        then 'BASE_CIENTIFICA'
        when 'TBCA'        then 'BASE_CIENTIFICA'
        when 'IA'          then 'ESTIMADO'
        else 'DECLARADO'
      end as classe,
      round(100 * sum(massa_g) / nullif((select massa_com_nutricao_g from massas), 0), 1) as pct
    from avaliado where confiavel group by 1
  ) x
),

-- Coerência energética (§2.7): os fatores de conversão da IN 75/2020.
energia as (
  select
    (tn.nutrientes->>'ENERGIA_KCAL')::numeric as kcal_declarada,
    ( 4 * coalesce((tn.nutrientes->>'CARBOIDRATOS')::numeric, 0)
    + 4 * coalesce((tn.nutrientes->>'PROTEINAS')::numeric, 0)
    + 9 * coalesce((tn.nutrientes->>'GORDURAS_TOTAIS')::numeric, 0)
    + 2 * coalesce((tn.nutrientes->>'FIBRAS_ALIMENTARES')::numeric, 0)
    + 7 * coalesce((tn.nutrientes->>'ALCOOL')::numeric, 0)
    ) as kcal_atwater
  from totais_nutrientes tn
),

alertas as (
  select coalesce(jsonb_agg(a), '[]'::jsonb) as lista from (
    select jsonb_build_object(
      'codigo', 'ENERGIA_INCOERENTE',
      'detalhe', format(
        'Valor energético somado (%s kcal) diverge %s%% do calculado pelos macronutrientes (%s kcal).',
        round(kcal_declarada), round(100 * abs(kcal_declarada - kcal_atwater) / nullif(kcal_atwater, 0)),
        round(kcal_atwater))
    ) as a
    from energia
    where kcal_declarada is not null and kcal_atwater > 0
      and abs(kcal_declarada - kcal_atwater) / kcal_atwater > 0.20
  ) x
)

select case
  when d.tem_ciclo then jsonb_build_object(
    'status', 'SEM_DADOS', 'erro', 'ciclo_detectado',
    'nutrientes', '{}'::jsonb, 'massa_g', 0, 'cobertura_pct', 0, 'insumos_faltantes', '[]'::jsonb,
    'alergenos_contem', '[]'::jsonb, 'alergenos_pode_conter', '[]'::jsonb,
    'itens_total', 0, 'itens_com_dado', 0, 'composicao_fontes', '{}'::jsonb,
    'alertas', jsonb_build_array(jsonb_build_object('codigo', 'CICLO', 'detalhe', 'Um preparo desta receita consome a si mesmo, direta ou indiretamente.'))
  )
  when d.profundidade_excedida then jsonb_build_object(
    'status', 'SEM_DADOS', 'erro', 'profundidade_excedida',
    'nutrientes', '{}'::jsonb, 'massa_g', 0, 'cobertura_pct', 0, 'insumos_faltantes', '[]'::jsonb,
    'alergenos_contem', '[]'::jsonb, 'alergenos_pode_conter', '[]'::jsonb,
    'itens_total', 0, 'itens_com_dado', 0, 'composicao_fontes', '{}'::jsonb,
    'alertas', jsonb_build_array(jsonb_build_object('codigo', 'PROFUNDIDADE', 'detalhe', 'A receita encadeia mais de 5 níveis de preparo.'))
  )
  when m.massa_estimavel_g = 0 then jsonb_build_object(
    'status', 'SEM_DADOS', 'erro', 'receita_vazia_ou_sem_massa',
    'nutrientes', '{}'::jsonb, 'massa_g', 0, 'cobertura_pct', 0,
    'insumos_faltantes', coalesce(f.lista, '[]'::jsonb),
    -- Mesmo sem massa nenhuma, o que se sabe de alérgeno continua valendo: é
    -- exatamente o prato "sem número, mas com aviso" da §3.1 do plano.
    'alergenos_contem', to_jsonb(al.contem), 'alergenos_pode_conter', to_jsonb(al.pode_conter),
    'itens_total', c.itens_total, 'itens_com_dado', 0,
    'itens_alergeno_avaliado', c.itens_alergeno_avaliado,
    'composicao_fontes', '{}'::jsonb, 'alertas', '[]'::jsonb
  )
  else jsonb_build_object(
    'status', case
      when c.itens_com_dado = c.itens_total
       and m.massa_com_nutricao_g >= m.massa_estimavel_g * 0.999
      then 'COMPLETO' else 'PARCIAL' end,
    'nutrientes', tn.nutrientes,
    'massa_g', round(m.massa_estimavel_g, 2),
    -- Mantida por compatibilidade: cobertura POR MASSA.
    'cobertura_pct', round(100 * m.massa_com_nutricao_g / m.massa_estimavel_g, 1),
    'insumos_faltantes', coalesce(f.lista, '[]'::jsonb),
    'alergenos_contem', to_jsonb(al.contem),
    'alergenos_pode_conter', to_jsonb(al.pode_conter),
    'itens_total', c.itens_total,
    'itens_com_dado', c.itens_com_dado,
    'itens_alergeno_avaliado', c.itens_alergeno_avaliado,
    'composicao_fontes', comp.fontes,
    'alertas', alt.lista
  )
end
from diagnostico d
cross join massas m
cross join contagem c
cross join totais_nutrientes tn
cross join alergenos al
cross join composicao comp
cross join alertas alt
left join faltantes f on true;
$$;

comment on function public.fn_calcular_nutricao_receita(jsonb, uuid, boolean) is
  'Motor único (ADR-01) v2: recursão de preparos, alérgenos agregados, cobertura por massa E por contagem de itens, rendimento normalizado, coerência energética e composição de fontes. Ver docs/PLANO-NUTRICIONAL-VITRINE.md §4 Fatia 1.';

revoke execute on function public.fn_calcular_nutricao_receita(jsonb, uuid, boolean) from public;
grant  execute on function public.fn_calcular_nutricao_receita(jsonb, uuid, boolean) to authenticated;

-- ============================================================================
-- NUTRICIONAL — SPRINT 1: MOTOR DE CÁLCULO
-- ============================================================================
-- NUT-04 a NUT-06 do docs/PLANO-NUTRICIONAL.md.
--
-- ADR-01: cálculo canônico em plpgsql, UMA implementação só. O produto salvo
-- (fn_recalcular_nutricao_produto) e o preview ao vivo do editor de ficha
-- (fn_simular_nutricao) chamam o MESMO motor recursivo
-- (fn_calcular_nutricao_receita) — o primeiro lê a ficha do banco, o segundo
-- recebe uma receita ainda não salva. Nenhum gêmeo em TypeScript.
--
-- ADR-06: nada aqui inventa massa. Insumo sem ponte de conversão (peso médio
-- ou densidade) entra em `insumos_faltantes` e sai do denominador de
-- cobertura — nunca vira um número calculado por regra de três.
-- ============================================================================

-- ── 1. insumos_nutricao (NUT-04) ────────────────────────────────────────────

create table if not exists public.insumos_nutricao (
  insumo_id       uuid primary key references public.insumos(id) on delete cascade,
  loja_id         uuid not null references public.lojas(id) on delete cascade,

  -- Base de expressão, igual a alimentos_referencia: sempre 100 g ou 100 ml.
  base_qtd        numeric not null default 100 check (base_qtd > 0),
  base_unidade    text not null default 'g' check (base_unidade in ('g', 'ml')),

  -- Pontes p/ quando o insumo não vive na mesma grandeza da nutrição:
  -- densidade cruza massa↔volume; peso_medio_un_g cruza contagem/semântico→massa.
  -- Ver fn_normalizar_para_nutricao — são exatamente os dois jeitos de faltar dado.
  densidade_g_ml  numeric check (densidade_g_ml is null or densidade_g_ml > 0),
  peso_medio_un_g numeric check (peso_medio_un_g is null or peso_medio_un_g > 0),

  nutrientes            jsonb not null default '{}'::jsonb,  -- { "ENERGIA_KCAL": 165, ... }
  alergenos_contem      text[] not null default '{}',
  alergenos_pode_conter text[] not null default '{}',

  origem       text not null check (origem in ('ROTULO_EAN','ROTULO_FOTO','USDA','TBCA','IA','MANUAL')),
  fonte_ref    uuid references public.alimentos_referencia(id),
  fonte_versao text,
  fonte_url    text,

  confianca    numeric not null default 1 check (confianca between 0 and 1),
  -- ADR-02: nada com revisado=false entra no cache publicável (S4). Aqui, na
  -- Sprint 1, essa regra já é respeitada pelo motor de cálculo (parâmetro
  -- p_incluir_nao_revisado), não só documentada.
  revisado      boolean not null default false,
  revisado_por  uuid references auth.users(id),
  revisado_em   timestamptz,

  ia_modelo        text,
  ia_justificativa text,
  ia_payload       jsonb,

  atualizado_em timestamptz not null default now()
);

comment on table public.insumos_nutricao is
  'Nutrição declarada por insumo, por loja. Origem/fonte/confiança são obrigatórias por construção — ver ADR-06 do PLANO-NUTRICIONAL.';
comment on column public.insumos_nutricao.peso_medio_un_g is
  'Gramas de 1 unidade_medida do insumo (seja ela un, fatias, dente...). Sem isso, um insumo em unidade não-dimensional não tem massa calculável — nunca vira regra de três.';
comment on column public.insumos_nutricao.densidade_g_ml is
  'Só necessária quando insumo e nutrição estão em grandezas físicas diferentes (insumo em ml, nutrição declarada em g, ou vice-versa).';

create index if not exists idx_insumos_nutricao_loja on public.insumos_nutricao (loja_id);

alter table public.insumos_nutricao enable row level security;

drop policy if exists insumos_nutricao_acesso on public.insumos_nutricao;
create policy insumos_nutricao_acesso
  on public.insumos_nutricao for all
  using (public.fn_tem_papel(loja_id, array['admin','operador']))
  with check (public.fn_tem_papel(loja_id, array['admin','operador']));

-- ── 2. Normalização de massa (a ponte de cada leitura) ──────────────────────

create or replace function public.fn_normalizar_para_nutricao(
  p_unidade_medida text,     -- insumos.unidade_medida do insumo folha
  p_quantidade     numeric,  -- quantidade nessa unidade
  p_base_unidade   text,     -- insumos_nutricao.base_unidade ('g' ou 'ml')
  p_densidade_g_ml numeric,  -- ponte massa↔volume; pode ser null
  p_peso_medio_g   numeric   -- gramas de 1 p_unidade_medida; pode ser null
) returns numeric
language plpgsql immutable
set search_path = public
as $$
declare
  v_um    record;
  v_fisica numeric; -- quantidade convertida para g ou ml (mesma grandeza do insumo)
begin
  select grandeza, fator_base into v_um from public.unidades_medida where codigo = p_unidade_medida;
  if not found then return null; end if;

  if v_um.fator_base is not null then
    -- Dimensional: fator_base é relativo à unidade-base da grandeza (kg ou L);
    -- ×1000 leva à submúltipla atômica (g ou ml) — mesmo padrão de unidades.ts.
    v_fisica := p_quantidade * v_um.fator_base * 1000;

    if v_um.grandeza = 'massa' and p_base_unidade = 'g'  then return v_fisica; end if;
    if v_um.grandeza = 'volume' and p_base_unidade = 'ml' then return v_fisica; end if;

    -- Grandeza cruzada (ex.: insumo em ml, nutrição declarada em g): sem
    -- densidade não há conversão — não se inventa massa (ADR-06).
    if p_densidade_g_ml is null then return null; end if;
    if v_um.grandeza = 'volume' and p_base_unidade = 'g'  then return v_fisica * p_densidade_g_ml; end if;
    if v_um.grandeza = 'massa'  and p_base_unidade = 'ml' then return v_fisica / p_densidade_g_ml; end if;
    return null;
  end if;

  -- Sem grandeza física (un, semântico, agrupador): só a ponte declarada resolve.
  if p_peso_medio_g is null then return null; end if;
  v_fisica := p_quantidade * p_peso_medio_g; -- sempre em gramas
  if p_base_unidade = 'g' then return v_fisica; end if;
  if p_densidade_g_ml is null then return null; end if;
  return v_fisica / p_densidade_g_ml;
end;
$$;

comment on function public.fn_normalizar_para_nutricao(text, numeric, text, numeric, numeric) is
  'Converte quantidade (na unidade do insumo) para a grandeza de insumos_nutricao. NULL = ponte ausente — nunca chuta.';

revoke execute on function public.fn_normalizar_para_nutricao(text, numeric, text, numeric, numeric) from public;
grant  execute on function public.fn_normalizar_para_nutricao(text, numeric, text, numeric, numeric) to authenticated;

-- ── 3. O motor recursivo (NUT-05) ───────────────────────────────────────────
--
-- p_linhas: [{"insumo_id": "uuid", "quantidade": n}, ...] — quantidade sempre
-- na unidade_medida do próprio insumo (mesma convenção de fichas_tecnicas e
-- fichas_preparos: não existe coluna de unidade por linha).
--
-- Recursão: quando uma linha aponta para um insumo com is_preparo, ela se
-- expande nas linhas de fichas_preparos daquele preparo, escaladas por
-- (quantidade_consumida / rendimento_do_preparo) — exatamente o "250/2000"
-- do critério de aceite NUT-05. Path (`caminho`) detecta ciclo; profundidade
-- 6 é o teto (produto + até 5 níveis de preparo dentro de preparo, R-04).

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

  union all

  select
    fp.insumo_id,
    fp.quantidade * (
      a.quantidade / nullif(
        coalesce(nullif(ip.rendimento_padrao_kg, 0), nullif(ip.rendimento_porcoes, 0), 1),
        0
      )
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
  -- Só nós que NÃO são preparo entram na agregação final: um preparo cujo
  -- ciclo/profundidade cortou a expansão não vira leitura de nutriente.
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
    (
      tem_cadastro and massa_g is not null
      and nutrientes is not null and nutrientes <> '{}'::jsonb
      and (revisado or p_incluir_nao_revisado)
    ) as confiavel
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

massas as (
  select
    coalesce(sum(massa_g) filter (where massa_g is not null), 0) as massa_estimavel_g,
    coalesce(sum(massa_g) filter (where confiavel), 0)           as massa_com_nutricao_g
  from avaliado
)

select case
  when d.tem_ciclo then jsonb_build_object(
    'status', 'SEM_DADOS', 'erro', 'ciclo_detectado',
    'nutrientes', '{}'::jsonb, 'massa_g', 0, 'cobertura_pct', 0, 'insumos_faltantes', '[]'::jsonb
  )
  when d.profundidade_excedida then jsonb_build_object(
    'status', 'SEM_DADOS', 'erro', 'profundidade_excedida',
    'nutrientes', '{}'::jsonb, 'massa_g', 0, 'cobertura_pct', 0, 'insumos_faltantes', '[]'::jsonb
  )
  when m.massa_estimavel_g = 0 then jsonb_build_object(
    'status', 'SEM_DADOS', 'erro', 'receita_vazia_ou_sem_massa',
    'nutrientes', '{}'::jsonb, 'massa_g', 0, 'cobertura_pct', 0,
    'insumos_faltantes', coalesce(f.lista, '[]'::jsonb)
  )
  else jsonb_build_object(
    'status', case when m.massa_com_nutricao_g >= m.massa_estimavel_g * 0.999 then 'COMPLETO' else 'PARCIAL' end,
    'nutrientes', tn.nutrientes,
    'massa_g', round(m.massa_estimavel_g, 2),
    'cobertura_pct', round(100 * m.massa_com_nutricao_g / m.massa_estimavel_g, 1),
    'insumos_faltantes', coalesce(f.lista, '[]'::jsonb)
  )
end
from diagnostico d
cross join massas m
cross join totais_nutrientes tn
left join faltantes f on true;
$$;

comment on function public.fn_calcular_nutricao_receita(jsonb, uuid, boolean) is
  'Motor único (ADR-01): recursão de preparos, detecção de ciclo (profundidade 6 = produto + 5 níveis), normalização de massa via fn_normalizar_para_nutricao. p_loja_id é reservado para futura checagem de escopo — a leitura já é filtrada pela RLS do chamador.';

revoke execute on function public.fn_calcular_nutricao_receita(jsonb, uuid, boolean) from public;
grant  execute on function public.fn_calcular_nutricao_receita(jsonb, uuid, boolean) to authenticated;

-- ── 4. Os dois usos do motor (NUT-05 canônico + NUT-06 preview) ─────────────

create or replace function public.fn_recalcular_nutricao_produto(p_produto_id uuid)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_loja_id uuid;
  v_linhas  jsonb;
begin
  select loja_id into v_loja_id from public.produtos where id = p_produto_id;
  if not found then
    raise exception 'Produto % não encontrado.', p_produto_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('insumo_id', ft.insumo_id, 'quantidade', ft.quantidade_consumida)), '[]'::jsonb)
    into v_linhas
  from public.fichas_tecnicas ft
  where ft.produto_id = p_produto_id;

  -- Canônico: só dado revisado publica (ADR-02).
  return public.fn_calcular_nutricao_receita(v_linhas, v_loja_id, false);
end;
$$;

comment on function public.fn_recalcular_nutricao_produto(uuid) is
  'NUT-05. Lê a ficha técnica salva do produto e chama o motor único. Em S4 (NUT-18), o resultado passa a ser gravado em produtos_nutricao_cache por trigger — aqui ainda só retorna.';

revoke execute on function public.fn_recalcular_nutricao_produto(uuid) from public;
grant  execute on function public.fn_recalcular_nutricao_produto(uuid) to authenticated;

create or replace function public.fn_simular_nutricao(p_linhas jsonb, p_loja_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  -- Preview de receita ainda não salva (NUT-06): mesmo motor, mas lenient —
  -- inclui dado ainda não revisado para o lojista ver progresso ao vivo
  -- enquanto monta a ficha. ADR-02 (nada não-revisado publica) vale para o
  -- cache do cardápio, não para esta prévia de trabalho.
  select public.fn_calcular_nutricao_receita(p_linhas, p_loja_id, true);
$$;

comment on function public.fn_simular_nutricao(jsonb, uuid) is
  'NUT-06. Preview ao vivo no editor de ficha, sem salvar nada. Mesma implementação de fn_recalcular_nutricao_produto (ADR-01), modo lenient.';

revoke execute on function public.fn_simular_nutricao(jsonb, uuid) from public;
grant  execute on function public.fn_simular_nutricao(jsonb, uuid) to authenticated;

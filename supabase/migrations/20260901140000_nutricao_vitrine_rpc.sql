-- ============================================================================
-- NUTRIÇÃO — O QUE A VITRINE LÊ (Onda V, Fatia 4, lado do banco)
-- ============================================================================
-- docs/PLANO-NUTRICIONAL-VITRINE.md §3.1 e §4 Fatia 4.
--
-- Duas RPCs, ambas lidas por `anon` (o cliente não tem login) e ambas servidas
-- por cache — a vitrine nunca recalcula (R-06 do plano-mãe).
--
--   fn_nutricao_cardapio  → um registro por produto que tem algo a dizer.
--   fn_nutricao_opcoes    → nutrição de cada adicional e de cada item de combo,
--                           para a tabela reagir ao que o cliente escolhe.
--
-- Regra de publicação (§3.1): número só sai com o prato fechado; alérgeno sai
-- sempre que houver, mesmo em prato incompleto — é o dado de quem tem
-- restrição, e escondê-lo por causa de uma caloria faltante seria absurdo.
-- ============================================================================

drop function if exists public.fn_nutricao_cardapio(uuid);

create or replace function public.fn_nutricao_cardapio(p_loja_id uuid)
returns table (
  produto_id            uuid,
  publicavel            boolean,
  status                text,
  parcial               boolean,
  por_porcao            jsonb,
  por_100g              jsonb,
  peso_porcao_g         numeric,
  porcoes               numeric,
  massa_servida_g       numeric,
  cobertura_pct         numeric,
  itens_total           integer,
  itens_com_dado        integer,
  alergenos_contem      text[],
  alergenos_pode_conter text[],
  atributos             text[],
  composicao_fontes     jsonb,
  atualizado_em         timestamptz
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with cfg as (
    select l.id,
           coalesce(l.nutricao_ativo, true)           as ativo,
           coalesce(l.nutricao_exibicao, 'COMPLETA')  as exibicao,
           coalesce(l.nutricao_selos_atributo, true)  as selos
    from public.lojas l where l.id = p_loja_id
  )
  select
    c.produto_id,
    -- SO_ALERGENOS nunca publica número; PARCIAL_COM_AVISO publica também o
    -- prato incompleto, desde que ele tenha algum valor calculado.
    case cfg.exibicao
      when 'SO_ALERGENOS'      then false
      when 'PARCIAL_COM_AVISO' then (c.publicavel or (c.por_porcao <> '{}'::jsonb and c.status <> 'SEM_DADOS'))
      else c.publicavel
    end,
    c.status,
    (c.status = 'PARCIAL'),
    c.por_porcao, c.por_100g, c.peso_porcao_g, c.porcoes, c.massa_servida_g,
    c.cobertura_pct, c.itens_total, c.itens_com_dado,
    c.alergenos_contem, c.alergenos_pode_conter,
    case when cfg.selos then c.atributos else '{}'::text[] end,
    c.composicao_fontes,
    c.atualizado_em
  from public.produtos_nutricao_cache c
  join public.produtos p on p.id = c.produto_id and p.disponivel
  cross join cfg
  where c.loja_id = p_loja_id
    and cfg.ativo
    -- Só entra quem tem alguma coisa a dizer: número publicável, ou alérgeno
    -- declarado, ou valores parciais quando a loja optou por mostrá-los.
    and (
      c.publicavel
      or cardinality(c.alergenos_contem) > 0
      or cardinality(c.alergenos_pode_conter) > 0
      or (cfg.exibicao = 'PARCIAL_COM_AVISO' and c.por_porcao <> '{}'::jsonb)
    );
$$;

comment on function public.fn_nutricao_cardapio(uuid) is
  'Nutricao publicavel do cardapio, lida do cache e filtrada pela configuracao de exibicao da loja. Ver PLANO-NUTRICIONAL-VITRINE 3.1.';

revoke all on function public.fn_nutricao_cardapio(uuid) from public;
grant execute on function public.fn_nutricao_cardapio(uuid) to anon, authenticated;

-- ── Adicionais e itens de combo ─────────────────────────────────────────────
--
-- `opcoes` já carrega insumo_id e quantidade_insumo (usados na baixa de
-- estoque). O mesmo par serve à nutrição sem cadastro novo: escolher "Bacon
-- extra" ou trocar a bebida do combo passa a mexer na tabela que o cliente vê.
-- São poucas opções por loja e o motor é STABLE — medido em produção antes de
-- decidir por não cachear.

create or replace function public.fn_nutricao_opcoes_cardapio(p_loja_id uuid)
returns table (
  opcao_id              uuid,
  produto_id            uuid,
  nutrientes            jsonb,
  massa_g               numeric,
  completo              boolean,
  alergenos_contem      text[],
  alergenos_pode_conter text[]
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select
    o.id,
    g.produto_id,
    coalesce(n->'nutrientes', '{}'::jsonb),
    coalesce((n->>'massa_g')::numeric, 0),
    (n->>'status') = 'COMPLETO',
    coalesce(array(select jsonb_array_elements_text(n->'alergenos_contem')), '{}'),
    coalesce(array(select jsonb_array_elements_text(n->'alergenos_pode_conter')), '{}')
  from public.opcoes o
  join public.grupos_opcoes g on g.id = o.grupo_id
  join public.produtos p on p.id = g.produto_id
  cross join lateral public.fn_calcular_nutricao_receita(
    jsonb_build_array(jsonb_build_object(
      'insumo_id', o.insumo_id,
      'quantidade', coalesce(o.quantidade_insumo, 1)
    )),
    p.loja_id,
    false
  ) as n
  where p.loja_id = p_loja_id
    and p.disponivel
    and o.disponivel
    and o.insumo_id is not null
    and coalesce((select nutricao_ativo from public.lojas where id = p_loja_id), true);
$$;

comment on function public.fn_nutricao_opcoes_cardapio(uuid) is
  'Nutricao de cada adicional/item de combo, para a tabela do produto reagir a escolha do cliente. Usa opcoes.insumo_id, que ja existia para a baixa de estoque.';

revoke all on function public.fn_nutricao_opcoes_cardapio(uuid) from public;
grant execute on function public.fn_nutricao_opcoes_cardapio(uuid) to anon, authenticated;

-- ── Painel de cobertura do admin (Fatia 3) ──────────────────────────────────
--
-- A lacuna vira tarefa: qual prato, o que falta, e o que se ganha ao resolver.

create or replace view public.vw_nutricao_cobertura as
select
  p.loja_id,
  p.id            as produto_id,
  p.nome          as produto,
  p.disponivel,
  coalesce(c.status, 'SEM_DADOS')  as status,
  coalesce(c.publicavel, false)    as publicavel,
  coalesce(c.itens_total, 0)       as itens_total,
  coalesce(c.itens_com_dado, 0)    as itens_com_dado,
  coalesce(c.cobertura_pct, 0)     as cobertura_pct,
  coalesce(c.massa_servida_g, 0)   as massa_servida_g,
  c.peso_porcao_g,
  coalesce(c.alergenos_contem, '{}')   as alergenos_contem,
  coalesce(c.atributos, '{}')          as atributos,
  coalesce(c.alertas, '[]'::jsonb)     as alertas,
  coalesce(c.faltantes_detalhe, '[]'::jsonb) as faltantes,
  (c.produto_id is null)               as nunca_calculado,
  c.atualizado_em
from public.produtos p
left join public.produtos_nutricao_cache c on c.produto_id = p.id;

comment on view public.vw_nutricao_cobertura is
  'Semaforo de nutricao por prato para o admin. RLS herdada de produtos (security_invoker).';

alter view public.vw_nutricao_cobertura set (security_invoker = on);

grant select on public.vw_nutricao_cobertura to authenticated;

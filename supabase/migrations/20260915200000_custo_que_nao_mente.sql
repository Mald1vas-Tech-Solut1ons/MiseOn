-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ O custo para de mentir: ou ele é confiável, ou ele se declara incerto.   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- ACHADO (15/09/2026, medido em produção)
--
-- `vw_margem_produto_real` estava publicando número absurdo como se fosse fato:
--
--   BATATA FRITA            preço R$ 18,00   custo R$ 87,68   margem  -387%
--   BATATA CHEDDAR E BACON  preço R$ 26,00   custo R$ 91,26   margem  -251%
--   COCA-COLA / ÁGUA        preço R$  7,00   custo R$  0,00   margem   100%
--
-- A matemática da view estava CERTA. O defeito é o dado de entrada:
--
--   Oleo de Soja Liza · unidade_medida = 'ml' · qtd_embalagem = 1 · R$ 6,89
--
-- O sistema lê "a embalagem tem 1 ml e custa R$ 6,89" e conclui R$ 6,89 POR ML.
-- A ficha usa 12 ml, então a batata "custa" R$ 82,68. Na vida real é uma
-- garrafa de 900 ml: R$ 0,0077/ml, ou R$ 0,09 na porção.
--
-- Não é um caso isolado. Varredura em todas as lojas: **76 insumos** medidos em
-- g/ml com `qtd_embalagem` menor que 50. Nada no banco impedia — não há CHECK
-- nem default que relacione a unidade com o tamanho da embalagem.
--
-- São dois estragos opostos, e os dois destroem a confiança:
--   • com preço → custo estoura e a margem fica negativa sem sentido;
--   • sem preço → custo zero e a margem aparece como 100%.
--
-- POR QUE ISSO É O DEFEITO MAIS CARO DO PRODUTO
--
-- Custo e margem reais são A diferenciação anunciada do MiseOn. Uma tela que
-- mostra -387% não é um arredondamento errado: é a prova, para o dono do
-- restaurante, de que o sistema não entende a cozinha dele. O dono que pesa
-- 50 g de alho a mais — o do vídeo de delivery — fecha a tela e não volta.
--
-- DECISÃO
--
-- O sistema não vai adivinhar o tamanho da embalagem: inventar "900 ml" seria
-- trocar um número errado por um chute. Ele passa a fazer três coisas:
--
--   1. SABER quando o custo não é confiável, por regra explícita.
--   2. CALAR a margem nesse caso, em vez de publicar -387% como fato.
--   3. MOSTRAR ao lojista exatamente qual insumo corrigir e por quê.
--
-- Custo desconhecido some do cálculo declarando-se desconhecido. Custo
-- impossível idem. É o mesmo princípio já adotado na nutrição: cobertura
-- parcial se declara parcial em vez de fingir 100%.

-- ── 1. O custo de um insumo, com veredito sobre a própria confiança ─────────
create or replace function public.fn_custo_unitario_insumo(p_insumo_id uuid)
returns table(custo numeric, confiavel boolean, motivo text)
language plpgsql stable security definer set search_path to ''
as $$
declare
  v_ins    record;
  v_lote   numeric;
  v_custo  numeric;
  v_frac   boolean;   -- unidade fracionária: g, ml, kg, l
  v_pequena boolean;  -- g/ml: unidades em que a embalagem é sempre grande
begin
  select i.unidade_medida, i.preco_embalagem, i.qtd_embalagem, i.loja_id
    into v_ins
  from public.insumos i where i.id = p_insumo_id;
  if not found then
    return query select null::numeric, false, 'insumo não encontrado'; return;
  end if;

  -- Custo do lote mais antigo com saldo (PEPS) vence o preço de embalagem.
  select l.custo_unitario into v_lote
  from public.lotes_estoque l
  where l.insumo_id = p_insumo_id and l.loja_id = v_ins.loja_id
    and l.quantidade_restante > 0
  order by l.criado_em, l.id limit 1;

  v_custo := coalesce(v_lote, v_ins.preco_embalagem / nullif(v_ins.qtd_embalagem, 0));

  v_frac := lower(coalesce(v_ins.unidade_medida,'')) in ('g','ml','kg','l');
  v_pequena := lower(coalesce(v_ins.unidade_medida,'')) in ('g','ml');

  if v_custo is null or v_custo <= 0 then
    return query select null::numeric, false,
      'sem custo cadastrado: informe o preço e o tamanho da embalagem'; return;
  end if;

  -- A checagem de embalagem só vale quando o custo VEIO da embalagem. Preparo
  -- produzido na casa tem custo vindo do lote (PEPS) e `qtd_embalagem` não
  -- significa nada nele — julgar pelo tamanho da embalagem transformaria todo
  -- molho da casa em suspeito sem motivo.
  if v_lote is null and v_pequena and coalesce(v_ins.qtd_embalagem, 0) < 50 then
    return query select v_custo, false,
      format('embalagem declarada com %s %s: confira o tamanho real (ex.: 900 para uma garrafa de 900 ml)',
             trim(to_char(v_ins.qtd_embalagem,'FM999999990.####')), v_ins.unidade_medida);
    return;
  end if;

  -- Venha da embalagem ou do lote, R$ 1,00 por grama é R$ 1.000,00 o quilo.
  -- Existe (açafrão), mas é raro o bastante para conferir antes de virar custo.
  if v_pequena and v_custo > 1 then
    return query select v_custo, false,
      format('custo de R$ %s por %s (R$ %s por %s) está fora da faixa usual: confira a embalagem',
             trim(to_char(v_custo,'FM999990.0000')), v_ins.unidade_medida,
             trim(to_char(v_custo*1000,'FM999999990.00')),
             case when lower(v_ins.unidade_medida)='g' then 'kg' else 'l' end);
    return;
  end if;

  return query select v_custo, true, null::text;
end $$;

comment on function public.fn_custo_unitario_insumo(uuid) is
  'Custo por unidade de estoque do insumo (lote PEPS, senão preço/embalagem), '
  'acompanhado do veredito de confiança. Quem consome deve respeitar o '
  'confiavel=false em vez de publicar o número.';

-- ── 2. A lista de trabalho do lojista ───────────────────────────────────────
create or replace view public.vw_insumos_custo_suspeito as
select i.loja_id, i.id as insumo_id, i.nome as insumo,
       i.unidade_medida, i.qtd_embalagem, i.preco_embalagem,
       c.custo as custo_por_unidade, c.motivo,
       (select count(*) from public.fichas_tecnicas f where f.insumo_id = i.id) as fichas_afetadas
from public.insumos i
cross join lateral public.fn_custo_unitario_insumo(i.id) c
where i.ativo and not c.confiavel
order by (select count(*) from public.fichas_tecnicas f where f.insumo_id = i.id) desc, i.nome;

comment on view public.vw_insumos_custo_suspeito is
  'Insumos cujo custo o sistema não assina embaixo. Ordenado por quantas fichas '
  'técnicas cada um contamina — corrigir do topo para baixo é o caminho curto.';

-- ── 3. A margem passa a se declarar incerta em vez de inventar ──────────────
-- DROP antes do CREATE: a view antiga tinha `custo_fixo` como bigint (era um
-- `sum(0)` literal) e CREATE OR REPLACE não muda o tipo de uma coluna.
drop view if exists public.vw_margem_produto_real;
create view public.vw_margem_produto_real as
with custo as (
  select ft.produto_id,
         sum(ft.quantidade_consumida * coalesce(c.custo, 0)) as custo_insumos,
         bool_and(c.confiavel)                               as custo_confiavel,
         count(*) filter (where not c.confiavel)             as insumos_incertos,
         min(c.motivo) filter (where not c.confiavel)        as primeiro_motivo
  from public.fichas_tecnicas ft
  cross join lateral public.fn_custo_unitario_insumo(ft.insumo_id) c
  group by ft.produto_id
)
select p.loja_id,
       p.id   as produto_id,
       p.nome as produto,
       p.preco as preco_venda,
       cu.custo_insumos,
       0::numeric as custo_fixo,      -- rateio de custo fixo ainda não entra aqui
       cu.custo_insumos as custo_total,
       -- Sem ficha técnica o produto não tem custo conhecido: é revenda ou
       -- cadastro incompleto. Antes isso virava "margem 100%".
       coalesce(cu.custo_confiavel, false) as custo_confiavel,
       case when cu.produto_id is null then 'produto sem ficha técnica: o custo não é zero, é desconhecido'
            else cu.primeiro_motivo end as motivo_incerteza,
       coalesce(cu.insumos_incertos, 0) as insumos_incertos,
       case when cu.custo_confiavel then p.preco - cu.custo_insumos end as margem_bruta,
       case when cu.custo_confiavel and p.preco > 0
            then round(100 * (p.preco - cu.custo_insumos) / p.preco, 2) end as margem_pct,
       case when cu.custo_confiavel and p.preco > 0
            then (100 * (p.preco - cu.custo_insumos) / p.preco) < 20
            else false end as alerta_margem_baixa,
       p.disponivel, p.controla_estoque
from public.produtos p
left join custo cu on cu.produto_id = p.id
order by p.loja_id, (case when cu.custo_confiavel and p.preco > 0
                          then round(100 * (p.preco - cu.custo_insumos) / p.preco, 2) end) nulls last;

comment on view public.vw_margem_produto_real is
  'Margem por produto. margem_pct vem NULA quando o custo não é confiável — a '
  'tela deve mostrar o motivo_incerteza, nunca um percentual inventado. Ver '
  'vw_insumos_custo_suspeito para a lista do que corrigir.';

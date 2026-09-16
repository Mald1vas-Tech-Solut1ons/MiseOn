-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ O custo fixo entra no prato — e a margem para de ser pública.            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- "A conta de água de R$ 6.500 por mês entra no custo da salada." Entra mesmo.
-- Mas ao ir medir onde ela deveria entrar, apareceram três defeitos maiores
-- que a lacuna que eu tinha vindo fechar.
--
--
-- DEFEITO 1 · A TELA DE MARGEM NÃO USA O MOTOR DE CUSTO
--
-- O laudo de 15/09 diz que a margem parou de publicar número impossível. Isso
-- foi verdade para `vw_margem_produto_real` — que NENHUMA tela lê.
--
-- A tela que o lojista abre é Financeiro › Margens, e ela lê
-- `vw_custo_produto`, que ficou como estava: soma
-- `preco_embalagem / qtd_embalagem` direto do insumo, sem passar por
-- `fn_custo_unitario_insumo`. Ou seja: sem veredito de confiança e, pior, sem
-- descer na ficha do preparo.
--
-- Medido hoje, Lanche do Paulista, as duas views lado a lado:
--
--   produto                 custo na tela   custo real   margem tela   real
--   X-BACON                      6,12        14,35         78,9%      50,5%
--   SMASH DUPLO                  4,22        11,54         87,6%      66,1%
--   SMASH FIT DE PATINHO         3,97        11,22         89,2%      69,6%
--   X-PAULISTA                   4,52        13,24         85,9%      58,6%
--   X-SALADA                     4,10        12,20         84,2%      53,1%
--   COMBO X-BACON                8,67        16,90         79,4%      59,8%
--
-- Vinte e oito pontos de margem no X-Bacon. O hambúrguer inteiro — a carne do
-- smash, que é preparo da casa — não estava no custo, porque a view parava no
-- primeiro nível da ficha. E os cinco produtos sem ficha (Coca-Cola, água,
-- bombom, misto quente) apareciam com margem 100%, que é a mesma mentira que
-- o laudo diz ter matado de manhã: custo desconhecido não é custo zero.
--
-- Não adiantava acrescentar custo fixo a esse número. Seria lapidar um erro.
-- `vw_custo_produto` passa a ser construída sobre o mesmo motor da outra, e as
-- duas views param de contar histórias diferentes sobre o mesmo prato.
--
--
-- DEFEITO 2 · QUALQUER PESSOA DA INTERNET LIA A MARGEM DE TODAS AS LOJAS
--
-- Executado contra a produção com a chave anônima publicada no bundle:
--
--   GET /rest/v1/vw_custo_produto?select=nome,custo_insumos,margem_pct
--   → 200 · 121 linhas · 8 lojas distintas
--
-- Custo por prato, rateio de custo fixo e margem de todas as lojas, incluindo
-- a Natureba, que é o cadastro preparado para a visita comercial.
-- `configuracoes_custo` está protegida e devolve vazio para o anônimo — mas a
-- view servia o mesmo dado lavado numa coluna calculada.
--
-- Não era RLS frouxa: a política `pub_produtos` libera SELECT de produto
-- disponível para todo mundo, e está certa — é o cardápio público. O erro foi
-- pendurar custo e margem em cima de uma tabela que é pública de propósito.
-- Por isso `security_invoker` sozinho não resolveria, e nem resolve entre dois
-- lojistas: `pub_produtos` deixaria o dono da loja A ler a margem da loja B.
--
-- As duas views passam a carregar o próprio predicado de acesso
-- (`fn_meu_acesso`) e o SELECT sai do `anon` — por REVOKE explícito, porque
-- este projeto tem DEFAULT PRIVILEGES que dão ALL ao `anon` em toda view nova
-- de `public`. Criar view aqui é publicá-la, a menos que se tire na mão.
--
--
-- DEFEITO 3 · O RATEIO QUE EXISTIA COBRAVA O MESMO DA COCA E DO COMBO
--
-- `taxa_rateio` era `custo fixo mensal / expectativa_vendas_mes`: no Lanche do
-- Paulista, R$ 7.000 / 1.200 = R$ 5,83 por produto, iguais para todos. Duas
-- coisas quebram nisso:
--
--   • Um refrigerante de R$ 6,00 absorvia R$ 5,83 de aluguel, e um combo de
--     R$ 42,00 absorvia os mesmos R$ 5,83. Ninguém tira a Coca do cardápio
--     por causa do aluguel.
--   • `expectativa_vendas_mes` conta PEDIDOS, mas a cobrança era por PRODUTO.
--     Um pedido com três itens sacava três vezes do mesmo caixa. O rateio não
--     fechava com o custo que ele dizia estar ratear.
--
-- Entra o rateio proporcional à receita, que é o que a contabilidade de food
-- service faz e a única alocação que FECHA: se cada prato absorve
-- `preço × (custo fixo ÷ faturamento)`, a soma sobre as vendas do mês devolve
-- exatamente o custo fixo do mês, qualquer que seja o mix vendido.
--
-- DE ONDE SAI O FATURAMENTO, EM ORDEM DE CONFIANÇA
--
--   VENDA_MEDIDA  o que a loja faturou nos últimos 30 dias, normalizado para
--                 o mês. Exige amostra: 30 pedidos FINALIZADO e 14 dias de
--                 janela. Abaixo disso não é taxa mensal, é um punhado de
--                 pedidos.
--   EXPECTATIVA   expectativa_vendas_mes × ticket médio medido da loja. Usa o
--                 número que o lojista declarou, com o ticket que a operação
--                 mostrou. Exige 10 pedidos para o ticket significar algo.
--   (nenhuma)     NULL com o motivo. Loja sem venda nenhuma não tem por onde
--                 ratear custo fixo por prato, e dizer isso é melhor que
--                 inventar um divisor.
--
-- Os cortes de amostra (30 pedidos / 14 dias / 10 pedidos) são julgamento, não
-- medição — estão escritos aqui para poderem ser discutidos, não para passarem
-- por achado.
--
-- O TETO QUE IMPEDE A PRÓXIMA BATATA DE R$ 87,68
--
-- O tenant de provas tem R$ 7.000 de custo fixo declarado e R$ 921,28 de
-- faturamento em dois meses. Rateio proporcional puro daria mais de 1.500% de
-- custo fixo sobre a venda e jogaria TODO prato para prejuízo — número
-- aritmeticamente correto e completamente inútil, porque o defeito está na
-- base de vendas, não nos pratos.
--
-- Custo fixo acima do faturamento não é uma alocação, é um aviso. Acima de
-- 100% a função devolve NULL com os dois números na mão, para o lojista ver
-- qual dos dois está errado. Abaixo disso, ela responde.

begin;

-- ── 1. O rateio ───────────────────────────────────────────────────────────

create or replace function public.fn_rateio_custo_fixo(p_loja_id uuid)
returns table(
  fracao             numeric,   -- quanto de cada R$ 1,00 vendido é custo fixo
  base               text,      -- VENDA_MEDIDA · EXPECTATIVA · SEM_BASE
  fixo_mensal        numeric,
  faturamento_mensal numeric,
  confiavel          boolean,
  motivo             text
)
language plpgsql
stable
security definer
set search_path to ''
as $fn$
declare
  v_fixo numeric; v_exp int;
  v_fat30 numeric; v_n30 int; v_dias int;
  v_ticket numeric; v_n_tot int;
  v_fat numeric; v_base text;
begin
  -- Guarda de tenant. SECURITY DEFINER roda como dono e ignora RLS; com a loja
  -- vindo por parâmetro, sem esta linha qualquer chamador lê o aluguel e o
  -- faturamento de qualquer loja trocando o uuid. Medido: o `anon` TINHA
  -- EXECUTE nesta função por DEFAULT PRIVILEGE, então o "qualquer chamador"
  -- incluía visitante anônimo com a chave publicada no bundle.
  if not public.fn_meu_acesso(p_loja_id) then
    return;
  end if;

  select coalesce(cc.custo_aluguel,0) + coalesce(cc.custo_energia,0)
       + coalesce(cc.custo_agua,0)    + coalesce(cc.custo_internet,0)
       + coalesce(cc.custo_gas,0)     + coalesce(cc.outros_custos_fixos,0),
         coalesce(cc.expectativa_vendas_mes, 0)
    into v_fixo, v_exp
  from public.configuracoes_custo cc where cc.loja_id = p_loja_id;

  -- Linha ausente ou toda zerada é o padrão de quem nunca preencheu. Zero de
  -- custo fixo não é uma loja sem aluguel, é uma loja que não contou o dela.
  if coalesce(v_fixo, 0) = 0 then
    return query select null::numeric, 'SEM_BASE'::text, coalesce(v_fixo, 0),
      null::numeric, false,
      'custo fixo não preenchido: aluguel, energia, água e o resto ficam em Financeiro › Custos Fixos'::text;
    return;
  end if;

  -- Base 1: o que a loja faturou de verdade.
  select coalesce(sum(p.valor_total), 0), count(*),
         coalesce(greatest(extract(day from now() - min(p.criado_em))::int, 1), 0)
    into v_fat30, v_n30, v_dias
  from public.pedidos p
  where p.loja_id = p_loja_id and p.status = 'FINALIZADO'
    and p.criado_em >= now() - interval '30 days';

  if v_n30 >= 30 and v_dias >= 14 then
    v_fat  := v_fat30 * 30.0 / v_dias;     -- vira taxa mensal
    v_base := 'VENDA_MEDIDA';
  else
    -- Base 2: a expectativa do lojista, com o ticket que a operação mostrou.
    select avg(p.valor_total), count(*) into v_ticket, v_n_tot
    from public.pedidos p
    where p.loja_id = p_loja_id and p.status = 'FINALIZADO';

    if v_exp > 0 and v_n_tot >= 10 and coalesce(v_ticket, 0) > 0 then
      v_fat  := v_exp * v_ticket;
      v_base := 'EXPECTATIVA';
    else
      return query select null::numeric, 'SEM_BASE'::text, v_fixo, null::numeric, false,
        format('sem venda suficiente para ratear R$ %s de custo fixo por prato: %s pedido(s) finalizado(s) na loja',
               to_char(v_fixo, 'FM999G999D00'), coalesce(v_n_tot, 0))::text;
      return;
    end if;
  end if;

  if coalesce(v_fat, 0) <= 0 then
    return query select null::numeric, 'SEM_BASE'::text, v_fixo, v_fat, false,
      'faturamento apurado em zero: não há por onde dividir o custo fixo'::text;
    return;
  end if;

  -- O teto. Acima dele a conta fecha matematicamente e mente na prática.
  if v_fixo > v_fat then
    return query select null::numeric, v_base, v_fixo, v_fat, false,
      format('custo fixo (R$ %s/mês) maior que o faturamento apurado (R$ %s/mês): confira os dois antes de ratear',
             to_char(v_fixo, 'FM999G999D00'), to_char(v_fat, 'FM999G999D00'))::text;
    return;
  end if;

  return query select round(v_fixo / v_fat, 6), v_base, v_fixo, round(v_fat, 2), true, null::text;
end;
$fn$;

comment on function public.fn_rateio_custo_fixo(uuid) is
  'Quanto de cada real vendido é custo fixo, com a base declarada. Devolve NULL com motivo em vez de um divisor inventado.';

-- `from public` NÃO basta: este projeto tem DEFAULT PRIVILEGES que dão EXECUTE
-- ao `anon` DIRETAMENTE (pg_default_acl, defaclobjtype='f'), não por herança
-- de PUBLIC. Revogar de PUBLIC deixa a linha `anon=X/postgres` intacta. É o
-- espelho da armadilha já anotada no CLAUDE.md, e precisa dos dois revokes.
revoke all on function public.fn_rateio_custo_fixo(uuid) from public;
revoke all on function public.fn_rateio_custo_fixo(uuid) from anon;
grant execute on function public.fn_rateio_custo_fixo(uuid) to authenticated, service_role;

-- ── 2. A tela do lojista: vw_custo_produto ────────────────────────────────
--
-- Os nomes de coluna que a tela já lê são preservados (produto_id, nome,
-- preco_venda, custo_insumos, taxa_rateio, lucro_bruto, lucro_liquido,
-- margem_pct). O que muda é a origem dos números e o fato de virem NULOS
-- quando não se sabe. As colunas novas dizem por quê.

drop view if exists public.vw_custo_produto;

create view public.vw_custo_produto
with (security_invoker = true)
as
with rateio as (
  select l.id as loja_id, r.fracao, r.base, r.confiavel as rateio_ok, r.motivo as rateio_motivo
  from public.lojas l
  cross join lateral public.fn_rateio_custo_fixo(l.id) r
),
custo as (
  select ft.produto_id,
         sum(ft.quantidade_consumida * coalesce(c.custo, 0)) as custo_insumos,
         bool_and(c.confiavel)                               as custo_confiavel,
         min(c.motivo) filter (where not c.confiavel)        as primeiro_motivo
  from public.fichas_tecnicas ft
  cross join lateral public.fn_custo_unitario_insumo(ft.insumo_id) c(custo, confiavel, motivo)
  group by ft.produto_id
)
select
  p.id       as produto_id,
  p.loja_id,
  p.nome,
  p.preco    as preco_venda,

  case when cu.custo_confiavel then cu.custo_insumos end as custo_insumos,

  -- Rateio proporcional ao preço: o combo carrega mais aluguel que a lata.
  case when r.rateio_ok then round(p.preco * r.fracao, 2) end as taxa_rateio,

  case when cu.custo_confiavel then p.preco - cu.custo_insumos end as lucro_bruto,

  case when cu.custo_confiavel and r.rateio_ok
       then p.preco - cu.custo_insumos - round(p.preco * r.fracao, 2) end as lucro_liquido,

  -- Margem sobre o líquido quando há rateio, sobre o bruto quando não há: o
  -- número e o rótulo "após rateio" da tela nunca se descolam.
  case
    when not cu.custo_confiavel or cu.produto_id is null or p.preco <= 0 then null
    when r.rateio_ok then round(100 * (p.preco - cu.custo_insumos - round(p.preco * r.fracao, 2)) / p.preco, 1)
    else round(100 * (p.preco - cu.custo_insumos) / p.preco, 1)
  end as margem_pct,

  coalesce(cu.custo_confiavel, false) as custo_confiavel,
  case
    when cu.produto_id is null then 'produto sem ficha técnica: o custo não é zero, é desconhecido'
    else cu.primeiro_motivo
  end as motivo_incerteza,
  coalesce(r.rateio_ok, false) as rateio_confiavel,
  r.base                       as rateio_base,
  r.rateio_motivo
from public.produtos p
left join custo  cu on cu.produto_id = p.id
left join rateio r  on r.loja_id     = p.loja_id
-- O predicado de acesso mora AQUI, não na RLS de produtos: aquela é a do
-- cardápio público e libera o produto disponível para o mundo, de propósito.
where public.fn_meu_acesso(p.loja_id);

comment on view public.vw_custo_produto is
  'Custo, rateio de custo fixo e margem por produto. Só para quem tem acesso à loja: o cardápio é público, o custo não.';

-- REVOKE explícito, e não só a ausência de GRANT: o projeto tem DEFAULT
-- PRIVILEGES dando ALL em toda tabela/view nova de `public` para `anon`
-- (pg_default_acl, dono postgres). Toda view criada aqui nasce pública sem
-- ninguém pedir. Conceder ao `authenticated` não desfaz isso — é preciso
-- tirar do `anon` na mão, toda vez.
revoke all on public.vw_custo_produto from anon;
grant select on public.vw_custo_produto to authenticated, service_role;

-- ── 3. vw_margem_produto_real ─────────────────────────────────────────────

drop view if exists public.vw_margem_produto_real;

create view public.vw_margem_produto_real
with (security_invoker = true)
as
with rateio as (
  select l.id as loja_id, r.fracao, r.base, r.confiavel as rateio_ok, r.motivo as rateio_motivo
  from public.lojas l
  cross join lateral public.fn_rateio_custo_fixo(l.id) r
),
custo as (
  select ft.produto_id,
         sum(ft.quantidade_consumida * coalesce(c.custo, 0))  as custo_insumos,
         bool_and(c.confiavel)                                as custo_confiavel,
         count(*) filter (where not c.confiavel)              as insumos_incertos,
         min(c.motivo) filter (where not c.confiavel)         as primeiro_motivo
  from public.fichas_tecnicas ft
  cross join lateral public.fn_custo_unitario_insumo(ft.insumo_id) c(custo, confiavel, motivo)
  group by ft.produto_id
)
select
  p.loja_id,
  p.id    as produto_id,
  p.nome  as produto,
  p.preco as preco_venda,
  cu.custo_insumos,
  case when r.rateio_ok then round(p.preco * r.fracao, 2) end as custo_fixo,
  case when r.rateio_ok then cu.custo_insumos + round(p.preco * r.fracao, 2)
       else cu.custo_insumos end as custo_total,
  coalesce(cu.custo_confiavel, false) as custo_confiavel,
  case
    when cu.produto_id is null then 'produto sem ficha técnica: o custo não é zero, é desconhecido'
    else cu.primeiro_motivo
  end as motivo_incerteza,
  coalesce(cu.insumos_incertos, 0) as insumos_incertos,
  coalesce(r.rateio_ok, false)     as rateio_confiavel,
  r.base                           as rateio_base,
  r.rateio_motivo,
  case when cu.custo_confiavel
       then p.preco - cu.custo_insumos
            - case when r.rateio_ok then round(p.preco * r.fracao, 2) else 0 end end as margem_bruta,
  case when cu.custo_confiavel and p.preco > 0
       then round(100 * (p.preco - cu.custo_insumos
            - case when r.rateio_ok then round(p.preco * r.fracao, 2) else 0 end) / p.preco, 2) end as margem_pct,
  case when cu.custo_confiavel and p.preco > 0
       then (100 * (p.preco - cu.custo_insumos
            - case when r.rateio_ok then round(p.preco * r.fracao, 2) else 0 end) / p.preco) < 20
       else false end as alerta_margem_baixa,
  p.disponivel,
  p.controla_estoque
from public.produtos p
left join custo  cu on cu.produto_id = p.id
left join rateio r  on r.loja_id     = p.loja_id
where public.fn_meu_acesso(p.loja_id);

comment on view public.vw_margem_produto_real is
  'Margem por produto com custo fixo rateado. Só para quem tem acesso à loja.';

revoke all on public.vw_margem_produto_real from anon;
grant select on public.vw_margem_produto_real to authenticated, service_role;

commit;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Mix de vendas por faixa de horário.                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- "O lanchinho da tarde me dá 12% do faturamento."
--
-- É uma frase de decisão de cardápio, não de curiosidade: quem sabe disso põe
-- gente e produto na tarde, e quem não sabe corta a tarde achando que é buraco
-- morto. O sistema não tinha como responder — nenhum relatório quebrava venda
-- por hora do dia.
--
-- Medido antes de escrever: nenhuma view em `public` agrupa pedido por hora.
--
--   select table_name from information_schema.views
--   where table_schema='public' and table_name ilike '%hora%';  → vazio
--
-- AS FAIXAS
--
-- Não são horas cheias: ninguém decide cardápio olhando 24 barras. São os
-- turnos que a cozinha já reconhece, e a fronteira de cada um é a troca de
-- serviço, não o relógio redondo:
--
--   MADRUGADA   00h–05h   pós-balada, delivery de madrugada
--   MANHA       05h–11h   café, pão na chapa
--   ALMOCO      11h–14h   o pico do por quilo e do PF
--   TARDE       14h–18h   o "lanchinho da tarde" do vídeo
--   JANTAR      18h–23h   o pico do delivery
--   FECHAMENTO  23h–00h   a última hora antes de fechar
--
-- A HORA É A DA LOJA
--
-- O banco roda em UTC (`select current_setting('TimeZone')` → UTC). Agrupar
-- por hora sem converter joga o almoço de São Paulo para as 15h e o relatório
-- inteiro mente em três horas. Mesma conversão de `fn_loja_aberta` e de
-- `fn_cupom_na_janela`.
--
-- O QUE CONTA COMO VENDA
--
-- Só `FINALIZADO`. Pedido cancelado não é faturamento, e pedido em andamento
-- ainda não é. É a mesma régua que `fn_rateio_custo_fixo` usa para apurar
-- faturamento — as duas respostas têm de fechar entre si.
--
-- E A HORA DE QUAL MOMENTO
--
-- `criado_em`: a hora em que o cliente pediu, que é a hora que descreve a
-- demanda. A hora em que a cozinha entregou descreve a operação, e é outra
-- pergunta. Desde 20260916120000 `criado_em` é gravado pelo servidor e não
-- aceita mais o que o navegador mandar — sem isso este relatório seria
-- editável pelo cliente.

begin;

-- ── A faixa, num lugar só ─────────────────────────────────────────────────

create or replace function public.fn_faixa_horaria(p_momento timestamptz)
returns text
language sql
immutable
set search_path to ''
as $fn$
  select case
    when h <  5 then 'MADRUGADA'
    when h < 11 then 'MANHA'
    when h < 14 then 'ALMOCO'
    when h < 18 then 'TARDE'
    when h < 23 then 'JANTAR'
    else             'FECHAMENTO'
  end
  from (select extract(hour from p_momento at time zone 'America/Sao_Paulo')::int as h) t;
$fn$;

comment on function public.fn_faixa_horaria(timestamptz) is
  'Turno de cozinha a que um instante pertence, na hora da loja. Único lugar onde as fronteiras das faixas são decididas.';

-- ── O mix ─────────────────────────────────────────────────────────────────

create or replace function public.fn_mix_por_faixa_horaria(
  p_loja_id uuid,
  p_desde   date default null,
  p_ate     date default null
)
returns table(
  faixa            text,
  ordem            int,
  rotulo           text,
  pedidos          bigint,
  faturamento      numeric,
  ticket_medio     numeric,
  itens            bigint,
  itens_por_pedido numeric,
  pct_faturamento  numeric,
  pct_pedidos      numeric,
  produto_campeao  text
)
language sql
stable
security definer
set search_path to ''
as $fn$
  with periodo as (
    select coalesce(p_desde, (now() at time zone 'America/Sao_Paulo')::date - 30) as de,
           coalesce(p_ate,   (now() at time zone 'America/Sao_Paulo')::date)      as ate
  ),
  venda as (
    select p.id, p.valor_total,
           public.fn_faixa_horaria(p.criado_em) as faixa
    from public.pedidos p, periodo
    -- SECURITY DEFINER com a loja vindo por parâmetro é um convite: sem esta
    -- linha, qualquer lojista autenticado leria o faturamento por turno de
    -- qualquer concorrente só trocando o uuid da chamada.
    where public.fn_meu_acesso(p_loja_id)
      and p.loja_id = p_loja_id
      and p.status = 'FINALIZADO'
      and (p.criado_em at time zone 'America/Sao_Paulo')::date between periodo.de and periodo.ate
  ),
  por_faixa as (
    select v.faixa,
           count(*)                       as pedidos,
           coalesce(sum(v.valor_total),0) as faturamento,
           coalesce(sum(ip.qtd),0)        as itens
    from venda v
    left join lateral (
      select coalesce(sum(i.quantidade),0) as qtd
      from public.itens_pedido i where i.pedido_id = v.id
    ) ip on true
    group by v.faixa
  ),
  campeao as (
    select f.faixa, i.nome_produto,
           row_number() over (partition by f.faixa
                              order by sum(i.quantidade) desc, i.nome_produto) as rn
    from venda f
    join public.itens_pedido i on i.pedido_id = f.id
    where i.nome_produto is not null
    group by f.faixa, i.nome_produto
  ),
  faixas(faixa, ordem, rotulo) as (values
    ('MANHA'::text,      1, 'Manhã · 5h às 11h'::text),
    ('ALMOCO',           2, 'Almoço · 11h às 14h'),
    ('TARDE',            3, 'Tarde · 14h às 18h'),
    ('JANTAR',           4, 'Jantar · 18h às 23h'),
    ('FECHAMENTO',       5, 'Fechamento · 23h à meia-noite'),
    ('MADRUGADA',        6, 'Madrugada · meia-noite às 5h')
  ),
  total as (
    select nullif(sum(faturamento),0) as fat, nullif(sum(pedidos),0) as ped from por_faixa
  )
  select
    f.faixa, f.ordem, f.rotulo,
    coalesce(pf.pedidos, 0),
    coalesce(pf.faturamento, 0),
    case when coalesce(pf.pedidos,0) > 0
         then round(pf.faturamento / pf.pedidos, 2) end,
    coalesce(pf.itens, 0),
    case when coalesce(pf.pedidos,0) > 0
         then round(pf.itens::numeric / pf.pedidos, 2) end,
    -- Percentual só existe se houver total. Loja sem venda no período recebe
    -- NULO, não zero: zero por cento afirma que a faixa não vendeu, e o certo
    -- é que NADA vendeu e a pergunta não tem resposta ainda.
    case when t.fat is not null then round(100 * coalesce(pf.faturamento,0) / t.fat, 1) end,
    case when t.ped is not null then round(100 * coalesce(pf.pedidos,0)     / t.ped, 1) end,
    c.nome_produto
  from faixas f
  cross join total t
  left join por_faixa pf on pf.faixa = f.faixa
  left join campeao   c  on c.faixa  = f.faixa and c.rn = 1
  order by f.ordem;
$fn$;

comment on function public.fn_mix_por_faixa_horaria(uuid, date, date) is
  'Faturamento, pedidos, ticket e campeão de vendas por turno de cozinha. Só pedido FINALIZADO, na hora da loja.';

-- Os dois revokes: DEFAULT PRIVILEGE dá EXECUTE ao `anon` direto, e tirar de
-- PUBLIC não o alcança.
revoke all on function public.fn_mix_por_faixa_horaria(uuid, date, date) from public;
revoke all on function public.fn_mix_por_faixa_horaria(uuid, date, date) from anon;
grant execute on function public.fn_mix_por_faixa_horaria(uuid, date, date) to authenticated, service_role;

commit;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Varredura de integridade — rode ANTES de mostrar o sistema a alguém.     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- POR QUE EXISTE
--
-- Em 15/09/2026 eu achei defeitos por amostragem, um a um. O MESMO defeito
-- raiz apareceu quatro vezes com roupas diferentes: óleo em ml, tomate em
-- fatias, alface em porção, lote com custo por embalagem. Achar de um em um
-- não termina nunca e não dá para afirmar que acabou.
--
-- Esta varredura pergunta ao banco INTEIRO se as invariantes do domínio valem.
-- Cada linha devolvida é uma contradição no dado — não um alerta de estilo.
--
-- Só leitura. Não altera nada. Rode no SQL Editor do Supabase.
--
-- COMO LER
--
--   gravidade ALTA   → o número na tela está errado ou o dinheiro não fecha.
--                      Não mostre o sistema assim.
--   gravidade MEDIA  → o cadastro está incompleto; a tela fica vazia, não
--                      mentirosa. Dá para demonstrar desviando.
--   gravidade BAIXA  → arrumação; não atrapalha demonstração.

with

-- ── DINHEIRO ───────────────────────────────────────────────────────────────

-- O total gravado tem que bater com a soma das partes. Se não bate, alguém
-- escreveu o total por fora do recálculo do servidor.
total_nao_fecha as (
  select 'ALTA' as gravidade, 'pedido: total não bate com as partes' as verificacao,
         l.nome as loja, 'pedido #'||p.numero as onde,
         'total '||p.valor_total||' ≠ subtotal '||p.subtotal||' + taxa '||p.taxa_entrega
           ||' - desconto '||p.desconto||' - cashback '||p.cashback_usado as detalhe
  from public.pedidos p join public.lojas l on l.id = p.loja_id
  where p.status <> 'CANCELADO'
    and abs(p.valor_total - (p.subtotal + p.taxa_entrega - p.desconto - p.cashback_usado)) > 0.01
),

-- Desconto maior que o subtotal significa que a loja pagou para vender.
desconto_maior_que_venda as (
  select 'ALTA', 'pedido: desconto maior que o subtotal',
         l.nome, 'pedido #'||p.numero,
         'desconto '||p.desconto||' sobre subtotal '||p.subtotal
  from public.pedidos p join public.lojas l on l.id = p.loja_id
  where p.status <> 'CANCELADO' and p.desconto > p.subtotal + 0.01
),

-- Cupom passou do teto de usos: a trava de concorrência falhou em algum ponto.
cupom_estourou as (
  select 'ALTA', 'cupom: usos acima do limite',
         l.nome, 'cupom '||c.codigo,
         c.usos||' usos para um limite de '||c.limite_usos
  from public.cupons c join public.lojas l on l.id = c.loja_id
  where c.limite_usos is not null and coalesce(c.usos,0) > c.limite_usos
),

-- O saldo de cashback é a soma dos movimentos. Se divergir, ou o saldo foi
-- escrito na mão, ou um movimento não foi registrado.
cashback_divergente as (
  select 'ALTA', 'cashback: saldo não bate com os movimentos',
         l.nome, 'cliente '||s.cliente_id::text,
         'saldo '||round(s.saldo,2)||' ≠ movimentos '||round(coalesce(m.soma,0),2)
  from public.cashback_saldos s
  join public.lojas l on l.id = s.loja_id
  left join lateral (
    select sum(valor) as soma from public.cashback_movimentos mm
    where mm.cliente_id = s.cliente_id and mm.loja_id = s.loja_id
  ) m on true
  where abs(s.saldo - coalesce(m.soma,0)) > 0.01
),

cashback_negativo as (
  select 'ALTA', 'cashback: saldo negativo',
         l.nome, 'cliente '||s.cliente_id::text, 'saldo '||round(s.saldo,2)
  from public.cashback_saldos s join public.lojas l on l.id = s.loja_id
  where s.saldo < 0
),

-- Pedido encerrado sem pagamento confirmado: ou a venda não foi cobrada, ou o
-- pagamento não foi registrado. Nos dois casos o DRE está errado.
finalizado_sem_pagamento as (
  select 'ALTA', 'pedido: FINALIZADO sem pagamento PAGO',
         l.nome, 'pedido #'||p.numero, 'valor '||p.valor_total
  from public.pedidos p join public.lojas l on l.id = p.loja_id
  where p.status = 'FINALIZADO' and p.valor_total > 0
    and not exists (select 1 from public.pagamentos g
                     where g.pedido_id = p.id and g.status = 'PAGO')
),

-- Item de um pedido que pertence a outra loja: vazamento entre inquilinos.
item_de_outra_loja as (
  select 'ALTA', 'pedido: item pertence a outra loja',
         l.nome, 'pedido #'||p.numero, 'produto '||pr.nome
  from public.itens_pedido ip
  join public.pedidos p on p.id = ip.pedido_id
  join public.produtos pr on pr.id = ip.produto_id
  join public.lojas l on l.id = p.loja_id
  where pr.loja_id <> p.loja_id
),

-- ── CUSTO ──────────────────────────────────────────────────────────────────

-- O custo por unidade não passa no teste de plausibilidade. É o defeito que
-- transformou uma porção de batata em R$ 87,68.
custo_implausivel as (
  select 'ALTA', 'insumo: custo não confiável',
         l.nome, i.nome, left(c.motivo, 90)
  from public.insumos i
  join public.lojas l on l.id = i.loja_id
  cross join lateral public.fn_custo_unitario_insumo(i.id) c
  where i.ativo and not c.confiavel
    and exists (select 1 from public.fichas_tecnicas f where f.insumo_id = i.id)
),

-- Lote guardando custo por EMBALAGEM enquanto a unidade de estoque é g/ml.
lote_com_custo_de_embalagem as (
  select 'ALTA', 'lote: custo parece ser por embalagem, não por unidade',
         l.nome, i.nome,
         'lote a R$ '||round(lo.custo_unitario,2)||' por '||i.unidade_medida
           ||' (cadastro diz R$ '||round(i.preco_embalagem/nullif(i.qtd_embalagem,0),5)||')'
  from public.lotes_estoque lo
  join public.insumos i on i.id = lo.insumo_id
  join public.lojas l on l.id = lo.loja_id
  where lo.quantidade_restante > 0
    and lower(i.unidade_medida) in ('g','ml')
    and lo.custo_unitario > 1
    and coalesce(i.qtd_embalagem,0) >= 5
),

-- A embalagem contradiz o rendimento que o próprio insumo declara.
embalagem_contradiz_rendimento as (
  select 'ALTA', 'insumo: embalagem contradiz o rendimento declarado',
         l.nome, i.nome,
         'embalagem '||i.qtd_embalagem||' mas o rendimento deduz '
           ||public.fn_embalagem_do_rendimento(i.id)
  from public.insumos i join public.lojas l on l.id = i.loja_id
  where i.ativo and coalesce(i.is_preparo,false) = false
    and i.detalhes_rendimento is not null
    and public.fn_embalagem_do_rendimento(i.id) is not null
    and public.fn_embalagem_do_rendimento(i.id) <> i.qtd_embalagem
),

-- Saldo do insumo não bate com a soma dos lotes: o estoque não sabe o que tem.
saldo_diverge_dos_lotes as (
  select 'ALTA', 'estoque: saldo do insumo não bate com os lotes',
         l.nome, i.nome,
         'saldo '||round(i.quantidade_atual,3)||' ≠ lotes '||round(coalesce(t.soma,0),3)
           ||' '||i.unidade_medida
  from public.insumos i
  join public.lojas l on l.id = i.loja_id
  left join lateral (
    select sum(lo.quantidade_restante) as soma from public.lotes_estoque lo
    where lo.insumo_id = i.id and lo.quantidade_restante > 0
  ) t on true
  where i.ativo and coalesce(i.is_preparo,false) = false
    and abs(coalesce(i.quantidade_atual,0) - coalesce(t.soma,0)) > 0.01
),

-- Ficha pedindo quantidade zero ou negativa de um insumo.
ficha_com_quantidade_invalida as (
  select 'ALTA', 'ficha técnica: quantidade zero ou negativa',
         l.nome, pr.nome||' ← '||i.nome, 'quantidade '||ft.quantidade_consumida
  from public.fichas_tecnicas ft
  join public.produtos pr on pr.id = ft.produto_id
  join public.insumos i on i.id = ft.insumo_id
  join public.lojas l on l.id = pr.loja_id
  where coalesce(ft.quantidade_consumida,0) <= 0
),

-- Preparo que se usa, direta ou indiretamente: a recursão de custo nunca fecha.
preparo_circular as (
  select 'ALTA', 'preparo: usa a si mesmo',
         l.nome, i.nome, 'ficha do preparo contém o próprio preparo'
  from public.fichas_preparos fp
  join public.insumos i on i.id = fp.preparo_id
  join public.lojas l on l.id = fp.loja_id
  where fp.insumo_id = fp.preparo_id
),

-- ── CADASTRO ───────────────────────────────────────────────────────────────

produto_sem_preco as (
  select 'MEDIA', 'produto: à venda sem preço',
         l.nome, pr.nome, 'preço '||coalesce(pr.preco::text,'nulo')
  from public.produtos pr join public.lojas l on l.id = pr.loja_id
  where pr.disponivel and coalesce(pr.preco,0) <= 0
    and coalesce(pr.tipo_venda::text,'') <> 'POR_PESO'
),

produto_sem_ficha as (
  select 'MEDIA', 'produto: sem ficha técnica (custo desconhecido)',
         l.nome, pr.nome, 'não é possível calcular margem'
  from public.produtos pr join public.lojas l on l.id = pr.loja_id
  where pr.disponivel
    and not exists (select 1 from public.fichas_tecnicas f where f.produto_id = pr.id)
),

preparo_sem_ficha as (
  select 'MEDIA', 'preparo: sem ficha (custo não sobe da receita)',
         l.nome, i.nome, 'cadastre o que entra neste preparo'
  from public.insumos i join public.lojas l on l.id = i.loja_id
  where i.ativo and coalesce(i.is_preparo,false)
    and not exists (select 1 from public.fichas_preparos f where f.preparo_id = i.id)
),

preparo_sem_rendimento as (
  select 'MEDIA', 'preparo: sem rendimento declarado',
         l.nome, i.nome, 'o custo do lote não tem por quanto dividir'
  from public.insumos i join public.lojas l on l.id = i.loja_id
  where i.ativo and coalesce(i.is_preparo,false)
    and coalesce(i.rendimento_porcoes,0) <= 0
),

mesa_duplicada as (
  select 'MEDIA', 'mesa: número repetido na mesma loja',
         l.nome, 'mesa '||m.numero, count(*)||' cadastros ativos'
  from public.mesas m join public.lojas l on l.id = m.loja_id
  where m.ativo group by l.nome, m.numero having count(*) > 1
),

produto_sem_categoria as (
  select 'BAIXA', 'produto: sem categoria (não aparece agrupado no cardápio)',
         l.nome, pr.nome, 'categoria nula'
  from public.produtos pr join public.lojas l on l.id = pr.loja_id
  where pr.disponivel and pr.categoria_id is null
),

tudo as (
  select * from total_nao_fecha
  union all select * from desconto_maior_que_venda
  union all select * from cupom_estourou
  union all select * from cashback_divergente
  union all select * from cashback_negativo
  union all select * from finalizado_sem_pagamento
  union all select * from item_de_outra_loja
  union all select * from custo_implausivel
  union all select * from lote_com_custo_de_embalagem
  union all select * from embalagem_contradiz_rendimento
  union all select * from saldo_diverge_dos_lotes
  union all select * from ficha_com_quantidade_invalida
  union all select * from preparo_circular
  union all select * from produto_sem_preco
  union all select * from produto_sem_ficha
  union all select * from preparo_sem_ficha
  union all select * from preparo_sem_rendimento
  union all select * from mesa_duplicada
  union all select * from produto_sem_categoria
)
select gravidade, verificacao, loja, count(*) as ocorrencias,
       min(onde)||case when count(*) > 1 then ' (e mais '||(count(*)-1)||')' else '' end as exemplo,
       min(detalhe) as primeiro_detalhe
from tudo
group by gravidade, verificacao, loja
order by case gravidade when 'ALTA' then 1 when 'MEDIA' then 2 else 3 end,
         count(*) desc, loja;

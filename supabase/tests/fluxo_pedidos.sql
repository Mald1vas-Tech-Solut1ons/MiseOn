-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Varredura do fluxo de pedidos — Sprint 20.                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- POR QUE EXISTE
--
-- Todo pedido, de qualquer canal (cardápio online, mesa/QR, PDV, garçom,
-- totem, WhatsApp, iFood, balança), precisa chegar ao painel da loja certa,
-- no status certo, com dinheiro, estoque e ledger coerentes. Esta varredura
-- pergunta ao banco INTEIRO se essas invariantes valem — não confere canal
-- por canal, à mão.
--
-- Regras confirmadas em produção (pg_get_functiondef, não na migration):
--   fn_trg_status_pedido → baixa de estoque acontece na transição para
--     ACEITO (a partir de NOVO ou AGUARDANDO_PAGAMENTO); receita é lançada
--     na transição para FINALIZADO. CANCELADO estorna as duas coisas sem
--     resetar `estoque_baixado`/`receita_lancada` (o histórico fica, o saldo
--     é que volta).
--   fn_baixar_estoque → idempotente (sai se já existe BAIXA_VENDA para o
--     pedido); só baixa insumo de produto com `controla_estoque` e ficha.
--   fn_lancar_receita_pedido → grava em `contas.tipo = 'RECEITA'`
--     (Receita Vendas ou Receita iFood conforme `origem`).
--
-- Só leitura. Não altera nada. Rode no SQL Editor do Supabase ou via
-- Management API.
--
-- COMO LER
--
--   gravidade ALTA   → dinheiro ou estoque incoerente, ou pedido que não
--                      chega para quem precisa vê-lo. Não é maquiagem.
--   gravidade MEDIA  → operação travada (cozinha, pagamento) que ainda não
--                      corrompeu dado, mas está deixando cliente no vácuo.

with

-- `lanchepaulista` nasceu em 14/07/2026 e passou o resto do mês em
-- construção: ledger financeiro só foi ligado em 21/07, o módulo de balança
-- e buffet em 26/07. Pedido de antes disso nunca vai ficar corretos e não é
-- bug — é fixture de quando a peça ainda não existia. Corte fixo, não se
-- move com o tempo: só esconde o que já era velho quando este arquivo
-- nasceu (23/09/2026), nunca um pedido futuro.
legado_cutoff as (
  select '2026-08-01 00:00:00+00'::timestamptz as data
),

-- ── DINHEIRO E ESTRUTURA DO PEDIDO ──────────────────────────────────────────

pedido_sem_item as (
  select 'ALTA' as gravidade, 'pedido: sem nenhum item' as verificacao,
         l.nome as loja, 'pedido #'||p.numero as onde,
         'status '||p.status||', criado em '||p.criado_em as detalhe
  from public.pedidos p join public.lojas l on l.id = p.loja_id, legado_cutoff lc
  where p.criado_em < now() - interval '10 minutes'
    and p.criado_em >= lc.data
    and not exists (select 1 from public.itens_pedido ip where ip.pedido_id = p.id)
),

-- Pagamento nunca registrado (nem PENDENTE): a rota do canal não gravou
-- `pagamentos`, e sem essa linha não tem como confirmar nem estornar. Mesa
-- com comanda ainda ABERTA é exceção de propósito: quem senta pra comer não
-- paga a cada item, paga ao fechar a conta — achado falso confirmado em
-- 23/09 com o pedido #309 (mesa 10, comanda aberta de propósito no teste).
pedido_sem_pagamento as (
  select 'ALTA', 'pedido: sem nenhum registro de pagamento',
         l.nome, 'pedido #'||p.numero,
         'valor '||p.valor_total||', origem '||p.origem||', status '||p.status
  from public.pedidos p join public.lojas l on l.id = p.loja_id
  where p.status <> 'CANCELADO' and p.valor_total > 0
    and p.criado_em < now() - interval '10 minutes'
    and not exists (select 1 from public.pagamentos g where g.pedido_id = p.id)
    and not exists (
      select 1 from public.comandas c
      where c.id = p.comanda_id and c.status = 'ABERTA'
    )
),

-- O gateway (ou a consulta manual) marcou PAGO, mas o pedido ficou parado no
-- portão de espera: o cliente pagou e não foi avisado.
pagamento_pago_pedido_aguardando as (
  select 'ALTA', 'pedido: pagamento PAGO mas pedido preso em AGUARDANDO_PAGAMENTO',
         l.nome, 'pedido #'||p.numero, 'pago em '||g.data_pagamento
  from public.pedidos p
  join public.lojas l on l.id = p.loja_id
  join public.pagamentos g on g.pedido_id = p.id and g.status = 'PAGO'
  where p.status = 'AGUARDANDO_PAGAMENTO'
),

-- A loja não decidiu: pedido novo demorando para ser aceito ou recusado.
pedido_preso_novo as (
  select 'ALTA', 'pedido: NOVO parado sem decisão da loja',
         l.nome, 'pedido #'||p.numero,
         'parado há '||round(extract(epoch from (now()-p.atualizado_em))/60)||' min'
  from public.pedidos p join public.lojas l on l.id = p.loja_id, legado_cutoff lc
  where p.status = 'NOVO' and p.atualizado_em < now() - interval '15 minutes'
    and p.criado_em >= lc.data
),

-- Aceito, mas a cozinha não começou.
pedido_preso_aceito as (
  select 'MEDIA', 'pedido: ACEITO parado sem ir para a cozinha',
         l.nome, 'pedido #'||p.numero,
         'parado há '||round(extract(epoch from (now()-p.atualizado_em))/60)||' min'
  from public.pedidos p join public.lojas l on l.id = p.loja_id, legado_cutoff lc
  where p.status = 'ACEITO' and p.atualizado_em < now() - interval '45 minutes'
    and p.criado_em >= lc.data
),

-- Senha é o número que o cliente ouve no balcão. Duas comandas com a mesma
-- senha no mesmo dia operacional (reseta às 4h, não à meia-noite) trocam
-- pedido na entrega.
pedidos_com_dia_operacional as (
  select p.id, p.loja_id, p.numero, p.senha, p.status,
         (((p.criado_em at time zone 'America/Sao_Paulo') - interval '4 hours')::date) as dia_operacional
  from public.pedidos p
),
senha_duplicada as (
  select 'ALTA', 'pedido: senha repetida no mesmo dia operacional',
         l.nome, 'senha '||pdo.senha,
         count(*)||' pedidos: '||string_agg('#'||pdo.numero::text, ', ' order by pdo.numero)
  from pedidos_com_dia_operacional pdo
  join public.lojas l on l.id = pdo.loja_id
  where pdo.senha is not null and pdo.status <> 'CANCELADO'
  group by l.nome, pdo.loja_id, pdo.senha, pdo.dia_operacional
  having count(*) > 1
),

-- O total gravado tem que bater com a soma das partes.
total_nao_fecha as (
  select 'ALTA', 'pedido: total não bate com as partes',
         l.nome, 'pedido #'||p.numero,
         'total '||p.valor_total||' ≠ subtotal '||p.subtotal||' + taxa '||p.taxa_entrega
           ||' - desconto '||p.desconto||' - cashback '||p.cashback_usado
  from public.pedidos p join public.lojas l on l.id = p.loja_id, legado_cutoff lc
  where p.status <> 'CANCELADO'
    and p.criado_em >= lc.data
    and abs(p.valor_total - (p.subtotal + p.taxa_entrega - p.desconto - p.cashback_usado)) > 0.01
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

-- ── LEDGER (RECEITA) ─────────────────────────────────────────────────────

pedidos_receita_ledger as (
  select lf.referencia_id as pedido_id, count(*) as qtd
  from public.lancamentos_financeiros lf
  join public.contas c on c.id = lf.conta_creditada and c.tipo = 'RECEITA'
  where lf.referencia_tipo = 'PEDIDO'
  group by lf.referencia_id
),

-- FINALIZADO tem que ter gerado a receita — flag e lançamento real, os dois.
finalizado_sem_receita as (
  select 'ALTA', 'pedido: FINALIZADO sem receita no ledger',
         l.nome, 'pedido #'||p.numero,
         'receita_lancada='||p.receita_lancada||', lançamentos='||coalesce(prl.qtd,0)
  from public.pedidos p
  join public.lojas l on l.id = p.loja_id
  join legado_cutoff lc on p.criado_em >= lc.data
  left join pedidos_receita_ledger prl on prl.pedido_id = p.id
  where p.status = 'FINALIZADO' and p.valor_total > 0
    and (not p.receita_lancada or coalesce(prl.qtd,0) = 0)
),

-- Receita lançada mais de uma vez: o trigger não devia deixar (é guardado
-- por `OLD.status IS DISTINCT FROM 'FINALIZADO'`), mas quem confia, testa.
receita_em_dobro as (
  select 'ALTA', 'pedido: receita lançada mais de uma vez',
         l.nome, 'pedido #'||p.numero, prl.qtd||' lançamentos de receita'
  from pedidos_receita_ledger prl
  join public.pedidos p on p.id = prl.pedido_id
  join public.lojas l on l.id = p.loja_id
  where prl.qtd > 1
),

-- ── ESTOQUE ────────────────────────────────────────────────────────────

-- Só entra nesta lista quem tem pelo menos um item que deveria mesmo baixar
-- estoque (produto com controla_estoque e ficha técnica).
pedidos_com_estoque as (
  select distinct ip.pedido_id
  from public.itens_pedido ip
  join public.produtos pr on pr.id = ip.produto_id and pr.controla_estoque
  join public.fichas_tecnicas ft on ft.produto_id = pr.id
),

-- Passou de ACEITO (onde a baixa deveria ter ocorrido) e a flag continua
-- false: ou a baixa falhou em silêncio, ou o pedido pulou o trigger.
baixa_ausente as (
  select 'ALTA', 'pedido: sem baixa de estoque apesar de aceito',
         l.nome, 'pedido #'||p.numero,
         'status '||p.status||', estoque_baixado = false'
  from public.pedidos p
  join public.lojas l on l.id = p.loja_id
  join pedidos_com_estoque pce on pce.pedido_id = p.id
  join legado_cutoff lc on p.criado_em >= lc.data
  where p.status not in ('NOVO','AGUARDANDO_PAGAMENTO','CANCELADO')
    and not p.estoque_baixado
),

-- Flag diz que baixou, mas não existe o movimento BAIXA_VENDA correspondente.
-- Falso positivo conhecido: produto que ganhou ficha técnica DEPOIS do
-- pedido (fichas_tecnicas não tem carimbo de tempo pra filtrar isso). Antes
-- de tratar um achado aqui como bug, confira se o produto já tinha ficha na
-- data do pedido — não dá pra saber por SQL, só olhando o caso.
baixa_sem_movimento as (
  select 'ALTA', 'pedido: flag de baixa true mas sem movimento de estoque',
         l.nome, 'pedido #'||p.numero, 'estoque_baixado = true sem BAIXA_VENDA'
  from public.pedidos p
  join public.lojas l on l.id = p.loja_id
  join pedidos_com_estoque pce on pce.pedido_id = p.id
  join legado_cutoff lc on p.criado_em >= lc.data
  where p.estoque_baixado
    and not exists (
      select 1 from public.movimentacoes_estoque m
      where m.pedido_id = p.id and m.tipo = 'BAIXA_VENDA'
    )
),

-- ── TOTEM ──────────────────────────────────────────────────────────────

-- Pix não confirmado e ninguém cancelou: cliente foi embora sem pagar e a
-- tela do totem ficou presa até alguém decidir. (Achado real em 22/09: 20
-- presos em lanchepaulista — a lista aqui é para decidir a regra de limpeza,
-- não para apagar um a um.)
totem_aguardando_antigo as (
  select 'MEDIA', 'totem: pedido preso em AGUARDANDO_PAGAMENTO',
         l.nome, 'pedido #'||p.numero,
         'criado há '||round(extract(epoch from (now()-p.criado_em))/3600,1)||' h'
  from public.pedidos p join public.lojas l on l.id = p.loja_id
  where p.origem = 'totem' and p.status = 'AGUARDANDO_PAGAMENTO'
    and p.criado_em < now() - interval '30 minutes'
),

tudo as (
  select * from pedido_sem_item
  union all select * from pedido_sem_pagamento
  union all select * from pagamento_pago_pedido_aguardando
  union all select * from pedido_preso_novo
  union all select * from pedido_preso_aceito
  union all select * from senha_duplicada
  union all select * from total_nao_fecha
  union all select * from item_de_outra_loja
  union all select * from finalizado_sem_receita
  union all select * from receita_em_dobro
  union all select * from baixa_ausente
  union all select * from baixa_sem_movimento
  union all select * from totem_aguardando_antigo
)
select gravidade, verificacao, loja, count(*) as ocorrencias,
       min(onde)||case when count(*) > 1 then ' (e mais '||(count(*)-1)||')' else '' end as exemplo,
       min(detalhe) as primeiro_detalhe
from tudo
group by gravidade, verificacao, loja
order by case gravidade when 'ALTA' then 1 when 'MEDIA' then 2 else 3 end,
         count(*) desc, loja;

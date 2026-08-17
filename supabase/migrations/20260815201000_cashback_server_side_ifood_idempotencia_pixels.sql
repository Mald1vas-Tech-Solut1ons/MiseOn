-- ============================================================================
-- HARDENING CRÍTICO PRÉ-IFOOD — Achados 02, 05 e 07
-- ============================================================================
--
-- 02 (CRÍTICO) Pedido grátis. `cashback_usado` era gravado direto no INSERT
--    pelo browser e o débito de saldo era um passo SEPARADO (fn_usar_cashback)
--    executado depois. Bastava não executar o segundo passo:
--      1. insert pedidos { cashback_usado: 9999 }   -- sem ter saldo
--      2. (pula fn_usar_cashback)
--      3. fn_recalcular_pedido -> valor_total = 0
--      4. fn_quitar_pedido_cashback -> pagamento PAGO, pedido ACEITO
--    Correção: o cashback deixa de ser um número declarado pelo cliente e passa
--    a ser DERIVADO do ledger (cashback_movimentos), que só fn_usar_cashback
--    escreve — e ela valida saldo e dono.
--
-- 05 (CRÍTICO) meta_pixel_id / ga4_measurement_id iam sem validação para dentro
--    de um <script> inline na vitrine (XSS armazenado → roubo de sessão dos
--    clientes). CHECK constraint aqui + validação no front.
--
-- 07 (ALTO) Webhook do iFood sem idempotência: cada reenvio de um evento PLC
--    virava um pedido novo (cozinha produz 2x, estoque baixa 2x, receita 2x).
-- ============================================================================

-- ── 02a. Cashback derivado do ledger ───────────────────────────────────────
create or replace function public.fn_recalcular_pedido(p_pedido_id uuid)
returns numeric
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_loja uuid; v_cupom uuid; v_taxa numeric; v_cashback numeric;
  v_subtotal numeric := 0; v_desconto numeric := 0; v_total numeric;
  c record;
begin
  select loja_id, cupom_id, coalesce(taxa_entrega, 0)
    into v_loja, v_cupom, v_taxa
  from pedidos where id = p_pedido_id;
  if v_loja is null then return null; end if;

  -- Subtotal a partir dos preços reais (produtos + opções). Fallback ao
  -- snapshot só quando o FK foi apagado (produto/opção removidos após o pedido).
  select coalesce(sum(
           (coalesce(pr.preco, ip.preco_unitario) + coalesce(op.soma, 0)) * ip.quantidade
         ), 0)
    into v_subtotal
  from itens_pedido ip
  left join produtos pr on pr.id = ip.produto_id
  left join lateral (
    select sum(coalesce(o.preco_adicional, ipo.preco_adicional)) as soma
    from itens_pedido_opcoes ipo
    left join opcoes o on o.id = ipo.opcao_id
    where ipo.item_id = ip.id
  ) op on true
  where ip.pedido_id = p_pedido_id;

  -- Desconto: recomputado do cupom (server-side). Cupom inválido = sem desconto.
  if v_cupom is not null then
    select * into c from cupons
      where id = v_cupom and loja_id = v_loja and ativo
        and (validade is null or validade >= current_date)
        and v_subtotal >= coalesce(pedido_minimo, 0);
    if found then
      v_desconto := case when c.tipo = 'FIXO'
        then least(c.valor, v_subtotal)
        else round(v_subtotal * c.valor / 100, 2) end;
    end if;
  end if;

  -- ACHADO 02: o cashback vem do LEDGER, nunca da coluna que o browser gravou.
  -- cashback_movimentos só é escrito por fn_usar_cashback, que valida saldo
  -- suficiente e dono do pedido. Movimentos de USO são gravados negativos.
  select coalesce(-sum(cm.valor), 0)
    into v_cashback
  from cashback_movimentos cm
  where cm.pedido_id = p_pedido_id and cm.tipo = 'USO';

  -- Nunca deixa o cashback pagar mais do que o pedido realmente custa.
  v_cashback := least(greatest(v_cashback, 0), v_subtotal + v_taxa - v_desconto);

  v_total := greatest(0, v_subtotal + v_taxa - v_desconto - v_cashback);

  update pedidos
     set subtotal = v_subtotal, desconto = v_desconto, valor_total = v_total,
         cashback_usado = v_cashback,   -- alinha a coluna com o ledger
         atualizado_em = now()
   where id = p_pedido_id;

  return v_total;
end; $function$;

comment on function public.fn_recalcular_pedido(uuid) is
  'Fonte da verdade do valor do pedido. Subtotal, desconto e cashback são '
  'recomputados server-side; nada que o browser gravou em pedidos é confiado.';

-- ── 02b. Quitação por cashback recalcula antes de decidir ──────────────────
-- Antes: confiava em valor_total/cashback_usado como estavam na linha, que era
-- exatamente o que o atacante controlava.
create or replace function public.fn_quitar_pedido_cashback(p_pedido_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_total numeric;
  v_cashback numeric;
begin
  -- O pedido tem de ser de quem está chamando.
  if not exists (
    select 1 from pedidos p
    where p.id = p_pedido_id and p.cliente_user_id = auth.uid()
  ) then
    return false;
  end if;

  -- Recalcula com base no ledger ANTES de decidir se está quitado.
  v_total := fn_recalcular_pedido(p_pedido_id);
  if v_total is null then return false; end if;

  select coalesce(cashback_usado, 0) into v_cashback
  from pedidos where id = p_pedido_id;

  -- Só quita o que o cashback realmente cobriu.
  if not (v_total <= 0 and v_cashback > 0) then
    return false;
  end if;

  update pagamentos set status = 'PAGO', data_pagamento = now()
    where pedido_id = p_pedido_id and status = 'PENDENTE';
  update pedidos set status = 'ACEITO'
    where id = p_pedido_id and status = 'NOVO';

  return true;
end; $function$;

-- ── 07. Idempotência do iFood ──────────────────────────────────────────────
-- Sem isto, o reenvio de evento (comportamento NORMAL do iFood quando não
-- recebe acknowledgment) duplica o pedido na cozinha.
create unique index if not exists uniq_pedidos_ifood_order_id
  on public.pedidos (ifood_order_id)
  where ifood_order_id is not null;

comment on index public.uniq_pedidos_ifood_order_id is
  'Achado 07: garante que reenvio de webhook do iFood não vire pedido duplicado. '
  'O webhook usa upsert ... on conflict do nothing sobre este índice.';

-- ── 05. Formato dos pixels de rastreamento ─────────────────────────────────
-- Defesa em profundidade: o front valida, mas o banco é quem garante que nunca
-- entra caractere capaz de escapar do contexto <script> da vitrine.
update public.lojas
   set meta_pixel_id = null
 where meta_pixel_id is not null and meta_pixel_id !~ '^[0-9]{15,16}$';

update public.lojas
   set ga4_measurement_id = null
 where ga4_measurement_id is not null and ga4_measurement_id !~ '^G-[A-Z0-9]{8,12}$';

alter table public.lojas
  drop constraint if exists chk_meta_pixel_id_formato,
  add constraint chk_meta_pixel_id_formato
    check (meta_pixel_id is null or meta_pixel_id ~ '^[0-9]{15,16}$');

alter table public.lojas
  drop constraint if exists chk_ga4_measurement_id_formato,
  add constraint chk_ga4_measurement_id_formato
    check (ga4_measurement_id is null or ga4_measurement_id ~ '^G-[A-Z0-9]{8,12}$');

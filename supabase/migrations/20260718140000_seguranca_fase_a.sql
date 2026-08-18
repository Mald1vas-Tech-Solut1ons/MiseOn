-- ============================================================
-- Segurança — FASE A (6 achados críticos)
-- Auditoria 2026-07-18. Fecha os fios de "comida grátis remota".
-- Idempotente onde possível; seguro para rodar em produção.
-- ============================================================

-- Garante que cliente_user_id e clientes.user_id existam (criadas oficialmente
-- em 20260721, mas referenciadas nas policies e RPCs abaixo)
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS cliente_user_id uuid;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS user_id uuid;

-- ── [2] Preço é autoridade do SERVIDOR ──────────────────────
-- O browser insere subtotal/desconto/valor_total livremente (INSERT
-- público). Esta função recalcula tudo a partir dos PREÇOS REAIS de
-- produtos e opções, revalida o cupom e sobrescreve os totais do
-- pedido. As functions de Pix/cartão chamam isto antes de cobrar.
create or replace function fn_recalcular_pedido(p_pedido_id uuid)
returns numeric
language plpgsql
security definer
as $$
declare
  v_loja uuid; v_cupom uuid; v_taxa numeric; v_cashback numeric;
  v_subtotal numeric := 0; v_desconto numeric := 0; v_total numeric;
  c record;
begin
  select loja_id, cupom_id, coalesce(taxa_entrega,0), coalesce(cashback_usado,0)
    into v_loja, v_cupom, v_taxa, v_cashback
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

  v_total := greatest(0, v_subtotal + v_taxa - v_desconto - v_cashback);

  update pedidos
     set subtotal = v_subtotal, desconto = v_desconto, valor_total = v_total,
         atualizado_em = now()
   where id = p_pedido_id;

  return v_total;
end; $$;

-- ── [4] fn_usar_cashback: exige dono do saldo E do pedido ───
create or replace function fn_usar_cashback(p_cliente_id uuid, p_loja_id uuid, p_pedido_id uuid, p_valor numeric)
returns boolean
language plpgsql
security definer
as $$
declare v_ok boolean;
begin
  if p_valor <= 0 then return true; end if;

  -- O saldo debitado tem de pertencer a QUEM chama, e o pedido também.
  if not exists (select 1 from clientes c where c.id = p_cliente_id and c.user_id = auth.uid()) then
    return false;
  end if;
  if not exists (select 1 from pedidos p where p.id = p_pedido_id and p.cliente_user_id = auth.uid()) then
    return false;
  end if;

  update cashback_saldos set saldo = saldo - p_valor, atualizado_em = now()
  where cliente_id = p_cliente_id and loja_id = p_loja_id and saldo >= p_valor;

  get diagnostics v_ok = row_count;
  if v_ok then
    insert into cashback_movimentos (loja_id, cliente_id, pedido_id, tipo, valor)
    values (p_loja_id, p_cliente_id, p_pedido_id, 'USO', -p_valor);
  end if;
  return v_ok;
end; $$;

-- ── [3] Quitação por cashback (substitui o INSERT de PAGO no cliente) ──
-- O cliente não pode mais gravar pagamento PAGO direto (policy abaixo).
-- Quando o cashback cobre o pedido inteiro (valor_total 0), esta função
-- — que valida o dono — marca o pagamento e aceita o pedido.
create or replace function fn_quitar_pedido_cashback(p_pedido_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare v_ok boolean := false;
begin
  if not exists (
    select 1 from pedidos p
    where p.id = p_pedido_id and p.cliente_user_id = auth.uid()
      and p.valor_total <= 0 and p.cashback_usado > 0
  ) then
    return false;
  end if;

  update pagamentos set status = 'PAGO', data_pagamento = now()
    where pedido_id = p_pedido_id and status = 'PENDENTE';
  update pedidos set status = 'ACEITO'
    where id = p_pedido_id and status = 'NOVO';
  get diagnostics v_ok = row_count;
  return true;
end; $$;

-- ── [3] pagamentos: INSERT público só PENDENTE, nunca PAGO ──
-- Operadores da loja seguem inserindo qualquer status via adm_pgto
-- (fn_meu_acesso). O gargalo é só o público/cliente.
drop policy if exists pub_cria_pgto on pagamentos;
create policy pub_cria_pgto on pagamentos for insert to public
  with check (status = 'PENDENTE' and gateway_txid is null and data_pagamento is null);
-- cliente lê o status do próprio pagamento (confirmação Pix)
drop policy if exists cliente_le_pgto on pagamentos;
create policy cliente_le_pgto on pagamentos for select to public
  using (pedido_id in (select id from pedidos where cliente_user_id = auth.uid()));

-- ── [6] Fim do vazamento: leitura pública em massa de pedidos ──
-- Remove os SELECT USING(true). O cliente lê os SEUS (cliente_seus_pedidos,
-- já existente) e o acompanhamento por link usa fn_acompanhar_pedido.
drop policy if exists pub_le_pedido on pedidos;
drop policy if exists pub_le_item  on itens_pedido;
drop policy if exists pub_le_ipo   on itens_pedido_opcoes;

drop policy if exists cliente_le_item on itens_pedido;
create policy cliente_le_item on itens_pedido for select to public
  using (pedido_id in (select id from pedidos where cliente_user_id = auth.uid()));

drop policy if exists cliente_le_ipo on itens_pedido_opcoes;
create policy cliente_le_ipo on itens_pedido_opcoes for select to public
  using (item_id in (
    select ip.id from itens_pedido ip
    join pedidos p on p.id = ip.pedido_id
    where p.cliente_user_id = auth.uid()
  ));

-- Acompanhamento por link (uuid = token). Retorna UM pedido pelo id exato
-- (não enumerável em massa). SECURITY DEFINER: contorna a RLS acima só
-- para esta leitura pontual.
create or replace function fn_acompanhar_pedido(p_id uuid)
returns jsonb
language sql
security definer
stable
as $$
  select to_jsonb(p) || jsonb_build_object(
    'itens_pedido', coalesce((
      select jsonb_agg(to_jsonb(ip) || jsonb_build_object(
        'itens_pedido_opcoes', coalesce((
          select jsonb_agg(to_jsonb(ipo)) from itens_pedido_opcoes ipo where ipo.item_id = ip.id
        ), '[]'::jsonb)
      )) from itens_pedido ip where ip.pedido_id = p.id
    ), '[]'::jsonb),
    'pagamentos', coalesce((
      select jsonb_agg(jsonb_build_object('metodo', pg.metodo, 'status', pg.status, 'valor_pago', pg.valor_pago))
      from pagamentos pg where pg.pedido_id = p.id
    ), '[]'::jsonb)
  )
  from pedidos p where p.id = p_id;
$$;
grant execute on function fn_acompanhar_pedido(uuid) to anon, authenticated;

-- ── [5] enderecos_cliente / favoritos_cliente: só o dono ────
drop policy if exists pub_le_endereco       on enderecos_cliente;
drop policy if exists pub_cria_endereco     on enderecos_cliente;
drop policy if exists pub_atualiza_endereco on enderecos_cliente;
drop policy if exists pub_deleta_endereco   on enderecos_cliente;
drop policy if exists cliente_end_all       on enderecos_cliente;
create policy cliente_end_all on enderecos_cliente for all to public
  using (cliente_id in (select id from clientes where user_id = auth.uid()))
  with check (cliente_id in (select id from clientes where user_id = auth.uid()));

drop policy if exists pub_le_favorito     on favoritos_cliente;
drop policy if exists pub_cria_favorito   on favoritos_cliente;
drop policy if exists pub_deleta_favorito on favoritos_cliente;
drop policy if exists cliente_fav_all     on favoritos_cliente;
create policy cliente_fav_all on favoritos_cliente for all to public
  using (cliente_id in (select id from clientes where user_id = auth.uid()))
  with check (cliente_id in (select id from clientes where user_id = auth.uid()));

-- ── Hotfix cashback multi-tenant (preparado em 20260718120000, nunca
-- aplicado em produção). PK por (cliente_id, loja_id) e crédito na base
-- pré-cashback. Dados atuais têm cliente_id único → troca de PK é segura.
alter table cashback_saldos drop constraint if exists cashback_saldos_pkey;
alter table cashback_saldos add primary key (cliente_id, loja_id);

create or replace function fn_creditar_cashback(p_pedido_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_loja uuid; v_cliente uuid; v_subtotal numeric; v_taxa numeric; v_desconto numeric; v_pct numeric; v_credito numeric;
begin
  select p.loja_id, p.cliente_id, p.subtotal, p.taxa_entrega, p.desconto
    into v_loja, v_cliente, v_subtotal, v_taxa, v_desconto
  from pedidos p where p.id = p_pedido_id;
  if v_cliente is null then return; end if;

  select cashback_pct into v_pct from lojas where id = v_loja;
  if v_pct is null or v_pct <= 0 then return; end if;

  v_credito := round((coalesce(v_subtotal,0) + coalesce(v_taxa,0) - coalesce(v_desconto,0)) * v_pct / 100, 2);
  if v_credito is null or v_credito <= 0 then return; end if;

  insert into cashback_saldos (cliente_id, loja_id, saldo)
  values (v_cliente, v_loja, v_credito)
  on conflict (cliente_id, loja_id) do update
    set saldo = cashback_saldos.saldo + v_credito, atualizado_em = now();

  insert into cashback_movimentos (loja_id, cliente_id, pedido_id, tipo, valor)
  values (v_loja, v_cliente, p_pedido_id, 'CREDITO', v_credito);
end; $$;

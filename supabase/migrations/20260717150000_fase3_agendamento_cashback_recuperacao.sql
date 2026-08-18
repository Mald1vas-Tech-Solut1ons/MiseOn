-- ============================================================
-- MiseOn — Fase 3: Agendamento, Cashback e Recuperação de Vendas
-- ============================================================

-- Garante que clientes.user_id exista (criada oficialmente em 20260721,
-- mas referenciada nas policies de cashback abaixo)
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS user_id uuid;

-- ── 1. AGENDAMENTO ──────────────────────────────────────────
-- `pedidos.agendado_para` e `lojas.aceita_agendamento` já existem desde o
-- schema base. Falta só a antecedência mínima (quanto tempo de prep a
-- loja precisa entre "agora" e o horário agendado mais próximo).
alter table public.lojas
  add column if not exists agendamento_antecedencia_min int not null default 30;

-- ── 2. CASHBACK ──────────────────────────────────────────────
-- Ledger + saldo em cache, no mesmo padrão já usado pelo estoque
-- (movimentacoes_estoque = fonte de verdade; insumos.quantidade_atual = cache).
alter table public.lojas
  add column if not exists cashback_pct numeric(5,2) not null default 0; -- 0 = desligado

alter table public.pedidos
  add column if not exists cashback_usado numeric(10,2) not null default 0;

create table if not exists public.cashback_saldos (
  cliente_id    uuid primary key references public.clientes(id) on delete cascade,
  loja_id       uuid not null references public.lojas(id) on delete cascade,
  saldo         numeric(10,2) not null default 0 check (saldo >= 0),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_cashback_saldos_loja on public.cashback_saldos (loja_id);

create table if not exists public.cashback_movimentos (
  id         uuid primary key default gen_random_uuid(),
  loja_id    uuid not null references public.lojas(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  pedido_id  uuid references public.pedidos(id) on delete set null,
  tipo       text not null check (tipo in ('CREDITO', 'USO')),
  valor      numeric(10,2) not null, -- positivo em CREDITO, negativo em USO (ledger)
  criado_em  timestamptz not null default now()
);
create index if not exists idx_cashback_mov_cliente on public.cashback_movimentos (cliente_id, criado_em desc);

-- Credita cashback quando o pedido é FINALIZADO (chamado pela trigger abaixo).
-- Sem cliente_id identificado (ex.: balcão/mesa sem login), não há saldo pra creditar.
create or replace function fn_creditar_cashback(p_pedido_id uuid) returns void as $$
declare
  v_loja uuid; v_cliente uuid; v_subtotal numeric; v_taxa numeric; v_desconto numeric; v_valor_total numeric; v_pct numeric; v_credito numeric;
begin
  select p.loja_id, p.cliente_id, p.subtotal, p.taxa_entrega, p.desconto, p.valor_total into v_loja, v_cliente, v_subtotal, v_taxa, v_desconto, v_valor_total
  from pedidos p where p.id = p_pedido_id;

  if v_cliente is null then return; end if;

  select cashback_pct into v_pct from lojas where id = v_loja;
  if v_pct is null or v_pct <= 0 then return; end if;

  -- Calculate cashback based on pre-cashback amount: subtotal + taxa_entrega - desconto
  v_credito := round((v_subtotal + v_taxa - v_desconto) * v_pct / 100, 2);
  if v_credito <= 0 then return; end if;

  insert into cashback_saldos (cliente_id, loja_id, saldo)
  values (v_cliente, v_loja, v_credito)
  on conflict (cliente_id) do update
    set saldo = cashback_saldos.saldo + v_credito, atualizado_em = now();

  insert into cashback_movimentos (loja_id, cliente_id, pedido_id, tipo, valor)
  values (v_loja, v_cliente, p_pedido_id, 'CREDITO', v_credito);
end; $$ language plpgsql security definer;

-- RPC atômica de uso do saldo — evita corrida entre duas abas gastando o
-- mesmo saldo ao mesmo tempo (UPDATE ... WHERE saldo >= valor é atômico).
create or replace function fn_usar_cashback(p_cliente_id uuid, p_loja_id uuid, p_pedido_id uuid, p_valor numeric)
returns boolean as $$
declare v_ok boolean;
begin
  if p_valor <= 0 then return true; end if;

  update cashback_saldos set saldo = saldo - p_valor, atualizado_em = now()
  where cliente_id = p_cliente_id and loja_id = p_loja_id and saldo >= p_valor;

  get diagnostics v_ok = row_count;
  if v_ok then
    insert into cashback_movimentos (loja_id, cliente_id, pedido_id, tipo, valor)
    values (p_loja_id, p_cliente_id, p_pedido_id, 'USO', -p_valor);
  end if;
  return v_ok;
end; $$ language plpgsql security definer;

-- Estende a trigger JÁ EXISTENTE de status (estoque) para também creditar
-- cashback ao finalizar — mesmo ponto único de verdade, sem duplicar regra
-- de negócio em cada tela que finaliza pedido (Painel, Mesas, PDV...).
create or replace function public.fn_trg_status_pedido() returns trigger as $$
begin
  NEW.atualizado_em = now();
  if NEW.status = 'ACEITO' and OLD.status = 'NOVO' then
    perform fn_baixar_estoque(NEW.id);
    NEW.estoque_baixado = true;
  end if;

  if NEW.status = 'CANCELADO' and OLD.estoque_baixado then
    insert into movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, motivo, pedido_id)
    select m.loja_id, m.insumo_id, 'AJUSTE', -m.quantidade, 'Estorno por cancelamento', m.pedido_id
    from movimentacoes_estoque m
    where m.pedido_id = NEW.id and m.tipo = 'BAIXA_VENDA';
    update insumos i set quantidade_atual = i.quantidade_atual - m.quantidade
    from movimentacoes_estoque m
    where m.pedido_id = NEW.id and m.tipo = 'BAIXA_VENDA' and i.id = m.insumo_id;
  end if;

  if NEW.status = 'FINALIZADO' and OLD.status is distinct from 'FINALIZADO' then
    perform fn_creditar_cashback(NEW.id);
  end if;

  return NEW;
end; $$ language plpgsql security definer;

alter table public.cashback_saldos     enable row level security;
alter table public.cashback_movimentos enable row level security;

drop policy if exists cliente_seu_saldo on public.cashback_saldos;
create policy cliente_seu_saldo on public.cashback_saldos for select using (
  cliente_id in (select id from clientes where user_id = auth.uid())
);
drop policy if exists adm_cashback_saldos on public.cashback_saldos;
create policy adm_cashback_saldos on public.cashback_saldos for all using (fn_meu_acesso(loja_id));

drop policy if exists cliente_seus_movimentos on public.cashback_movimentos;
create policy cliente_seus_movimentos on public.cashback_movimentos for select using (
  cliente_id in (select id from clientes where user_id = auth.uid())
);
drop policy if exists adm_cashback_mov on public.cashback_movimentos;
create policy adm_cashback_mov on public.cashback_movimentos for all using (fn_meu_acesso(loja_id));

-- ── 3. RECUPERAÇÃO DE VENDAS ─────────────────────────────────
-- Pix não pago já é 100% derivável de pedidos+pagamentos existentes (sem
-- tabela nova). O que falta capturar é o carrinho que nunca virou pedido:
-- 1 registro por cliente/loja, atualizado quando ele abre o checkout.
create table if not exists public.carrinhos_abandonados (
  id             uuid primary key default gen_random_uuid(),
  loja_id        uuid not null references public.lojas(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  cliente_id     uuid references public.clientes(id) on delete set null,
  itens_resumo   text not null,             -- snapshot legível: "2x X-Bacon, 1x Coca-Cola"
  valor_estimado numeric(10,2) not null default 0,
  status         text not null default 'ABERTO' check (status in ('ABERTO', 'RECUPERADO')),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (loja_id, user_id)
);
create index if not exists idx_carrinhos_abandonados_loja on public.carrinhos_abandonados (loja_id, status, atualizado_em desc);

alter table public.carrinhos_abandonados enable row level security;

drop policy if exists cliente_seu_carrinho on public.carrinhos_abandonados;
create policy cliente_seu_carrinho on public.carrinhos_abandonados for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists adm_carrinhos_abandonados on public.carrinhos_abandonados;
create policy adm_carrinhos_abandonados on public.carrinhos_abandonados for all using (fn_meu_acesso(loja_id));

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Cashback: o lojista consegue ligar, e o saldo expira de verdade.         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- ACHADO (15/09/2026, medido em produção)
--
-- A aba Cashback do Marketing está quebrada. `src/pages/admin/Marketing.tsx`
-- lê e grava `lojas.cashback_dias_expiracao`, e essa coluna NÃO EXISTE em
-- produção — `lojas` só tem `cashback_pct`. Consequência em duas pontas:
--
--   • ao abrir, o SELECT falha, `loja` volta nulo e a tela mostra 0%, mesmo
--     numa loja com 5% configurado;
--   • ao salvar, o UPDATE falha e o lojista lê "Erro ao salvar". Ele não
--     consegue ligar o cashback pela interface, ponto.
--
-- Os 5% que aparecem hoje no cardápio do Lanche do Paulista e do Natureba
-- foram gravados antes da tela passar a pedir a coluna que falta.
--
-- POR QUE ISSO IMPORTA MAIS QUE PARECE
--
-- Cashback é a resposta do produto ao cartão de carimbo. O dono do buffet do
-- vídeo recusa promoção de carimbo com um argumento afiado: "esse tipo de
-- promoção atrai o cliente que quer desconto… ele é mesquinho, não valoriza a
-- qualidade". Cashback não tem esse efeito — ele não anuncia desconto na
-- vitrine, devolve saldo a quem já comprou. Não exige carimbo, cartão, app
-- nem app de terceiros: o saldo vive na conta do cliente e reaparece no
-- checkout seguinte. É o argumento comercial mais direto que o módulo tem, e
-- estava inacessível.
--
-- E a tela prometia expiração que não existia em lugar nenhum: nem coluna, nem
-- rotina. Saldo que nunca expira é passivo que só cresce no balanço da loja.
--
-- CORREÇÃO: a coluna passa a existir E a expiração passa a acontecer.

-- ── 1. A configuração que a tela já esperava ────────────────────────────────
alter table public.lojas
  add column if not exists cashback_dias_expiracao integer;

comment on column public.lojas.cashback_dias_expiracao is
  'Dias até o crédito de cashback expirar. NULL = não expira. A tela de '
  'Marketing grava aqui; fn_expirar_cashback consome.';

-- ── 2. Cada crédito passa a saber quando vence ──────────────────────────────
alter table public.cashback_movimentos
  add column if not exists expira_em timestamptz;

create index if not exists idx_cashback_mov_expira
  on public.cashback_movimentos (loja_id, expira_em)
  where tipo = 'CREDITO' and expira_em is not null;

-- ── 3. O crédito nasce com validade ─────────────────────────────────────────
create or replace function public.fn_creditar_cashback(p_pedido_id uuid)
 returns void
 language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare
  v_loja uuid; v_cliente uuid; v_subtotal numeric; v_taxa numeric;
  v_desconto numeric; v_pct numeric; v_credito numeric; v_dias int;
begin
  select p.loja_id, p.cliente_id, p.subtotal, p.taxa_entrega, p.desconto
    into v_loja, v_cliente, v_subtotal, v_taxa, v_desconto
  from pedidos p where p.id = p_pedido_id;
  if v_cliente is null then return; end if;

  select cashback_pct, cashback_dias_expiracao into v_pct, v_dias
  from lojas where id = v_loja;
  if v_pct is null or v_pct <= 0 then return; end if;

  v_credito := round((coalesce(v_subtotal,0) + coalesce(v_taxa,0) - coalesce(v_desconto,0)) * v_pct / 100, 2);
  if v_credito is null or v_credito <= 0 then return; end if;

  insert into cashback_saldos (cliente_id, loja_id, saldo)
  values (v_cliente, v_loja, v_credito)
  on conflict (cliente_id, loja_id) do update
    set saldo = cashback_saldos.saldo + v_credito, atualizado_em = now();

  insert into cashback_movimentos (loja_id, cliente_id, pedido_id, tipo, valor, expira_em)
  values (v_loja, v_cliente, p_pedido_id, 'CREDITO', v_credito,
          case when v_dias is not null and v_dias > 0
               then now() + make_interval(days => v_dias) end);
end; $function$;

-- ── 4. A expiração acontece ─────────────────────────────────────────────────
-- Expira o que venceu e ainda não foi gasto, por cliente. O saldo é um número
-- só, então o que expira é a parte dele que veio de créditos vencidos e que
-- sobreviveu aos usos posteriores — PEPS: o uso consome primeiro o crédito
-- mais antigo. Nunca deixa o saldo negativo.
create or replace function public.fn_expirar_cashback(p_loja_id uuid default null)
returns table(cliente_id uuid, loja_id uuid, expirado numeric)
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
begin
  return query
  with por_cliente as (
    select m.cliente_id, m.loja_id,
           sum(m.valor) filter (where m.tipo = 'CREDITO'
                                  and m.expira_em is not null
                                  and m.expira_em <= now())          as creditado_vencido,
           coalesce(-sum(m.valor) filter (where m.tipo = 'USO'), 0)  as ja_usado,
           coalesce(-sum(m.valor) filter (where m.tipo = 'EXPIRACAO'), 0) as ja_expirado
    from cashback_movimentos m
    where (p_loja_id is null or m.loja_id = p_loja_id)
    group by m.cliente_id, m.loja_id
  ),
  a_expirar as (
    select pc.cliente_id, pc.loja_id, s.saldo,
           -- do que venceu, desconta o que já saiu (uso e expirações anteriores)
           greatest(0, least(s.saldo,
                     coalesce(pc.creditado_vencido,0) - pc.ja_usado - pc.ja_expirado)) as valor
    from por_cliente pc
    join cashback_saldos s
      on s.cliente_id = pc.cliente_id and s.loja_id = pc.loja_id and s.saldo > 0
  ),
  baixados as (
    update cashback_saldos s
       set saldo = s.saldo - a.valor, atualizado_em = now()
      from a_expirar a
     where s.cliente_id = a.cliente_id and s.loja_id = a.loja_id and a.valor > 0
    returning s.cliente_id, s.loja_id, a.valor
  ),
  registrados as (
    insert into cashback_movimentos (loja_id, cliente_id, pedido_id, tipo, valor)
    select b.loja_id, b.cliente_id, null, 'EXPIRACAO', -b.valor from baixados b
    returning cashback_movimentos.cliente_id, cashback_movimentos.loja_id, -cashback_movimentos.valor
  )
  select r.cliente_id, r.loja_id, r.valor from registrados r;
end $function$;

comment on function public.fn_expirar_cashback(uuid) is
  'Expira o cashback vencido e não gasto. Rodar diariamente (cron ou edge '
  'function). Sem loja informada, roda para todas.';

revoke execute on function public.fn_expirar_cashback(uuid) from public, anon, authenticated;
grant  execute on function public.fn_expirar_cashback(uuid) to service_role;

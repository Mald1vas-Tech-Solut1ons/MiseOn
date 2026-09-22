-- ═══════════════════════════════════════════════════════════════════════════
-- RESGATE DE CASHBACK NO TOTEM (22/09/2026)
--
-- Até aqui o totem só ACUMULAVA e a tela prometia "use na próxima compra" —
-- promessa sem caminho. `fn_usar_cashback` exige auth.uid(), e o totem é
-- anônimo: o resgate precisa de uma porta própria, aberta pelo token do totem.
--
-- Regras decididas pelo dono (não reabrir):
--   - usa só o saldo ANTERIOR (o crédito do pedido corrente só nasce no
--     FINALIZADO, então isso sai de graça);
--   - teto de 30% do valor do pedido;
--   - saldo mínimo de R$ 5 para resgatar;
--   - resgate e cupom não se somam;
--   - o VALOR é decidido aqui; o totem manda só a intenção (`usar_cashback`);
--   - o saldo vale 15 dias a partir do crédito.
--
-- Buracos fechados de carona, todos medidos em produção:
--   1. Só `fn_cancelar_meu_pedido_pendente` (cliente online) devolvia o saldo.
--      Pedido cancelado no totem, pela loja ou abandonado levava o cashback
--      junto. Agora o estorno é gatilho do CANCELADO — vale para todo caminho.
--   2. `fn_expirar_cashback` existia e não estava no pg_cron: nada expirava.
--   3. `cashback_dias_expiracao` NULO nas lojas = saldo vitalício, enquanto a
--      tela da loja mostrava "60 dias". O prazo agora é regra da plataforma.
--   4. `fn_expirar_cashback` nunca rodou: lia `r.valor` de uma coluna sem
--      nome e caía em "column r.valor does not exist". Achado pela prova.
--   5. O crédito era calculado sobre o total ANTES do cashback usado: quem
--      pagava parte com saldo ganhava cashback sobre o próprio cashback.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Regras num lugar só ────────────────────────────────────────────────────
create or replace function public.fn_cashback_regras()
returns jsonb language sql immutable
set search_path to 'public', 'pg_temp'
as $$ select jsonb_build_object('teto_pct', 30, 'saldo_minimo', 5, 'validade_dias', 15) $$;

/** Quanto do saldo pode abater deste total. Arredonda PARA BAIXO: nunca passa do teto. */
create or replace function public.fn_cashback_valor_resgate(p_saldo numeric, p_total numeric)
returns numeric language sql immutable
set search_path to 'public', 'pg_temp'
as $$
  select case
    when coalesce(p_saldo, 0) < (fn_cashback_regras()->>'saldo_minimo')::numeric then 0
    when coalesce(p_total, 0) <= 0 then 0
    else least(p_saldo, floor(p_total * (fn_cashback_regras()->>'teto_pct')::numeric) / 100)
  end
$$;

-- ── Estorno é um tipo próprio ──────────────────────────────────────────────
-- Gravar a devolução como CREDITO (o que o caminho online fazia) cria saldo
-- sem prazo e faz a expiração achar que aquele uso ainda consumiu crédito.
alter table public.cashback_movimentos drop constraint if exists cashback_movimentos_tipo_check;
alter table public.cashback_movimentos
  add constraint cashback_movimentos_tipo_check
  check (tipo in ('CREDITO', 'USO', 'ESTORNO', 'EXPIRACAO'));

-- ── Crédito: 15 dias, sobre o que foi PAGO ─────────────────────────────────
create or replace function public.fn_creditar_cashback(p_pedido_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_loja uuid; v_cliente uuid; v_subtotal numeric; v_taxa numeric;
  v_desconto numeric; v_usado numeric; v_pct numeric; v_credito numeric;
  v_dias int := (fn_cashback_regras()->>'validade_dias')::int;
begin
  select p.loja_id, p.cliente_id, p.subtotal, p.taxa_entrega, p.desconto, p.cashback_usado
    into v_loja, v_cliente, v_subtotal, v_taxa, v_desconto, v_usado
  from pedidos p where p.id = p_pedido_id;
  if v_cliente is null then return; end if;

  select cashback_pct into v_pct from lojas where id = v_loja;
  if v_pct is null or v_pct <= 0 then return; end if;

  -- Cashback sobre dinheiro que entrou, não sobre o saldo que o cliente gastou.
  v_credito := round((coalesce(v_subtotal,0) + coalesce(v_taxa,0) - coalesce(v_desconto,0)
                      - coalesce(v_usado,0)) * v_pct / 100, 2);
  if v_credito is null or v_credito <= 0 then return; end if;

  insert into cashback_saldos (cliente_id, loja_id, saldo)
  values (v_cliente, v_loja, v_credito)
  on conflict (cliente_id, loja_id) do update
    set saldo = cashback_saldos.saldo + v_credito, atualizado_em = now();

  insert into cashback_movimentos (loja_id, cliente_id, pedido_id, tipo, valor, expira_em)
  values (v_loja, v_cliente, p_pedido_id, 'CREDITO', v_credito,
          now() + make_interval(days => v_dias));
end; $function$;

-- ── Expiração: estorno devolve o uso ───────────────────────────────────────
create or replace function public.fn_expirar_cashback(p_loja_id uuid DEFAULT NULL::uuid)
 returns table(cliente_id uuid, loja_id uuid, expirado numeric)
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  return query
  with por_cliente as (
    select m.cliente_id, m.loja_id,
           sum(m.valor) filter (where m.tipo = 'CREDITO'
                                  and m.expira_em is not null
                                  and m.expira_em <= now())          as creditado_vencido,
           -- uso líquido: o que foi estornado volta a não ter consumido crédito
           coalesce(-sum(m.valor) filter (where m.tipo in ('USO','ESTORNO')), 0) as ja_usado,
           coalesce(-sum(m.valor) filter (where m.tipo = 'EXPIRACAO'), 0) as ja_expirado
    from cashback_movimentos m
    where (p_loja_id is null or m.loja_id = p_loja_id)
    group by m.cliente_id, m.loja_id
  ),
  a_expirar as (
    select pc.cliente_id, pc.loja_id, s.saldo,
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
    returning cashback_movimentos.cliente_id, cashback_movimentos.loja_id, -cashback_movimentos.valor as valor
  )
  select r.cliente_id, r.loja_id, r.valor from registrados r;
end $function$;

-- ── Estorno no CANCELADO, venha de onde vier ───────────────────────────────
-- Soma líquida de TODOS os movimentos do pedido: se o caminho online já
-- devolveu antes de cancelar, a soma dá zero e aqui não acontece nada.
create or replace function public.fn_trg_estornar_cashback_cancelado()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare v_liquido numeric;
begin
  if NEW.cliente_id is null then return null; end if;

  select coalesce(sum(valor), 0) into v_liquido
  from cashback_movimentos where pedido_id = NEW.id;
  if v_liquido >= 0 then return null; end if;

  insert into cashback_saldos (cliente_id, loja_id, saldo)
  values (NEW.cliente_id, NEW.loja_id, -v_liquido)
  on conflict (cliente_id, loja_id) do update
    set saldo = cashback_saldos.saldo - v_liquido, atualizado_em = now();

  insert into cashback_movimentos (loja_id, cliente_id, pedido_id, tipo, valor)
  values (NEW.loja_id, NEW.cliente_id, NEW.id, 'ESTORNO', -v_liquido);
  return null;
end; $function$;

drop trigger if exists trg_estornar_cashback_cancelado on public.pedidos;
create trigger trg_estornar_cashback_cancelado
  after update of status on public.pedidos
  for each row
  when (NEW.status = 'CANCELADO' and OLD.status is distinct from 'CANCELADO')
  execute function public.fn_trg_estornar_cashback_cancelado();

-- ── Consulta do totem: quanto dá para usar NESTE carrinho ──────────────────
-- O totem mostra o valor, mas não o decide: o pedido refaz a conta sozinho.
-- Devolve só números — nada de nome — porque quem digita o telefone é quem
-- está na frente da tela, não necessariamente o dono dele.
create or replace function public.fn_totem_saldo_cashback(p_token uuid, p_telefone text, p_itens jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_loja uuid; v_cliente uuid; v_saldo numeric := 0; v_total numeric := 0;
  v_tel text := nullif(regexp_replace(coalesce(p_telefone,''), '[^0-9]', '', 'g'), '');
  v_rl jsonb; v_expira timestamptz;
begin
  select id into v_loja from lojas
   where totem_ativo is true and totem_token is not null and totem_token = p_token;
  if v_loja is null then raise exception 'Totem nao autorizado.'; end if;

  -- Sem teto, o token do totem vira oráculo de saldo por telefone.
  v_rl := fn_rate_limit_consumir('totem-cashback:' || v_loja::text, 60, 30);
  if not coalesce((v_rl->>'permitido')::boolean, true) then
    return jsonb_build_object('saldo', 0, 'resgate', 0, 'motivo', 'limite');
  end if;

  if v_tel is null or length(v_tel) < 10 then
    return jsonb_build_object('saldo', 0, 'resgate', 0);
  end if;

  select id into v_cliente from clientes where loja_id = v_loja and telefone = v_tel limit 1;
  if v_cliente is null then return jsonb_build_object('saldo', 0, 'resgate', 0); end if;

  -- Saldo vencido não pode aparecer como disponível.
  perform fn_expirar_cashback(v_loja);
  select coalesce(saldo, 0) into v_saldo
  from cashback_saldos where cliente_id = v_cliente and loja_id = v_loja;

  -- Mesmo preço que o pedido vai usar: produto + opções, do banco.
  select coalesce(sum((pr.preco + coalesce(op.soma, 0))
                      * coalesce(nullif(it->>'quantidade','')::numeric, 1)), 0)
    into v_total
  from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) it
  join produtos pr on pr.id = nullif(it->>'produto_id','')::uuid and pr.loja_id = v_loja
  left join lateral (
    select sum(o.preco_adicional) soma
    from jsonb_array_elements(coalesce(it->'opcoes','[]'::jsonb)) sel
    join opcoes o on o.id = nullif(sel->>'id','')::uuid
  ) op on true;

  select min(m.expira_em) into v_expira
  from cashback_movimentos m
  where m.cliente_id = v_cliente and m.loja_id = v_loja and m.tipo = 'CREDITO'
    and m.expira_em > now();

  return jsonb_build_object(
    'saldo', coalesce(v_saldo, 0),
    'resgate', fn_cashback_valor_resgate(coalesce(v_saldo, 0), v_total),
    'expira_em', v_expira,
    'saldo_minimo', (fn_cashback_regras()->>'saldo_minimo')::numeric,
    'teto_pct', (fn_cashback_regras()->>'teto_pct')::numeric);
end; $function$;

-- ── Criação do pedido do totem, agora com resgate ──────────────────────────
create or replace function public.fn_totem_criar_pedido(p_token uuid, p_payload jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_loja uuid; v_metodo text := coalesce(p_payload->>'metodo','PIX');
  v_pedido uuid; v_numero integer; v_total numeric;
  v_item jsonb; v_item_id uuid; v_status status_pedido;
  v_email text := nullif(lower(btrim(p_payload->>'email')),'');
  v_tel   text := nullif(regexp_replace(coalesce(p_payload->>'telefone',''), '[^0-9]', '', 'g'),'');
  v_doc   text := nullif(regexp_replace(coalesce(p_payload->>'documento',''), '[^0-9]', '', 'g'),'');
  v_cliente uuid;
  v_quer_cashback boolean := coalesce((p_payload->>'usar_cashback')::boolean, false);
  v_saldo numeric; v_resgate numeric := 0;
begin
  -- As duas chaves do produto contratado. Nenhuma sozinha abre a porta.
  select id into v_loja from lojas
   where totem_ativo is true and totem_token is not null and totem_token = p_token;
  if v_loja is null then
    raise exception 'Totem nao autorizado: verifique se o MiseOn Kiosk esta contratado para esta loja e se o aparelho foi vinculado.';
  end if;
  if jsonb_array_length(coalesce(p_payload->'itens','[]'::jsonb)) = 0 then
    raise exception 'Pedido sem itens.'; end if;

  if v_email is not null or v_tel is not null then
    select id into v_cliente from clientes
     where loja_id = v_loja
       and ((v_email is not null and lower(email) = v_email) or (v_tel is not null and telefone = v_tel))
     limit 1;
    if v_cliente is null then
      insert into clientes (loja_id, telefone, nome, email)
      values (v_loja, coalesce(v_tel, 'totem-' || substr(md5(coalesce(v_email,'')),1,11)),
              nullif(btrim(p_payload->>'nome'),''), v_email)
      returning id into v_cliente;
    elsif v_email is not null then
      update clientes set email = coalesce(email, v_email) where id = v_cliente;
    end if;
  end if;

  v_status := case when v_metodo in ('PIX','CREDITO')
                   then 'AGUARDANDO_PAGAMENTO'::status_pedido else 'NOVO'::status_pedido end;

  -- Cupom não entra por aqui: o totem não tem campo de cupom, e resgate e
  -- cupom não se somam. Se um dia entrar, a exclusão continua valendo abaixo.
  insert into pedidos (loja_id, tipo_pedido, origem, status, identificador_cliente,
                       observacao, cliente_id, documento_cliente)
  values (v_loja, 'RETIRADA_BALCAO', 'totem', v_status,
          coalesce(nullif(btrim(p_payload->>'nome'),''), 'Totem'),
          nullif(p_payload->>'observacao',''), v_cliente, v_doc)
  returning id, numero into v_pedido, v_numero;

  for v_item in select * from jsonb_array_elements(p_payload->'itens') loop
    -- Preco e nome vem do BANCO, nunca do payload: o totem fica na rua.
    insert into itens_pedido (pedido_id, produto_id, nome_produto, preco_unitario, quantidade, observacao)
    select v_pedido, pr.id, pr.nome, pr.preco,
           coalesce(nullif(v_item->>'quantidade','')::numeric,1), nullif(v_item->>'observacao','')
      from produtos pr where pr.id = nullif(v_item->>'produto_id','')::uuid and pr.loja_id = v_loja
    returning id into v_item_id;
    if v_item_id is null then raise exception 'Produto % nao pertence a esta loja.', v_item->>'produto_id'; end if;
    insert into itens_pedido_opcoes (item_id, opcao_id, nome_opcao, preco_adicional)
    select v_item_id, o.id, o.nome, o.preco_adicional
      from jsonb_array_elements(coalesce(v_item->'opcoes','[]'::jsonb)) sel
      join opcoes o on o.id = nullif(sel->>'id','')::uuid;
  end loop;

  v_total := fn_recalcular_pedido(v_pedido);

  -- RESGATE. O totem manda só a intenção; o valor sai daqui, do saldo que
  -- existia ANTES deste pedido e do total que o banco acabou de calcular.
  if v_quer_cashback and v_cliente is not null
     and not exists (select 1 from pedidos where id = v_pedido and cupom_id is not null) then
    perform fn_expirar_cashback(v_loja);
    -- Trava a linha: dois pedidos do mesmo telefone ao mesmo tempo não gastam
    -- o mesmo saldo duas vezes.
    select saldo into v_saldo from cashback_saldos
     where cliente_id = v_cliente and loja_id = v_loja for update;
    v_resgate := fn_cashback_valor_resgate(coalesce(v_saldo, 0), coalesce(v_total, 0));
    if v_resgate > 0 then
      update cashback_saldos set saldo = saldo - v_resgate, atualizado_em = now()
       where cliente_id = v_cliente and loja_id = v_loja;
      insert into cashback_movimentos (loja_id, cliente_id, pedido_id, tipo, valor)
      values (v_loja, v_cliente, v_pedido, 'USO', -v_resgate);
      v_total := fn_recalcular_pedido(v_pedido);
    end if;
  end if;

  insert into pagamentos (pedido_id, metodo, valor_pago)
  values (v_pedido, v_metodo::metodo_pgto, coalesce(v_total,0));

  return jsonb_build_object('pedido_id', v_pedido, 'numero', v_numero,
    'senha', (select senha from pedidos where id = v_pedido),
    'valor_total', coalesce(v_total,0), 'status', v_status::text,
    'identificado', v_cliente is not null,
    'cashback_usado', v_resgate,
    'cashback_validade_dias', (fn_cashback_regras()->>'validade_dias')::int,
    'cashback_pct', (select coalesce(cashback_pct,0) from lojas where id = v_loja));
end; $function$;

-- ── Pedido do totem esquecido com saldo preso ──────────────────────────────
-- O totem cancela ao desistir, mas aparelho desligado no meio do Pix deixa o
-- pedido AGUARDANDO_PAGAMENTO para sempre, com o cashback do cliente dentro.
-- A cobrança expira em 1h (pix-criar-cobranca); 2h depois ninguém paga mais.
create or replace function public.fn_cashback_manutencao()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare v_cancelados int; v_expirados int;
begin
  with alvo as (
    select p.id from pedidos p
    where p.origem = 'totem' and p.status = 'AGUARDANDO_PAGAMENTO'
      and p.criado_em < now() - interval '2 hours'
      and exists (select 1 from cashback_movimentos m where m.pedido_id = p.id and m.tipo = 'USO')
      and not exists (select 1 from pagamentos pg where pg.pedido_id = p.id and pg.status = 'PAGO')
  ), cancelados as (
    update pedidos p set status = 'CANCELADO',
           motivo_cancelamento = 'Pix do totem não pago; cashback devolvido'
      from alvo where p.id = alvo.id
    returning p.id
  )
  select count(*) into v_cancelados from cancelados;

  update pagamentos pg set status = 'CANCELADO'
   where pg.status = 'PENDENTE'
     and pg.pedido_id in (select id from pedidos where status = 'CANCELADO' and origem = 'totem'
                           and motivo_cancelamento = 'Pix do totem não pago; cashback devolvido');

  select count(*) into v_expirados from fn_expirar_cashback(null);
  return jsonb_build_object('cancelados', v_cancelados, 'expirados', v_expirados);
end; $function$;

-- ── Saldo antigo sem prazo ganha os 15 dias a contar de hoje ───────────────
-- Só existe no tenant de provas (medido: 10 créditos, todos lanchepaulista).
update public.cashback_movimentos
   set expira_em = now() + make_interval(days => (public.fn_cashback_regras()->>'validade_dias')::int)
 where tipo = 'CREDITO' and expira_em is null;

-- ── Grants: função nova em public nasce exposta (DEFAULT PRIVILEGES) ───────
revoke all on function public.fn_cashback_regras() from public, anon, authenticated;
revoke all on function public.fn_cashback_valor_resgate(numeric, numeric) from public, anon, authenticated;
revoke all on function public.fn_trg_estornar_cashback_cancelado() from public, anon, authenticated;
revoke all on function public.fn_cashback_manutencao() from public, anon, authenticated;
revoke all on function public.fn_totem_saldo_cashback(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.fn_creditar_cashback(uuid) from public, anon, authenticated;
revoke all on function public.fn_expirar_cashback(uuid) from public, anon, authenticated;
grant execute on function public.fn_totem_saldo_cashback(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.fn_cashback_regras() to service_role;
grant execute on function public.fn_cashback_valor_resgate(numeric, numeric) to service_role;
grant execute on function public.fn_cashback_manutencao() to service_role;
grant execute on function public.fn_creditar_cashback(uuid) to service_role;
grant execute on function public.fn_expirar_cashback(uuid) to service_role;

-- ── Agenda ─────────────────────────────────────────────────────────────────
select cron.unschedule(jobid) from cron.job where jobname = 'cashback-manutencao';
select cron.schedule('cashback-manutencao', '*/15 * * * *', 'select public.fn_cashback_manutencao()');

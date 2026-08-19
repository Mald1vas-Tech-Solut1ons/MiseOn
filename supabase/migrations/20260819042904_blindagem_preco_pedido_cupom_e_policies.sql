-- ═══════════════════════════════════════════════════════════════════════════
-- Blindagem do valor do pedido, das regras de cupom e das policies públicas.
--
-- Contexto: fn_recalcular_pedido é a autoridade sobre quanto cobrar (Pix e
-- cartão chamam ela antes de gerar a cobrança). Ela tinha quatro brechas que
-- deixavam o browser ditar o preço, e as regras de cupom (limite de uso,
-- primeira compra, método) nunca eram aplicadas no servidor.
--
-- Cuidado tomado: dois fluxos legítimos gravam dado que parece suspeito e NÃO
-- podem quebrar — a balança (item com produto_id nulo, venda por peso) e o PDV
-- (pedido sem cliente_user_id, criado pelo operador). Ambos são de staff
-- autenticado, então a distinção é "quem inseriu", não "o dado é nulo".
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Constraints de sinal ────────────────────────────────────────────────
-- Sem isto, taxa_entrega = -50 derrubava o total de um pedido de R$60 para R$10
-- e a cobrança Pix saía nesse valor. Base conferida: zero linhas violando.

alter table pedidos
  add constraint pedidos_valores_nao_negativos
  check (
    taxa_entrega   >= 0 and
    subtotal       >= 0 and
    desconto       >= 0 and
    valor_total    >= 0 and
    cashback_usado >= 0
  );

alter table itens_pedido
  add constraint itens_pedido_preco_nao_negativo
  check (preco_unitario >= 0);

alter table itens_pedido_opcoes
  add constraint itens_pedido_opcoes_preco_nao_negativo
  check (preco_adicional >= 0);


-- ── 2. fn_recalcular_pedido: preço vem do catálogo, não do cliente ─────────
create or replace function fn_recalcular_pedido(p_pedido_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_loja uuid; v_cupom uuid; v_taxa numeric; v_cashback numeric;
  v_subtotal numeric := 0; v_desconto numeric := 0; v_total numeric;
  v_metodo text; v_cliente uuid; v_intruso int;
  c record;
begin
  select loja_id, cupom_id, coalesce(taxa_entrega, 0), cliente_id
    into v_loja, v_cupom, v_taxa, v_cliente
  from pedidos where id = p_pedido_id;
  if v_loja is null then return null; end if;

  -- Item apontando para produto que não é desta loja é adulteração: antes o
  -- join não filtrava por loja e dava para referenciar o item de R$1 de outra
  -- loja pagando por esse preço. Aborta em vez de calcular errado.
  select count(*) into v_intruso
  from itens_pedido ip
  join produtos pr on pr.id = ip.produto_id
  where ip.pedido_id = p_pedido_id and pr.loja_id <> v_loja;
  if v_intruso > 0 then
    raise exception 'Pedido % contém item de outra loja.', p_pedido_id;
  end if;

  -- produto_id nulo é legítimo só na venda por peso (balança), inserida por
  -- staff — a policy de INSERT abaixo é quem garante isso. Aqui, quando existe
  -- produto, o preço é SEMPRE o do catálogo; o preco_unitario do cliente só
  -- vale para o item avulso da balança. Mesma regra para as opções.
  select coalesce(sum(
           (coalesce(pr.preco, ip.preco_unitario) + coalesce(op.soma, 0)) * ip.quantidade
         ), 0)
    into v_subtotal
  from itens_pedido ip
  left join produtos pr on pr.id = ip.produto_id and pr.loja_id = v_loja
  left join lateral (
    select sum(coalesce(o.preco_adicional, ipo.preco_adicional)) as soma
    from itens_pedido_opcoes ipo
    left join opcoes o on o.id = ipo.opcao_id
    where ipo.item_id = ip.id
  ) op on true
  where ip.pedido_id = p_pedido_id;

  -- Método de pagamento do pedido (para cupom com metodo_exigido). Só era
  -- checado no browser, em CheckoutDrawer.tsx — ou seja, contornável.
  select metodo::text into v_metodo
  from pagamentos where pedido_id = p_pedido_id
  order by criado_em desc limit 1;

  -- ── Cupom: agora com TODAS as regras que a tabela promete ───────────────
  if v_cupom is not null then
    select * into c from cupons
      where id = v_cupom and loja_id = v_loja and ativo
        and (validade is null or validade >= current_date)
        and v_subtotal >= coalesce(pedido_minimo, 0)
        -- limite_usos: era configuração morta, nada no sistema conferia
        and (limite_usos is null or coalesce(usos, 0) < limite_usos)
        -- metodo_exigido: agora vale no servidor
        and (metodo_exigido is null or v_metodo is null or metodo_exigido::text = v_metodo);

    -- apenas_primeiro_pedido: só vale se o cliente não tem pedido anterior
    -- encerrado nesta loja (o próprio pedido em curso não conta).
    if found and c.apenas_primeiro_pedido and v_cliente is not null then
      if exists (
        select 1 from pedidos ant
        where ant.cliente_id = v_cliente
          and ant.loja_id = v_loja
          and ant.id <> p_pedido_id
          and ant.status = 'FINALIZADO'
      ) then
        c := null;
      end if;
    end if;

    if c.id is not null then
      v_desconto := case when c.tipo = 'FIXO'
        then least(c.valor, v_subtotal)
        else round(v_subtotal * c.valor / 100, 2) end;
    end if;
  end if;

  select coalesce(-sum(cm.valor), 0)
    into v_cashback
  from cashback_movimentos cm
  where cm.pedido_id = p_pedido_id and cm.tipo = 'USO';

  v_cashback := least(greatest(v_cashback, 0), v_subtotal + v_taxa - v_desconto);

  v_total := greatest(0, v_subtotal + v_taxa - v_desconto - v_cashback);

  update pedidos
     set subtotal = v_subtotal, desconto = v_desconto, valor_total = v_total,
         cashback_usado = v_cashback,
         atualizado_em = now()
   where id = p_pedido_id;

  return v_total;
end;
$fn$;


-- ── 3. Contador de uso do cupom ────────────────────────────────────────────
-- `usos` nunca era incrementado em lugar nenhum do sistema, então limite_usos
-- não segurava nada e o contador do painel do lojista ficava sempre em zero.
-- Incrementa na confirmação do pagamento (não na criação do pedido, senão
-- carrinho abandonado queimaria cupom), o que cobre Pix, cartão e cashback.

create or replace function fn_trg_incrementa_uso_cupom()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare v_cupom uuid;
begin
  if NEW.status = 'PAGO' and (TG_OP = 'INSERT' or OLD.status is distinct from 'PAGO') then
    select cupom_id into v_cupom from pedidos where id = NEW.pedido_id;
    if v_cupom is not null then
      update cupons set usos = coalesce(usos, 0) + 1 where id = v_cupom;
    end if;
  end if;
  return NEW;
end;
$fn$;

drop trigger if exists trg_incrementa_uso_cupom on pagamentos;
create trigger trg_incrementa_uso_cupom
  after insert or update of status on pagamentos
  for each row execute function fn_trg_incrementa_uso_cupom();


-- ── 4. fn_cliente_confirmar_recebimento: exige ser dono do pedido ──────────
-- Era executável por anon sem nenhuma checagem de dono: com o UUID do pedido
-- dava para forçar EM_ROTA -> FINALIZADO, o que dispara fn_creditar_cashback e
-- lança a receita no ledger com a entrega ainda na rua.

create or replace function fn_cliente_confirmar_recebimento(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_status text;
  v_tipo text;
begin
  if not exists (
    select 1 from pedidos
    where id = p_pedido_id and cliente_user_id = auth.uid()
  ) then
    raise exception 'Você só pode confirmar o recebimento de um pedido seu.';
  end if;

  select status, tipo_pedido into v_status, v_tipo from pedidos where id = p_pedido_id;

  if v_status is null then
    raise exception 'Pedido não encontrado.';
  end if;

  if v_status in ('FINALIZADO', 'CANCELADO') then
    raise exception 'O pedido já está finalizado ou cancelado.';
  end if;

  if (v_tipo = 'DELIVERY' and v_status <> 'EM_ROTA') then
    raise exception 'Você só pode confirmar o recebimento de um delivery se ele já saiu para entrega (EM ROTA).';
  end if;

  if (v_tipo in ('SALAO', 'RETIRADA_BALCAO') and v_status <> 'PRONTO') then
    raise exception 'Você só pode confirmar o recebimento se o pedido estiver PRONTO.';
  end if;

  update pedidos set status = 'FINALIZADO' where id = p_pedido_id;
end;
$fn$;


-- ── 5. Policies: fecha criação anônima e complemento livre ─────────────────

-- pub_cria_pedido só exigia "cliente_user_id nulo OU meu" — deixando nulo,
-- qualquer anônimo criava pedido em qualquer loja, à vontade (flood no KDS,
-- fila de e-mail e DRE poluído). Os dois donos legítimos são: o cliente logado
-- (delivery/balcão) e o staff da loja (PDV, balança, garçom). Mesa continua
-- entrando por fn_pedido_mesa_criar, que é SECURITY DEFINER e não passa aqui.
drop policy if exists pub_cria_pedido on pedidos;
create policy cria_pedido_cliente_ou_staff on pedidos
  for insert
  with check (
    cliente_user_id = auth.uid()
    or fn_meu_acesso(loja_id)
  );

-- Complemento podia ser inserido por qualquer um em qualquer item
-- (WITH CHECK true), com preço arbitrário.
drop policy if exists pub_cria_opcao on itens_pedido_opcoes;
create policy cria_opcao_do_proprio_pedido on itens_pedido_opcoes
  for insert
  with check (
    exists (
      select 1 from itens_pedido ip
      join pedidos p on p.id = ip.pedido_id
      where ip.id = itens_pedido_opcoes.item_id
        and (p.cliente_user_id = auth.uid() or fn_meu_acesso(p.loja_id))
    )
  );

-- Item sem produto (preço livre) é privilégio da balança, que é staff.
-- O cliente só pode inserir item que aponta para produto real da própria loja.
drop policy if exists cria_item_do_proprio_pedido on itens_pedido;
create policy cria_item_do_proprio_pedido on itens_pedido
  for insert
  with check (
    exists (
      select 1 from pedidos p
      where p.id = itens_pedido.pedido_id
        and (
          fn_meu_acesso(p.loja_id)
          or (
            p.cliente_user_id = auth.uid()
            and exists (
              select 1 from produtos pr
              where pr.id = itens_pedido.produto_id and pr.loja_id = p.loja_id
            )
          )
        )
    )
  );


-- ── 6. Cupons deixam de ser catálogo público ──────────────────────────────
-- `pub_cupons` era FOR SELECT USING (ativo), sem escopo de loja: qualquer
-- anônimo listava os cupons de TODAS as lojas, inclusive os de recuperação de
-- carrinho (VOLTA****), que são gerados para um cliente específico.
-- Validação passa a ser por RPC: manda o código, recebe válido/inválido.

drop policy if exists pub_cupons on cupons;

create or replace function fn_validar_cupom(
  p_loja_id uuid,
  p_codigo  text,
  p_subtotal numeric default 0,
  p_metodo  text default null
)
returns table (
  id uuid, codigo text, descricao text, tipo text, valor numeric,
  pedido_minimo numeric, desconto numeric
)
language plpgsql
security definer
set search_path = public
as $fn$
declare c record; v_cliente uuid;
begin
  select * into c from cupons
   where loja_id = p_loja_id
     and upper(btrim(codigo)) = upper(btrim(p_codigo))
     and ativo
     and (validade is null or validade >= current_date)
     and (limite_usos is null or coalesce(usos, 0) < limite_usos)
     and (metodo_exigido is null or p_metodo is null or metodo_exigido::text = p_metodo);

  if not found then
    raise exception 'Cupom inválido ou expirado.';
  end if;

  if coalesce(p_subtotal, 0) < coalesce(c.pedido_minimo, 0) then
    raise exception 'Este cupom vale a partir de %.', to_char(c.pedido_minimo, 'FM999G999D00');
  end if;

  if c.apenas_primeiro_pedido then
    select cl.id into v_cliente from clientes cl
     where cl.user_id = auth.uid() and cl.loja_id = p_loja_id;
    if v_cliente is not null and exists (
      select 1 from pedidos ant
       where ant.cliente_id = v_cliente and ant.loja_id = p_loja_id
         and ant.status = 'FINALIZADO'
    ) then
      raise exception 'Este cupom é só para a primeira compra.';
    end if;
  end if;

  return query select
    c.id, c.codigo, c.descricao, c.tipo::text, c.valor, c.pedido_minimo,
    case when c.tipo = 'FIXO'
      then least(c.valor, coalesce(p_subtotal, 0))
      else round(coalesce(p_subtotal, 0) * c.valor / 100, 2) end;
end;
$fn$;

revoke all on function fn_validar_cupom(uuid, text, numeric, text) from public;
grant execute on function fn_validar_cupom(uuid, text, numeric, text) to anon, authenticated;

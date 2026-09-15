-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Cupom com janela de horário: o desconto que achata o pico.               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- A LACUNA
--
-- "Faço desconto para quem almoça depois da 1h40." O restaurante por quilo usa
-- preço para mover gente do pico para a borda do serviço: a fila de 12h30 não
-- cabe no salão, e a das 14h paga o mesmo aluguel com o salão vazio.
--
-- Medido em produção antes de escrever qualquer linha:
--
--   select column_name from information_schema.columns
--   where table_schema='public' and table_name='cupons';
--   → validade (date). Só isso. Não havia hora, não havia dia da semana.
--
-- O lojista conseguia dizer "vale até 30 de setembro" e nada mais. Para dizer
-- "vale das 14h às 17h, de segunda a sexta" ele teria que ligar e desligar o
-- cupom na mão, duas vezes por dia, cinco dias por semana.
--
-- O QUE ENTRA
--
--   hora_inicio time  ·  hora_fim time  ·  dias_semana smallint[]
--
-- Tudo nulo = sem restrição. Os 4 cupons que já existem em produção não mudam
-- de comportamento: a migração é aditiva e o predicado devolve verdadeiro
-- quando as três colunas estão nulas.
--
-- Combinações que o lojista escreve de verdade:
--
--   depois das 13h40      hora_inicio 13:40 · hora_fim NULL
--   só no almoço          hora_inicio 11:00 · hora_fim 14:00
--   happy hour de quinta  hora_inicio 18:00 · hora_fim 20:00 · dias {4}
--   madrugada             hora_inicio 22:00 · hora_fim 02:00  (cruza o dia)
--   só em dia de semana   dias {1,2,3,4,5}
--
-- FUSO: A HORA É A DA LOJA, NÃO A DO BANCO
--
--   select current_setting('TimeZone') → UTC
--
-- O banco roda em UTC. Um cupom "a partir das 13h40" comparado contra a hora
-- do banco valeria a partir das 10h40 em São Paulo — três horas de desconto
-- que o lojista não autorizou, todo dia. A conversão para 'America/Sao_Paulo'
-- é a mesma que fn_loja_aberta já faz, e dias_semana usa a mesma convenção
-- dela (EXTRACT(DOW): 0=domingo .. 6=sábado).
--
-- UM PREDICADO, DOIS CHAMADORES
--
-- A regra mora em fn_cupom_na_janela e em nenhum outro lugar. fn_validar_cupom
-- (a prévia, antes de fechar) e fn_revalidar_desconto_pedido (o servidor, no
-- commit) chamam a MESMA função. Foi exatamente a divergência entre esses dois
-- caminhos que deixou o desconto na mão do navegador até hoje de manhã; não se
-- repete a trilha.
--
-- O MOMENTO QUE VALE É O DO PEDIDO, NÃO O DA COBRANÇA
--
-- A prévia checa contra now(). O servidor checa contra pedidos.criado_em.
-- A diferença é o cliente que fecha o carrinho às 13h58 com um cupom que
-- termina às 14h e paga às 14h05: cobrar dele o preço cheio depois de ter
-- mostrado o preço com desconto é quebra de combinado, não regra de negócio.
--
-- E É POR ISSO QUE criado_em PRECISA DEIXAR DE SER DO NAVEGADOR
--
--   select grantee, privilege_type from information_schema.column_privileges
--   where table_name='pedidos' and column_name='criado_em';
--   → anon INSERT/UPDATE · authenticated INSERT/UPDATE
--
-- Ancorar a janela em criado_em sem fechar isso seria trocar uma fraude por
-- outra: bastaria mandar criado_em dentro da janela para levar o desconto de
-- qualquer hora. Varredura no repositório: nenhum INSERT de pedido — nem do
-- iFood, nem do totem, nem do garçom, nem das suítes — escreve criado_em.
-- Todos dependem do default. Então o gatilho pode fixar sem quebrar ninguém,
-- e de quebra o relatório por faixa de horário passa a ter hora de origem
-- confiável.

begin;

-- ── 1. As colunas ─────────────────────────────────────────────────────────

alter table public.cupons
  add column if not exists hora_inicio time,
  add column if not exists hora_fim    time,
  add column if not exists dias_semana smallint[];

comment on column public.cupons.hora_inicio is
  'Hora da loja (America/Sao_Paulo) a partir da qual o cupom vale. NULL = desde a abertura.';
comment on column public.cupons.hora_fim is
  'Hora da loja até a qual o cupom vale. NULL = até o fim do dia. Menor que hora_inicio = janela que cruza a meia-noite.';
comment on column public.cupons.dias_semana is
  'Dias em que o cupom vale, na convenção EXTRACT(DOW): 0=domingo .. 6=sábado. NULL = todos os dias.';

-- Array vazio significaria "nunca vale", que ninguém quer dizer de propósito.
-- array_length devolve NULL para o array vazio, e NULL numa CHECK passa — daí
-- o coalesce. O operador <@ recusa de brinde elemento nulo dentro do array.
alter table public.cupons drop constraint if exists cupons_dias_semana_valido;
alter table public.cupons
  add constraint cupons_dias_semana_valido check (
    dias_semana is null or (
      coalesce(array_length(dias_semana, 1), 0) between 1 and 7
      and dias_semana <@ array[0,1,2,3,4,5,6]::smallint[]
    )
  );

-- ── 2. O predicado ────────────────────────────────────────────────────────

create or replace function public.fn_cupom_na_janela(
  p_hora_inicio time,
  p_hora_fim    time,
  p_dias        smallint[],
  p_momento     timestamptz default now()
)
returns boolean
language sql
stable
set search_path to ''
as $fn$
  with t as (
    select
      (p_momento at time zone 'America/Sao_Paulo')::time                     as hm,
      extract(dow from p_momento at time zone 'America/Sao_Paulo')::smallint as hoje,
      ((extract(dow from p_momento at time zone 'America/Sao_Paulo')::int + 6) % 7)::smallint as ontem
  )
  select case
    -- Sem janela de hora: o dia da semana decide sozinho.
    when p_hora_inicio is null and p_hora_fim is null then
      p_dias is null or t.hoje = any(p_dias)

    when p_hora_inicio is null then
      t.hm <= p_hora_fim and (p_dias is null or t.hoje = any(p_dias))

    when p_hora_fim is null then
      t.hm >= p_hora_inicio and (p_dias is null or t.hoje = any(p_dias))

    when p_hora_fim > p_hora_inicio then
      t.hm >= p_hora_inicio and t.hm <= p_hora_fim
      and (p_dias is null or t.hoje = any(p_dias))

    -- Cruza a meia-noite. A madrugada de sábado pertence à noite de sexta:
    -- quem marcou "sexta, 22h às 02h" quer o cliente de 1h da manhã dentro.
    else
      (t.hm >= p_hora_inicio and (p_dias is null or t.hoje  = any(p_dias)))
      or
      (t.hm <= p_hora_fim    and (p_dias is null or t.ontem = any(p_dias)))
  end
  from t;
$fn$;

comment on function public.fn_cupom_na_janela(time, time, smallint[], timestamptz) is
  'Único lugar onde a janela de horário do cupom é decidida. A hora vira hora da loja antes de comparar.';

grant execute on function public.fn_cupom_na_janela(time, time, smallint[], timestamptz)
  to anon, authenticated, service_role;

-- ── 3. criado_em passa a ser do servidor ──────────────────────────────────

create or replace function public.fn_trg_criado_em_do_servidor()
returns trigger
language plpgsql
security definer
set search_path to ''
as $fn$
begin
  if tg_op = 'INSERT' then
    new.criado_em := now();
  else
    new.criado_em := old.criado_em;   -- a hora do pedido não se move
  end if;
  return new;
end;
$fn$;

-- O 01 no nome faz cair antes de trg_numero_pedido e dos outros BEFORE, que
-- disparam em ordem alfabética: quem ler criado_em depois já lê o do servidor.
drop trigger if exists trg_01_criado_em_do_servidor on public.pedidos;
create trigger trg_01_criado_em_do_servidor
  before insert or update on public.pedidos
  for each row execute function public.fn_trg_criado_em_do_servidor();

-- ── 4. A prévia: fn_validar_cupom ─────────────────────────────────────────

create or replace function public.fn_validar_cupom(
  p_loja_id  uuid,
  p_codigo   text,
  p_subtotal numeric default 0,
  p_metodo   text default null
)
returns table(id uuid, codigo text, descricao text, tipo text, valor numeric,
              pedido_minimo numeric, desconto numeric, frete_gratis boolean)
language plpgsql
security definer
set search_path to ''
as $fn$
DECLARE
  c record;
  v_cliente uuid;
  v_dias text;
  v_quando text;
BEGIN
  SELECT cu.* INTO c
  FROM public.cupons cu
  WHERE cu.loja_id = p_loja_id
    AND upper(btrim(cu.codigo)) = upper(btrim(coalesce(p_codigo, '')));

  IF NOT FOUND THEN RAISE EXCEPTION 'Não encontramos esse cupom nesta loja. Confira o código.'; END IF;

  SELECT cl.id INTO v_cliente FROM public.clientes cl
  WHERE cl.user_id = auth.uid() AND cl.loja_id = p_loja_id;

  IF NOT c.ativo THEN RAISE EXCEPTION 'Este cupom não está mais disponível.'; END IF;
  IF c.validade IS NOT NULL AND c.validade < current_date THEN
    RAISE EXCEPTION 'Este cupom venceu em %.', to_char(c.validade, 'DD/MM/YYYY');
  END IF;

  -- Janela de horário. A mensagem carrega a regra inteira de propósito: quem
  -- ouve "não vale agora" tenta de novo na hora errada; quem ouve "vale das
  -- 14h às 17h" volta às 14h.
  IF NOT public.fn_cupom_na_janela(c.hora_inicio, c.hora_fim, c.dias_semana) THEN
    IF c.dias_semana IS NOT NULL THEN
      SELECT string_agg(
               CASE d WHEN 0 THEN 'domingo' WHEN 1 THEN 'segunda' WHEN 2 THEN 'terça'
                      WHEN 3 THEN 'quarta'  WHEN 4 THEN 'quinta'  WHEN 5 THEN 'sexta'
                      ELSE 'sábado' END, ', ' ORDER BY d)
        INTO v_dias
      FROM unnest(c.dias_semana) d;
    END IF;

    IF c.hora_inicio IS NOT NULL AND c.hora_fim IS NOT NULL THEN
      v_quando := format('das %s às %s', to_char(c.hora_inicio, 'HH24hMI'),
                                         to_char(c.hora_fim, 'HH24hMI'));
    ELSIF c.hora_inicio IS NOT NULL THEN
      v_quando := format('a partir das %s', to_char(c.hora_inicio, 'HH24hMI'));
    ELSIF c.hora_fim IS NOT NULL THEN
      v_quando := format('até as %s', to_char(c.hora_fim, 'HH24hMI'));
    END IF;

    -- Um único marcador: em PL/pgSQL '%%' é um por cento literal, não dois
    -- buracos de substituição. A frase é montada antes e entregue inteira.
    IF v_quando IS NOT NULL AND v_dias IS NOT NULL THEN
      RAISE EXCEPTION '%', format('Este cupom vale %s, %s.', v_quando, v_dias);
    ELSIF v_quando IS NOT NULL THEN
      RAISE EXCEPTION '%', format('Este cupom vale %s.', v_quando);
    ELSE
      RAISE EXCEPTION '%', format('Este cupom vale só %s.', v_dias);
    END IF;
  END IF;

  IF c.limite_usos IS NOT NULL AND coalesce(c.usos, 0) >= c.limite_usos THEN
    RAISE EXCEPTION 'Este cupom já atingiu o limite de usos.';
  END IF;
  IF c.metodo_exigido IS NOT NULL AND p_metodo IS NOT NULL
     AND c.metodo_exigido::text <> p_metodo THEN
    RAISE EXCEPTION 'Este cupom vale só no pagamento por %.',
      CASE c.metodo_exigido::text
        WHEN 'PIX' THEN 'Pix' WHEN 'CREDITO' THEN 'cartão de crédito'
        WHEN 'DEBITO' THEN 'cartão de débito' WHEN 'DINHEIRO' THEN 'dinheiro'
        ELSE c.metodo_exigido::text END;
  END IF;
  IF coalesce(p_subtotal, 0) < coalesce(c.pedido_minimo, 0) THEN
    RAISE EXCEPTION 'Este cupom vale a partir de R$ %.', to_char(c.pedido_minimo, 'FM999G999D00');
  END IF;
  IF c.cliente_id IS NOT NULL AND c.cliente_id IS DISTINCT FROM v_cliente THEN
    RAISE EXCEPTION 'Este cupom foi emitido para outro cliente.';
  END IF;

  IF c.apenas_primeiro_pedido THEN
    IF v_cliente IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.pedidos ant
      WHERE ant.cliente_id = v_cliente AND ant.loja_id = p_loja_id AND ant.status = 'FINALIZADO'
    ) THEN
      RAISE EXCEPTION 'Este cupom é só para a primeira compra.';
    END IF;
  END IF;

  RETURN QUERY SELECT
    c.id, c.codigo, c.descricao, c.tipo::text, c.valor, c.pedido_minimo,
    CASE WHEN c.tipo = 'FIXO'
      THEN least(c.valor, coalesce(p_subtotal, 0))
      ELSE round(coalesce(p_subtotal, 0) * c.valor / 100, 2) END,
    c.frete_gratis;
END;
$fn$;

-- ── 5. O servidor: fn_revalidar_desconto_pedido ───────────────────────────

create or replace function public.fn_revalidar_desconto_pedido(p_pedido_id uuid)
returns numeric
language plpgsql
security definer
set search_path to ''
as $fn$
DECLARE
  v_loja uuid; v_cupom uuid; v_taxa numeric; v_cliente uuid; v_ifood text;
  v_subtotal numeric := 0; v_desconto numeric := 0; v_cashback numeric; v_total numeric;
  v_metodo text; v_aplica boolean := false; v_quando timestamptz;
  c record;
BEGIN
  SELECT p.loja_id, p.cupom_id, coalesce(p.taxa_entrega, 0), p.cliente_id,
         p.ifood_order_id, coalesce(p.criado_em, now())
  INTO v_loja, v_cupom, v_taxa, v_cliente, v_ifood, v_quando
  FROM public.pedidos p WHERE p.id = p_pedido_id;
  IF v_loja IS NULL THEN RETURN NULL; END IF;
  IF v_ifood IS NOT NULL THEN RETURN NULL; END IF;   -- preço do canal externo

  -- Venda de caixa com tentativa registrada tem total próprio (idempotência).
  PERFORM 1 FROM public.pdv_tentativas t WHERE t.pedido_id = p_pedido_id;
  IF FOUND THEN RETURN NULL; END IF;

  SELECT coalesce(sum((ip.preco_unitario + coalesce(op.soma, 0)) * ip.quantidade), 0)
  INTO v_subtotal
  FROM public.itens_pedido ip
  LEFT JOIN LATERAL (
    SELECT sum(ipo.preco_adicional) AS soma
    FROM public.itens_pedido_opcoes ipo WHERE ipo.item_id = ip.id
  ) op ON true
  WHERE ip.pedido_id = p_pedido_id;

  IF v_subtotal = 0 THEN RETURN NULL; END IF;       -- pedido ainda sendo montado

  SELECT metodo::text INTO v_metodo
  FROM public.pagamentos WHERE pedido_id = p_pedido_id
  ORDER BY (status = 'PAGO') DESC, data_pagamento DESC NULLS LAST LIMIT 1;

  IF v_cupom IS NOT NULL THEN
    -- A validade e a janela são conferidas contra a HORA DO PEDIDO, não contra
    -- a hora em que este recálculo roda: o pagamento pode chegar minutos
    -- depois, e quem viu o preço com desconto tem direito a ele.
    SELECT * INTO c FROM public.cupons cu
    WHERE cu.id = v_cupom AND cu.loja_id = v_loja AND cu.ativo
      AND (cu.validade IS NULL OR cu.validade >= (v_quando AT TIME ZONE 'America/Sao_Paulo')::date)
      AND public.fn_cupom_na_janela(cu.hora_inicio, cu.hora_fim, cu.dias_semana, v_quando)
      AND v_subtotal >= coalesce(cu.pedido_minimo, 0)
      AND (cu.limite_usos IS NULL OR coalesce(cu.usos, 0) < cu.limite_usos)
      AND (cu.metodo_exigido IS NULL OR v_metodo IS NULL OR cu.metodo_exigido::text = v_metodo)
      AND (cu.cliente_id IS NULL OR cu.cliente_id = v_cliente);

    v_aplica := FOUND;

    IF v_aplica AND c.apenas_primeiro_pedido AND v_cliente IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.pedidos ant
      WHERE ant.cliente_id = v_cliente AND ant.loja_id = v_loja
        AND ant.id <> p_pedido_id AND ant.status = 'FINALIZADO'
    ) THEN
      v_aplica := false;
    END IF;

    IF v_aplica THEN
      v_desconto := CASE WHEN c.tipo = 'FIXO'
        THEN least(c.valor, v_subtotal)
        ELSE round(v_subtotal * c.valor / 100, 2) END;
      IF c.frete_gratis THEN v_taxa := 0; END IF;
    END IF;
  END IF;

  SELECT coalesce(-sum(cm.valor), 0) INTO v_cashback
  FROM public.cashback_movimentos cm
  WHERE cm.pedido_id = p_pedido_id AND cm.tipo = 'USO';

  v_cashback := least(greatest(v_cashback, 0), v_subtotal + v_taxa - v_desconto);
  v_total := greatest(0, v_subtotal + v_taxa - v_desconto - v_cashback);

  UPDATE public.pedidos
  SET subtotal = v_subtotal, taxa_entrega = v_taxa, desconto = v_desconto,
      valor_total = v_total, cashback_usado = v_cashback, atualizado_em = now()
  WHERE id = p_pedido_id
    AND (subtotal, taxa_entrega, desconto, valor_total, cashback_usado)
        IS DISTINCT FROM (v_subtotal, v_taxa, v_desconto, v_total, v_cashback);

  RETURN v_total;
END;
$fn$;

commit;

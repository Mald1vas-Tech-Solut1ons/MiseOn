-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Cupom: o desconto passa a ser decidido pelo servidor, sempre.            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Três defeitos encontrados na auditoria de 15/09/2026, todos confirmados
-- contra a definição que está EM PRODUÇÃO (pg_get_functiondef), não contra o
-- arquivo versionado.
--
-- 1. CRASH no cupom de primeira compra.
--    `fn_recalcular_pedido` fazia `c := NULL` para descartar o cupom e logo
--    depois lia `c.id`. Em PL/pgSQL atribuir NULL a um RECORD deixa a variável
--    NÃO ATRIBUÍDA: a leitura seguinte levanta
--      ERROR: record "c" is not assigned yet
--    Comprovado em produção com um bloco isolado. O caminho é real: cliente
--    com pedido FINALIZADO usando cupom `apenas_primeiro_pedido` derruba o
--    recálculo — e o recálculo é o que as edge functions de Pix e cartão
--    chamam antes de cobrar. Resultado: a cobrança falha.
--    A intenção do código era descartar o cupom em silêncio. Agora é uma
--    flag booleana, que é o que `c := NULL` aparentava fazer.
--
-- 2. `limite_usos` era ultrapassável.
--    `fn_trg_incrementa_uso_cupom` fazia `usos = usos + 1` sem olhar o limite.
--    Dois pagamentos simultâneos no último uso disponível passavam os dois, e
--    o contador seguia subindo acima de `limite_usos`. O UPDATE agora carrega
--    a própria condição de limite: o lock de linha do Postgres serializa os
--    concorrentes e o contador nunca passa do teto.
--
-- 3. O recálculo do servidor era OPCIONAL.
--    Este era o buraco grande. `fn_recalcular_pedido` revalida tudo (loja,
--    validade, pedido mínimo contra o subtotal real, limite, método exigido,
--    dono do cupom, primeira compra) e reprecifica os itens por
--    `produtos.preco` — mas NENHUM gatilho a chamava. Ela só era invocada por
--    `pix-criar-cobranca` e `cartao-pagar`.
--    Ou seja: pedido em DINHEIRO, na maquininha da entrega, na mesa ou no
--    balcão gravava `valor_total`, `desconto` e `cupom_id` exatamente como o
--    navegador mandou. Cupom vencido, abaixo do pedido mínimo, de outra loja
--    ou de primeira compra no décimo pedido passavam direto.
--    Agora um gatilho DIFERIDO revalida o cupom no commit, e o desconto
--    gravado é sempre o do servidor.
--
-- Fora do alcance do gatilho, de propósito:
--   • Pedido do iFood (`ifood_order_id` preenchido) — o preço lá é o preço
--     COM markup de canal. O desconto de lá é da plataforma, não nosso.
--   • Venda do PDV com `pdv_tentativas` — a tentativa já fixou o total
--     (idempotência de caixa). O gatilho não insiste onde já foi decidido.
--   • Preço de item, em qualquer caso. Quem manda nele é
--     `fn_validar_item_pedido_catalogo`, no INSERT. Mexer aqui atropelaria o
--     preço praticado do quilo na venda por peso.

-- ── 1. fn_recalcular_pedido: flag no lugar do RECORD anulado ────────────────
CREATE OR REPLACE FUNCTION public.fn_recalcular_pedido(p_pedido_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_loja uuid; v_cupom uuid; v_taxa numeric; v_cashback numeric;
  v_subtotal numeric := 0; v_desconto numeric := 0; v_total numeric;
  v_metodo text; v_cliente uuid; v_intruso int;
  v_aplica boolean := false;
  c record;
BEGIN

  SELECT (t.resposta->>'valor_total')::numeric INTO v_total
  FROM public.pdv_tentativas t WHERE t.pedido_id=p_pedido_id;
  IF FOUND THEN RETURN v_total; END IF;

  SELECT loja_id, cupom_id, coalesce(taxa_entrega, 0), cliente_id
  INTO v_loja, v_cupom, v_taxa, v_cliente
  FROM public.pedidos WHERE id = p_pedido_id;
  IF v_loja IS NULL THEN RETURN NULL; END IF;

  SELECT count(*) INTO v_intruso
  FROM public.itens_pedido ip
  JOIN public.produtos pr ON pr.id = ip.produto_id
  WHERE ip.pedido_id = p_pedido_id AND pr.loja_id <> v_loja;
  IF v_intruso > 0 THEN RAISE EXCEPTION 'Pedido % contém item de outra loja.', p_pedido_id; END IF;

  SELECT coalesce(sum((coalesce(pr.preco, ip.preco_unitario) + coalesce(op.soma, 0)) * ip.quantidade), 0)
  INTO v_subtotal
  FROM public.itens_pedido ip
  LEFT JOIN public.produtos pr ON pr.id = ip.produto_id AND pr.loja_id = v_loja
  LEFT JOIN LATERAL (
    SELECT sum(coalesce(o.preco_adicional, ipo.preco_adicional)) AS soma
    FROM public.itens_pedido_opcoes ipo
    LEFT JOIN public.opcoes o ON o.id = ipo.opcao_id
    WHERE ipo.item_id = ip.id
  ) op ON true
  WHERE ip.pedido_id = p_pedido_id;

  SELECT metodo::text INTO v_metodo
  FROM public.pagamentos
  WHERE pedido_id = p_pedido_id
  ORDER BY (status = 'PAGO') DESC, data_pagamento DESC NULLS LAST
  LIMIT 1;

  IF v_cupom IS NOT NULL THEN
    SELECT * INTO c FROM public.cupons cu
    WHERE cu.id = v_cupom AND cu.loja_id = v_loja AND cu.ativo
      AND (cu.validade IS NULL OR cu.validade >= current_date)
      AND v_subtotal >= coalesce(cu.pedido_minimo, 0)
      AND (cu.limite_usos IS NULL OR coalesce(cu.usos, 0) < cu.limite_usos)
      AND (cu.metodo_exigido IS NULL OR v_metodo IS NULL OR cu.metodo_exigido::text = v_metodo)
      AND (cu.cliente_id IS NULL OR cu.cliente_id = v_cliente);

    v_aplica := FOUND;

    -- Cupom de primeira compra cai fora se o cliente já finalizou outro pedido.
    -- Descartar em silêncio: o pedido continua válido, só sem o desconto.
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
  WHERE id = p_pedido_id;

  RETURN v_total;
END;
$function$;

-- ── 2. limite_usos deixa de ser ultrapassável ───────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_trg_incrementa_uso_cupom()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_cupom uuid;
begin
  if NEW.status = 'PAGO' and (TG_OP = 'INSERT' or OLD.status is distinct from 'PAGO') then
    select cupom_id into v_cupom from pedidos where id = NEW.pedido_id;
    if v_cupom is not null then
      -- A condição de limite vai DENTRO do UPDATE: o lock de linha serializa
      -- pagamentos simultâneos e o contador nunca passa de limite_usos.
      update cupons
         set usos = coalesce(usos, 0) + 1
       where id = v_cupom
         and (limite_usos is null or coalesce(usos, 0) < limite_usos);
    end if;
  end if;
  return NEW;
end;
$function$;

-- ── 3. O desconto do servidor vira obrigatório ──────────────────────────────
--
-- Por que NÃO usar `fn_recalcular_pedido` aqui: ela reprecifica cada item por
-- `produtos.preco`. Isso atropelaria a venda por peso, onde o operador informa
-- o preço praticado do quilo no Painel da Balança (`p_preco_quilo`), que pode
-- ser diferente do preço de catálogo.
--
-- E não é preciso reprecificar: `fn_validar_item_pedido_catalogo` já força
-- `preco_unitario := produtos.preco` no INSERT do item, valida a loja do
-- produto e recusa produto indisponível. O subtotal, portanto, JÁ é do
-- servidor. O que ficava sem dono era só o desconto.
--
-- Esta função parte do subtotal que os itens realmente têm e decide apenas o
-- que o cupom vale. Preço de item ela não toca.
CREATE OR REPLACE FUNCTION public.fn_revalidar_desconto_pedido(p_pedido_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_loja uuid; v_cupom uuid; v_taxa numeric; v_cliente uuid; v_ifood text;
  v_subtotal numeric := 0; v_desconto numeric := 0; v_cashback numeric; v_total numeric;
  v_metodo text; v_aplica boolean := false;
  c record;
BEGIN
  SELECT p.loja_id, p.cupom_id, coalesce(p.taxa_entrega, 0), p.cliente_id, p.ifood_order_id
  INTO v_loja, v_cupom, v_taxa, v_cliente, v_ifood
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
    SELECT * INTO c FROM public.cupons cu
    WHERE cu.id = v_cupom AND cu.loja_id = v_loja AND cu.ativo
      AND (cu.validade IS NULL OR cu.validade >= current_date)
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
$function$;

CREATE OR REPLACE FUNCTION public.fn_trg_revalidar_desconto()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_pedido uuid; v_item uuid;
BEGIN
  -- Três armadilhas do PL/pgSQL, todas descobertas testando (e todas silenciosas
  -- até a hora em que o gatilho dispara de verdade):
  --   • Uma expressão CASE vira UMA consulta SQL e resolve os campos de TODOS os
  --     ramos. Citar NEW.pedido_id num ramo estoura no gatilho de `pedidos`, que
  --     não tem essa coluna. Por isso são IFs aninhados, nunca CASE.
  --   • OLD não existe no INSERT e NEW não existe no DELETE: cada referência
  --     precisa estar dentro do ramo de TG_OP que a torna válida.
  --   • A própria fn_revalidar_desconto_pedido dá UPDATE em `pedidos` tocando
  --     taxa_entrega, e `UPDATE OF` dispara só pela coluna estar na instrução,
  --     mesmo sem mudar de valor — daí a guarda de recursão.
  IF TG_TABLE_NAME = 'pedidos' THEN
    IF TG_OP = 'UPDATE' THEN
      IF NEW.cupom_id IS NOT DISTINCT FROM OLD.cupom_id
         AND NEW.taxa_entrega IS NOT DISTINCT FROM OLD.taxa_entrega THEN
        RETURN NULL;                      -- nada de dinheiro mudou: não reentra
      END IF;
    END IF;
    v_pedido := NEW.id;                   -- gatilho só de INSERT/UPDATE

  ELSIF TG_TABLE_NAME = 'itens_pedido' THEN
    IF TG_OP = 'DELETE' THEN v_pedido := OLD.pedido_id;
    ELSE                    v_pedido := NEW.pedido_id; END IF;

  ELSIF TG_TABLE_NAME = 'itens_pedido_opcoes' THEN
    IF TG_OP = 'DELETE' THEN v_item := OLD.item_id;
    ELSE                     v_item := NEW.item_id; END IF;
    SELECT ip.pedido_id INTO v_pedido FROM public.itens_pedido ip WHERE ip.id = v_item;
  END IF;

  IF v_pedido IS NULL THEN RETURN NULL; END IF;
  PERFORM 1 FROM public.pedidos p WHERE p.id = v_pedido;
  IF NOT FOUND THEN RETURN NULL; END IF;   -- apagado na mesma transação
  PERFORM public.fn_revalidar_desconto_pedido(v_pedido);
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_revalidar_desconto_itens ON public.itens_pedido;
CREATE CONSTRAINT TRIGGER trg_revalidar_desconto_itens
  AFTER INSERT OR UPDATE OR DELETE ON public.itens_pedido
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.fn_trg_revalidar_desconto();

DROP TRIGGER IF EXISTS trg_revalidar_desconto_opcoes ON public.itens_pedido_opcoes;
CREATE CONSTRAINT TRIGGER trg_revalidar_desconto_opcoes
  AFTER INSERT OR UPDATE OR DELETE ON public.itens_pedido_opcoes
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.fn_trg_revalidar_desconto();

-- No pedido só o que muda o dinheiro: trocar o cupom ou a taxa de entrega.
DROP TRIGGER IF EXISTS trg_revalidar_desconto_cupom ON public.pedidos;
CREATE CONSTRAINT TRIGGER trg_revalidar_desconto_cupom
  AFTER INSERT OR UPDATE OF cupom_id, taxa_entrega ON public.pedidos
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.fn_trg_revalidar_desconto();

COMMENT ON FUNCTION public.fn_revalidar_desconto_pedido(uuid) IS
  'Decide o desconto e o total no servidor a partir do subtotal real dos itens. '
  'Nao reprecifica item (isso ja e feito por fn_validar_item_pedido_catalogo no '
  'INSERT), para nao atropelar o preco praticado da venda por peso. Nao toca '
  'pedido do iFood nem venda com pdv_tentativas.';

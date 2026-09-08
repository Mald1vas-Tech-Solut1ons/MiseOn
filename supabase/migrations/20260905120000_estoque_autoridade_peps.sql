-- ============================================================================
-- SPRINT 1 (S1-C): ESTOQUE — UMA FONTE DE VERDADE, PEPS DE VERDADE
--
-- Problemas medidos (todos no código, nada em conjectura):
--
--  (1) fn_transformar_estoque gravava a origem como 'SAIDA' com quantidade
--      POSITIVA. A convenção do schema é "positivo entra, negativo sai"
--      (schema_inicial, comentário em movimentacoes_estoque.quantidade) e é
--      o sinal que trg_mov_custear_baixa reconhece para custear a baixa pelo
--      PEPS e consumir os lotes reais. Resultado: o custo apurado era 0, os
--      lotes da origem nunca eram consumidos e os destinos eram custeados
--      pelo preço de catálogo (fallback de fn_mov_criar_lote) — a regra
--      "VALOR SE CONSERVA" prometida no cabeçalho de 20260729011500 era
--      mentira. O comentário da linha culpada até afirmava o contrário.
--
--  (2) O mesmo sinal errado em KDSProducao.tsx (saída de insumos brutos
--      positiva) — corrigido no frontend em conjunto com esta migration.
--
--  (3) fn_lancar_custo_estoque disparava CMV em QUALQUER movimentação com
--      custo_total > 0, sem olhar o sinal nem o tipo. Dois estragos medidos:
--        (a) entrada de compra (custo_total = preço, pedido_id NULL) fazia o
--            histórico concatenar NEW.pedido_id → NULL → violação do NOT NULL
--            de lancamentos_financeiros.historico → a transação INTEIRA de
--            fn_receber_compra abortava ao receber compra com preço;
--        (b) qualquer entrada custeada (transformação-destino, estorno)
--            viraria CMV no DRE — compra contada como custo de venda.
--      Correção do (1) sem corrigir isto contaminaria o DRE: a origem
--      consumida viraria CMV e o destino vendido viraria CMV de novo —
--      o mesmo valor contado duas vezes. Por isso esta migration é
--      PRÉ-REQUISITO da correção da transformação, não um item do S1-D.
--
--  (4) O estorno por cancelamento devolvia o saldo (UPDATE em insumos) mas
--      gravava 'AJUSTE' positivo — e só ENTRADA abre lote PEPS
--      (fn_mov_criar_lote). O insumo voltava a ter saldo sem lastro de lote:
--      insumos.quantidade_atual divergia de SUM(lotes.restante) sem que
--      nada detectasse.
--
--  (5) fn_receber_compra recebe p_recebido_em e o grava na compra e no
--      ledger, mas NÃO o repassava à movimentação — a fila PEPS ordenava
--      pela data do registro, não pela data da compra.
--
-- O que esta migration faz:
--   A. fn_lancar_custo_estoque: CMV é CONSUMO definitivo — quantidade
--      negativa, custo > 0 e tipo <> 'SAIDA' (SAIDA é transferência entre
--      insumos: transformação/manufatura — o valor reentra pela ENTRADA do
--      destino e o CMV nasce quando o destino é vendido ou perde).
--      Histórico deixa de depender de pedido_id.
--   B. fn_transformar_estoque: origem com quantidade NEGATIVA → a trigger
--      custeia pelo PEPS, consome os lotes reais e o rateio passa a
--      conservar valor de verdade. Nada mais muda no corpo.
--   C. Estorno (fn_trg_status_pedido): 'ENTRADA' carregando o custo_total
--      da baixa original → o lote é recriado com o custo real que tinha
--      sido consumido (mesma regra de fn_ajustar_inventario: "só ENTRADA
--      abre lote PEPS").
--   D. fn_receber_compra: passa ocorrido_em à movimentação.
--   E. Nova RPC fn_movimentar_estoque: movimentação + saldo na MESMA
--      transação (a regra hoje está duplicada em 6 callers do frontend,
--      cada um com seu par de chamadas não-transacionais).
--   F. View vw_divergencia_saldo_lotes: saldo físico × saldo de lotes.
--      Critério de aceitação do sprint — divergência DETECTÁVEL.
--
-- Consequência medida e assumida (S1-D): o envio de preparo à pista do
-- buffet usa 'SAIDA' (ModalReposicaoBuffet) e deixava de virar CMV com a
-- regra A. SAIDA é o tipo da transferência entre insumos; consumo de pista
-- é um conceito que o modelo ainda não tem. A divergência
-- operacional-vs-contábil do buffet é o cerne do S1-D e será resolvida lá,
-- com modelo de consumo explícito — não remendada aqui.
--
-- Invariantes preservadas:
--   • positivo entra, negativo sai — em TODO escritor;
--   • movimentação e saldo caminham juntos (uma transação);
--   • valor se conserva: custo consumido = custo recriado no estorno;
--   • PEPS anda por ocorrido_em (a compra), não por criado_em.
--
-- Nota de drift: o banco de produção pode ter divergido destas migrações
-- (sessão de 05/09 sem credenciais de leitura). Antes de qualquer novo
-- reparo nestas funções, ler pg_get_functiondef na produção.
-- ============================================================================

-- ─── A. CMV é consumo definitivo ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_lancar_custo_estoque()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_conta_estoque UUID;
  v_conta_cmv     UUID;
  v_historico     TEXT;
BEGIN
  -- Só CONSUMO é CMV: quantidade negativa (saiu) e custo apurado.
  -- Positivo é entrada — nunca custo de venda (bug (3a): a entrada de
  -- compra abortava a transação aqui, por histórico NULL).
  -- 'SAIDA' é transferência entre insumos: o valor reentra pela ENTRADA do
  -- destino; contá-lo aqui faria o DRE somar o mesmo valor na transformação
  -- e de novo na venda do destino.
  IF NEW.quantidade >= 0 OR COALESCE(NEW.custo_total, 0) <= 0
     OR NEW.tipo = 'SAIDA' THEN
    RETURN NEW;
  END IF;

  -- 1.1.03 = Estoque de Insumos (20260729010000); 4.1.01 = CMV.
  SELECT id INTO v_conta_estoque FROM public.contas
    WHERE codigo = '1.1.03' AND loja_id = NEW.loja_id LIMIT 1;
  SELECT id INTO v_conta_cmv FROM public.contas
    WHERE codigo = '4.1.01' AND loja_id = NEW.loja_id LIMIT 1;

  IF v_conta_estoque IS NULL OR v_conta_cmv IS NULL THEN RETURN NEW; END IF;

  -- Consumo sem pedido (PERDA por validade, ajuste de inventário) existia
  -- antes e quebrava o NOT NULL do histórico. O número do pedido, quando
  -- existe, continua no texto para o razão continuar legível.
  SELECT 'CMV — ' || nome INTO v_historico
    FROM public.insumos WHERE id = NEW.insumo_id;
  v_historico := COALESCE(v_historico, 'CMV — insumo ' || NEW.insumo_id::text)
    || CASE WHEN NEW.pedido_id IS NOT NULL THEN
          ' — pedido ' || COALESCE(
            (SELECT numero::text FROM public.pedidos WHERE id = NEW.pedido_id),
            NEW.pedido_id::text)
        ELSE '' END;

  INSERT INTO public.lancamentos_financeiros (
    loja_id, historico, valor, conta_debitada, conta_creditada,
    referencia_tipo, referencia_id
  ) VALUES (
    NEW.loja_id, v_historico,
    NEW.custo_total, v_conta_cmv, v_conta_estoque, 'PEDIDO', NEW.pedido_id
  );

  RETURN NEW;
END; $function$;

-- ─── B. Transformação: a origem sai com o sinal que o PEPS entende ───────────
CREATE OR REPLACE FUNCTION public.fn_transformar_estoque(
  p_loja_id    UUID,
  p_tipo       TEXT,
  p_origens    JSONB,
  p_destinos   JSONB,
  p_observacao TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_transf     UUID;
  v_item       JSONB;
  v_insumo     UUID;
  v_qtd        NUMERIC;
  v_unidade    TEXT;
  v_fator      NUMERIC;
  v_base       NUMERIC;
  v_saldo      NUMERIC;
  v_nome       TEXT;
  v_mov        UUID;
  v_custo_mov  NUMERIC;
  v_custo_tot  NUMERIC := 0;
  v_peso_tot   NUMERIC := 0;
  v_peso       NUMERIC;
  v_atribuido  NUMERIC := 0;
  v_custo_item NUMERIC;
  v_idx        INTEGER := 0;
  v_qtd_dest   INTEGER;
BEGIN
  IF NOT public.fn_tem_papel(p_loja_id, ARRAY['admin','operador']) THEN
    RAISE EXCEPTION 'Sem permissão para movimentar o estoque desta loja.';
  END IF;

  IF jsonb_array_length(COALESCE(p_origens, '[]'::jsonb)) = 0
     OR jsonb_array_length(COALESCE(p_destinos, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Transformação precisa de pelo menos uma origem e um destino.';
  END IF;

  INSERT INTO public.transformacoes_estoque (loja_id, tipo, observacao)
  VALUES (p_loja_id, p_tipo::public.transformacao_tipo, NULLIF(p_observacao, ''))
  RETURNING id INTO v_transf;

  -- ── 1. Consome as origens pelo PEPS e apura o custo real ──
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_origens)
  LOOP
    v_insumo  := (v_item->>'insumo_id')::UUID;
    v_qtd     := (v_item->>'qtd')::NUMERIC;
    v_fator   := COALESCE((v_item->>'fator')::NUMERIC, 1);
    v_base    := v_qtd * v_fator;

    SELECT quantidade_atual, unidade_medida, nome INTO v_saldo, v_unidade, v_nome
    FROM public.insumos WHERE id = v_insumo AND loja_id = p_loja_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insumo de origem % não pertence a esta loja.', v_insumo;
    END IF;
    IF v_base <= 0 THEN
      RAISE EXCEPTION 'Quantidade de origem inválida para %.', v_nome;
    END IF;
    -- Desmontar mais do que existe é como criar massa do nada: o custo do
    -- excedente não teria lote de onde sair e o PEPS ficaria devendo.
    IF v_base > COALESCE(v_saldo, 0) + 1e-6 THEN
      RAISE EXCEPTION 'Estoque insuficiente de %: tem % %, tentou usar %.',
        v_nome, COALESCE(v_saldo,0), v_unidade, v_base;
    END IF;

    -- SAIDA NEGATIVA: a convenção do schema é "positivo entra, negativo sai",
    -- e é o sinal que trg_mov_custear_baixa reconhece para custear a baixa
    -- pelo PEPS dos lotes reais e consumi-los (Sprint 1: era positiva, não
    -- era custeada e o custo apurado vinha 0).
    INSERT INTO public.movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, motivo)
    VALUES (p_loja_id, v_insumo, 'SAIDA', -v_base,
            CASE WHEN p_tipo = 'DESMONTE' THEN 'Desmonte' ELSE 'Montagem' END
            || COALESCE(' — ' || NULLIF(p_observacao, ''), ''))
    RETURNING id, custo_total INTO v_mov, v_custo_mov;

    UPDATE public.insumos
    SET    quantidade_atual = COALESCE(quantidade_atual, 0) - v_base
    WHERE  id = v_insumo;

    v_custo_tot := v_custo_tot + COALESCE(v_custo_mov, 0);

    INSERT INTO public.transformacoes_itens (
      transformacao_id, loja_id, papel, insumo_id, quantidade, unidade, fator,
      quantidade_base, custo, movimentacao_id
    ) VALUES (
      v_transf, p_loja_id, 'ORIGEM', v_insumo, v_qtd,
      COALESCE(v_item->>'unidade', v_unidade), v_fator, v_base,
      COALESCE(v_custo_mov, 0), v_mov
    );
  END LOOP;

  -- ── 2. Rateio: peso declarado ou, na falta dele, a própria quantidade ──
  -- O peso existe porque nem toda parte vale o mesmo: 1 kg de filé não custa
  -- o mesmo que 1 kg de carcaça, ainda que saiam do mesmo frango.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_destinos)
  LOOP
    v_peso_tot := v_peso_tot + COALESCE(
      (v_item->>'peso')::NUMERIC,
      (v_item->>'qtd')::NUMERIC * COALESCE((v_item->>'fator')::NUMERIC, 1)
    );
  END LOOP;
  IF v_peso_tot <= 0 THEN v_peso_tot := 1; END IF;

  v_qtd_dest := jsonb_array_length(p_destinos);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_destinos)
  LOOP
    v_idx     := v_idx + 1;
    v_insumo  := (v_item->>'insumo_id')::UUID;
    v_qtd     := (v_item->>'qtd')::NUMERIC;
    v_fator   := COALESCE((v_item->>'fator')::NUMERIC, 1);
    v_base    := v_qtd * v_fator;
    v_peso    := COALESCE((v_item->>'peso')::NUMERIC, v_base);

    SELECT unidade_medida, nome INTO v_unidade, v_nome
    FROM public.insumos WHERE id = v_insumo AND loja_id = p_loja_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insumo de destino % não pertence a esta loja.', v_insumo;
    END IF;
    IF v_base <= 0 THEN
      RAISE EXCEPTION 'Quantidade de destino inválida para %.', v_nome;
    END IF;

    -- O último item leva o resíduo: sem isso, arredondar N partes faz sumir
    -- centavos e a conservação de valor deixa de fechar.
    IF v_idx = v_qtd_dest THEN
      v_custo_item := v_custo_tot - v_atribuido;
    ELSE
      v_custo_item := round(v_custo_tot * v_peso / v_peso_tot, 4);
    END IF;
    v_atribuido := v_atribuido + v_custo_item;

    INSERT INTO public.movimentacoes_estoque (
      loja_id, insumo_id, tipo, quantidade, custo_total, motivo, vence_em
    ) VALUES (
      p_loja_id, v_insumo, 'ENTRADA', v_base, NULLIF(v_custo_item, 0),
      CASE WHEN p_tipo = 'DESMONTE' THEN 'Desmonte' ELSE 'Montagem' END
      || COALESCE(' — ' || NULLIF(p_observacao, ''), ''),
      (NULLIF(v_item->>'vence_em', ''))::DATE
    ) RETURNING id INTO v_mov;

    UPDATE public.insumos
    SET    quantidade_atual = COALESCE(quantidade_atual, 0) + v_base
    WHERE  id = v_insumo;

    INSERT INTO public.transformacoes_itens (
      transformacao_id, loja_id, papel, insumo_id, quantidade, unidade, fator,
      quantidade_base, custo, movimentacao_id
    ) VALUES (
      v_transf, p_loja_id, 'DESTINO', v_insumo, v_qtd,
      COALESCE(v_item->>'unidade', v_unidade), v_fator, v_base, v_custo_item, v_mov
    );
  END LOOP;

  UPDATE public.transformacoes_estoque SET custo_total = v_custo_tot WHERE id = v_transf;

  RETURN jsonb_build_object(
    'transformacao_id', v_transf,
    'custo_consumido',  v_custo_tot,
    'custo_atribuido',  v_atribuido,
    'destinos',         v_qtd_dest
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_transformar_estoque(UUID, TEXT, JSONB, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_transformar_estoque(UUID, TEXT, JSONB, JSONB, TEXT) TO authenticated;

-- ─── C. Estorno devolve o lote, não só o saldo ───────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_trg_status_pedido()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
BEGIN
  NEW.atualizado_em = now();

  -- Sem mudanca de status nao ha nada a compensar: sair antes dos estornos.
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- ACEITO: baixa o estoque
  IF NEW.status = 'ACEITO' AND OLD.status = 'NOVO' THEN
    PERFORM fn_baixar_estoque(NEW.id);
    NEW.estoque_baixado = true;
  END IF;

  -- CANCELADO: estorna estoque
  IF NEW.status = 'CANCELADO' AND OLD.estoque_baixado THEN
    -- ENTRADA (e não AJUSTE) de propósito: só ENTRADA abre lote PEPS
    -- (fn_mov_criar_lote), a mesma regra que fn_ajustar_inventario aplica à
    -- sobra de inventário. O custo_total da baixa original viaja junto,
    -- então o lote recriado volta com o custo real que tinha sido consumido
    -- — saldo e lotes continuam batendo (Sprint 1: o saldo voltava mas o
    -- lote não, e a divergência era invisível).
    INSERT INTO movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, custo_total, motivo, pedido_id)
    SELECT m.loja_id, m.insumo_id, 'ENTRADA', -m.quantidade, m.custo_total, 'Estorno por cancelamento', m.pedido_id
    FROM movimentacoes_estoque m
    WHERE m.pedido_id = NEW.id AND m.tipo = 'BAIXA_VENDA';

    UPDATE insumos i SET quantidade_atual = i.quantidade_atual - m.quantidade
    FROM movimentacoes_estoque m
    WHERE m.pedido_id = NEW.id AND m.tipo = 'BAIXA_VENDA' AND i.id = m.insumo_id;
  END IF;

  -- CANCELADO: estorno financeiro (marca receita_lancada=false no NEW, nunca
  -- com UPDATE aninhado — isso derruba a transação com erro 27000)
  IF NEW.status = 'CANCELADO' AND OLD.receita_lancada THEN
    NEW.receita_lancada := NOT fn_lancar_estorno_pedido(NEW.id);
  END IF;

  -- FINALIZADO: credita cashback e lança receita no ledger
  IF NEW.status = 'FINALIZADO' AND OLD.status IS DISTINCT FROM 'FINALIZADO' THEN
    PERFORM fn_creditar_cashback(NEW.id);
    NEW.receita_lancada = fn_lancar_receita_pedido(NEW.id);
  END IF;

  RETURN NEW;
END;
$function$;

-- ─── D. Compra: a fila PEPS anda pela data da compra ────────────────────────
CREATE OR REPLACE FUNCTION public.fn_receber_compra(
  p_compra_id   UUID,
  p_itens       JSONB,
  p_numero_nota TEXT        DEFAULT NULL,
  p_recebido_em TIMESTAMPTZ DEFAULT now(),
  p_frete       NUMERIC     DEFAULT NULL,
  p_desconto    NUMERIC     DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_loja           UUID;
  v_fornecedor_id  UUID;
  v_fornecedor     TEXT;
  v_item           JSONB;
  v_ci             public.compras_itens%ROWTYPE;
  v_insumo         UUID;
  v_qtd            NUMERIC;
  v_unidade        TEXT;
  v_fator          NUMERIC;
  v_base           NUMERIC;
  v_base_pedida    NUMERIC;
  v_preco          NUMERIC;
  v_mov            UUID;
  v_status         public.compra_item_status;
  v_motivo         TEXT;
  v_total_pago     NUMERIC := 0;
  v_recebidos      INTEGER := 0;
  v_divergentes    INTEGER := 0;
  v_pendentes      INTEGER;
  v_status_compra  public.compra_status;
  v_conta_estoque  UUID;
  v_conta_forn     UUID;
BEGIN
  SELECT c.loja_id, c.fornecedor_id, f.nome INTO v_loja, v_fornecedor_id, v_fornecedor
  FROM   public.compras c
  LEFT   JOIN public.fornecedores f ON f.id = c.fornecedor_id
  WHERE  c.id = p_compra_id;

  IF v_loja IS NULL THEN
    RAISE EXCEPTION 'Compra % não encontrada.', p_compra_id;
  END IF;

  IF NOT public.fn_tem_papel(v_loja, ARRAY['admin','operador']) THEN
    RAISE EXCEPTION 'Sem permissão para receber compras desta loja.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_itens, '[]'::jsonb))
  LOOP
    SELECT * INTO v_ci
    FROM   public.compras_itens
    WHERE  id = (v_item->>'item_id')::UUID AND compra_id = p_compra_id;

    IF NOT FOUND THEN CONTINUE; END IF;

    v_insumo   := COALESCE((v_item->>'insumo_recebido_id')::UUID, v_ci.insumo_id);
    v_qtd      := COALESCE((v_item->>'qtd')::NUMERIC, 0);
    v_unidade  := COALESCE(v_item->>'unidade', v_ci.unidade_pedida);
    v_fator    := COALESCE((v_item->>'fator')::NUMERIC, v_ci.fator_pedida);
    v_preco    := NULLIF((v_item->>'preco_total')::NUMERIC, 0);
    v_base     := v_qtd * v_fator;
    v_base_pedida := v_ci.qtd_pedida * v_ci.fator_pedida;

    IF v_qtd <= 0 THEN
      v_status := 'NAO_VEIO';
    ELSIF v_insumo <> v_ci.insumo_id THEN
      v_status := 'SUBSTITUIDO';
    ELSIF v_base < v_base_pedida * 0.999 THEN
      v_status := 'PARCIAL';
    ELSE
      v_status := 'RECEBIDO';
    END IF;

    IF v_status <> 'RECEBIDO' THEN v_divergentes := v_divergentes + 1; END IF;

    IF v_base > 0 THEN
      v_motivo := 'Compra'
        || COALESCE(' — ' || v_fornecedor, '')
        || COALESCE(' — NF ' || NULLIF(p_numero_nota, ''), '')
        || ' (' || public.fn_num_txt(v_qtd) || ' ' || v_unidade || ')';

      INSERT INTO public.movimentacoes_estoque (
        loja_id, insumo_id, tipo, quantidade, custo_total, motivo,
        lote_fornecedor, vence_em, ocorrido_em
      ) VALUES (
        v_loja, v_insumo, 'ENTRADA', v_base, v_preco, v_motivo,
        NULLIF(v_item->>'lote', ''), (NULLIF(v_item->>'vence_em', ''))::DATE,
        -- A fila PEPS anda pela data da COMPRA; sem isso ela ordenava pela
        -- data do registro (Sprint 1: p_recebido_em já existia, era gravado
        -- na compra e no ledger, só não chegava à movimentação).
        COALESCE(p_recebido_em, now())
      ) RETURNING id INTO v_mov;

      UPDATE public.insumos
      SET    quantidade_atual = COALESCE(quantidade_atual, 0) + v_base,
             -- Aprende de quem vem: só preenche o vazio, nunca sobrescreve uma
             -- escolha que o lojista tenha feito de propósito.
             fornecedor_padrao_id = COALESCE(fornecedor_padrao_id, v_fornecedor_id)
      WHERE  id = v_insumo;

      IF v_preco IS NOT NULL AND v_qtd > 0 THEN
        UPDATE public.insumos
        SET    preco_embalagem = v_preco / v_qtd,
               qtd_embalagem   = v_fator
        WHERE  id = v_insumo;
      END IF;

      v_total_pago := v_total_pago + COALESCE(v_preco, 0);
      v_recebidos  := v_recebidos + 1;
    ELSE
      v_mov := NULL;
    END IF;

    UPDATE public.compras_itens
    SET    status             = v_status,
           insumo_recebido_id = CASE WHEN v_insumo <> insumo_id THEN v_insumo END,
           qtd_recebida       = v_qtd,
           unidade_recebida   = CASE WHEN v_qtd > 0 THEN v_unidade END,
           fator_recebida     = CASE WHEN v_qtd > 0 THEN v_fator END,
           preco_total_pago   = v_preco,
           marca              = NULLIF(v_item->>'marca', ''),
           lote_fornecedor    = NULLIF(v_item->>'lote', ''),
           vence_em           = (NULLIF(v_item->>'vence_em', ''))::DATE,
           observacao         = NULLIF(v_item->>'observacao', ''),
           recebido_em        = p_recebido_em,
           movimentacao_id    = v_mov
    WHERE  id = v_ci.id;
  END LOOP;

  SELECT COUNT(*) FILTER (WHERE status = 'PENDENTE') INTO v_pendentes
  FROM   public.compras_itens WHERE compra_id = p_compra_id;

  v_status_compra := CASE WHEN v_pendentes > 0 THEN 'RECEBIDO_PARCIAL'::public.compra_status
                                               ELSE 'RECEBIDO'::public.compra_status END;

  UPDATE public.compras
  SET    status      = v_status_compra,
         numero_nota = COALESCE(NULLIF(p_numero_nota, ''), numero_nota),
         recebido_em = COALESCE(p_recebido_em, now()),
         frete       = COALESCE(p_frete, frete),
         desconto    = COALESCE(p_desconto, desconto)
  WHERE  id = p_compra_id;

  IF v_total_pago > 0 THEN
    SELECT id INTO v_conta_estoque FROM public.contas
      WHERE loja_id = v_loja AND codigo = '1.1.03' LIMIT 1;
    SELECT id INTO v_conta_forn FROM public.contas
      WHERE loja_id = v_loja AND codigo = '2.1.01' LIMIT 1;

    IF v_conta_estoque IS NOT NULL AND v_conta_forn IS NOT NULL THEN
      INSERT INTO public.lancamentos_financeiros (
        loja_id, data_lancamento, historico, valor,
        conta_debitada, conta_creditada, referencia_tipo, referencia_id
      ) VALUES (
        v_loja, p_recebido_em::DATE,
        'Compra de insumos' || COALESCE(' — ' || v_fornecedor, '')
                            || COALESCE(' — NF ' || NULLIF(p_numero_nota, ''), ''),
        v_total_pago + COALESCE(p_frete, 0) - COALESCE(p_desconto, 0),
        v_conta_estoque, v_conta_forn, 'COMPRA', p_compra_id
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'compra_id',    p_compra_id,
    'status',       v_status_compra,
    'itens_recebidos', v_recebidos,
    'itens_divergentes', v_divergentes,
    'itens_pendentes',  v_pendentes,
    'total_pago',   v_total_pago
  );
END;
$function$;

-- ─── E. Uma fonte para "movimentação e saldo caminham juntos" ────────────────
-- Regra hoje duplicada em 6 callers do frontend, cada um com seu par de
-- chamadas não-transacionais (update de saldo por leitura obsoleta + insert
-- de movimentação). A partir daqui, quem precisa mover estoque à mão chama
-- UMA RPC: as triggers de custeio PEPS e de criação de lote continuam sendo
-- a autoridade do valor — a RPC só garante que saldo e histórico mudam
-- juntos, ou nada muda.
CREATE OR REPLACE FUNCTION public.fn_movimentar_estoque(
  p_insumo_id       UUID,
  p_tipo            TEXT,
  p_quantidade      NUMERIC,
  p_custo_total     NUMERIC     DEFAULT NULL,
  p_motivo          TEXT        DEFAULT NULL,
  p_ocorrido_em     TIMESTAMPTZ DEFAULT NULL,
  p_lote_fornecedor TEXT        DEFAULT NULL,
  p_vence_em        DATE        DEFAULT NULL,
  p_pedido_id       UUID        DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_loja      UUID;
  v_saldo     NUMERIC;
  v_nome      TEXT;
  v_mov       UUID;
  v_custo     NUMERIC;
BEGIN
  SELECT loja_id, COALESCE(quantidade_atual, 0), nome
  INTO   v_loja, v_saldo, v_nome
  FROM   public.insumos WHERE id = p_insumo_id;

  IF v_loja IS NULL THEN
    RAISE EXCEPTION 'Insumo % não encontrado.', p_insumo_id;
  END IF;

  -- auth.uid() nulo = chamada interna (service role / testes). Com usuário
  -- logado, exige vínculo com a loja — o mesmo padrão de fn_baixar_estoque.
  IF auth.uid() IS NOT NULL AND NOT public.fn_meu_acesso(v_loja) THEN
    RAISE EXCEPTION 'Sem permissão para movimentar o estoque desta loja.';
  END IF;

  IF p_tipo NOT IN ('ENTRADA', 'SAIDA', 'AJUSTE', 'PERDA') THEN
    RAISE EXCEPTION 'Tipo % inválido para movimentação manual.', p_tipo;
  END IF;

  -- Convenção do schema: positivo entra, negativo sai. BAIXA_VENDA não é
  -- aceita aqui de propósito — ela tem fonte única (fn_baixar_estoque).
  IF p_tipo = 'ENTRADA' AND p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Entrada exige quantidade positiva.';
  END IF;
  IF p_tipo <> 'ENTRADA' AND p_quantidade >= 0 THEN
    RAISE EXCEPTION 'Saída/ajuste/perda exige quantidade negativa.';
  END IF;

  -- Saldo primeiro, com guarda: saída maior que o estoque aborta sem deixar
  -- rastro (saldo negativo é mentira operacional).
  UPDATE public.insumos
  SET    quantidade_atual = COALESCE(quantidade_atual, 0) + p_quantidade
  WHERE  id = p_insumo_id
  RETURNING COALESCE(quantidade_atual, 0) INTO v_saldo;

  IF p_quantidade < 0 AND v_saldo < -1e-6 THEN
    RAISE EXCEPTION 'Estoque insuficiente de %: ficaria %. Ajuste o estoque antes de concluir a operação.',
      v_nome, v_saldo;
  END IF;

  -- A trigger de custeio preenche custo_total na SAIDA/PERDA/AJUSTE
  -- negativos (PEPS dos lotes); a de lote cria o lote na ENTRADA. O
  -- RETURNING traz o custo já apurado pelas triggers.
  INSERT INTO public.movimentacoes_estoque (
    loja_id, insumo_id, tipo, quantidade, custo_total, motivo,
    lote_fornecedor, vence_em, ocorrido_em, pedido_id
  ) VALUES (
    v_loja, p_insumo_id, p_tipo, p_quantidade, NULLIF(p_custo_total, 0),
    p_motivo, NULLIF(p_lote_fornecedor, ''), p_vence_em,
    COALESCE(p_ocorrido_em, now()), p_pedido_id
  )
  RETURNING id, custo_total INTO v_mov, v_custo;

  RETURN jsonb_build_object(
    'movimentacao_id', v_mov,
    'custo_total',     v_custo,
    'saldo',           v_saldo
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_movimentar_estoque(UUID, TEXT, NUMERIC, NUMERIC, TEXT, TIMESTAMPTZ, TEXT, DATE, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_movimentar_estoque(UUID, TEXT, NUMERIC, NUMERIC, TEXT, TIMESTAMPTZ, TEXT, DATE, UUID) TO authenticated;

-- ─── F. Divergência saldo físico × saldo de lotes: DETECTÁVEL ────────────────
-- insumos.quantidade_atual é cache mantido pelos callers; lotes_estoque é a
-- autoridade do PEPS. Nunca houve nada que comparasse os dois — estorno que
-- devolvia saldo sem lote, entrada não-transacional que caía pela metade:
-- tudo ficava invisível. A view não corrige nada: ela EXISTE para a
-- divergência não passar mais despercebida (critério de aceitação do S1-C).
CREATE VIEW public.vw_divergencia_saldo_lotes
WITH (security_invoker = true) AS
SELECT
  i.id             AS insumo_id,
  i.loja_id,
  i.nome,
  i.unidade_medida,
  i.quantidade_atual,
  COALESCE(l.saldo_lotes, 0) AS saldo_lotes,
  i.quantidade_atual - COALESCE(l.saldo_lotes, 0) AS divergencia
FROM public.insumos i
LEFT JOIN (
  SELECT insumo_id, SUM(quantidade_restante) AS saldo_lotes
  FROM   public.lotes_estoque
  GROUP  BY insumo_id
) l ON l.insumo_id = i.id
WHERE i.ativo
  AND abs(i.quantidade_atual - COALESCE(l.saldo_lotes, 0)) > 0.000001;

GRANT SELECT ON public.vw_divergencia_saldo_lotes TO authenticated;
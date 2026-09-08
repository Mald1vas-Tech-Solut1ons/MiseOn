-- ============================================================================
-- RECEITA COM FONTE ÚNICA NO LEDGER (Sprint 1 — Núcleo Íntegro)
--
-- Problema medido: um pedido pago via Pix gerava DOIS créditos em conta de
-- receita no ledger — um no instante do pagamento (Edge `_shared/pedido-pix`,
-- referencia_tipo 'PAGAMENTO', débito 1.1.02 Banco Efí) e outro na finalização
-- (fn_lancar_receita_pedido, referencia_tipo 'PEDIDO', débito 1.1.01 Caixa).
-- Como vw_dre_mensal soma TODO crédito em conta de tipo RECEITA, o DRE contava
-- o faturamento de pedido Pix em dobro — e divergia por método de pagamento
-- (cartão e dinheiro contavam 1x, Pix 2x).
--
-- Agravante: fn_lancar_estorno_pedido só revertia o lançamento 'PEDIDO'
-- (crédito em Caixa), deixando o 'PAGAMENTO' sem reversa — pedido Pix pago e
-- depois cancelado mantinha receita permanente no DRE.
--
-- Decisão de domínio: a ÚNICA origem de lançamento de receita de pedido é
-- fn_lancar_receita_pedido, chamada pela trigger de status no FINALIZADO.
-- Ela cobre todos os métodos, é idempotente (receita_lancada marcada via NEW
-- pela trigger) e tem reversa simétrica (fn_lancar_estorno_pedido). A
-- confirmação do Pix deixa de lançar receita — grava apenas o fato
-- operacional: pagamentos.status = PAGO e pedido NOVO→ACEITO.
--
-- Onde o dinheiro entrou passa a ser resolvido pela própria receita, com base
-- no pagamento realmente PAGO: Pix → Banco Efí (1.1.02, fallback Caixa);
-- demais métodos → Caixa (1.1.01), como já era. O estorno espelha a mesma
-- escolha — reverte para a conta de onde o dinheiro veio, sem resíduo.
--
-- Invariante preservada: ledger de dupla entrada (débito = crédito) e
-- idempotência. O que muda é QUEM lança (uma função, um gatilho), nunca
-- quanto.
--
-- Base: versão vigente de 20260721230100_hotfix_ledger_27000.sql (funções
-- retornam boolean; a trigger marca receita_lancada via NEW — sem escrita
-- aninhada em pedidos, o erro 27000 não volta).
-- ============================================================================

-- ── 1. Receita: débito na conta onde o dinheiro realmente entrou ────────────
DROP FUNCTION IF EXISTS public.fn_lancar_receita_pedido(uuid);

CREATE FUNCTION public.fn_lancar_receita_pedido(p_pedido_id UUID)
RETURNS boolean AS $$
DECLARE
  v_loja          UUID;
  v_valor_total   NUMERIC;
  v_taxa_ifood    NUMERIC;
  v_origem        TEXT;
  v_conta_caixa   UUID;
  v_conta_banco   UUID;
  v_conta_rec_vd  UUID;
  v_conta_rec_if  UUID;
  v_conta_taxa    UUID;
  v_conta_entrada UUID;  -- conta de onde o dinheiro entrou (débito da receita)
BEGIN
  SELECT loja_id, valor_total, taxa_ifood_retida, origem
    INTO v_loja, v_valor_total, v_taxa_ifood, v_origem
  FROM public.pedidos
  WHERE id = p_pedido_id AND NOT receita_lancada;

  IF v_loja IS NULL THEN RETURN false; END IF;

  SELECT id INTO v_conta_caixa  FROM public.contas WHERE loja_id = v_loja AND codigo = '1.1.01' LIMIT 1;
  SELECT id INTO v_conta_banco  FROM public.contas WHERE loja_id = v_loja AND codigo = '1.1.02' LIMIT 1;
  SELECT id INTO v_conta_rec_vd FROM public.contas WHERE loja_id = v_loja AND codigo = '3.1.01' LIMIT 1;
  SELECT id INTO v_conta_rec_if FROM public.contas WHERE loja_id = v_loja AND codigo = '3.1.02' LIMIT 1;
  SELECT id INTO v_conta_taxa   FROM public.contas WHERE loja_id = v_loja AND codigo = '4.1.02' LIMIT 1;

  IF v_conta_caixa IS NULL OR v_conta_rec_vd IS NULL THEN
    RAISE WARNING '[ledger] Plano de contas incompleto para loja %. Lançamento omitido.', v_loja;
    RETURN false;
  END IF;

  -- Onde o dinheiro entrou: Pix cai no banco (conta Efí da plataforma com
  -- split); dinheiro e cartão de maquininha, no caixa. Só um pagamento PAGO
  -- decide — pagamento PENDENTE não é dinheiro.
  v_conta_entrada := v_conta_caixa;
  IF EXISTS (
    SELECT 1 FROM public.pagamentos
    WHERE pedido_id = p_pedido_id AND status = 'PAGO' AND metodo = 'PIX'
  ) THEN
    v_conta_entrada := COALESCE(v_conta_banco, v_conta_caixa);
  END IF;

  IF v_origem = 'ifood' THEN
    INSERT INTO public.lancamentos_financeiros
      (loja_id, historico, valor, conta_debitada, conta_creditada, referencia_tipo, referencia_id)
    VALUES
      (v_loja,
       'Receita iFood pedido #' || (SELECT numero FROM public.pedidos WHERE id = p_pedido_id),
       v_valor_total,
       COALESCE(v_conta_banco, v_conta_caixa),
       v_conta_rec_if,
       'PEDIDO',
       p_pedido_id);

    IF COALESCE(v_taxa_ifood, 0) > 0 AND v_conta_taxa IS NOT NULL THEN
      INSERT INTO public.lancamentos_financeiros
        (loja_id, historico, valor, conta_debitada, conta_creditada, referencia_tipo, referencia_id)
      VALUES
        (v_loja,
         'Taxa iFood retida pedido #' || (SELECT numero FROM public.pedidos WHERE id = p_pedido_id),
         v_taxa_ifood,
         v_conta_taxa,
         COALESCE(v_conta_banco, v_conta_caixa),
         'TAXA_IFOOD',
         p_pedido_id);
    END IF;
  ELSE
    INSERT INTO public.lancamentos_financeiros
      (loja_id, historico, valor, conta_debitada, conta_creditada, referencia_tipo, referencia_id)
    VALUES
      (v_loja,
       'Receita venda pedido #' || (SELECT numero FROM public.pedidos WHERE id = p_pedido_id),
       v_valor_total,
       v_conta_entrada,
       v_conta_rec_vd,
       'PEDIDO',
       p_pedido_id);
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ── 2. Estorno: reversa exata — devolve para a conta de origem ──────────────
DROP FUNCTION IF EXISTS public.fn_lancar_estorno_pedido(uuid);

CREATE FUNCTION public.fn_lancar_estorno_pedido(p_pedido_id UUID)
RETURNS boolean AS $$
DECLARE
  v_loja          UUID;
  v_valor_total   NUMERIC;
  v_origem        TEXT;
  v_conta_caixa   UUID;
  v_conta_banco   UUID;
  v_conta_rec_vd  UUID;
  v_conta_rec_if  UUID;
  v_conta_saida   UUID;  -- conta para onde o dinheiro volta (crédito do estorno)
BEGIN
  SELECT loja_id, valor_total, origem
    INTO v_loja, v_valor_total, v_origem
  FROM public.pedidos
  WHERE id = p_pedido_id AND receita_lancada;

  IF v_loja IS NULL THEN RETURN false; END IF;

  SELECT id INTO v_conta_caixa  FROM public.contas WHERE loja_id = v_loja AND codigo = '1.1.01' LIMIT 1;
  SELECT id INTO v_conta_banco  FROM public.contas WHERE loja_id = v_loja AND codigo = '1.1.02' LIMIT 1;
  SELECT id INTO v_conta_rec_vd FROM public.contas WHERE loja_id = v_loja AND codigo = '3.1.01' LIMIT 1;
  SELECT id INTO v_conta_rec_if FROM public.contas WHERE loja_id = v_loja AND codigo = '3.1.02' LIMIT 1;

  -- Espelha a escolha da receita: se o dinheiro entrou pelo Pix, o estorno
  -- sai do banco; senão, sai do caixa. Reversa 1:1 com o lançamento original.
  v_conta_saida := v_conta_caixa;
  IF EXISTS (
    SELECT 1 FROM public.pagamentos
    WHERE pedido_id = p_pedido_id AND status = 'PAGO' AND metodo = 'PIX'
  ) THEN
    v_conta_saida := COALESCE(v_conta_banco, v_conta_caixa);
  END IF;

  IF v_origem = 'ifood' THEN
    INSERT INTO public.lancamentos_financeiros
      (loja_id, historico, valor, conta_debitada, conta_creditada, referencia_tipo, referencia_id)
    VALUES
      (v_loja,
       'ESTORNO iFood pedido #' || (SELECT numero FROM public.pedidos WHERE id = p_pedido_id),
       v_valor_total,
       v_conta_rec_if,
       COALESCE(v_conta_banco, v_conta_caixa),
       'ESTORNO',
       p_pedido_id);
  ELSE
    INSERT INTO public.lancamentos_financeiros
      (loja_id, historico, valor, conta_debitada, conta_creditada, referencia_tipo, referencia_id)
    VALUES
      (v_loja,
       'ESTORNO venda pedido #' || (SELECT numero FROM public.pedidos WHERE id = p_pedido_id),
       v_valor_total,
       v_conta_rec_vd,
       v_conta_saida,
       'ESTORNO',
       p_pedido_id);
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Nota: vw_dre_mensal NÃO precisa de mudança — ela já soma por tipo de conta e
-- por referencia_tipo. Com uma única origem de receita, os números passam a
-- ser os mesmos para todos os métodos de pagamento.
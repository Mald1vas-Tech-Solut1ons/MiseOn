-- ============================================================================
-- SPRINT 7: ESTOQUE — UMA AUTORIDADE, E A PORTA DOS FUNDOS FECHADA
--
-- MEDIDO EM PRODUÇÃO (08/09): 54 de 92 insumos da loja de provas com saldo
-- divergente dos lotes. Nenhum cliente contaminado hoje (o tenant real está
-- com estoque zerado), mas a fábrica de divergência estava ligada.
--
-- ─── AS DUAS CAUSAS ────────────────────────────────────────────────────────
--
-- 1. DUPLA CONTAGEM AO CRIAR INSUMO. O formulário de Estoque gravava
--    `quantidade_atual` no INSERT e, logo depois, chamava
--    fn_movimentar_estoque('ENTRADA', mesma quantidade) — que SOMA de novo.
--    Reproduzido aqui: criar insumo com saldo 10 gravava saldo 20 e lote 10.
--    Todo insumo nascido com saldo inicial nasceu divergente.
--
-- 2. LEDGER GRAVÁVEL POR FORA. `anon` e `authenticated` tinham
--    INSERT/UPDATE/DELETE diretos em movimentacoes_estoque, lotes_estoque e
--    no saldo de insumos. Como nenhum gatilho dessas tabelas mantém o saldo
--    nem consome lote (quem faz as três escritas juntas são as RPCs), um
--    INSERT direto produz estado impossível: saldo parado, lote intacto.
--
-- ─── O QUE ESTA MIGRATION FAZ ──────────────────────────────────────────────
--
-- Fecha a porta (REVOKE) e entrega a ferramenta que faltava para consertar o
-- que já está torto (fn_reconciliar_estoque). O saldo continua sendo mantido
-- pelas RPCs — derivar o cache do ledger por gatilho é a evolução seguinte e
-- exige reescrever as 8 funções que hoje o atualizam à mão; não se faz isso
-- na véspera de entregar para cliente.
-- ============================================================================

-- ── fn_reconciliar_estoque ──────────────────────────────────────────────────
-- fn_ajustar_inventario compara a contagem com o CACHE (quantidade_atual).
-- Num item já divergente ela responde "contagem bate com o sistema" e não
-- conserta nada — o lote continua mentindo. Esta função acerta OS DOIS LADOS
-- contra a contagem física, deixando rastro (movimentação), que é o que
-- separa regularizar de maquiar.
CREATE OR REPLACE FUNCTION public.fn_reconciliar_estoque(
  p_insumo_id  UUID,
  p_qtd_contada NUMERIC,
  p_observacao TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_loja        UUID;
  v_nome        TEXT;
  v_saldo_cache NUMERIC;
  v_saldo_lotes NUMERIC;
  v_dif         NUMERIC;
  v_motivo      TEXT;
  v_mov         UUID;
BEGIN
  SELECT loja_id, nome, COALESCE(quantidade_atual, 0)
    INTO v_loja, v_nome, v_saldo_cache
    FROM public.insumos WHERE id = p_insumo_id;

  IF v_loja IS NULL THEN
    RAISE EXCEPTION 'Insumo % não encontrado.', p_insumo_id;
  END IF;

  IF NOT public.fn_tem_papel(v_loja, ARRAY['admin','operador']) THEN
    RAISE EXCEPTION 'Sem permissão para reconciliar o estoque desta loja.';
  END IF;

  IF p_qtd_contada < 0 THEN
    RAISE EXCEPTION 'Contagem não pode ser negativa.';
  END IF;

  SELECT COALESCE(sum(quantidade_restante), 0)
    INTO v_saldo_lotes
    FROM public.lotes_estoque WHERE insumo_id = p_insumo_id;

  -- A diferença é medida contra os LOTES: é o lado com lastro (entrada real,
  -- custo real). O cache é o número que derrapou.
  v_dif := p_qtd_contada - v_saldo_lotes;

  v_motivo := 'Reconciliação de estoque'
    || COALESCE(' — ' || NULLIF(p_observacao, ''), '')
    || ' (cache ' || public.fn_num_txt(v_saldo_cache)
    || ' / lotes ' || public.fn_num_txt(v_saldo_lotes)
    || ' / contado ' || public.fn_num_txt(p_qtd_contada) || ')';

  IF abs(v_dif) >= 1e-6 THEN
    IF v_dif > 0 THEN
      -- Falta lote para o que existe fisicamente: ENTRADA abre lote (é o
      -- único tipo que abre) e o PEPS volta a ter de onde consumir.
      INSERT INTO public.movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, motivo)
      VALUES (v_loja, p_insumo_id, 'ENTRADA', v_dif, v_motivo)
      RETURNING id INTO v_mov;
    ELSE
      -- Sobra lote: AJUSTE negativo consome pelo PEPS e custeia a baixa.
      INSERT INTO public.movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, motivo)
      VALUES (v_loja, p_insumo_id, 'AJUSTE', v_dif, v_motivo)
      RETURNING id INTO v_mov;
    END IF;
  END IF;

  -- O cache passa a valer a contagem — os dois lados fecham no mesmo número.
  UPDATE public.insumos SET quantidade_atual = p_qtd_contada WHERE id = p_insumo_id;

  RETURN jsonb_build_object(
    'movimentacao_id', v_mov,
    'saldo_anterior',  v_saldo_cache,
    'lotes_anterior',  v_saldo_lotes,
    'saldo_novo',      p_qtd_contada,
    'diferenca_lotes', v_dif
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_reconciliar_estoque(UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_reconciliar_estoque(UUID, NUMERIC, TEXT) TO authenticated;

COMMENT ON FUNCTION public.fn_reconciliar_estoque(UUID, NUMERIC, TEXT) IS
  'Regulariza um insumo divergente: acerta saldo E lotes contra a contagem '
  'física, deixando movimentação de rastro. Diferente de fn_ajustar_inventario, '
  'mede a diferença contra os LOTES (o lado com lastro), não contra o cache.';

-- ── A PORTA DOS FUNDOS ──────────────────────────────────────────────────────
-- O ledger e os lotes passam a ser escritos SÓ pelas RPCs (SECURITY DEFINER
-- roda como dono e não é afetado por estes REVOKEs). Nenhuma tela do MiseOn
-- escreve nessas tabelas — conferido em src/ e supabase/functions/ antes de
-- revogar; o que existia era a possibilidade, e era ela que permitia criar
-- estado impossível.
REVOKE INSERT, UPDATE, DELETE ON public.movimentacoes_estoque FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.lotes_estoque        FROM anon, authenticated;

-- Em `insumos` o app precisa escrever metadados (nome, mínimo, unidade,
-- ficha), então o REVOKE é da COLUNA do saldo, cirúrgico: quantidade_atual
-- deixa de ser escrevível por fora. Quem move saldo é RPC.
REVOKE UPDATE (quantidade_atual) ON public.insumos FROM anon, authenticated;

COMMENT ON COLUMN public.insumos.quantidade_atual IS
  'Saldo do insumo. Só as RPCs escrevem (o UPDATE desta coluna é revogado de '
  'anon/authenticated desde 20260908): movimentação, saldo e lote andam '
  'juntos ou não andam.';

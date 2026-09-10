-- ============================================================================
-- EXPEDIÇÃO PARCIAL NO SALÃO — a bebida sai antes do prato
--
-- ─── O DEFEITO ─────────────────────────────────────────────────────────────
-- `fn_expedir_kds_pedido` recusava a expedição inteira se QUALQUER ticket do
-- pedido ainda estivesse em produção:
--
--     IF v_pendentes > 0 THEN
--       RAISE EXCEPTION 'Pedido ainda possui tickets em producao.';
--
-- Isso contradiz a política escrita no plano de execução
-- (docs/SPRINTS-E-UX-LANCAMENTO-MISEON.md, seção "Expedição caixa e telas de
-- gestão"), que diz com todas as letras:
--
--     "Pronto no Bar não significa pedido inteiro pronto. A política permite
--      servir bebida à mesa antes da refeição, enquanto o delivery aguarda os
--      itens necessários à entrega."
--
-- Na prática do salão isso é o caso comum, não a exceção: a mesa pede chope e
-- picanha juntos; o chope fica pronto em trinta segundos e a picanha em vinte
-- minutos. Com a regra antiga o garçom não conseguia registrar a entrega do
-- chope — e a saída era não registrar nada, que é como o sistema perde o
-- rastro do que já foi à mesa.
--
-- A suíte de integração do Sprint 18 já afirmava o comportamento correto
-- ("expedicao converge entre dispositivos sem finalizar pedido ou comanda",
-- esperando 1 ticket expedido com a rodada 2 ainda AGUARDANDO). Ela nunca
-- tinha rodado — ficava BLOCKED por falta de credencial —, então o código
-- subiu contrariando o próprio contrato que estava escrito ao lado.
--
-- ─── A REGRA, AGORA ────────────────────────────────────────────────────────
-- Depende do DESTINO, porque a operação depende:
--
--  • SALAO e RETIRADA_BALCAO: expede o que está PRONTO e deixa o resto em
--    produção. O item entregue fica marcado com hora e responsável; o pedido
--    e a comanda NÃO são fechados — quem fecha a conta é o caixa, e quem
--    conclui o pedido é a máquina de estados, não a expedição.
--
--  • DELIVERY: continua exigindo tudo pronto. O entregador leva uma sacola só;
--    despachar pela metade é pedido incompleto na casa do cliente, e não há
--    segunda viagem. Aqui a recusa é proteção, não burocracia.
--
-- ─── O QUE NÃO MUDA ────────────────────────────────────────────────────────
--  • Pedido sem nenhum ticket continua sendo erro (não há o que expedir).
--  • Autorização continua exigindo papel admin/operador da loja.
--  • A ordem de locks (pedido primeiro, tickets por id) é a mesma do despacho,
--    para expedição e item novo não se atravessarem em concorrência.
--  • Idempotência: expedir de novo não remarca o que já saiu — o filtro
--    `expedido_em IS NULL` continua lá, e a segunda chamada devolve 0 em vez
--    de erro. Dois dispositivos apontando para o mesmo pedido convergem.
-- ============================================================================

create or replace function public.fn_expedir_kds_pedido(p_pedido_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_loja_id   uuid;
  v_tipo      tipo_pedido;
  v_marcados  integer;
  v_total     integer;
  v_pendentes integer;
BEGIN
  SELECT loja_id, tipo_pedido INTO v_loja_id, v_tipo
  FROM public.pedidos
  WHERE id = p_pedido_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido nao encontrado.'; END IF;

  IF NOT public.fn_tem_papel(v_loja_id, ARRAY['admin', 'operador']) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  -- Mesma ordem de locks usada pelo despacho: pedido primeiro, tickets por id.
  -- Assim item novo e expedicao nao atravessam um ao outro em concorrencia.
  PERFORM 1
  FROM public.kds_tickets
  WHERE pedido_id = p_pedido_id
  ORDER BY id
  FOR UPDATE;

  SELECT count(*), count(*) FILTER (WHERE status <> 'PRONTO')
  INTO v_total, v_pendentes
  FROM public.kds_tickets
  WHERE pedido_id = p_pedido_id;

  IF v_total = 0 THEN
    RAISE EXCEPTION 'Pedido nao possui tickets de producao.';
  END IF;

  -- Delivery sai inteiro ou nao sai: o entregador leva uma sacola so.
  IF v_tipo = 'DELIVERY' AND v_pendentes > 0 THEN
    RAISE EXCEPTION 'Entrega so pode sair com o pedido inteiro pronto: ainda ha % item(ns) em producao.', v_pendentes
      USING ERRCODE = 'check_violation';
  END IF;

  -- Salao e balcao: entrega o que ficou pronto, sem fechar pedido nem comanda.
  UPDATE public.kds_tickets
  SET expedido_em = now(), expedido_por = auth.uid()
  WHERE pedido_id = p_pedido_id
    AND loja_id = v_loja_id
    AND status = 'PRONTO'
    AND expedido_em IS NULL;
  GET DIAGNOSTICS v_marcados = ROW_COUNT;

  RETURN jsonb_build_object(
    'pedido_id',         p_pedido_id,
    'tickets_expedidos', v_marcados,
    'tickets_pendentes', v_pendentes
  );
END;
$function$;

comment on function public.fn_expedir_kds_pedido(uuid) is
  'Marca como expedidos os tickets PRONTOS do pedido. Salao e balcao aceitam expedicao parcial (a bebida sai antes do prato) e nao fecham pedido nem comanda; delivery exige o pedido inteiro pronto. Idempotente: a segunda chamada devolve 0.';

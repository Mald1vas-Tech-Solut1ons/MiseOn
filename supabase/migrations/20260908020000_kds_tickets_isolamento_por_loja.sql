-- ============================================================================
-- SPRINT 5: KDS ENTERPRISE — HOTFIX DE ISOLAMENTO ENTRE LOJAS
--
-- fn_avancar_kds_ticket era SECURITY DEFINER sem checagem de acesso: como as
-- funções SECURITY DEFINER rodam com o dono da função (não o usuário
-- chamador), RLS de kds_tickets nunca era avaliada dentro dela. Qualquer
-- usuário autenticado — de qualquer loja — podia avançar o ticket de
-- QUALQUER outra loja passando o UUID. O resto do app segue o padrão
-- oposto (ex: fn_avancar_status_pedido, fn_transformar_estoque) — checa
-- fn_tem_papel/usuarios_loja explicitamente no corpo da função.
--
-- fn_despachar_kds_tickets e fn_verificar_pedido_completo_kds nunca
-- precisaram estar expostas para authenticated: só são chamadas
-- internamente (via trigger / PERFORM), então a concessão a authenticated
-- só aumentava a superfície de ataque à toa.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_avancar_kds_ticket(
  p_ticket_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket        RECORD;
  v_total_etapas  INT;
  v_proximo_idx   INT;
  v_novo_status   TEXT;
  v_resultado     JSONB;
BEGIN
  SELECT t.*, jsonb_array_length(w.etapas) AS total_etapas
  INTO v_ticket
  FROM public.kds_tickets t
  JOIN public.kds_workflows w ON w.id = t.workflow_id
  WHERE t.id = p_ticket_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket KDS % não encontrado', p_ticket_id;
  END IF;

  IF NOT public.fn_tem_papel(v_ticket.loja_id, ARRAY['admin','operador']) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  IF v_ticket.status = 'PRONTO' THEN
    RETURN jsonb_build_object('status', 'PRONTO', 'mensagem', 'Ticket já está concluído');
  END IF;

  v_proximo_idx  := v_ticket.etapa_atual_idx + 1;
  v_total_etapas := v_ticket.total_etapas;

  -- Determina o novo status
  IF v_proximo_idx >= v_total_etapas - 1 THEN
    v_novo_status := 'PRONTO';
  ELSIF v_ticket.status = 'AGUARDANDO' THEN
    v_novo_status := 'PREPARANDO';
  ELSE
    v_novo_status := v_ticket.status;
  END IF;

  -- Avança o ticket
  UPDATE public.kds_tickets
  SET
    etapa_atual_idx = LEAST(v_proximo_idx, v_total_etapas - 1),
    status          = v_novo_status,
    iniciado_em     = COALESCE(iniciado_em, now()),
    concluido_em    = CASE WHEN v_novo_status = 'PRONTO' THEN now() ELSE NULL END
  WHERE id = p_ticket_id;

  -- Se concluiu, verifica se o pedido inteiro está pronto
  IF v_novo_status = 'PRONTO' THEN
    PERFORM public.fn_verificar_pedido_completo_kds(v_ticket.pedido_id);
  END IF;

  v_resultado := jsonb_build_object(
    'ticket_id',      p_ticket_id,
    'etapa_anterior', v_ticket.etapa_atual_idx,
    'etapa_atual',    LEAST(v_proximo_idx, v_total_etapas - 1),
    'status',         v_novo_status
  );

  RETURN v_resultado;
END;
$$;

-- fn_despachar_kds_tickets e fn_verificar_pedido_completo_kds só são
-- chamadas internamente (trigger / PERFORM) — não precisam de acesso via API.
REVOKE ALL ON FUNCTION public.fn_despachar_kds_tickets(UUID) FROM authenticated;
REVOKE ALL ON FUNCTION public.fn_verificar_pedido_completo_kds(UUID) FROM authenticated;

COMMENT ON FUNCTION public.fn_avancar_kds_ticket(UUID) IS
  'Avança o ponteiro de etapa de um ticket. Exige admin/operador da loja dona '
  'do ticket (fn_tem_papel) — SECURITY DEFINER não herda RLS automaticamente. '
  'Quando atinge o fim do workflow da estação, marca PRONTO e verifica se o '
  'pedido completo está pronto.';

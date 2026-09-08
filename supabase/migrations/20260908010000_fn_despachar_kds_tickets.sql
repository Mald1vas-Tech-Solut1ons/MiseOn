-- ============================================================================
-- SPRINT 5: KDS ENTERPRISE — RPCs DE DESPACHO, AVANÇO E CONCLUSÃO
--
-- fn_despachar_kds_tickets(p_pedido_id):
--   Lê os itens do pedido, agrupa por estação (usando estacao_kds_id do
--   produto, com fallback para a estação Cozinha da loja), e cria um
--   kds_ticket por estação. Idempotente via ON CONFLICT DO NOTHING.
--
-- fn_avancar_kds_ticket(p_ticket_id):
--   Avança etapa_atual_idx. Quando atinge o fim do workflow do ticket,
--   marca status = 'PRONTO'. Chama fn_verificar_pedido_completo.
--
-- fn_verificar_pedido_completo_kds(p_pedido_id):
--   Se TODOS os tickets do pedido estão 'PRONTO', atualiza pedidos.status
--   diretamente (não via fn_avancar_status_pedido — essa função exige
--   auth.uid() de um usuário da loja, e aqui o gatilho pode disparar sem
--   sessão, ex. pedido do iFood). Os triggers de estoque/e-mail/iFood do
--   pedidos continuam disparando normalmente porque são acionados pela
--   própria coluna status mudando, não por quem fez o UPDATE.
-- ============================================================================

-- ── fn_despachar_kds_tickets ────────────────────────────────────────────────
-- Retorna TRUE se despachou tickets (loja usa o modelo novo) e FALSE se a
-- loja não tem estações configuradas (modelo legado) — o chamador usa isso
-- para decidir se também avança pedidos.status/estacao_atual automaticamente.
CREATE OR REPLACE FUNCTION public.fn_despachar_kds_tickets(
  p_pedido_id UUID
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loja_id         UUID;
  v_estacao_id      UUID;
  v_workflow_id     UUID;
  v_estacao_default UUID;
  v_workflow_default UUID;
  v_item            RECORD;
  v_ticket_itens    JSONB;
  v_grupo           RECORD;
BEGIN
  -- Busca loja do pedido
  SELECT loja_id INTO v_loja_id
  FROM public.pedidos WHERE id = p_pedido_id;

  IF v_loja_id IS NULL THEN
    RAISE EXCEPTION 'Pedido % não encontrado', p_pedido_id;
  END IF;

  -- Estação e workflow padrão (Cozinha — primeira estação ativa por ordem)
  SELECT e.id, w.id
  INTO v_estacao_default, v_workflow_default
  FROM public.kds_estacoes e
  JOIN public.kds_workflows w ON w.estacao_id = e.id AND w.loja_id = e.loja_id
  WHERE e.loja_id = v_loja_id AND e.ativo = true
  ORDER BY e.ordem ASC
  LIMIT 1;

  -- Se não tem estações configuradas, encerra silenciosamente
  -- (loja usa modelo legado — pedidos.etapa_kds_atual)
  IF v_estacao_default IS NULL THEN
    RETURN false;
  END IF;

  -- Agrupa itens do pedido por estação
  -- Para cada agrupamento distinto de estacao_kds_id, cria um ticket
  FOR v_grupo IN
    SELECT
      COALESCE(p.estacao_kds_id, v_estacao_default) AS estacao_id,
      COALESCE(p.workflow_kds_id, v_workflow_default) AS workflow_id,
      jsonb_agg(
        jsonb_build_object(
          'item_pedido_id', ip.id,
          'produto_id',     ip.produto_id,
          'nome',           ip.nome_produto,
          'quantidade',     ip.quantidade,
          'observacao',     ip.observacao,
          'opcoes',         COALESCE(
                              (SELECT jsonb_agg(o.nome_opcao)
                               FROM public.itens_pedido_opcoes o
                               WHERE o.item_id = ip.id),
                              '[]'::jsonb
                            )
        )
      ) AS itens_json
    FROM public.itens_pedido ip
    LEFT JOIN public.produtos p ON p.id = ip.produto_id
    WHERE ip.pedido_id = p_pedido_id
    GROUP BY COALESCE(p.estacao_kds_id, v_estacao_default),
             COALESCE(p.workflow_kds_id, v_workflow_default)
  LOOP
    -- Verifica que a estação e workflow existem e são da mesma loja
    SELECT e.id, w.id
    INTO v_estacao_id, v_workflow_id
    FROM public.kds_estacoes e
    JOIN public.kds_workflows w ON w.estacao_id = e.id
    WHERE e.id = v_grupo.estacao_id
      AND w.id = v_grupo.workflow_id
      AND e.loja_id = v_loja_id
    LIMIT 1;

    -- Fallback se estação do produto não pertence a esta loja
    IF v_estacao_id IS NULL THEN
      v_estacao_id  := v_estacao_default;
      v_workflow_id := v_workflow_default;
    END IF;

    -- Cria o ticket (idempotente: não duplica se já existe)
    INSERT INTO public.kds_tickets(
      pedido_id, loja_id, estacao_id, workflow_id, itens
    )
    VALUES (
      p_pedido_id, v_loja_id, v_estacao_id, v_workflow_id, v_grupo.itens_json
    )
    ON CONFLICT (pedido_id, estacao_id) DO NOTHING;

  END LOOP;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_despachar_kds_tickets(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_despachar_kds_tickets(UUID) TO authenticated;

-- ── fn_avancar_kds_ticket ────────────────────────────────────────────────────
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

REVOKE ALL ON FUNCTION public.fn_avancar_kds_ticket(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_avancar_kds_ticket(UUID) TO authenticated;

-- ── fn_verificar_pedido_completo_kds ─────────────────────────────────────────
-- IMPORTANTE: pedidos.status é guardado por fn_valida_transicao_pedido, que só
-- aceita PREPARANDO → PRONTO quando estacao_atual = 'COZINHA' (e nesse caso
-- ela mesma move estacao_atual de volta para 'BALCAO' — não fazemos isso
-- aqui). Pedido sem item de cozinha (requer_cozinha = false) já está parado
-- em ACEITO/BALCAO e o validador aceita ACEITO → PRONTO direto. Por isso este
-- UPDATE só toca status: um pedido com requer_cozinha = true só chega aqui já
-- em PREPARANDO/COZINHA porque fn_trg_despachar_kds_ao_aceitar adianta esse
-- passo no despacho (ver abaixo) — sem isso, a transição pulada faria esta
-- função estourar exceção e derrubar fn_avancar_kds_ticket inteiro.
CREATE OR REPLACE FUNCTION public.fn_verificar_pedido_completo_kds(
  p_pedido_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_tickets  INT;
  v_prontos        INT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'PRONTO')
  INTO v_total_tickets, v_prontos
  FROM public.kds_tickets
  WHERE pedido_id = p_pedido_id;

  -- Só conclui quando TODOS os tickets existem e estão prontos
  IF v_total_tickets > 0 AND v_total_tickets = v_prontos THEN
    UPDATE public.pedidos
    SET status = 'PRONTO'
    WHERE id = p_pedido_id
      AND status NOT IN ('PRONTO', 'FINALIZADO', 'CANCELADO');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_verificar_pedido_completo_kds(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_verificar_pedido_completo_kds(UUID) TO authenticated;

-- ── Trigger: despacha tickets automaticamente ao aceitar o pedido ────────────
CREATE OR REPLACE FUNCTION public.fn_trg_despachar_kds_ao_aceitar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_despachou boolean;
BEGIN
  -- Despacha quando o pedido passa para ACEITO ou PREPARANDO
  -- (garante que iFood e outros canais também geram tickets)
  IF NEW.status IN ('ACEITO', 'PREPARANDO')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('ACEITO', 'PREPARANDO', 'PRONTO'))
  THEN
    v_despachou := public.fn_despachar_kds_tickets(NEW.id);

    -- No modelo por tickets a cozinha já vê o pedido na hora (não existe mais
    -- o clique manual de "mandar pra cozinha"); adiantamos aqui as MESMAS
    -- transições que esse clique faria (fn_valida_estacao_pedido /
    -- fn_valida_transicao_pedido), senão fn_verificar_pedido_completo_kds
    -- tentaria pular direto de ACEITO pra PRONTO com item de cozinha
    -- pendente e o validador rejeitaria.
    IF v_despachou AND NEW.status = 'ACEITO' AND NEW.requer_cozinha THEN
      IF NEW.estacao_atual = 'BALCAO' THEN
        UPDATE public.pedidos SET estacao_atual = 'COZINHA' WHERE id = NEW.id;
      END IF;
      UPDATE public.pedidos SET status = 'PREPARANDO' WHERE id = NEW.id AND status = 'ACEITO';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_despachar_kds_ao_aceitar ON public.pedidos;

CREATE TRIGGER trg_despachar_kds_ao_aceitar
  AFTER INSERT OR UPDATE OF status ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trg_despachar_kds_ao_aceitar();

COMMENT ON FUNCTION public.fn_despachar_kds_tickets(UUID) IS
  'Fragmenta um pedido em tickets de produção por estação. Idempotente. '
  'Lojas sem estações configuradas são ignoradas (modelo legado permanece).';

COMMENT ON FUNCTION public.fn_avancar_kds_ticket(UUID) IS
  'Avança o ponteiro de etapa de um ticket. Quando atinge o fim do workflow '
  'da estação, marca PRONTO e verifica se o pedido completo está pronto.';

COMMENT ON FUNCTION public.fn_verificar_pedido_completo_kds(UUID) IS
  'Verifica se todos os tickets de um pedido estão PRONTO. '
  'Se sim, atualiza pedidos.status = PRONTO para o expeditor/balcão.';

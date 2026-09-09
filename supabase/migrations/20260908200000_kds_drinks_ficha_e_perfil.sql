-- ============================================================================
-- SPRINT 12: BAR NÃO É COZINHA COM OUTRO NOME
--
-- O produto declara o perfil de produção. O ticket do bar recebe receita,
-- volume, teor alcoólico e calorias calculadas pelo motor nutricional. Nada é
-- inferido pelo nome "caipirinha", "gin" etc.
-- ============================================================================

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS perfil_preparo text NOT NULL DEFAULT 'ALIMENTO'
    CHECK (perfil_preparo IN ('ALIMENTO', 'DRINK', 'BEBIDA_PRONTA')),
  ADD COLUMN IF NOT EXISTS teor_alcoolico_pct numeric(5,2)
    CHECK (teor_alcoolico_pct IS NULL OR teor_alcoolico_pct BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS volume_porcao_ml numeric(10,2)
    CHECK (volume_porcao_ml IS NULL OR volume_porcao_ml > 0);

COMMENT ON COLUMN public.produtos.perfil_preparo IS
  'Classificação operacional explícita: alimento, drink montado no bar ou bebida pronta de revenda.';
COMMENT ON COLUMN public.produtos.teor_alcoolico_pct IS
  'ABV informado pelo lojista para a porção final do drink; não é estimado silenciosamente.';

-- Melhora somente o workflow padrão antigo. Fluxos que o lojista já
-- personalizou são preservados.
UPDATE public.kds_workflows
SET etapas = '[
  {"id":"separar","nome":"Separar ingredientes","ordem":0},
  {"id":"misturar","nome":"Misturar / montar","ordem":1},
  {"id":"finalizar","nome":"Finalizar e servir","ordem":2}
]'::jsonb
WHERE nome = 'Fluxo Bar'
  AND etapas = '[
    {"id":"preparar","nome":"Preparar Drink","ordem":0},
    {"id":"servir","nome":"Servir","ordem":1}
  ]'::jsonb;

CREATE OR REPLACE FUNCTION public.fn_despachar_kds_tickets(p_pedido_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_loja_id uuid;
  v_estacao_id uuid;
  v_workflow_id uuid;
  v_estacao_default uuid;
  v_workflow_default uuid;
  v_grupo record;
BEGIN
  SELECT loja_id INTO v_loja_id
  FROM public.pedidos WHERE id = p_pedido_id;

  IF v_loja_id IS NULL THEN
    RAISE EXCEPTION 'Pedido % não encontrado', p_pedido_id;
  END IF;

  -- Triggers e service role não têm auth.uid(). Uma chamada feita pelo painel
  -- precisa pertencer à loja e ter papel operacional.
  IF auth.uid() IS NOT NULL
     AND NOT public.fn_tem_papel(v_loja_id, ARRAY['admin', 'operador']) THEN
    RAISE EXCEPTION 'Sem acesso operacional a este pedido.';
  END IF;

  SELECT e.id, w.id INTO v_estacao_default, v_workflow_default
  FROM public.kds_estacoes e
  JOIN public.kds_workflows w ON w.estacao_id = e.id AND w.loja_id = e.loja_id
  WHERE e.loja_id = v_loja_id AND e.ativo = true
  ORDER BY e.ordem
  LIMIT 1;

  IF v_estacao_default IS NULL THEN RETURN false; END IF;

  FOR v_grupo IN
    SELECT
      coalesce(p.estacao_kds_id, v_estacao_default) AS estacao_id,
      coalesce(p.workflow_kds_id, wk.id, v_workflow_default) AS workflow_id,
      jsonb_agg(
        jsonb_build_object(
          'item_pedido_id', ip.id,
          'produto_id', ip.produto_id,
          'nome', ip.nome_produto,
          'quantidade', ip.quantidade,
          'observacao', ip.observacao,
          'opcoes', coalesce(
            (SELECT jsonb_agg(o.nome_opcao ORDER BY o.nome_opcao)
             FROM public.itens_pedido_opcoes o WHERE o.item_id = ip.id),
            '[]'::jsonb
          ),
          'perfil_preparo', coalesce(p.perfil_preparo, 'ALIMENTO'),
          'teor_alcoolico_pct', p.teor_alcoolico_pct,
          'volume_porcao_ml', p.volume_porcao_ml,
          'calorias_porcao', (
            SELECT nullif(c.por_porcao->>'ENERGIA_KCAL', '')::numeric
            FROM public.produtos_nutricao_cache c
            WHERE c.produto_id = p.id
          ),
          'ingredientes', coalesce(
            (SELECT jsonb_agg(jsonb_build_object(
                'nome', i.nome,
                'quantidade', ft.quantidade_consumida,
                'unidade', i.unidade_medida
              ) ORDER BY i.nome)
             FROM public.fichas_tecnicas ft
             JOIN public.insumos i ON i.id = ft.insumo_id
             WHERE ft.produto_id = p.id),
            '[]'::jsonb
          )
        ) ORDER BY ip.id
      ) AS itens_json
    FROM public.itens_pedido ip
    LEFT JOIN public.produtos p ON p.id = ip.produto_id
    LEFT JOIN public.kds_workflows wk
      ON wk.estacao_id = p.estacao_kds_id AND wk.loja_id = v_loja_id
    WHERE ip.pedido_id = p_pedido_id
    GROUP BY
      coalesce(p.estacao_kds_id, v_estacao_default),
      coalesce(p.workflow_kds_id, wk.id, v_workflow_default)
  LOOP
    SELECT e.id, w.id INTO v_estacao_id, v_workflow_id
    FROM public.kds_estacoes e
    JOIN public.kds_workflows w ON w.estacao_id = e.id
    WHERE e.id = v_grupo.estacao_id
      AND w.id = v_grupo.workflow_id
      AND e.loja_id = v_loja_id
    LIMIT 1;

    IF v_estacao_id IS NULL THEN
      v_estacao_id := v_estacao_default;
      v_workflow_id := v_workflow_default;
    END IF;

    INSERT INTO public.kds_tickets(pedido_id, loja_id, estacao_id, workflow_id, itens)
    VALUES (p_pedido_id, v_loja_id, v_estacao_id, v_workflow_id, v_grupo.itens_json)
    ON CONFLICT (pedido_id, estacao_id) DO NOTHING;
  END LOOP;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_despachar_kds_tickets(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_despachar_kds_tickets(uuid) TO authenticated;

COMMENT ON FUNCTION public.fn_despachar_kds_tickets(uuid) IS
  'Cria tickets independentes por estação com snapshot operacional da receita e do perfil de bebida.';

-- O avanço de ticket também é SECURITY DEFINER. A versão original dependia
-- apenas de o chamador conhecer o UUID; aqui o tenant é validado antes de
-- qualquer alteração e a função auxiliar deixa de ser uma API pública.
CREATE OR REPLACE FUNCTION public.fn_avancar_kds_ticket(p_ticket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_ticket record;
  v_total_etapas int;
  v_proximo_idx int;
  v_novo_status text;
BEGIN
  SELECT t.*, jsonb_array_length(w.etapas) AS total_etapas
  INTO v_ticket
  FROM public.kds_tickets t
  JOIN public.kds_workflows w ON w.id = t.workflow_id
  WHERE t.id = p_ticket_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket KDS % não encontrado', p_ticket_id;
  END IF;
  IF NOT public.fn_tem_papel(v_ticket.loja_id, ARRAY['admin', 'operador']) THEN
    RAISE EXCEPTION 'Sem acesso operacional a este ticket.';
  END IF;
  IF v_ticket.status = 'PRONTO' THEN
    RETURN jsonb_build_object('status', 'PRONTO', 'mensagem', 'Ticket já está concluído');
  END IF;

  v_proximo_idx := v_ticket.etapa_atual_idx + 1;
  v_total_etapas := v_ticket.total_etapas;
  v_novo_status := CASE
    WHEN v_proximo_idx >= v_total_etapas - 1 THEN 'PRONTO'
    WHEN v_ticket.status = 'AGUARDANDO' THEN 'PREPARANDO'
    ELSE v_ticket.status
  END;

  UPDATE public.kds_tickets
  SET etapa_atual_idx = least(v_proximo_idx, v_total_etapas - 1),
      status = v_novo_status,
      iniciado_em = coalesce(iniciado_em, now()),
      concluido_em = CASE WHEN v_novo_status = 'PRONTO' THEN now() ELSE NULL END
  WHERE id = p_ticket_id;

  IF v_novo_status = 'PRONTO' THEN
    PERFORM public.fn_verificar_pedido_completo_kds(v_ticket.pedido_id);
  END IF;

  RETURN jsonb_build_object(
    'ticket_id', p_ticket_id,
    'etapa_anterior', v_ticket.etapa_atual_idx,
    'etapa_atual', least(v_proximo_idx, v_total_etapas - 1),
    'status', v_novo_status
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_avancar_kds_ticket(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_avancar_kds_ticket(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.fn_verificar_pedido_completo_kds(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_trg_despachar_kds_ao_aceitar()
  FROM PUBLIC, anon, authenticated;

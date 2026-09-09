-- ============================================================================
-- SPRINT 14: REVENDA DIRETA NUNCA ENTRA NO KDS
--
-- produtos.estacao_preparo = 'DIRETO' está documentado desde 20260720100000:
-- "revenda direta (balcão entrega sem passar pela cozinha)". fn_despachar_kds_
-- tickets nunca filtrou por isso — nem na versão original (Sprint 5,
-- 20260908010000) nem na reescrita para drinks (Sprint 12, 20260908200000).
-- Uma Coca-Cola de revenda virava ticket na fila da cozinha, na etapa de
-- qualquer workflow que por acaso fosse a estação padrão da loja (visto ao
-- vivo: foi parar em "Ponto da carne").
--
-- Item sem produto vinculado (ex.: avulso de PDV) continua contando como
-- COZINHA, mesma regra do trigger que calcula requer_cozinha.
-- ============================================================================

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
      -- Regra de 20260720100000: DIRETO é revenda que o balcão entrega sem
      -- passar pela cozinha. Item sem produto (avulso) conta como cozinha.
      AND coalesce(p.estacao_preparo, 'COZINHA') <> 'DIRETO'
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

COMMENT ON FUNCTION public.fn_despachar_kds_tickets(uuid) IS
  'Cria tickets independentes por estação com snapshot operacional da receita e do perfil de bebida. Item estacao_preparo=DIRETO (revenda) nunca entra no KDS.';

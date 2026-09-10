-- ============================================================================
-- SPRINT 18: KDS POR RODADA, SNAPSHOT COMPLETO E MODIFICADORES VALIDADOS
--
-- Invariantes:
--   * item_pedido_id e a identidade; reexecucao nunca duplica um item;
--   * ticket concluido e imutavel; novo item cria nova rodada;
--   * opcoes sao validadas e precificadas pelo catalogo da loja;
--   * ponto da carne continua sendo modificador/observacao do item, nunca etapa;
--   * a ultima etapa permanece visivel e so o proximo avancar conclui o ticket.
-- ============================================================================

ALTER TABLE public.kds_tickets
  ADD COLUMN rodada_numero integer NOT NULL DEFAULT 1
  CHECK (rodada_numero > 0);

ALTER TABLE public.kds_tickets ADD COLUMN workflow_snapshot jsonb;
UPDATE public.kds_tickets t
SET workflow_snapshot = w.etapas
FROM public.kds_workflows w
WHERE w.id = t.workflow_id;
ALTER TABLE public.kds_tickets ALTER COLUMN workflow_snapshot SET NOT NULL;

DROP INDEX IF EXISTS public.kds_tickets_pedido_estacao_uk;
CREATE UNIQUE INDEX kds_tickets_pedido_estacao_rodada_uk
  ON public.kds_tickets (pedido_id, estacao_id, rodada_numero);
CREATE UNIQUE INDEX kds_tickets_um_ativo_por_estacao_uk
  ON public.kds_tickets (pedido_id, estacao_id)
  WHERE status IN ('AGUARDANDO', 'PREPARANDO');

CREATE TABLE public.kds_ticket_itens (
  ticket_id uuid NOT NULL REFERENCES public.kds_tickets(id) ON DELETE CASCADE,
  item_pedido_id uuid NOT NULL REFERENCES public.itens_pedido(id) ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, item_pedido_id),
  CONSTRAINT kds_ticket_itens_item_unico UNIQUE (item_pedido_id)
);

CREATE INDEX kds_ticket_itens_ticket_idx
  ON public.kds_ticket_itens (ticket_id);

ALTER TABLE public.kds_ticket_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY kds_ticket_itens_por_loja ON public.kds_ticket_itens
  USING (EXISTS (
    SELECT 1
    FROM public.kds_tickets t
    WHERE t.id = kds_ticket_itens.ticket_id
      AND public.fn_tem_papel(t.loja_id, ARRAY['admin', 'operador'])
  ));

-- Preserva a identidade dos snapshots ja existentes antes de trocar o despacho.
INSERT INTO public.kds_ticket_itens (ticket_id, item_pedido_id)
SELECT t.id, nullif(item->>'item_pedido_id', '')::uuid
FROM public.kds_tickets t
CROSS JOIN LATERAL jsonb_array_elements(t.itens) item
WHERE nullif(item->>'item_pedido_id', '') IS NOT NULL
ON CONFLICT (item_pedido_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.fn_snapshot_item_kds(p_item_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT jsonb_build_object(
    'item_pedido_id', ip.id,
    'produto_id', ip.produto_id,
    'nome', ip.nome_produto,
    'quantidade', ip.quantidade,
    'observacao', ip.observacao,
    -- Campo legado mantido para clientes ja publicados.
    'opcoes', COALESCE((
      SELECT jsonb_agg(ipo.nome_opcao ORDER BY ipo.id)
      FROM public.itens_pedido_opcoes ipo
      WHERE ipo.item_id = ip.id
    ), '[]'::jsonb),
    -- Contrato estruturado da Sprint 18.
    'modificadores', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'opcao_id', ipo.opcao_id,
        'grupo_id', o.grupo_id,
        'grupo_nome', g.nome,
        'nome', ipo.nome_opcao,
        'preco_adicional', ipo.preco_adicional
      ) ORDER BY g.ordem, o.ordem, ipo.id)
      FROM public.itens_pedido_opcoes ipo
      LEFT JOIN public.opcoes o ON o.id = ipo.opcao_id
      LEFT JOIN public.grupos_opcoes g ON g.id = o.grupo_id
      WHERE ipo.item_id = ip.id
    ), '[]'::jsonb),
    'perfil_preparo', COALESCE(p.perfil_preparo, 'ALIMENTO'),
    'teor_alcoolico_pct', p.teor_alcoolico_pct,
    'volume_porcao_ml', p.volume_porcao_ml,
    'calorias_porcao', (
      SELECT nullif(c.por_porcao->>'ENERGIA_KCAL', '')::numeric
      FROM public.produtos_nutricao_cache c
      WHERE c.produto_id = p.id
    ),
    'ingredientes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'nome', i.nome,
        'quantidade', ft.quantidade_consumida,
        'unidade', i.unidade_medida
      ) ORDER BY i.nome)
      FROM public.fichas_tecnicas ft
      JOIN public.insumos i ON i.id = ft.insumo_id
      WHERE ft.produto_id = p.id
    ), '[]'::jsonb)
  )
  FROM public.itens_pedido ip
  LEFT JOIN public.produtos p ON p.id = ip.produto_id
  WHERE ip.id = p_item_id;
$function$;

REVOKE ALL ON FUNCTION public.fn_snapshot_item_kds(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_item_cumpre_minimos_opcoes(p_item_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.itens_pedido ip
    JOIN public.grupos_opcoes g ON g.produto_id = ip.produto_id
    WHERE ip.id = p_item_id
      AND COALESCE(g.min_escolhas, 0) > (
        SELECT count(*)
        FROM public.itens_pedido_opcoes ipo
        JOIN public.opcoes o ON o.id = ipo.opcao_id
        WHERE ipo.item_id = ip.id AND o.grupo_id = g.id
      )
  );
$function$;

REVOKE ALL ON FUNCTION public.fn_item_cumpre_minimos_opcoes(uuid) FROM PUBLIC, anon, authenticated;

-- Produto, nome e preco-base do item sao definidos pelo catalogo. A opcao fica
-- em itens_pedido_opcoes e nao e somada novamente no snapshot do item.
CREATE OR REPLACE FUNCTION public.fn_validar_item_pedido_catalogo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_pedido record;
  v_produto record;
BEGIN
  -- Tentativa de editar apenas snapshots nao recalcula pedido antigo pelo
  -- preco atual do catalogo: conserva exatamente o valor/nome da venda.
  IF TG_OP = 'UPDATE'
     AND NEW.produto_id IS NOT DISTINCT FROM OLD.produto_id
     AND NEW.pedido_id = OLD.pedido_id THEN
    NEW.nome_produto := OLD.nome_produto;
    NEW.preco_unitario := OLD.preco_unitario;
    RETURN NEW;
  END IF;

  IF NEW.produto_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.loja_id, p.status::text AS status INTO v_pedido
  FROM public.pedidos p
  WHERE p.id = NEW.pedido_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido nao encontrado.'; END IF;
  IF v_pedido.status IN ('PRONTO', 'FINALIZADO', 'CANCELADO') THEN
    RAISE EXCEPTION 'Pedido encerrado nao aceita novos itens; abra uma nova rodada na comanda.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.kds_tickets t
    WHERE t.pedido_id = NEW.pedido_id AND t.expedido_em IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Pedido ja expedido nao aceita novos itens; abra uma nova rodada na comanda.';
  END IF;

  SELECT pr.id, pr.nome, pr.preco, pr.disponivel
  INTO v_produto
  FROM public.produtos pr
  WHERE pr.id = NEW.produto_id AND pr.loja_id = v_pedido.loja_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto nao pertence a loja do pedido.';
  END IF;
  IF NOT COALESCE(v_produto.disponivel, false) THEN
    RAISE EXCEPTION 'Produto indisponivel.';
  END IF;

  NEW.nome_produto := v_produto.nome;
  NEW.preco_unitario := v_produto.preco;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validar_item_pedido_catalogo ON public.itens_pedido;
CREATE TRIGGER trg_validar_item_pedido_catalogo
  BEFORE INSERT OR UPDATE OF produto_id, pedido_id, nome_produto, preco_unitario
  ON public.itens_pedido
  FOR EACH ROW EXECUTE FUNCTION public.fn_validar_item_pedido_catalogo();

REVOKE ALL ON FUNCTION public.fn_validar_item_pedido_catalogo() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_validar_opcao_item_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_item_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.item_id ELSE NEW.item_id END;
  v_produto_id uuid;
  v_opcao record;
  v_quantidade integer;
BEGIN
  IF pg_trigger_depth() = 1 AND EXISTS (
    SELECT 1
    FROM public.kds_ticket_itens kti
    JOIN public.kds_tickets kt ON kt.id = kti.ticket_id
    WHERE kti.item_pedido_id = v_item_id AND kt.status = 'PRONTO'
  ) THEN
    RAISE EXCEPTION 'Nao e permitido alterar modificadores de item com producao concluida.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  IF NEW.opcao_id IS NULL THEN
    RAISE EXCEPTION 'Opcao do catalogo e obrigatoria.';
  END IF;

  SELECT ip.produto_id INTO v_produto_id
  FROM public.itens_pedido ip
  WHERE ip.id = NEW.item_id
  FOR UPDATE;

  SELECT o.id, o.nome, o.preco_adicional, o.disponivel, o.grupo_id,
         COALESCE(g.max_escolhas, 1) AS max_escolhas
  INTO v_opcao
  FROM public.opcoes o
  JOIN public.grupos_opcoes g ON g.id = o.grupo_id
  WHERE o.id = NEW.opcao_id AND g.produto_id = v_produto_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Opcao nao pertence ao produto do item.';
  END IF;
  IF NOT COALESCE(v_opcao.disponivel, false) THEN
    RAISE EXCEPTION 'Opcao indisponivel.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.itens_pedido_opcoes ipo
    WHERE ipo.item_id = NEW.item_id
      AND ipo.opcao_id = NEW.opcao_id
      AND (TG_OP <> 'UPDATE' OR ipo.id <> NEW.id)
  ) THEN
    RAISE EXCEPTION 'Opcao duplicada no mesmo item.';
  END IF;

  SELECT count(*) INTO v_quantidade
  FROM public.itens_pedido_opcoes ipo
  JOIN public.opcoes o ON o.id = ipo.opcao_id
  WHERE ipo.item_id = NEW.item_id
    AND o.grupo_id = v_opcao.grupo_id
    AND (TG_OP <> 'UPDATE' OR ipo.id <> NEW.id);

  IF v_quantidade >= v_opcao.max_escolhas THEN
    RAISE EXCEPTION 'Quantidade maxima de opcoes excedida para o grupo.';
  END IF;

  NEW.nome_opcao := v_opcao.nome;
  NEW.preco_adicional := v_opcao.preco_adicional;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validar_opcao_item_pedido ON public.itens_pedido_opcoes;
CREATE TRIGGER trg_validar_opcao_item_pedido
  BEFORE INSERT OR UPDATE OR DELETE ON public.itens_pedido_opcoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_validar_opcao_item_pedido();

REVOKE ALL ON FUNCTION public.fn_validar_opcao_item_pedido() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_despachar_kds_tickets(p_pedido_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_loja_id uuid;
  v_estacao_default uuid;
  v_workflow_default uuid;
  v_item record;
  v_ticket_id uuid;
  v_rodada integer;
BEGIN
  -- Serializa todos os despachos do pedido, inclusive triggers concorrentes.
  SELECT loja_id INTO v_loja_id
  FROM public.pedidos
  WHERE id = p_pedido_id
  FOR UPDATE;

  IF v_loja_id IS NULL THEN
    RAISE EXCEPTION 'Pedido % nao encontrado', p_pedido_id;
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT public.fn_tem_papel(v_loja_id, ARRAY['admin', 'operador', 'garcom']) THEN
    RAISE EXCEPTION 'Sem acesso operacional a este pedido.';
  END IF;

  SELECT e.id, w.id INTO v_estacao_default, v_workflow_default
  FROM public.kds_estacoes e
  JOIN public.kds_workflows w ON w.estacao_id = e.id AND w.loja_id = e.loja_id
  WHERE e.loja_id = v_loja_id AND e.ativo
  ORDER BY e.ordem, e.id
  LIMIT 1;

  IF v_estacao_default IS NULL THEN
    RETURN false;
  END IF;

  -- Opcoes gravadas depois do item atualizam somente tickets ainda ativos.
  UPDATE public.kds_tickets t
  SET itens = COALESCE((
    SELECT jsonb_agg(public.fn_snapshot_item_kds(kti.item_pedido_id)
                     ORDER BY kti.criado_em, kti.item_pedido_id)
    FROM public.kds_ticket_itens kti
    WHERE kti.ticket_id = t.id
  ), '[]'::jsonb)
  WHERE t.pedido_id = p_pedido_id
    AND t.status IN ('AGUARDANDO', 'PREPARANDO');

  FOR v_item IN
    SELECT ip.id,
           COALESCE(pr.estacao_kds_id, v_estacao_default) AS estacao_id,
           COALESCE(pr.workflow_kds_id, wk.id, v_workflow_default) AS workflow_id
    FROM public.itens_pedido ip
    LEFT JOIN public.produtos pr ON pr.id = ip.produto_id
    LEFT JOIN public.kds_workflows wk
      ON wk.estacao_id = pr.estacao_kds_id AND wk.loja_id = v_loja_id
    WHERE ip.pedido_id = p_pedido_id
      AND (COALESCE(pr.estacao_preparo, 'COZINHA') <> 'DIRETO'
           OR pr.estacao_kds_id IS NOT NULL)
      AND public.fn_item_cumpre_minimos_opcoes(ip.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.kds_ticket_itens kti WHERE kti.item_pedido_id = ip.id
      )
    ORDER BY ip.id
  LOOP
    -- Configuracao cruzada de outra loja cai na estacao padrao da loja dona.
    IF NOT EXISTS (
      SELECT 1
      FROM public.kds_estacoes e
      JOIN public.kds_workflows w ON w.id = v_item.workflow_id
       AND w.estacao_id = e.id AND w.loja_id = e.loja_id
      WHERE e.id = v_item.estacao_id AND e.loja_id = v_loja_id AND e.ativo
    ) THEN
      v_item.estacao_id := v_estacao_default;
      v_item.workflow_id := v_workflow_default;
    END IF;

    SELECT t.id INTO v_ticket_id
    FROM public.kds_tickets t
    WHERE t.pedido_id = p_pedido_id
      AND t.estacao_id = v_item.estacao_id
      AND t.status IN ('AGUARDANDO', 'PREPARANDO')
    ORDER BY t.rodada_numero DESC
    LIMIT 1
    FOR UPDATE;

    IF v_ticket_id IS NULL THEN
      SELECT COALESCE(max(t.rodada_numero), 0) + 1 INTO v_rodada
      FROM public.kds_tickets t
      WHERE t.pedido_id = p_pedido_id AND t.estacao_id = v_item.estacao_id;

      INSERT INTO public.kds_tickets (
        pedido_id, loja_id, estacao_id, workflow_id, workflow_snapshot,
        rodada_numero, itens
      ) VALUES (
        p_pedido_id, v_loja_id, v_item.estacao_id, v_item.workflow_id,
        (SELECT etapas FROM public.kds_workflows WHERE id = v_item.workflow_id),
        v_rodada, jsonb_build_array(public.fn_snapshot_item_kds(v_item.id))
      ) RETURNING id INTO v_ticket_id;
    ELSE
      UPDATE public.kds_tickets
      SET itens = itens || jsonb_build_array(public.fn_snapshot_item_kds(v_item.id))
      WHERE id = v_ticket_id;
    END IF;

    INSERT INTO public.kds_ticket_itens (ticket_id, item_pedido_id)
    VALUES (v_ticket_id, v_item.id)
    ON CONFLICT (item_pedido_id) DO NOTHING;
  END LOOP;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_despachar_kds_tickets(uuid) FROM PUBLIC, anon, authenticated;

-- O trigger diferido observa todas as opcoes gravadas na mesma transacao da RPC.
CREATE OR REPLACE FUNCTION public.fn_trg_despachar_kds_ao_inserir_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_status text;
BEGIN
  SELECT status::text INTO v_status FROM public.pedidos WHERE id = NEW.pedido_id;
  IF v_status IN ('ACEITO', 'PREPARANDO') THEN
    PERFORM public.fn_despachar_kds_tickets(NEW.pedido_id);
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_trg_despachar_kds_ao_inserir_item()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_despachar_kds_ao_inserir_item ON public.itens_pedido;
CREATE CONSTRAINT TRIGGER trg_despachar_kds_ao_inserir_item
  AFTER INSERT ON public.itens_pedido
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.fn_trg_despachar_kds_ao_inserir_item();

CREATE OR REPLACE FUNCTION public.fn_trg_sincronizar_opcao_kds()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_item_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.item_id ELSE NEW.item_id END;
  v_pedido_id uuid;
  v_status text;
BEGIN
  SELECT ip.pedido_id, p.status::text INTO v_pedido_id, v_status
  FROM public.itens_pedido ip
  JOIN public.pedidos p ON p.id = ip.pedido_id
  WHERE ip.id = v_item_id;

  IF v_status IN ('ACEITO', 'PREPARANDO', 'PRONTO') THEN
    PERFORM public.fn_despachar_kds_tickets(v_pedido_id);
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sincronizar_opcao_kds ON public.itens_pedido_opcoes;
CREATE TRIGGER trg_sincronizar_opcao_kds
  AFTER INSERT OR UPDATE OR DELETE ON public.itens_pedido_opcoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_trg_sincronizar_opcao_kds();

REVOKE ALL ON FUNCTION public.fn_trg_sincronizar_opcao_kds() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_validar_edicao_item_kds()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.kds_ticket_itens kti
    JOIN public.kds_tickets kt ON kt.id = kti.ticket_id
    WHERE kti.item_pedido_id = OLD.id AND kt.status = 'PRONTO'
  ) THEN
    RAISE EXCEPTION 'Nao e permitido alterar item com producao concluida.';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_trg_sincronizar_item_kds()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_status text;
BEGIN
  SELECT status::text INTO v_status
  FROM public.pedidos WHERE id = NEW.pedido_id;
  IF v_status IN ('ACEITO', 'PREPARANDO') THEN
    PERFORM public.fn_despachar_kds_tickets(NEW.pedido_id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validar_edicao_item_kds ON public.itens_pedido;
CREATE TRIGGER trg_validar_edicao_item_kds
  BEFORE UPDATE OF quantidade, observacao ON public.itens_pedido
  FOR EACH ROW EXECUTE FUNCTION public.fn_validar_edicao_item_kds();

DROP TRIGGER IF EXISTS trg_sincronizar_edicao_item_kds ON public.itens_pedido;
CREATE TRIGGER trg_sincronizar_edicao_item_kds
  AFTER UPDATE OF quantidade, observacao ON public.itens_pedido
  FOR EACH ROW EXECUTE FUNCTION public.fn_trg_sincronizar_item_kds();

REVOKE ALL ON FUNCTION public.fn_validar_edicao_item_kds() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_trg_sincronizar_item_kds() FROM PUBLIC, anon, authenticated;

-- A RPC do garcom e atomica e rejeita grupo obrigatorio incompleto. Para item
-- de catalogo, p_nome_produto e p_preco_unitario sao apenas compatibilidade:
-- os triggers substituem ambos pelos snapshots autoritativos do produto.
CREATE OR REPLACE FUNCTION public.fn_lancar_item_avulso_comanda(
  p_loja_id uuid,
  p_comanda_id uuid,
  p_produto_id uuid DEFAULT NULL,
  p_nome_produto text DEFAULT NULL,
  p_preco_unitario numeric DEFAULT 0,
  p_quantidade numeric DEFAULT 1,
  p_observacao text DEFAULT NULL,
  p_opcoes jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_comanda public.comandas%ROWTYPE;
  v_pedido public.pedidos%ROWTYPE;
  v_nome text := NULLIF(btrim(p_nome_produto), '');
  v_requer_cozinha boolean := false;
  v_item_id uuid;
  v_total numeric(10,2);
BEGIN
  IF NOT public.fn_tem_papel(p_loja_id, ARRAY['admin', 'operador', 'garcom']) THEN
    RAISE EXCEPTION 'Voce nao tem acesso operacional a esta loja.';
  END IF;
  IF p_quantidade <= 0 OR p_preco_unitario < 0 THEN
    RAISE EXCEPTION 'Quantidade e preco precisam ser validos.';
  END IF;
  IF p_opcoes IS NULL OR jsonb_typeof(p_opcoes) <> 'array' THEN
    RAISE EXCEPTION 'Opcoes precisam ser uma lista.';
  END IF;

  IF p_produto_id IS NOT NULL THEN
    SELECT p.nome,
           (COALESCE(p.estacao_preparo, 'COZINHA') <> 'DIRETO'
            OR p.estacao_kds_id IS NOT NULL)
    INTO v_nome, v_requer_cozinha
    FROM public.produtos p
    WHERE p.id = p_produto_id AND p.loja_id = p_loja_id AND p.disponivel;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto invalido ou indisponivel nesta loja.'; END IF;
  END IF;
  IF v_nome IS NULL THEN RAISE EXCEPTION 'Informe o produto ou o nome do item.'; END IF;
  IF p_produto_id IS NULL AND jsonb_array_length(p_opcoes) > 0 THEN
    RAISE EXCEPTION 'Item sem produto nao aceita opcao de catalogo.';
  END IF;

  SELECT * INTO v_comanda
  FROM public.comandas
  WHERE id = p_comanda_id AND loja_id = p_loja_id AND status = 'ABERTA'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda aberta nao encontrada.'; END IF;

  SELECT * INTO v_pedido
  FROM public.pedidos
  WHERE comanda_id = v_comanda.id AND status IN ('NOVO', 'ACEITO', 'PREPARANDO')
  ORDER BY criado_em DESC LIMIT 1 FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.pedidos (
      loja_id, comanda_id, tipo_pedido, status, identificador_cliente,
      subtotal, taxa_entrega, desconto, valor_total, origem,
      requer_cozinha, estacao_atual
    ) VALUES (
      p_loja_id, v_comanda.id, 'SALAO', 'ACEITO',
      CASE WHEN v_comanda.numero_cartao IS NOT NULL
        THEN 'Comanda ' || v_comanda.numero_cartao ELSE 'Cliente Buffet' END,
      0, 0, 0, 0, 'garcom_mobile', v_requer_cozinha,
      CASE WHEN v_requer_cozinha THEN 'COZINHA' ELSE 'BALCAO' END
    ) RETURNING * INTO v_pedido;
  END IF;

  IF v_requer_cozinha AND NOT v_pedido.requer_cozinha THEN
    UPDATE public.pedidos
    SET requer_cozinha = true, estacao_atual = 'COZINHA'
    WHERE id = v_pedido.id;
    IF v_pedido.status = 'ACEITO' THEN
      UPDATE public.pedidos SET status = 'PREPARANDO' WHERE id = v_pedido.id;
    END IF;
  END IF;

  INSERT INTO public.itens_pedido (
    pedido_id, produto_id, nome_produto, preco_unitario, quantidade, observacao
  ) VALUES (
    v_pedido.id, p_produto_id, v_nome, p_preco_unitario, p_quantidade,
    NULLIF(btrim(p_observacao), '')
  ) RETURNING id INTO v_item_id;

  INSERT INTO public.itens_pedido_opcoes (item_id, opcao_id, nome_opcao, preco_adicional)
  SELECT v_item_id, NULLIF(sel->>'id', '')::uuid, '', 0
  FROM jsonb_array_elements(p_opcoes) sel;

  IF NOT public.fn_item_cumpre_minimos_opcoes(v_item_id) THEN
    RAISE EXCEPTION 'Escolha as opcoes obrigatorias do produto.';
  END IF;

  v_total := public.fn_recalcular_pedido(v_pedido.id);

  RETURN jsonb_build_object(
    'comanda_id', v_comanda.id,
    'pedido_id', v_pedido.id,
    'item_id', v_item_id,
    'valor_total', v_total
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_lancar_item_avulso_comanda(uuid, uuid, uuid, text, numeric, numeric, text, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_lancar_item_avulso_comanda(uuid, uuid, uuid, text, numeric, numeric, text, jsonb)
  TO authenticated;

-- Corrige a semantica da etapa final: entrar nela nao conclui; avancar quando
-- ja se esta nela conclui. Funciona igualmente com workflows de 1, 2 ou N etapas.
CREATE OR REPLACE FUNCTION public.fn_avancar_kds_ticket(p_ticket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ticket record;
  v_total_etapas integer;
  v_novo_idx integer;
  v_novo_status text;
BEGIN
  SELECT t.*, jsonb_array_length(t.workflow_snapshot) AS total_etapas
  INTO v_ticket
  FROM public.kds_tickets t
  WHERE t.id = p_ticket_id
  FOR UPDATE OF t;

  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket KDS % nao encontrado', p_ticket_id; END IF;
  IF NOT public.fn_tem_papel(v_ticket.loja_id, ARRAY['admin', 'operador']) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  IF v_ticket.status = 'PRONTO' THEN
    RETURN jsonb_build_object('status', 'PRONTO', 'mensagem', 'Ticket ja esta concluido');
  END IF;

  v_total_etapas := v_ticket.total_etapas;
  IF v_total_etapas < 1 THEN RAISE EXCEPTION 'Workflow do ticket nao possui etapas.'; END IF;

  IF v_ticket.etapa_atual_idx >= v_total_etapas - 1 THEN
    v_novo_idx := v_ticket.etapa_atual_idx;
    v_novo_status := 'PRONTO';
  ELSE
    v_novo_idx := v_ticket.etapa_atual_idx + 1;
    v_novo_status := 'PREPARANDO';
  END IF;

  UPDATE public.kds_tickets
  SET etapa_atual_idx = v_novo_idx,
      status = v_novo_status,
      iniciado_em = COALESCE(iniciado_em, now()),
      concluido_em = CASE WHEN v_novo_status = 'PRONTO' THEN now() ELSE NULL END
  WHERE id = p_ticket_id;

  IF v_novo_status = 'PRONTO' THEN
    PERFORM public.fn_verificar_pedido_completo_kds(v_ticket.pedido_id);
  END IF;

  RETURN jsonb_build_object(
    'ticket_id', p_ticket_id,
    'etapa_anterior', v_ticket.etapa_atual_idx,
    'etapa_atual', v_novo_idx,
    'status', v_novo_status
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_avancar_kds_ticket(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_avancar_kds_ticket(uuid) TO authenticated;

COMMENT ON COLUMN public.kds_tickets.rodada_numero IS
  'Sequencia monotona do ticket dentro do mesmo pedido e estacao. Ticket PRONTO nunca e reaberto.';
COMMENT ON COLUMN public.kds_tickets.workflow_snapshot IS
  'Etapas congeladas na criacao do ticket; editar o workflow nao altera trabalho em curso.';
COMMENT ON TABLE public.kds_ticket_itens IS
  'Identidade relacional dos itens despachados. Impede perda e duplicacao mesmo com reexecucao concorrente.';
COMMENT ON FUNCTION public.fn_despachar_kds_tickets(uuid) IS
  'Reconcilia itens completos com tickets ativos por estacao. Cria nova rodada quando a anterior esta PRONTO.';

-- "Ponto da carne" descreve uma escolha do item. Impedir novas configuracoes
-- erradas e mais seguro do que reescrever silenciosamente workflows em uso.
CREATE OR REPLACE FUNCTION public.fn_nome_etapa_kds_reservado(p_nome text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'pg_catalog'
AS $function$
  SELECT regexp_replace(
    translate(lower(COALESCE(p_nome, '')),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'),
    '[^a-z0-9]+', ' ', 'g'
  ) ~ '^ *ponto +d[aeo] +carne *$';
$function$;

CREATE OR REPLACE FUNCTION public.fn_validar_workflow_sem_modificador()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_etapa jsonb;
BEGIN
  FOR v_etapa IN SELECT value FROM jsonb_array_elements(COALESCE(NEW.etapas, '[]'::jsonb))
  LOOP
    IF public.fn_nome_etapa_kds_reservado(v_etapa->>'nome') THEN
      RAISE EXCEPTION 'Ponto da carne e modificador/observacao do item, nao etapa do KDS.';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_workflow_sem_ponto_carne ON public.kds_workflows;
CREATE TRIGGER trg_workflow_sem_ponto_carne
  BEFORE INSERT OR UPDATE OF etapas ON public.kds_workflows
  FOR EACH ROW EXECUTE FUNCTION public.fn_validar_workflow_sem_modificador();

CREATE OR REPLACE FUNCTION public.fn_validar_kds_legado_sem_modificador()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_etapa jsonb;
BEGIN
  FOR v_etapa IN SELECT value FROM jsonb_array_elements(COALESCE(NEW.kds_etapas, '[]'::jsonb))
  LOOP
    IF public.fn_nome_etapa_kds_reservado(v_etapa->>'nome') THEN
      RAISE EXCEPTION 'Ponto da carne e modificador/observacao do item, nao etapa do KDS.';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_kds_legado_sem_ponto_carne ON public.lojas;
CREATE TRIGGER trg_kds_legado_sem_ponto_carne
  BEFORE INSERT OR UPDATE OF kds_etapas ON public.lojas
  FOR EACH ROW EXECUTE FUNCTION public.fn_validar_kds_legado_sem_modificador();

REVOKE ALL ON FUNCTION public.fn_nome_etapa_kds_reservado(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_validar_workflow_sem_modificador() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_validar_kds_legado_sem_modificador() FROM PUBLIC, anon, authenticated;

-- Expeditor compartilhado entre dispositivos. Isto confirma apenas a retirada
-- do KDS: nao finaliza pedido, pagamento, mesa ou comanda.
ALTER TABLE public.kds_tickets
  ADD COLUMN expedido_em timestamptz,
  ADD COLUMN expedido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX kds_tickets_expedicao_idx
  ON public.kds_tickets (loja_id, expedido_em)
  WHERE status = 'PRONTO';

CREATE OR REPLACE FUNCTION public.fn_expedir_kds_pedido(p_pedido_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_loja_id uuid;
  v_marcados integer;
  v_total integer;
  v_pendentes integer;
BEGIN
  SELECT loja_id INTO v_loja_id
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
  IF v_pendentes > 0 THEN
    RAISE EXCEPTION 'Pedido ainda possui tickets em producao.';
  END IF;

  UPDATE public.kds_tickets
  SET expedido_em = now(), expedido_por = auth.uid()
  WHERE pedido_id = p_pedido_id
    AND loja_id = v_loja_id
    AND status = 'PRONTO'
    AND expedido_em IS NULL;
  GET DIAGNOSTICS v_marcados = ROW_COUNT;

  RETURN jsonb_build_object('pedido_id', p_pedido_id, 'tickets_expedidos', v_marcados);
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_expedir_kds_pedido(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_expedir_kds_pedido(uuid) TO authenticated;

COMMENT ON FUNCTION public.fn_expedir_kds_pedido(uuid) IS
  'Marca tickets PRONTO como expedidos de forma idempotente. Nao altera pedido, pagamento ou comanda.';

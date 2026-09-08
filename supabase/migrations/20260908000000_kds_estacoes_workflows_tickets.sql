-- ============================================================================
-- SPRINT 5: KDS ENTERPRISE — ESTAÇÕES, WORKFLOWS E TICKETS DE PRODUÇÃO
--
-- Problema resolvido: o modelo anterior usava um único ponteiro de etapa por
-- pedido (pedidos.etapa_kds_atual). Quando uma mesa pede hambúrguer (Cozinha)
-- + caipirinha (Bar), os dois compartilhavam o mesmo ponteiro — avançar um
-- avançava o outro. Não é KDS profissional.
--
-- Modelo novo:
--   kds_estacoes — telas físicas da operação (Cozinha, Bar, Chapa...)
--   kds_workflows — trilho de etapas de cada estação
--   kds_tickets   — 1 ticket por pedido por estação; ponteiros independentes
--
-- Compatibilidade retroativa: o modelo legado (pedidos.etapa_kds_atual) continua
-- funcionando para lojas sem estações configuradas. Nenhum dado existente é
-- modificado ou deletado.
-- ============================================================================

-- ── 1. ESTAÇÕES FÍSICAS ─────────────────────────────────────────────────────
CREATE TABLE public.kds_estacoes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id    UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  cor        TEXT NOT NULL DEFAULT '#FC5B24',
  ativo      BOOLEAN NOT NULL DEFAULT true,
  ordem      INT NOT NULL DEFAULT 0,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT kds_estacoes_nome_check CHECK (char_length(nome) BETWEEN 1 AND 60)
);

CREATE INDEX kds_estacoes_loja_idx ON public.kds_estacoes(loja_id);

-- Nome único por loja — é o alvo do ON CONFLICT do bootstrap logo abaixo.
CREATE UNIQUE INDEX kds_estacoes_loja_nome_uk ON public.kds_estacoes(loja_id, nome);

-- ── 2. WORKFLOWS POR ESTAÇÃO ────────────────────────────────────────────────
-- etapas é JSONB: [{id: uuid, nome: text, ordem: int}]
-- Cada estação tem exatamente um workflow ativo. Futuro: múltiplos por turno.
CREATE TABLE public.kds_workflows (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id    UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  estacao_id UUID NOT NULL REFERENCES public.kds_estacoes(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  etapas     JSONB NOT NULL DEFAULT '[]'::jsonb,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT kds_workflows_nome_check CHECK (char_length(nome) BETWEEN 1 AND 80)
);

CREATE INDEX kds_workflows_estacao_idx ON public.kds_workflows(estacao_id);
CREATE INDEX kds_workflows_loja_idx    ON public.kds_workflows(loja_id);

-- Um workflow por estação — alvo do ON CONFLICT do bootstrap logo abaixo.
CREATE UNIQUE INDEX kds_workflows_estacao_uk ON public.kds_workflows(estacao_id);

-- ── 3. TICKETS DE PRODUÇÃO ──────────────────────────────────────────────────
-- Um ticket = um pedido num contexto de uma única estação.
-- itens: snapshot de [{produto_id, nome, quantidade, observacao, opcoes[]}]
CREATE TABLE public.kds_tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  loja_id         UUID NOT NULL,
  estacao_id      UUID NOT NULL REFERENCES public.kds_estacoes(id),
  workflow_id     UUID NOT NULL REFERENCES public.kds_workflows(id),
  itens           JSONB NOT NULL DEFAULT '[]'::jsonb,
  etapa_atual_idx INT NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'AGUARDANDO'
                  CHECK (status IN ('AGUARDANDO', 'PREPARANDO', 'PRONTO')),
  iniciado_em     TIMESTAMPTZ,
  concluido_em    TIMESTAMPTZ,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX kds_tickets_estacao_status_idx ON public.kds_tickets(loja_id, estacao_id, status);
CREATE INDEX kds_tickets_pedido_idx         ON public.kds_tickets(pedido_id);

-- Um ticket por pedido por estação — é o que torna fn_despachar_kds_tickets
-- idempotente via ON CONFLICT (sem isto, "ON CONFLICT DO NOTHING" não tem
-- alvo e a chamada duplicada cria tickets fantasmas).
CREATE UNIQUE INDEX kds_tickets_pedido_estacao_uk ON public.kds_tickets(pedido_id, estacao_id);

-- ── 4. ROTEAMENTO: PRODUTO → ESTAÇÃO + WORKFLOW ─────────────────────────────
-- Se NULL, fn_despachar_kds_tickets usa a estação padrão (Cozinha) da loja.
ALTER TABLE public.produtos
  ADD COLUMN estacao_kds_id UUID REFERENCES public.kds_estacoes(id) ON DELETE SET NULL,
  ADD COLUMN workflow_kds_id UUID REFERENCES public.kds_workflows(id) ON DELETE SET NULL;

-- ── 5. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.kds_estacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kds_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kds_tickets   ENABLE ROW LEVEL SECURITY;

-- Membros operacionais da loja podem ler e escrever suas estações/workflows/tickets.
-- fn_tem_papel espera um text[] de papéis (mesma convenção de
-- transformacoes_estoque_e_inventario e modulo_compras_fornecedores_e_pedidos) —
-- a versão anterior passava um TEXT solto e a migração nem chegava a aplicar.
CREATE POLICY kds_estacoes_loja ON public.kds_estacoes
  USING (public.fn_tem_papel(loja_id, ARRAY['admin','operador']))
  WITH CHECK (public.fn_tem_papel(loja_id, ARRAY['admin','operador']));

CREATE POLICY kds_workflows_loja ON public.kds_workflows
  USING (public.fn_tem_papel(loja_id, ARRAY['admin','operador']))
  WITH CHECK (public.fn_tem_papel(loja_id, ARRAY['admin','operador']));

CREATE POLICY kds_tickets_loja ON public.kds_tickets
  USING (public.fn_tem_papel(loja_id, ARRAY['admin','operador']))
  WITH CHECK (public.fn_tem_papel(loja_id, ARRAY['admin','operador']));

-- ── 6. BOOTSTRAP: CRIA ESTAÇÕES E WORKFLOWS PADRÃO PARA LOJAS EXISTENTES ───
-- Cada loja existente recebe: Cozinha (Fila → Preparo → Expedição) e
-- Bar (Preparar Drink → Servir). Lojas novas seguem o mesmo padrão pelo
-- trigger de onboarding (Sprint 4).
DO $$
DECLARE
  r        RECORD;
  est_coz  UUID;
  est_bar  UUID;
  wf_coz   UUID;
  wf_bar   UUID;
BEGIN
  FOR r IN SELECT id FROM public.lojas LOOP

    -- Cria estação Cozinha (se ainda não existe)
    INSERT INTO public.kds_estacoes(loja_id, nome, cor, ordem)
    VALUES (r.id, 'Cozinha', '#FC5B24', 0)
    ON CONFLICT (loja_id, nome) DO NOTHING
    RETURNING id INTO est_coz;

    -- Cria estação Bar (se ainda não existe)
    INSERT INTO public.kds_estacoes(loja_id, nome, cor, ordem)
    VALUES (r.id, 'Bar', '#8B5CF6', 1)
    ON CONFLICT (loja_id, nome) DO NOTHING
    RETURNING id INTO est_bar;

    -- Re-busca se já existia (ON CONFLICT não popula RETURNING)
    IF est_coz IS NULL THEN
      SELECT id INTO est_coz FROM public.kds_estacoes
      WHERE loja_id = r.id AND nome = 'Cozinha' LIMIT 1;
    END IF;
    IF est_bar IS NULL THEN
      SELECT id INTO est_bar FROM public.kds_estacoes
      WHERE loja_id = r.id AND nome = 'Bar' LIMIT 1;
    END IF;

    -- Workflow Cozinha
    INSERT INTO public.kds_workflows(loja_id, estacao_id, nome, etapas)
    VALUES (
      r.id, est_coz, 'Fluxo Cozinha',
      '[
        {"id": "fila",      "nome": "Fila de Entrada", "ordem": 0},
        {"id": "preparo",   "nome": "Em Preparo",       "ordem": 1},
        {"id": "expedicao", "nome": "Expedição",        "ordem": 2}
      ]'::jsonb
    )
    ON CONFLICT (estacao_id) DO NOTHING
    RETURNING id INTO wf_coz;

    -- Workflow Bar
    INSERT INTO public.kds_workflows(loja_id, estacao_id, nome, etapas)
    VALUES (
      r.id, est_bar, 'Fluxo Bar',
      '[
        {"id": "preparar", "nome": "Preparar Drink", "ordem": 0},
        {"id": "servir",   "nome": "Servir",         "ordem": 1}
      ]'::jsonb
    )
    ON CONFLICT (estacao_id) DO NOTHING
    RETURNING id INTO wf_bar;

  END LOOP;
END;
$$;

-- ── 7. COMENTÁRIOS ──────────────────────────────────────────────────────────
COMMENT ON TABLE public.kds_estacoes IS
  'Estações físicas do KDS (ex: Cozinha, Bar, Chapa). Cada estação tem sua '
  'própria tela de tablet e seu próprio workflow de etapas.';

COMMENT ON TABLE public.kds_workflows IS
  'Workflow (trilho de etapas) de uma estação do KDS. etapas é JSONB: '
  '[{id, nome, ordem}]. O ponteiro etapa_atual_idx no ticket navega por este array.';

COMMENT ON TABLE public.kds_tickets IS
  'Um ticket de produção = um pedido fragmentado para uma estação. Múltiplos '
  'tickets podem existir para o mesmo pedido (um por estação). Cada ticket '
  'percorre seu próprio workflow de forma independente. O expeditor monitora '
  'todos os tickets de um pedido para sinalizar quando a mesa está completa.';

COMMENT ON COLUMN public.produtos.estacao_kds_id IS
  'Estação de produção deste produto. NULL = roteado para a estação Cozinha '
  'padrão da loja (fn_despachar_kds_tickets faz o fallback).';

COMMENT ON COLUMN public.produtos.workflow_kds_id IS
  'Workflow desta estação a ser seguido. NULL = usa o workflow padrão '
  'da estação (o primeiro ativo encontrado para a estacao_kds_id).';

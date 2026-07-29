-- ============================================================================
-- Módulo de Compras — parte 2: fornecedores e o documento de compra
-- ============================================================================
-- O PRINCÍPIO: pedido é intenção, recebimento é fato, e a diferença entre os
-- dois é informação — não erro a esconder.
--
-- Quem pediu 10 kg e recebeu 6, de outra marca, 15% mais caro, está sendo
-- informado sobre o seu fornecedor. Por isso a intenção e o fato moram na
-- MESMA linha de compras_itens: comparar os dois é uma leitura, não um join.
--
-- Os fatores de conversão são gravados como SNAPSHOT no item. O cadastro do
-- insumo pode mudar amanhã; o documento comercial registra o que valia no dia
-- da compra — do contrário o histórico de preço se reescreve sozinho.
-- ============================================================================

CREATE TYPE public.compra_status AS ENUM (
  'RASCUNHO',          -- montando a lista
  'ENVIADO',           -- pedido feito ao fornecedor
  'RECEBIDO_PARCIAL',  -- veio parte
  'RECEBIDO',          -- conferido e fechado
  'CANCELADO'
);

CREATE TYPE public.compra_item_status AS ENUM (
  'PENDENTE',
  'RECEBIDO',      -- veio o que foi pedido (ou mais)
  'PARCIAL',       -- veio menos do que foi pedido
  'NAO_VEIO',      -- fornecedor não entregou
  'SUBSTITUIDO'    -- veio outro item no lugar
);

-- ─── Fornecedores ───────────────────────────────────────────────────────────
CREATE TABLE public.fornecedores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id             UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  nome                TEXT NOT NULL,
  razao_social        TEXT,
  cnpj                TEXT,
  telefone            TEXT,
  email               TEXT,
  contato_nome        TEXT,
  -- Operacional: alimenta a sugestão de quando pedir e de quanto pedir.
  prazo_entrega_dias  INTEGER CHECK (prazo_entrega_dias IS NULL OR prazo_entrega_dias >= 0),
  pedido_minimo       NUMERIC(12,2) CHECK (pedido_minimo IS NULL OR pedido_minimo >= 0),
  condicao_pagamento  TEXT,
  -- Dias da semana em que o fornecedor entrega (0=domingo … 6=sábado).
  dias_entrega        SMALLINT[],
  observacao          TEXT,
  ativo               BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mesmo fornecedor cadastrado duas vezes fragmenta o histórico de preço, que é
-- justamente o ativo que esta tabela existe para construir.
CREATE UNIQUE INDEX uq_fornecedores_loja_nome
  ON public.fornecedores (loja_id, lower(btrim(nome))) WHERE ativo;
CREATE INDEX ix_fornecedores_loja ON public.fornecedores (loja_id) WHERE ativo;

-- ─── Compra (o documento: nasce pedido, morre nota conferida) ───────────────
CREATE TABLE public.compras (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id        UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  fornecedor_id  UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  status         public.compra_status NOT NULL DEFAULT 'RASCUNHO',
  numero_nota    TEXT,
  data_pedido    DATE NOT NULL DEFAULT CURRENT_DATE,
  data_prevista  DATE,
  recebido_em    TIMESTAMPTZ,
  frete          NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (frete >= 0),
  desconto       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (desconto >= 0),
  observacao     TEXT,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por     UUID DEFAULT auth.uid()
);

CREATE INDEX ix_compras_loja_status ON public.compras (loja_id, status, data_pedido DESC);
CREATE INDEX ix_compras_fornecedor  ON public.compras (fornecedor_id, data_pedido DESC);

-- ─── Itens: intenção e fato lado a lado ─────────────────────────────────────
CREATE TABLE public.compras_itens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id   UUID NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
  loja_id     UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  insumo_id   UUID NOT NULL REFERENCES public.insumos(id) ON DELETE RESTRICT,

  -- ── intenção ──
  qtd_pedida              NUMERIC(14,4) NOT NULL CHECK (qtd_pedida > 0),
  unidade_pedida          TEXT NOT NULL REFERENCES public.unidades_medida(codigo),
  -- Snapshot: quantas unidades-base do insumo valiam 1 unidade_pedida no dia.
  fator_pedida            NUMERIC(14,6) NOT NULL DEFAULT 1 CHECK (fator_pedida > 0),
  preco_unitario_previsto NUMERIC(12,4) CHECK (preco_unitario_previsto IS NULL OR preco_unitario_previsto >= 0),

  -- ── fato ──
  status              public.compra_item_status NOT NULL DEFAULT 'PENDENTE',
  -- Substituição: o fornecedor mandou outro item no lugar do pedido.
  insumo_recebido_id  UUID REFERENCES public.insumos(id) ON DELETE RESTRICT,
  qtd_recebida        NUMERIC(14,4) CHECK (qtd_recebida IS NULL OR qtd_recebida >= 0),
  unidade_recebida    TEXT REFERENCES public.unidades_medida(codigo),
  fator_recebida      NUMERIC(14,6) CHECK (fator_recebida IS NULL OR fator_recebida > 0),
  preco_total_pago    NUMERIC(12,2) CHECK (preco_total_pago IS NULL OR preco_total_pago >= 0),
  marca               TEXT,
  lote_fornecedor     TEXT,
  vence_em            DATE,
  recebido_em         TIMESTAMPTZ,
  -- Rastro no razão: da nota até a movimentação que mexeu no saldo.
  movimentacao_id     UUID REFERENCES public.movimentacoes_estoque(id) ON DELETE SET NULL,
  observacao          TEXT,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Recebido é recebido: quantidade sem unidade não vira saldo.
  CONSTRAINT compras_itens_recebimento_completo CHECK (
    qtd_recebida IS NULL OR qtd_recebida = 0
    OR (unidade_recebida IS NOT NULL AND fator_recebida IS NOT NULL)
  )
);

CREATE INDEX ix_compras_itens_compra ON public.compras_itens (compra_id);
CREATE INDEX ix_compras_itens_insumo ON public.compras_itens (insumo_id, recebido_em DESC);

-- ─── RLS: mesmo padrão do resto do estoque ──────────────────────────────────
ALTER TABLE public.fornecedores  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY compras_fornecedores ON public.fornecedores FOR ALL
  USING (public.fn_tem_papel(loja_id, ARRAY['admin','operador']))
  WITH CHECK (public.fn_tem_papel(loja_id, ARRAY['admin','operador']));

CREATE POLICY compras_docs ON public.compras FOR ALL
  USING (public.fn_tem_papel(loja_id, ARRAY['admin','operador']))
  WITH CHECK (public.fn_tem_papel(loja_id, ARRAY['admin','operador']));

CREATE POLICY compras_itens_docs ON public.compras_itens FOR ALL
  USING (public.fn_tem_papel(loja_id, ARRAY['admin','operador']))
  WITH CHECK (public.fn_tem_papel(loja_id, ARRAY['admin','operador']));

-- ─── Resumo do documento ────────────────────────────────────────────────────
-- security_invoker: a view herda a RLS de quem consulta, em vez de vazar as
-- compras de todas as lojas com o privilégio do dono.
CREATE VIEW public.vw_compras_resumo
WITH (security_invoker = true) AS
SELECT
  c.id, c.loja_id, c.status, c.numero_nota, c.data_pedido, c.data_prevista,
  c.recebido_em, c.frete, c.desconto, c.observacao, c.criado_em,
  c.fornecedor_id,
  f.nome AS fornecedor_nome,
  COUNT(i.id)                                            AS itens_total,
  COUNT(i.id) FILTER (WHERE i.status <> 'PENDENTE')      AS itens_conferidos,
  COALESCE(SUM(i.qtd_pedida * COALESCE(i.preco_unitario_previsto, 0)), 0)
    + c.frete - c.desconto                               AS total_previsto,
  COALESCE(SUM(i.preco_total_pago), 0) + c.frete - c.desconto AS total_pago
FROM public.compras c
LEFT JOIN public.fornecedores  f ON f.id = c.fornecedor_id
LEFT JOIN public.compras_itens i ON i.compra_id = c.id
GROUP BY c.id, f.nome;

-- ─── Histórico de preço: o ativo que o módulo constrói ──────────────────────
-- Cada recebimento vira um ponto comparável: custo por unidade-BASE do insumo.
-- Sem normalizar pela base, comparar "R$ 30 a caixa" com "R$ 4 o quilo" é
-- comparar nada.
CREATE VIEW public.vw_historico_precos_compra
WITH (security_invoker = true) AS
SELECT
  ci.loja_id,
  COALESCE(ci.insumo_recebido_id, ci.insumo_id) AS insumo_id,
  ins.nome          AS insumo_nome,
  ins.unidade_medida AS unidade_base,
  c.fornecedor_id,
  f.nome            AS fornecedor_nome,
  ci.marca,
  ci.recebido_em,
  c.numero_nota,
  ci.qtd_recebida,
  ci.unidade_recebida,
  ci.preco_total_pago,
  (ci.qtd_recebida * ci.fator_recebida)                       AS qtd_base,
  ci.preco_total_pago / NULLIF(ci.qtd_recebida * ci.fator_recebida, 0) AS custo_unitario_base
FROM public.compras_itens ci
JOIN public.compras c        ON c.id = ci.compra_id
LEFT JOIN public.fornecedores f ON f.id = c.fornecedor_id
JOIN public.insumos ins      ON ins.id = COALESCE(ci.insumo_recebido_id, ci.insumo_id)
WHERE ci.recebido_em IS NOT NULL
  AND COALESCE(ci.qtd_recebida, 0) > 0
  AND COALESCE(ci.preco_total_pago, 0) > 0;

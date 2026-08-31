-- ═══════════════════════════════════════════════════════════════════════════
-- As datas de uma entrada de estoque em food service são TRÊS, e cada uma
-- responde a uma pergunta diferente. Confundi-las custa caro:
--
--   ocorrido_em   QUANDO A COMPRA ACONTECEU. Manda no PEPS e no custo: é a
--                 ordem em que a mercadoria chegou à prateleira. Vem da data
--                 de emissão da nota.
--   criado_em     QUANDO O LANÇAMENTO FOI FEITO. É auditoria — quem digitou o
--                 quê e quando. NUNCA deve ser reescrito: sem ele não há como
--                 saber que uma nota de julho foi lançada em agosto, nem
--                 auditar quem mexeu no estoque.
--   vence_em      ATÉ QUANDO O ALIMENTO PODE SER USADO. Obrigação sanitária
--                 (RDC 216), e a base do alerta de perda.
--
-- A migração anterior escrevia a data de emissão dentro de `criado_em`. O PEPS
-- passou a ficar certo, mas a auditoria virou ficção: uma nota lançada hoje
-- aparecia como se tivesse sido digitada em julho. Aqui as duas passam a
-- existir lado a lado.
--
-- `fabricado_em` entra junto porque quem controla validade precisa dela para
-- dois casos concretos: recall de fornecedor (rastrear por lote e fabricação)
-- e produto sem validade impressa, em que a vida útil se conta da fabricação.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.movimentacoes_estoque
  ADD COLUMN IF NOT EXISTS ocorrido_em TIMESTAMPTZ;

ALTER TABLE public.lotes_estoque
  ADD COLUMN IF NOT EXISTS ocorrido_em  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fabricado_em DATE;

COMMENT ON COLUMN public.movimentacoes_estoque.ocorrido_em IS
  'Quando o fato aconteceu (emissão da nota). Ordena o PEPS. NULL = mesmo que criado_em.';
COMMENT ON COLUMN public.movimentacoes_estoque.criado_em IS
  'Quando o lançamento foi registrado no sistema. Auditoria — nunca reescrever.';
COMMENT ON COLUMN public.lotes_estoque.ocorrido_em IS
  'Data de compra do lote; é por ela que o PEPS consome, não pela de digitação.';
COMMENT ON COLUMN public.lotes_estoque.fabricado_em IS
  'Data de fabricação impressa na embalagem. Sustenta recall e validade calculada.';

-- Histórico existente: o que já está lá aconteceu quando foi lançado.
UPDATE public.movimentacoes_estoque SET ocorrido_em = criado_em WHERE ocorrido_em IS NULL;
UPDATE public.lotes_estoque         SET ocorrido_em = criado_em WHERE ocorrido_em IS NULL;

-- O PEPS lê a fila por data de compra. Sem índice, cada baixa varre a tabela.
CREATE INDEX IF NOT EXISTS idx_lotes_peps_ordem
  ON public.lotes_estoque (insumo_id, ocorrido_em)
  WHERE quantidade_restante > 0;

-- ─── O lote herda as duas datas, cada uma no seu lugar ────────────────────
CREATE OR REPLACE FUNCTION public.fn_mov_criar_lote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_unit NUMERIC;
BEGIN
  IF NEW.tipo <> 'ENTRADA' OR NEW.quantidade <= 0 THEN RETURN NEW; END IF;

  IF NEW.custo_total IS NOT NULL AND NEW.custo_total > 0 THEN
    v_unit := NEW.custo_total / NEW.quantidade;
  ELSE
    SELECT COALESCE(preco_embalagem / NULLIF(qtd_embalagem,0), 0) INTO v_unit
    FROM insumos WHERE id = NEW.insumo_id;
  END IF;

  INSERT INTO lotes_estoque (loja_id, insumo_id, quantidade_inicial,
                             quantidade_restante, custo_unitario, origem_mov_id,
                             lote_fornecedor, vence_em, ocorrido_em)
  VALUES (NEW.loja_id, NEW.insumo_id, NEW.quantidade, NEW.quantidade,
          COALESCE(v_unit,0), NEW.id,
          NEW.lote_fornecedor, NEW.vence_em,
          -- `criado_em` do lote fica com o default (agora): é o registro.
          -- A fila do PEPS anda por `ocorrido_em`, que é a compra.
          COALESCE(NEW.ocorrido_em, NEW.criado_em, now()));
  RETURN NEW;
END; $$;

-- ─── A view de custo passa a olhar a data da compra ───────────────────────
CREATE OR REPLACE VIEW public.vw_ultimo_custo_insumo
WITH (security_invoker = true) AS
SELECT DISTINCT ON (l.insumo_id)
  l.loja_id,
  l.insumo_id,
  l.custo_unitario,
  COALESCE(l.ocorrido_em, l.criado_em) AS comprado_em
FROM public.lotes_estoque l
WHERE l.custo_unitario > 0
ORDER BY l.insumo_id, COALESCE(l.ocorrido_em, l.criado_em) DESC;

GRANT SELECT ON public.vw_ultimo_custo_insumo TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- O PEPS ordenava por `criado_em` — a data em que o lote foi DIGITADO.
--
-- Enquanto tudo era lançado no mesmo dia da compra, dava no mesmo. Deixa de
-- dar no instante em que o lojista lança uma nota guardada: o arroz comprado
-- em julho, digitado hoje, ia para o fim da fila e o sistema consumia primeiro
-- o arroz comprado ontem. O custo saía da camada errada e o estoque envelhecia
-- mercadoria que já devia ter saído.
--
-- Ordenar por `ocorrido_em` põe a fila na ordem em que a mercadoria realmente
-- chegou. E, entre lotes do mesmo dia, sai primeiro o que vence antes — que é
-- o que qualquer cozinha faz na prática, e o que a boa prática sanitária manda
-- (PVPS: primeiro que vence, primeiro que sai).
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_consumir_lotes_peps(p_insumo_id uuid, p_qtd numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_restante NUMERIC := p_qtd;
  v_custo    NUMERIC := 0;
  v_tirar    NUMERIC;
  v_ultimo   NUMERIC := 0;
  r RECORD;
BEGIN
  IF p_qtd IS NULL OR p_qtd <= 0 THEN RETURN 0; END IF;

  FOR r IN
    SELECT id, quantidade_restante, custo_unitario
    FROM lotes_estoque
    WHERE insumo_id = p_insumo_id AND quantidade_restante > 0
    ORDER BY COALESCE(ocorrido_em, criado_em),
             -- Mesmo dia de compra: sai antes o que vence antes. Lote sem
             -- validade não pode furar a fila de um que está para vencer.
             vence_em NULLS LAST,
             id
    FOR UPDATE
  LOOP
    EXIT WHEN v_restante <= 0.00005;
    v_tirar  := LEAST(r.quantidade_restante, v_restante);
    v_custo  := v_custo + v_tirar * r.custo_unitario;
    v_ultimo := r.custo_unitario;

    UPDATE lotes_estoque SET quantidade_restante = quantidade_restante - v_tirar
    WHERE id = r.id;

    v_restante := v_restante - v_tirar;
  END LOOP;

  IF v_restante > 0.00005 THEN
    IF v_ultimo = 0 THEN
      SELECT COALESCE(preco_embalagem / NULLIF(qtd_embalagem,0), 0) INTO v_ultimo
      FROM insumos WHERE id = p_insumo_id;
    END IF;
    v_custo := v_custo + v_restante * COALESCE(v_ultimo,0);
    RAISE WARNING 'PEPS: insumo % sem lote para % unidades; custo estimado por % /un.',
      p_insumo_id, v_restante, v_ultimo;
  END IF;

  RETURN ROUND(v_custo, 4);
END; $$;

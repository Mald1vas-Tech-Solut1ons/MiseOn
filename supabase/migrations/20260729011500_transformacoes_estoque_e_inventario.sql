-- ============================================================================
-- Estoque — parte 4: monta, desmonta e inventário
-- ============================================================================
-- DESMONTE é a operação que faltava para o food service ser levado a sério:
-- compra-se o frango inteiro e usa-se peito, coxa e carcaça — três insumos com
-- preços, fichas e giros diferentes. Sem desmonte, ou o lojista cadastra três
-- itens e lança tudo à mão (e o custo vira chute), ou finge que o frango é um
-- insumo só (e a ficha técnica mente).
--
-- A regra inegociável: VALOR SE CONSERVA. O custo que sai do insumo de origem,
-- apurado pelo PEPS dos lotes reais, é exatamente o custo que se distribui
-- entre os destinos. Não some, não aparece. O resíduo de arredondamento vai no
-- último item para que a soma feche no centavo.
--
-- MONTAGEM é o caminho inverso (vários insumos viram um kit/cesta), e usa a
-- mesma mecânica com os papéis trocados.
--
-- INVENTÁRIO é a contagem física ganhando da planilha — e ela pode ser feita em
-- QUALQUER unidade: achou três cabeças de alho perdidas na câmara, conta em
-- cabeça e o sistema converte para a unidade de uso.
-- ============================================================================

CREATE TYPE public.transformacao_tipo AS ENUM ('DESMONTE', 'MONTAGEM');
CREATE TYPE public.transformacao_papel AS ENUM ('ORIGEM', 'DESTINO');

CREATE TABLE public.transformacoes_estoque (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id     UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  tipo        public.transformacao_tipo NOT NULL,
  custo_total NUMERIC(14,4) NOT NULL DEFAULT 0,
  observacao  TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por  UUID DEFAULT auth.uid()
);

-- Origem e destino na mesma tabela: um DESMONTE é 1 origem e N destinos, uma
-- MONTAGEM é N origens e 1 destino. O papel distingue; a mecânica é a mesma.
CREATE TABLE public.transformacoes_itens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transformacao_id  UUID NOT NULL REFERENCES public.transformacoes_estoque(id) ON DELETE CASCADE,
  loja_id           UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  papel             public.transformacao_papel NOT NULL,
  insumo_id         UUID NOT NULL REFERENCES public.insumos(id) ON DELETE RESTRICT,
  quantidade        NUMERIC(14,4) NOT NULL CHECK (quantidade > 0),
  unidade           TEXT NOT NULL REFERENCES public.unidades_medida(codigo),
  fator             NUMERIC(14,6) NOT NULL DEFAULT 1 CHECK (fator > 0),
  quantidade_base   NUMERIC(14,4) NOT NULL CHECK (quantidade_base > 0),
  custo             NUMERIC(14,4) NOT NULL DEFAULT 0,
  movimentacao_id   UUID REFERENCES public.movimentacoes_estoque(id) ON DELETE SET NULL,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_transf_loja  ON public.transformacoes_estoque (loja_id, criado_em DESC);
CREATE INDEX ix_transf_itens ON public.transformacoes_itens (transformacao_id);
CREATE INDEX ix_transf_insumo ON public.transformacoes_itens (insumo_id, criado_em DESC);

ALTER TABLE public.transformacoes_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transformacoes_itens   ENABLE ROW LEVEL SECURITY;

CREATE POLICY transf_estoque ON public.transformacoes_estoque FOR ALL
  USING (public.fn_tem_papel(loja_id, ARRAY['admin','operador']))
  WITH CHECK (public.fn_tem_papel(loja_id, ARRAY['admin','operador']));
CREATE POLICY transf_itens ON public.transformacoes_itens FOR ALL
  USING (public.fn_tem_papel(loja_id, ARRAY['admin','operador']))
  WITH CHECK (public.fn_tem_papel(loja_id, ARRAY['admin','operador']));

-- ─── RPC: transformar (desmontar / montar) ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_transformar_estoque(
  p_loja_id    UUID,
  p_tipo       TEXT,
  p_origens    JSONB,
  p_destinos   JSONB,
  p_observacao TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_transf     UUID;
  v_item       JSONB;
  v_insumo     UUID;
  v_qtd        NUMERIC;
  v_unidade    TEXT;
  v_fator      NUMERIC;
  v_base       NUMERIC;
  v_saldo      NUMERIC;
  v_nome       TEXT;
  v_mov        UUID;
  v_custo_mov  NUMERIC;
  v_custo_tot  NUMERIC := 0;
  v_peso_tot   NUMERIC := 0;
  v_peso       NUMERIC;
  v_atribuido  NUMERIC := 0;
  v_custo_item NUMERIC;
  v_idx        INTEGER := 0;
  v_qtd_dest   INTEGER;
BEGIN
  IF NOT public.fn_tem_papel(p_loja_id, ARRAY['admin','operador']) THEN
    RAISE EXCEPTION 'Sem permissão para movimentar o estoque desta loja.';
  END IF;

  IF jsonb_array_length(COALESCE(p_origens, '[]'::jsonb)) = 0
     OR jsonb_array_length(COALESCE(p_destinos, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Transformação precisa de pelo menos uma origem e um destino.';
  END IF;

  INSERT INTO public.transformacoes_estoque (loja_id, tipo, observacao)
  VALUES (p_loja_id, p_tipo::public.transformacao_tipo, NULLIF(p_observacao, ''))
  RETURNING id INTO v_transf;

  -- ── 1. Consome as origens pelo PEPS e apura o custo real ──
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_origens)
  LOOP
    v_insumo  := (v_item->>'insumo_id')::UUID;
    v_qtd     := (v_item->>'qtd')::NUMERIC;
    v_fator   := COALESCE((v_item->>'fator')::NUMERIC, 1);
    v_base    := v_qtd * v_fator;

    SELECT quantidade_atual, unidade_medida, nome INTO v_saldo, v_unidade, v_nome
    FROM public.insumos WHERE id = v_insumo AND loja_id = p_loja_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insumo de origem % não pertence a esta loja.', v_insumo;
    END IF;
    IF v_base <= 0 THEN
      RAISE EXCEPTION 'Quantidade de origem inválida para %.', v_nome;
    END IF;
    -- Desmontar mais do que existe é como criar massa do nada: o custo do
    -- excedente não teria lote de onde sair e o PEPS ficaria devendo.
    IF v_base > COALESCE(v_saldo, 0) + 1e-6 THEN
      RAISE EXCEPTION 'Estoque insuficiente de %: tem % %, tentou usar %.',
        v_nome, COALESCE(v_saldo,0), v_unidade, v_base;
    END IF;

    -- tipo SAIDA com quantidade positiva: trg_mov_custear_baixa consome os
    -- lotes PEPS e devolve o custo real em custo_total.
    INSERT INTO public.movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, motivo)
    VALUES (p_loja_id, v_insumo, 'SAIDA', v_base,
            CASE WHEN p_tipo = 'DESMONTE' THEN 'Desmonte' ELSE 'Montagem' END
            || COALESCE(' — ' || NULLIF(p_observacao, ''), ''))
    RETURNING id, custo_total INTO v_mov, v_custo_mov;

    UPDATE public.insumos
    SET    quantidade_atual = COALESCE(quantidade_atual, 0) - v_base
    WHERE  id = v_insumo;

    v_custo_tot := v_custo_tot + COALESCE(v_custo_mov, 0);

    INSERT INTO public.transformacoes_itens (
      transformacao_id, loja_id, papel, insumo_id, quantidade, unidade, fator,
      quantidade_base, custo, movimentacao_id
    ) VALUES (
      v_transf, p_loja_id, 'ORIGEM', v_insumo, v_qtd,
      COALESCE(v_item->>'unidade', v_unidade), v_fator, v_base,
      COALESCE(v_custo_mov, 0), v_mov
    );
  END LOOP;

  -- ── 2. Rateio: peso declarado ou, na falta dele, a própria quantidade ──
  -- O peso existe porque nem toda parte vale o mesmo: 1 kg de filé não custa o
  -- mesmo que 1 kg de carcaça, ainda que saiam do mesmo frango.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_destinos)
  LOOP
    v_peso_tot := v_peso_tot + COALESCE(
      (v_item->>'peso')::NUMERIC,
      (v_item->>'qtd')::NUMERIC * COALESCE((v_item->>'fator')::NUMERIC, 1)
    );
  END LOOP;
  IF v_peso_tot <= 0 THEN v_peso_tot := 1; END IF;

  v_qtd_dest := jsonb_array_length(p_destinos);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_destinos)
  LOOP
    v_idx     := v_idx + 1;
    v_insumo  := (v_item->>'insumo_id')::UUID;
    v_qtd     := (v_item->>'qtd')::NUMERIC;
    v_fator   := COALESCE((v_item->>'fator')::NUMERIC, 1);
    v_base    := v_qtd * v_fator;
    v_peso    := COALESCE((v_item->>'peso')::NUMERIC, v_base);

    SELECT unidade_medida, nome INTO v_unidade, v_nome
    FROM public.insumos WHERE id = v_insumo AND loja_id = p_loja_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insumo de destino % não pertence a esta loja.', v_insumo;
    END IF;
    IF v_base <= 0 THEN
      RAISE EXCEPTION 'Quantidade de destino inválida para %.', v_nome;
    END IF;

    -- O último item leva o resíduo: sem isso, arredondar N partes faz sumir
    -- centavos e a conservação de valor deixa de fechar.
    IF v_idx = v_qtd_dest THEN
      v_custo_item := v_custo_tot - v_atribuido;
    ELSE
      v_custo_item := round(v_custo_tot * v_peso / v_peso_tot, 4);
    END IF;
    v_atribuido := v_atribuido + v_custo_item;

    INSERT INTO public.movimentacoes_estoque (
      loja_id, insumo_id, tipo, quantidade, custo_total, motivo, vence_em
    ) VALUES (
      p_loja_id, v_insumo, 'ENTRADA', v_base, NULLIF(v_custo_item, 0),
      CASE WHEN p_tipo = 'DESMONTE' THEN 'Desmonte' ELSE 'Montagem' END
      || COALESCE(' — ' || NULLIF(p_observacao, ''), ''),
      (NULLIF(v_item->>'vence_em', ''))::DATE
    ) RETURNING id INTO v_mov;

    UPDATE public.insumos
    SET    quantidade_atual = COALESCE(quantidade_atual, 0) + v_base
    WHERE  id = v_insumo;

    INSERT INTO public.transformacoes_itens (
      transformacao_id, loja_id, papel, insumo_id, quantidade, unidade, fator,
      quantidade_base, custo, movimentacao_id
    ) VALUES (
      v_transf, p_loja_id, 'DESTINO', v_insumo, v_qtd,
      COALESCE(v_item->>'unidade', v_unidade), v_fator, v_base, v_custo_item, v_mov
    );
  END LOOP;

  UPDATE public.transformacoes_estoque SET custo_total = v_custo_tot WHERE id = v_transf;

  RETURN jsonb_build_object(
    'transformacao_id', v_transf,
    'custo_consumido',  v_custo_tot,
    'custo_atribuido',  v_atribuido,
    'destinos',         v_qtd_dest
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_transformar_estoque(UUID, TEXT, JSONB, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_transformar_estoque(UUID, TEXT, JSONB, JSONB, TEXT) TO authenticated;

-- ─── RPC: inventário (contagem física em qualquer unidade) ──────────────────
CREATE OR REPLACE FUNCTION public.fn_ajustar_inventario(
  p_insumo_id  UUID,
  p_qtd_contada NUMERIC,
  p_unidade    TEXT    DEFAULT NULL,
  p_fator      NUMERIC DEFAULT 1,
  p_observacao TEXT    DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_loja      UUID;
  v_saldo     NUMERIC;
  v_base_un   TEXT;
  v_nome      TEXT;
  v_contado   NUMERIC;
  v_dif       NUMERIC;
  v_motivo    TEXT;
  v_mov       UUID;
  v_custo     NUMERIC;
BEGIN
  SELECT loja_id, COALESCE(quantidade_atual, 0), unidade_medida, nome
  INTO   v_loja, v_saldo, v_base_un, v_nome
  FROM   public.insumos WHERE id = p_insumo_id;

  IF v_loja IS NULL THEN
    RAISE EXCEPTION 'Insumo % não encontrado.', p_insumo_id;
  END IF;
  IF NOT public.fn_tem_papel(v_loja, ARRAY['admin','operador']) THEN
    RAISE EXCEPTION 'Sem permissão para ajustar o estoque desta loja.';
  END IF;
  IF p_qtd_contada < 0 THEN
    RAISE EXCEPTION 'Contagem não pode ser negativa.';
  END IF;

  v_contado := p_qtd_contada * COALESCE(NULLIF(p_fator, 0), 1);
  v_dif     := v_contado - v_saldo;

  IF abs(v_dif) < 1e-6 THEN
    RETURN jsonb_build_object('diferenca', 0, 'saldo', v_saldo,
                              'mensagem', 'Contagem bate com o sistema.');
  END IF;

  v_motivo := 'Inventário'
    || COALESCE(' — ' || NULLIF(p_observacao, ''), '')
    || COALESCE(' (contado: ' || public.fn_num_txt(p_qtd_contada)
                || ' ' || p_unidade || ')', '');

  IF v_dif > 0 THEN
    -- Sobra entra como ENTRADA (e não AJUSTE) de propósito: só ENTRADA abre
    -- lote PEPS. Sobra sem lote deixaria saldo sem lastro de custo, e a
    -- próxima baixa não teria de onde tirar valor.
    INSERT INTO public.movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, motivo)
    VALUES (v_loja, p_insumo_id, 'ENTRADA', v_dif, v_motivo)
    RETURNING id INTO v_mov;
  ELSE
    -- Falta: quantidade negativa faz trg_mov_custear_baixa consumir o PEPS e
    -- precificar o que sumiu.
    INSERT INTO public.movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, motivo)
    VALUES (v_loja, p_insumo_id, 'AJUSTE', v_dif, v_motivo)
    RETURNING id, custo_total INTO v_mov, v_custo;
  END IF;

  -- A contagem física manda: o saldo passa a ser exatamente o que foi contado.
  UPDATE public.insumos SET quantidade_atual = v_contado WHERE id = p_insumo_id;

  RETURN jsonb_build_object(
    'movimentacao_id', v_mov,
    'saldo_anterior',  v_saldo,
    'saldo_novo',      v_contado,
    'diferenca',       v_dif,
    'unidade_base',    v_base_un,
    'custo_diferenca', COALESCE(v_custo, 0)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_ajustar_inventario(UUID, NUMERIC, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_ajustar_inventario(UUID, NUMERIC, TEXT, NUMERIC, TEXT) TO authenticated;

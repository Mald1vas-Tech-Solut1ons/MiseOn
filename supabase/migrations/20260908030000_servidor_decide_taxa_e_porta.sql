-- ============================================================================
-- SPRINT 6: O SERVIDOR DECIDE — TAXA DE ENTREGA E LOJA ABERTA
--
-- A blindagem de 20260819042904 tirou do cliente a autoridade sobre PREÇO DE
-- ITEM e CUPOM: fn_recalcular_pedido passou a buscar o preço no catálogo e a
-- revalidar todas as regras do cupom. Dois campos ficaram de fora e continuam
-- valendo o que o navegador mandar:
--
--   1. taxa_entrega — `fn_criar_pedido_completo` gravava
--      `p_payload->>'taxa_entrega'` exatamente como veio. Um POST com
--      "taxa_entrega": 0 fazia a loja entregar de graça, e o rombo é invisível:
--      o pedido fecha certinho, só que a taxa que o lojista configurou nunca
--      entrou. O cálculo real (distância → faixa → bairro → padrão, com frete
--      grátis e raio) vive em src/lib/geo.ts, ou seja: no bundle do cliente.
--
--   2. loja aberta/fechada — decidido em Cardapio.tsx com `new Date()` do
--      NAVEGADOR. Nenhuma RPC recusava pedido de loja fechada: bastava o
--      relógio do aparelho estar errado (ou um POST direto) para cair pedido
--      na cozinha com a loja no escuro.
--
-- Estas funções trazem as duas regras para o banco, espelhando o que o
-- frontend já faz — o objetivo é AUTORIDADE, não mudar preço de ninguém.
--
-- O que o cliente continua informando: o ENDEREÇO (lat/lng geocodificados e
-- bairro). A distância é recalculada aqui por haversine a partir do lat/lng da
-- loja — mentir nela é mentir no endereço para onde o entregador vai.
-- ============================================================================

-- ── fn_loja_aberta ──────────────────────────────────────────────────────────
-- Espelha lojaAberta() de src/pages/Cardapio.tsx, com duas diferenças
-- deliberadas: o fuso é o da operação (America/Sao_Paulo), não o do aparelho
-- do cliente; e a leitura é da tabela, não de um estado de tela.
--
-- Horário que cruza a meia-noite (sábado 10:00–00:50) precisa da linha de
-- ONTEM: à 00:30 de domingo quem está aberto é o sábado.
CREATE OR REPLACE FUNCTION public.fn_loja_aberta(p_loja_id UUID)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_manual boolean;
  v_local  timestamp;
  v_hm     time;
  v_hoje   int;
  v_ontem  int;
BEGIN
  SELECT aberto_manual INTO v_manual FROM public.lojas WHERE id = p_loja_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Chave manual do lojista vence o horário, para os dois lados.
  IF v_manual IS NOT NULL THEN
    RETURN v_manual;
  END IF;

  v_local := now() AT TIME ZONE 'America/Sao_Paulo';
  v_hm    := v_local::time;
  v_hoje  := EXTRACT(DOW FROM v_local)::int;
  v_ontem := (v_hoje + 6) % 7;

  RETURN EXISTS (
    SELECT 1 FROM public.horarios_funcionamento h
    WHERE h.loja_id = p_loja_id
      AND h.dia_semana = v_hoje
      AND (
        -- Dia normal: abre e fecha no mesmo dia.
        (h.fecha > h.abre AND v_hm >= h.abre AND v_hm <= h.fecha)
        -- Cruza a meia-noite: hoje cobre de "abre" até 23:59.
        OR (h.fecha <= h.abre AND v_hm >= h.abre)
      )
  ) OR EXISTS (
    -- Madrugada herdada de ontem: a linha de ontem cobre 00:00 até "fecha".
    SELECT 1 FROM public.horarios_funcionamento h
    WHERE h.loja_id = p_loja_id
      AND h.dia_semana = v_ontem
      AND h.fecha <= h.abre
      AND v_hm <= h.fecha
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_loja_aberta(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_loja_aberta(UUID) TO anon, authenticated;

-- ── fn_taxa_entrega_calculada ───────────────────────────────────────────────
-- Espelha calcularEntrega() de src/lib/geo.ts, na mesma ordem de precedência:
--   1. DISTÂNCIA (haversine loja↔endereço) → faixa (modo HIBRIDO) ou linear;
--   2. BAIRRO (tabela taxas_entrega);
--   3. PADRÃO (lojas.entrega_taxa_padrao).
-- Frete grátis por valor mínimo zera a taxa nos caminhos de distância —
-- exatamente como no geo.ts, que também não aplica isenção no fallback de
-- bairro (divergência preservada de propósito: mudar isso aqui mudaria preço).
CREATE OR REPLACE FUNCTION public.fn_taxa_entrega_calculada(
  p_loja_id  UUID,
  p_lat      NUMERIC,
  p_lng      NUMERIC,
  p_bairro   TEXT,
  p_subtotal NUMERIC DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  l              RECORD;
  v_dist         NUMERIC;
  v_frete_gratis BOOLEAN;
  v_faixa        RECORD;
  v_raio         NUMERIC;
  v_taxa         NUMERIC;
  v_fora         BOOLEAN := false;
  v_tem_faixa    BOOLEAN;
  v_bairro_norm  TEXT;
  v_valor_bairro NUMERIC;
BEGIN
  SELECT lat, lng, entrega_modo, entrega_taxa_base, entrega_taxa_km,
         entrega_raio_km, entrega_taxa_padrao, frete_gratis_valor_minimo
    INTO l
    FROM public.lojas WHERE id = p_loja_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('taxa', 0, 'distancia_km', NULL, 'origem', 'NENHUM',
                              'fora_de_area', false, 'frete_gratis', false);
  END IF;

  v_frete_gratis := COALESCE(l.frete_gratis_valor_minimo, 0) > 0
                    AND COALESCE(p_subtotal, 0) >= l.frete_gratis_valor_minimo;

  -- ── 1. Distância ─────────────────────────────────────────────────────────
  IF l.lat IS NOT NULL AND l.lng IS NOT NULL AND p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    v_dist := round(
      (6371 * 2 * asin(sqrt(
        power(sin(radians(p_lat - l.lat) / 2), 2)
        + cos(radians(l.lat)) * cos(radians(p_lat))
          * power(sin(radians(p_lng - l.lng) / 2), 2)
      )))::numeric, 2);

    SELECT EXISTS (
      SELECT 1 FROM public.faixas_entrega f
      WHERE f.loja_id = p_loja_id AND COALESCE(f.ativo, true)
    ) INTO v_tem_faixa;

    IF COALESCE(l.entrega_modo, '') = 'HIBRIDO' AND v_tem_faixa THEN
      -- Menor faixa que ainda cobre a distância (geo.ts ordena por km_ate).
      SELECT f.* INTO v_faixa
        FROM public.faixas_entrega f
       WHERE f.loja_id = p_loja_id AND COALESCE(f.ativo, true) AND v_dist <= f.km_ate
       ORDER BY f.km_ate ASC
       LIMIT 1;

      SELECT COALESCE(l.entrega_raio_km, MAX(f.km_ate))
        INTO v_raio
        FROM public.faixas_entrega f
       WHERE f.loja_id = p_loja_id AND COALESCE(f.ativo, true) AND f.km_ate > 0;

      IF v_faixa.id IS NULL THEN
        -- Nenhuma faixa alcança: sem raio configurado, é fora por definição.
        v_taxa := 0;
        v_fora := CASE WHEN v_raio IS NOT NULL THEN v_dist > v_raio ELSE true END;
      ELSIF v_frete_gratis THEN
        v_taxa := 0;
        v_fora := v_raio IS NOT NULL AND v_dist > v_raio;
      ELSE
        v_taxa := COALESCE(
          v_faixa.taxa_fixa,
          round(COALESCE(l.entrega_taxa_base, 0)
                + COALESCE(v_faixa.taxa_por_km, l.entrega_taxa_km, 0) * v_dist, 2)
        );
        v_fora := v_raio IS NOT NULL AND v_dist > v_raio;
      END IF;
    ELSE
      v_raio := l.entrega_raio_km;
      v_fora := v_raio IS NOT NULL AND v_dist > v_raio;
      v_taxa := CASE WHEN v_frete_gratis THEN 0
                     ELSE round(COALESCE(l.entrega_taxa_base, 0)
                                + COALESCE(l.entrega_taxa_km, 0) * v_dist, 2) END;
    END IF;

    RETURN jsonb_build_object('taxa', v_taxa, 'distancia_km', v_dist, 'origem', 'DISTANCIA',
                              'fora_de_area', v_fora, 'frete_gratis', v_frete_gratis);
  END IF;

  -- ── 2. Bairro ────────────────────────────────────────────────────────────
  -- Mesma normalização do normaliza() em geo.ts: sem acento, minúscula, sem
  -- espaço nas pontas. NFD + remoção dos diacríticos combinantes.
  v_bairro_norm := lower(btrim(regexp_replace(
    normalize(COALESCE(p_bairro, ''), NFD), E'[\\u0300-\\u036f]', '', 'g')));

  IF v_bairro_norm <> '' THEN
    SELECT t.valor INTO v_valor_bairro
      FROM public.taxas_entrega t
     WHERE t.loja_id = p_loja_id
       AND lower(btrim(regexp_replace(
             normalize(t.bairro, NFD), E'[\\u0300-\\u036f]', '', 'g'))) = v_bairro_norm
     LIMIT 1;

    IF v_valor_bairro IS NOT NULL THEN
      RETURN jsonb_build_object('taxa', v_valor_bairro, 'distancia_km', NULL, 'origem', 'BAIRRO',
                                'fora_de_area', false, 'frete_gratis', false);
    END IF;
  END IF;

  -- ── 3. Padrão ────────────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'taxa', COALESCE(l.entrega_taxa_padrao, 0),
    'distancia_km', NULL,
    'origem', CASE WHEN COALESCE(l.entrega_taxa_padrao, 0) > 0 THEN 'PADRAO' ELSE 'NENHUM' END,
    'fora_de_area', false,
    'frete_gratis', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_taxa_entrega_calculada(UUID, NUMERIC, NUMERIC, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_taxa_entrega_calculada(UUID, NUMERIC, NUMERIC, TEXT, NUMERIC) TO anon, authenticated;

COMMENT ON FUNCTION public.fn_loja_aberta(UUID) IS
  'Loja está aberta agora? Horário no fuso da operação (America/Sao_Paulo), '
  'cobrindo turno que cruza a meia-noite; aberto_manual vence o horário. '
  'Autoridade do servidor — o navegador não decide mais isso sozinho.';

COMMENT ON FUNCTION public.fn_taxa_entrega_calculada(UUID, NUMERIC, NUMERIC, TEXT, NUMERIC) IS
  'Taxa de entrega derivada das tabelas da loja (distância/faixa → bairro → '
  'padrão), espelhando src/lib/geo.ts. O cliente informa endereço; o preço do '
  'frete é do servidor.';

-- ============================================================================
-- SPRINT 10: ENTREGA É LOCALIZAÇÃO, NÃO UM NOME DE BAIRRO
--
-- Uma tabela de bairros é uma aproximação administrativa; ela não determina
-- distância, cobertura nem o custo do deslocamento. Pior: o fallback aceitava
-- pedidos sem coordenadas e transformava uma falha de geocodificação em um
-- preço aparentemente válido. A autoridade passa a exigir origem e destino.
--
-- As políticas comerciais continuam as mesmas e são aplicadas DEPOIS da
-- distância: raio, faixas e frete grátis por subtotal. `p_bairro` permanece
-- na assinatura somente para não quebrar clientes já publicados; é ignorado.
-- ============================================================================

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
SET search_path TO ''
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
BEGIN
  SELECT lat, lng, entrega_modo, entrega_taxa_base, entrega_taxa_km,
         entrega_raio_km, frete_gratis_valor_minimo
    INTO l
    FROM public.lojas WHERE id = p_loja_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('taxa', 0, 'distancia_km', NULL, 'origem', 'NENHUM',
                              'fora_de_area', false, 'frete_gratis', false);
  END IF;

  IF l.lat IS NULL OR l.lng IS NULL THEN
    RAISE EXCEPTION 'A loja ainda não configurou a localização para calcular a entrega.';
  END IF;

  IF p_lat IS NULL OR p_lng IS NULL THEN
    RAISE EXCEPTION 'Não foi possível localizar o endereço de entrega. Confira rua, número, cidade e CEP.';
  END IF;

  v_frete_gratis := COALESCE(l.frete_gratis_valor_minimo, 0) > 0
                    AND COALESCE(p_subtotal, 0) >= l.frete_gratis_valor_minimo;

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
END;
$$;

COMMENT ON FUNCTION public.fn_taxa_entrega_calculada(UUID, NUMERIC, NUMERIC, TEXT, NUMERIC) IS
  'Frete derivado da localização real entre loja e cliente. Bairro e taxa padrão não são fallback de checkout; raio, faixas e frete grátis são políticas sobre a distância.';

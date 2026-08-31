-- O lote de estoque passa a nascer com a data da COMPRA, e nasce a view que
-- alimenta o alerta de variação de preço.
--
-- O lote guardava `now()`. Quem compra dia 04 e lança dia 31 tinha o estoque
-- entrando 27 dias depois do que aconteceu — e o PEPS consome pela ordem de
-- chegada, então a mercadoria velha ficava "mais nova" que a comprada depois
-- dela. O custo saía da camada errada e ninguém tinha como perceber.
--
-- (Esta migração foi refinada logo em seguida por
--  20260831150000_estoque_tres_datas_e_ciclo_de_vida.sql, que separa a data do
--  fato da data do registro em colunas distintas.)

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
                             lote_fornecedor, vence_em, criado_em)
  VALUES (NEW.loja_id, NEW.insumo_id, NEW.quantidade, NEW.quantidade,
          COALESCE(v_unit,0), NEW.id,
          NEW.lote_fornecedor, NEW.vence_em,
          COALESCE(NEW.criado_em, now()));
  RETURN NEW;
END; $$;

-- ─── Último custo conhecido de cada insumo ─────────────────────────────────
--
-- É o que permite avisar "este tomate subiu 14% desde a última compra" no
-- momento em que dá para fazer alguma coisa a respeito: antes de confirmar a
-- entrada, com o cupom na mão e o fornecedor ainda fresco na memória.
CREATE OR REPLACE VIEW public.vw_ultimo_custo_insumo
WITH (security_invoker = true) AS
SELECT DISTINCT ON (l.insumo_id)
  l.loja_id,
  l.insumo_id,
  l.custo_unitario,
  l.criado_em AS comprado_em
FROM public.lotes_estoque l
WHERE l.custo_unitario > 0
ORDER BY l.insumo_id, l.criado_em DESC;

COMMENT ON VIEW public.vw_ultimo_custo_insumo IS
  'Custo unitário da última entrada de cada insumo. Base do alerta de variação de preço na importação de nota.';

GRANT SELECT ON public.vw_ultimo_custo_insumo TO authenticated;

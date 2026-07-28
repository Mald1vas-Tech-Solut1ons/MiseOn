-- ═══════════════════════════════════════════════════════════════════════════
-- Controle de lotes de fornecedores e validades em Insumos Brutos
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE movimentacoes_estoque
ADD COLUMN IF NOT EXISTS lote_fornecedor VARCHAR(100),
ADD COLUMN IF NOT EXISTS vence_em DATE;

ALTER TABLE lotes_estoque
ADD COLUMN IF NOT EXISTS lote_fornecedor VARCHAR(100),
ADD COLUMN IF NOT EXISTS vence_em DATE;

-- Atualizar a trigger que cria o lote de estoque quando há uma entrada
CREATE OR REPLACE FUNCTION fn_mov_criar_lote() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
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
                             lote_fornecedor, vence_em)
  VALUES (NEW.loja_id, NEW.insumo_id, NEW.quantidade, NEW.quantidade,
          COALESCE(v_unit,0), NEW.id,
          NEW.lote_fornecedor, NEW.vence_em);
  RETURN NEW;
END; $$;

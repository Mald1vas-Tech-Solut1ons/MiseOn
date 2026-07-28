-- Adiciona o Rendimento Padrão nos Insumos (Fator de Cocção)
ALTER TABLE "public"."insumos" ADD COLUMN "rendimento_padrao_kg" numeric(10,3);

-- Atualiza a tabela reposicoes_buffet para o novo modelo KDS
ALTER TABLE "public"."reposicoes_buffet" 
  ADD COLUMN "preparo_id" uuid REFERENCES "public"."insumos"("id") ON DELETE CASCADE,
  ADD COLUMN "peso_sobra_limpa_kg" numeric(10,3) DEFAULT 0,
  ADD COLUMN "status" character varying(20) DEFAULT 'NA_PISTA';

-- Permite nulo na coluna antiga de produto
ALTER TABLE "public"."reposicoes_buffet" ALTER COLUMN "produto_id" DROP NOT NULL;

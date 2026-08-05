-- Migration: compras_depara_nfce
-- Tabela para armazenar o histórico de vínculos (De-Para) entre itens de cupons fiscais (NFC-e / NF-e) e insumos do MiseOn

CREATE TABLE IF NOT EXISTS public.compras_depara_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  chave_item_fornecedor TEXT NOT NULL, -- EAN ou Hash da Descrição do produto na nota
  descricao_nota TEXT NOT NULL,
  gtin_nota TEXT,
  insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
  fator_conversao NUMERIC(15, 6) NOT NULL DEFAULT 1.0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uk_depara_loja_chave UNIQUE (loja_id, chave_item_fornecedor)
);

ALTER TABLE public.compras_depara_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso por loja aos de-paras de compras"
  ON public.compras_depara_itens
  FOR ALL
  TO authenticated
  USING (
    loja_id IN (
      SELECT loja_id FROM public.usuarios_loja WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_depara_loja_chave ON public.compras_depara_itens (loja_id, chave_item_fornecedor);

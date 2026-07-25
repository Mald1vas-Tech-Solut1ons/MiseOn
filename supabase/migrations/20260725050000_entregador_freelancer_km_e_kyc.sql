-- ============================================================================
-- Entregador freelancer: taxa por km real + cadastro de documentos (KYC)
--
-- Decisões (consultoria com o Rafael):
--   - Taxa configurável por loja, com padrão global sugerido pela plataforma
--     (R$5 mínimo até 5km, R$1,20/km excedente) — cada loja pode ajustar.
--   - Entregador continua vinculado a UMA loja (sem mudança de identidade).
--   - Documentos (CNH, doc do veículo) ficam pendentes até o admin da loja
--     aprovar manualmente.
-- ============================================================================

-- 1. Nova opção de remuneração + taxa configurável (default = padrão global)
ALTER TABLE public.configuracoes_custo
  DROP CONSTRAINT IF EXISTS configuracoes_custo_tipo_remuneracao_entregador_check;

ALTER TABLE public.configuracoes_custo
  ADD CONSTRAINT configuracoes_custo_tipo_remuneracao_entregador_check
  CHECK (tipo_remuneracao_entregador = ANY (ARRAY['FIXO','POR_ENTREGA','POR_KM','DESLIGADO']));

ALTER TABLE public.configuracoes_custo
  ADD COLUMN IF NOT EXISTS entregador_taxa_minima NUMERIC(10,2) DEFAULT 5.00,
  ADD COLUMN IF NOT EXISTS entregador_raio_minimo_km NUMERIC(6,2) DEFAULT 5.00,
  ADD COLUMN IF NOT EXISTS entregador_taxa_km_excedente NUMERIC(10,2) DEFAULT 1.20;

COMMENT ON COLUMN public.configuracoes_custo.entregador_taxa_minima IS
  'Valor pago ao entregador freelancer (POR_KM) por entrega dentro do raio mínimo. Padrão sugerido pela plataforma: R$5.';
COMMENT ON COLUMN public.configuracoes_custo.entregador_raio_minimo_km IS
  'Raio, em km, coberto pela taxa mínima antes de cobrar por km excedente. Padrão sugerido: 5km.';
COMMENT ON COLUMN public.configuracoes_custo.entregador_taxa_km_excedente IS
  'Valor por km rodado além do raio mínimo (POR_KM). Padrão sugerido pela plataforma: R$1,20/km.';

-- 2. Documentos do entregador (KYC) — fila de aprovação manual pelo admin
ALTER TABLE public.entregadores
  ADD COLUMN IF NOT EXISTS cnh_numero TEXT,
  ADD COLUMN IF NOT EXISTS cnh_arquivo_url TEXT,
  ADD COLUMN IF NOT EXISTS veiculo_doc_arquivo_url TEXT,
  ADD COLUMN IF NOT EXISTS status_documentos TEXT DEFAULT 'pendente'
    CHECK (status_documentos IN ('pendente', 'aprovado', 'rejeitado')),
  ADD COLUMN IF NOT EXISTS documentos_enviados_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS documentos_revisado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS documentos_revisado_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS motivo_rejeicao TEXT;

CREATE INDEX IF NOT EXISTS idx_entregadores_status_documentos
  ON public.entregadores (loja_id, status_documentos);

-- ============================================================================
-- RASTREAMENTO DE ANÚNCIOS & PIXELS DE MARKETING (META PIXEL + GA4)
-- ============================================================================

ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS meta_pixel_id TEXT,
  ADD COLUMN IF NOT EXISTS ga4_measurement_id TEXT;

COMMENT ON COLUMN public.lojas.meta_pixel_id IS 'ID do Meta Pixel para rastreamento de anúncios (ex: 123456789012345)';
COMMENT ON COLUMN public.lojas.ga4_measurement_id IS 'ID do Google Analytics 4 (ex: G-XXXXXXXXXX)';

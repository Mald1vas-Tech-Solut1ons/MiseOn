-- ============================================================================
-- Bucket privado para documentos do entregador (CNH, documento do veículo)
--
-- Diferente de loja-assets (público, logos/banners), este bucket é PRIVADO —
-- são documentos pessoais. Caminho: {loja_id}/{user_id}/cnh.ext ou
-- {loja_id}/{user_id}/veiculo.ext. Leitura liberada só pro próprio entregador
-- (dono do documento) ou pro admin daquela loja (fila de aprovação); upload
-- só pelo próprio entregador.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('entregador-docs', 'entregador-docs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS entregador_docs_upload_proprio ON storage.objects;
CREATE POLICY entregador_docs_upload_proprio ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'entregador-docs'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

DROP POLICY IF EXISTS entregador_docs_update_proprio ON storage.objects;
CREATE POLICY entregador_docs_update_proprio ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'entregador-docs'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

DROP POLICY IF EXISTS entregador_docs_leitura ON storage.objects;
CREATE POLICY entregador_docs_leitura ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'entregador-docs'
    AND (
      auth.uid()::text = (storage.foldername(name))[2]
      OR public.fn_sou_admin(((storage.foldername(name))[1])::uuid)
    )
  );

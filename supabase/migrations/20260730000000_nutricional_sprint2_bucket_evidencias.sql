-- ============================================================================
-- NUTRICIONAL — SPRINT 2: bucket de evidências do OCR de rótulo (NUT-11)
-- ============================================================================
-- A foto do rótulo é a evidência que sustenta a revisão humana (§8.2 momento
-- 2 do PLANO-NUTRICIONAL: "evidência à esquerda, valores à direita"). Privado
-- — não é material de vitrine. Caminho: {loja_id}/{insumo_id}/{timestamp}.jpg.
-- Upload sempre via service_role (Edge Function nutricao-ocr-rotulo); a
-- policy de leitura é para a tela de revisão (equipe da loja), não para o
-- cliente final.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('nutricao-evidencias', 'nutricao-evidencias', false)
on conflict (id) do nothing;

drop policy if exists nutricao_evidencias_leitura on storage.objects;
create policy nutricao_evidencias_leitura on storage.objects
  for select
  using (
    bucket_id = 'nutricao-evidencias'
    and public.fn_tem_papel(((storage.foldername(name))[1])::uuid, array['admin', 'operador'])
  );

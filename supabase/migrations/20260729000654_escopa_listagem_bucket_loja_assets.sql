-- O bucket loja-assets é público: as imagens do cardápio são servidas pela URL
-- pública do CDN, que NÃO passa por RLS. A policy de SELECT em storage.objects
-- serve só para a API de listagem/download — e estava liberada para qualquer
-- um, permitindo enumerar todos os arquivos de todas as lojas.
-- Escopada pela loja, no mesmo padrão que update e delete já usavam.
drop policy if exists loja_assets_leitura_publica on storage.objects;

create policy loja_assets_leitura_por_loja on storage.objects
  for select to authenticated
  using (
    bucket_id = 'loja-assets'
    and fn_meu_acesso(((storage.foldername(name))[1])::uuid)
  );

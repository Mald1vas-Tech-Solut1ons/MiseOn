-- O banner da loja e exibido com object-fit: cover e object-position travado no
-- centro. Medido no cardapio do Lanche do Paulista: imagem 4000x1714 (2.33:1)
-- exibida em 1280x320 (4:1) — cerca de 42% da altura fica fora, sempre cortada
-- pelo meio. Se o assunto da foto (fachada, prato, logo) nao estiver no centro
-- vertical exato, ele some, e o lojista nao tem como corrigir.
--
-- banner_pos_y guarda o ponto focal vertical em porcentagem: 0 = topo da
-- imagem, 50 = centro (o comportamento atual), 100 = base. Vira direto o
-- object-position do <img>, entao o lojista enquadra sem precisar reeditar a
-- foto num editor externo.

alter table public.lojas
  add column if not exists banner_pos_y smallint not null default 50;

alter table public.lojas
  add constraint lojas_banner_pos_y_valido check (banner_pos_y between 0 and 100);

comment on column public.lojas.banner_pos_y is
  'Ponto focal vertical do banner em % (0 = topo, 50 = centro, 100 = base). Alimenta o object-position do cardapio.';

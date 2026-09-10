-- ============================================================================
-- REDES SOCIAIS DA LOJA NA VITRINE
--
-- POR QUE: o cardápio digital é a página que o cliente abre com fome — é o
-- momento de maior atenção que a loja tem no dia. Hoje ela termina ali: quem
-- gostou não tem para onde ir, e a loja que produz conteúdo (a Natureba posta
-- no Instagram) não colhe nada dessa visita. Um botão no topo transforma
-- pedido em seguidor, e seguidor em próximo pedido, sem custo de mídia.
--
-- O QUE ENTRA: três campos de texto livre, preenchidos pelo lojista no painel.
-- Guardamos EXATAMENTE o que ele digitou — "@natureba", "natureba" ou a URL
-- inteira com rastreio colado pelo próprio app. A normalização acontece na
-- leitura (src/lib/redesSociais.ts, com teste), não na gravação, por dois
-- motivos: ele reconhece na tela o que escreveu, e uma regra melhor amanhã
-- conserta os cadastros de ontem sem migração de dados.
--
-- NULO É RESPOSTA VÁLIDA: loja sem Instagram não ganha botão vazio. E link
-- colado no campo errado (o Instagram no campo do TikTok) não vira botão —
-- some, em vez de virar um botão que mente sobre para onde leva.
-- ============================================================================

alter table public.lojas
  add column if not exists instagram text,
  add column if not exists tiktok    text,
  add column if not exists facebook  text;

comment on column public.lojas.instagram is
  'Perfil do Instagram como o lojista digitou (@usuario, usuario ou URL). Normalizado na leitura por src/lib/redesSociais.ts.';
comment on column public.lojas.tiktok is
  'Perfil do TikTok como o lojista digitou. Normalizado na leitura.';
comment on column public.lojas.facebook is
  'Pagina do Facebook como o lojista digitou. Normalizada na leitura.';

-- A Natureba ja produz conteudo no Instagram: o perfil entra junto com o
-- cardapio para a vitrine nascer completa.
update public.lojas
   set instagram = coalesce(nullif(btrim(instagram), ''), 'naturebalojas')
 where slug = 'natureba';

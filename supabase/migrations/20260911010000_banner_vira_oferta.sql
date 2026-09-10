-- ============================================================================
-- O BANNER VIRA OFERTA — com promessa, destino e uma página que a cumpre
--
-- ─── O DIAGNÓSTICO ─────────────────────────────────────────────────────────
-- Conferido em produção (10/09/2026): o banner da Natureba está com título
-- VAZIO e ação NENHUM. É uma ilustração 3D de banco de imagens ocupando a
-- faixa mais nobre da vitrine — a primeira coisa que o cliente vê ao abrir o
-- cardápio com fome — sem dizer o nome da loja, sem oferta, sem preço, sem
-- prazo e sem para onde ir.
--
-- Banner em delivery não é enfeite: é oferta. iFood e Rappi vendem ali com
-- três coisas, sempre as mesmas — um SELO curto que dá o tamanho do desconto,
-- uma PROMESSA em uma linha, e um DESTINO que continua a promessa. Faltavam
-- as três. O que existia era `titulo`, uma legenda opcional jogada por cima
-- da imagem, e um destino que só sabia abrir UM produto ou filtrar UMA
-- categoria — nenhum dos dois é uma oferta.
--
-- ─── O QUE ENTRA ───────────────────────────────────────────────────────────
--
-- 1. A PROMESSA (campos de texto que o lojista controla)
--    • selo        — o carimbo curto: "ATÉ 30% OFF", "FRETE GRÁTIS"
--    • subtitulo   — a linha que qualifica: "válido até domingo, no Pix"
--    • cta_texto   — o que o botão diz: "Ver combos", "Pegar meu cupom"
--    Sem isso o banner depende da imagem falar sozinha, e imagem de banco não
--    fala.
--
-- 2. O DESTINO QUE FALTAVA: COLECAO
--    Uma lista curada de produtos que atravessa categorias — "Combos da
--    semana" com dois lanches, uma salada e um refrigerante. Nem produto
--    único nem categoria inteira davam conta: promoção quase nunca respeita a
--    arrumação do cardápio. A coleção é a "página alternativa" que o banner
--    prometia e não tinha.
--
-- 3. O ENQUADRAMENTO
--    • foco_y — 0 a 100, o ponto vertical que fica visível quando a imagem é
--      cortada na proporção da faixa. Mesma ideia do `banner_pos_y` que o
--      cabeçalho da loja já usa. Sem isso o corte é sempre pelo meio, e é por
--      isso que a arte aparece decapitada.
--
-- ─── INVARIANTE ────────────────────────────────────────────────────────────
-- A constraint de coerência entre tipo_acao e alvo continua valendo, agora
-- incluindo COLECAO — cuja lista vive em `banner_produtos`, não no
-- acao_target_id (uma lista não cabe num campo escalar, e forçá-la ali seria
-- exatamente o campo genérico ambíguo que eu evito).
-- ============================================================================

alter table public.banners_destaque
  add column if not exists selo        text,
  add column if not exists subtitulo   text,
  add column if not exists cta_texto   text,
  add column if not exists foco_y      smallint;

alter table public.banners_destaque
  add constraint banners_destaque_foco_y_valido
  check (foco_y is null or (foco_y >= 0 and foco_y <= 100)) not valid;

alter table public.banners_destaque validate constraint banners_destaque_foco_y_valido;

comment on column public.banners_destaque.selo is
  'Carimbo curto da oferta ("ATE 30% OFF"). Aparece antes do titulo, em destaque.';
comment on column public.banners_destaque.subtitulo is
  'Linha que qualifica a promessa: prazo, condicao, meio de pagamento.';
comment on column public.banners_destaque.cta_texto is
  'Texto do botao. Diz o que acontece ao tocar, nao "saiba mais".';
comment on column public.banners_destaque.foco_y is
  'Ponto vertical (0-100) que fica visivel quando a imagem e cortada na faixa. Sem ele o corte e sempre pelo meio.';

-- ── A coleção ───────────────────────────────────────────────────────────────
create table if not exists public.banner_produtos (
  banner_id   uuid    not null references public.banners_destaque(id) on delete cascade,
  produto_id  uuid    not null references public.produtos(id)         on delete cascade,
  ordem       integer not null default 0,
  primary key (banner_id, produto_id)
);

comment on table public.banner_produtos is
  'Produtos curados de um banner do tipo COLECAO. Atravessa categorias: promocao raramente respeita a arrumacao do cardapio.';

create index if not exists idx_banner_produtos_banner
  on public.banner_produtos (banner_id, ordem);

alter table public.banner_produtos enable row level security;

-- Leitura pública: a coleção é conteúdo de vitrine, igual ao produto que ela
-- lista. Escrita fica com quem administra a loja dona do banner.
drop policy if exists banner_produtos_leitura_publica on public.banner_produtos;
create policy banner_produtos_leitura_publica
  on public.banner_produtos for select
  using (true);

drop policy if exists banner_produtos_escrita_da_loja on public.banner_produtos;
create policy banner_produtos_escrita_da_loja
  on public.banner_produtos for all
  using (
    exists (
      select 1 from public.banners_destaque b
      where b.id = banner_produtos.banner_id
        and public.fn_tem_papel(b.loja_id, array['admin'])
    )
  )
  with check (
    exists (
      select 1 from public.banners_destaque b
      where b.id = banner_produtos.banner_id
        and public.fn_tem_papel(b.loja_id, array['admin'])
    )
  );

grant select on public.banner_produtos to anon, authenticated;
grant insert, update, delete on public.banner_produtos to authenticated;

-- ── COLECAO entra na constraint de coerência ────────────────────────────────
-- O alvo de uma coleção é a própria lista em banner_produtos; o campo escalar
-- guarda apenas o rótulo da seção ("Combos da semana"), que é o que a vitrine
-- imprime como título da página da oferta.
alter table public.banners_destaque
  drop constraint if exists banners_destaque_acao_coerente;

alter table public.banners_destaque
  add constraint banners_destaque_acao_coerente check (
    tipo_acao in ('NENHUM', 'PRODUTO', 'CATEGORIA', 'CUPOM', 'LINK_EXTERNO', 'COLECAO')
    and (
      (tipo_acao = 'NENHUM' and coalesce(btrim(acao_target_id), '') = '')
      or (tipo_acao <> 'NENHUM' and coalesce(btrim(acao_target_id), '') <> '')
    )
  );

-- ============================================================================
-- ARTE DE BANNER GERADA PELO SISTEMA
--
-- ─── O PROBLEMA ────────────────────────────────────────────────────────────
-- Hoje `banners_destaque.imagem_url` é NOT NULL: para ter banner, o lojista
-- precisa PRODUZIR uma imagem. Na prática isso significa abrir o Canva, achar
-- um modelo, escrever o texto, exportar, voltar no painel e subir. O resultado
-- medido é o que está na Natureba: uma ilustração 3D de banco de imagens, sem
-- oferta, sem preço e sem prazo — porque montar arte de verdade dá trabalho e
-- ninguém tem designer.
--
-- ─── E TEM UM PROBLEMA PIOR, QUE NINGUÉM VÊ ────────────────────────────────
-- Arte feita à mão MENTE com o tempo. O concorrente estampa no banner "use o
-- cupom POSFERIADAOOFF — pedido de qualquer valor". Se amanhã alguém editar o
-- cupom no cadastro e exigir R$ 30 de mínimo, a imagem continua prometendo
-- "qualquer valor". O cliente tenta, o sistema recusa com razão, e quem fica
-- mal é a loja. Foi exatamente isso que aconteceu aqui: os três cupons do
-- Lanche do Paulista têm regra (um vencido, um com mínimo de R$ 30, um só no
-- Pix) e nada na tela contava isso.
--
-- ─── A SOLUÇÃO ─────────────────────────────────────────────────────────────
-- A arte passa a ser DESENHADA PELO SISTEMA a partir dos dados: as cores e o
-- logo da loja, o selo, o título, o subtítulo e — quando o banner aponta para
-- um cupom — o código e as condições REAIS lidas da tabela `cupons`. Não tem
-- como a arte contradizer a regra, porque as duas saem da mesma fonte.
--
-- `modelo_arte` guarda qual dos modelos do sistema usar. Com ele preenchido,
-- `imagem_url` deixa de ser obrigatória: o banner é composto na hora, sem
-- upload, sem Canva, sem exportar nada.
--
-- ─── COMPATIBILIDADE ───────────────────────────────────────────────────────
-- Banner que já existe continua com a imagem dele e `modelo_arte` nulo. A
-- coluna só deixa de ser obrigatória; nenhuma linha existente muda.
-- ============================================================================

alter table public.banners_destaque
  alter column imagem_url drop not null;

alter table public.banners_destaque
  add column if not exists modelo_arte text;

comment on column public.banners_destaque.modelo_arte is
  'Modelo de arte do sistema usado para compor o banner sem upload. Nulo = banner usa imagem_url.';

-- Um dos dois tem que existir: ou a imagem que o lojista subiu, ou o modelo
-- que o sistema desenha. Banner sem nenhum dos dois e uma faixa vazia no topo
-- da vitrine — o pior resultado possivel para o espaco mais nobre da pagina.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'banners_destaque_tem_arte') then
    alter table public.banners_destaque
      add constraint banners_destaque_tem_arte check (
        coalesce(btrim(imagem_url), '') <> '' or coalesce(btrim(modelo_arte), '') <> ''
      );
  end if;
end $$;

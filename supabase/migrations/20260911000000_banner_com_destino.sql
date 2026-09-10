-- ============================================================================
-- O BANNER PASSA A LEVAR A ALGUM LUGAR
--
-- ─── O DEFEITO ─────────────────────────────────────────────────────────────
-- A vitrine (src/pages/Cardapio.tsx) já implementa o clique do banner por
-- inteiro: abre o produto, filtra a categoria, copia o cupom ou abre o link,
-- conforme `banner.tipo_acao` e `banner.acao_target_id`. O tipo em
-- `src/types.ts` também já declara os dois campos.
--
-- As colunas nunca existiram no banco.
--
-- Conferido em 10/09/2026: `banners_destaque` tem apenas id, loja_id,
-- imagem_url, titulo, link_redirecionamento, ordem_exibicao e is_ativo. Ou
-- seja, `tipo_acao` chegava sempre `undefined`, todo `if` caía fora e o clique
-- não fazia nada. Metade de cima da ponte construída, metade de baixo não.
--
-- Isso não é um detalhe cosmético: o banner ocupa a faixa mais nobre da página
-- que o cliente abre com fome. Um retângulo bonito que não responde ao toque
-- ensina o cliente que aquilo ali não é clicável — e ele para de tentar,
-- inclusive nos banners que um dia funcionarem.
--
-- ─── O QUE ENTRA ───────────────────────────────────────────────────────────
--  • tipo_acao: NENHUM | PRODUTO | CATEGORIA | CUPOM | LINK_EXTERNO — os
--    mesmos valores que o front já espera (TipoAcaoBanner).
--  • acao_target_id: o alvo. id do produto, id da categoria, o código do cupom
--    ou a URL, conforme o tipo.
--
-- Um campo genérico para significados diferentes é o tipo de coisa que eu
-- normalmente evito. Aqui ele é aceitável porque `tipo_acao` está ao lado e
-- diz como ler o valor — o significado nunca depende de adivinhação. O que
-- NÃO pode é o inverso: alvo preenchido sem tipo, ou tipo que exige alvo sem
-- alvo. Isso a constraint impede.
--
-- ─── COMPATIBILIDADE ───────────────────────────────────────────────────────
-- Banner que já existe nasce com NENHUM e continua se comportando como hoje:
-- se tiver `link_redirecionamento`, a vitrine ainda o usa como último caso.
-- Nenhum banner muda de comportamento sem alguém configurar.
-- ============================================================================

alter table public.banners_destaque
  add column if not exists tipo_acao       text,
  add column if not exists acao_target_id  text;

update public.banners_destaque
   set tipo_acao = case
     when coalesce(btrim(link_redirecionamento), '') <> '' then 'LINK_EXTERNO'
     else 'NENHUM'
   end
 where tipo_acao is null;

-- Banner antigo que já tinha link continua levando ao mesmo lugar.
update public.banners_destaque
   set acao_target_id = link_redirecionamento
 where tipo_acao = 'LINK_EXTERNO'
   and coalesce(btrim(acao_target_id), '') = ''
   and coalesce(btrim(link_redirecionamento), '') <> '';

alter table public.banners_destaque
  alter column tipo_acao set default 'NENHUM';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'banners_destaque_acao_coerente'
  ) then
    alter table public.banners_destaque
      add constraint banners_destaque_acao_coerente check (
        tipo_acao in ('NENHUM', 'PRODUTO', 'CATEGORIA', 'CUPOM', 'LINK_EXTERNO')
        and (
          -- Sem ação: alvo tem que estar vazio, senão fica lixo guardado que
          -- alguém um dia lê como se valesse.
          (tipo_acao = 'NENHUM' and coalesce(btrim(acao_target_id), '') = '')
          -- Com ação: alvo é obrigatório. Banner "vai para o produto" sem
          -- dizer qual produto é exatamente o clique que não faz nada.
          or (tipo_acao <> 'NENHUM' and coalesce(btrim(acao_target_id), '') <> '')
        )
      );
  end if;
end $$;

comment on column public.banners_destaque.tipo_acao is
  'O que acontece ao tocar no banner: NENHUM, PRODUTO, CATEGORIA, CUPOM ou LINK_EXTERNO. Diz como ler acao_target_id.';
comment on column public.banners_destaque.acao_target_id is
  'Alvo da acao: id do produto, id da categoria, codigo do cupom ou URL. Sempre lido conforme tipo_acao.';

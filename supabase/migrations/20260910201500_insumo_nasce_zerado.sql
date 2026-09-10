-- ============================================================================
-- INSUMO NASCE ZERADO — A ÚLTIMA PORTA DO SALDO ESCRITO POR FORA
--
-- ─── O QUE FOI MEDIDO EM PRODUÇÃO (10/09) ──────────────────────────────────
--
-- 57 de 182 insumos ativos aparecem em vw_divergencia_saldo_lotes. Os 57 têm
-- a MESMA assinatura, sem exceção: o saldo em insumos.quantidade_atual não
-- bate com a soma do próprio ledger.
--
--   with led as (select insumo_id, coalesce(sum(quantidade),0) as ledger
--                from movimentacoes_estoque group by insumo_id)
--   select (i.id in (select insumo_id from vw_divergencia_saldo_lotes)) as divergente,
--          count(*) filter (where abs(coalesce(i.quantidade_atual,0)
--                                   - coalesce(led.ledger,0)) <= 1e-6) as cache_ok,
--          count(*) filter (where abs(coalesce(i.quantidade_atual,0)
--                                   - coalesce(led.ledger,0))  > 1e-6) as cache_fora
--   from insumos i left join led on led.insumo_id = i.id
--   where i.ativo group by 1;
--
--   divergente=false → 124 cache_ok,  1 cache_fora
--   divergente=true  →   0 cache_ok, 57 cache_fora
--
-- A correlação é a prova: divergir dos lotes é a MESMA coisa que ter saldo que
-- o ledger nunca viu. 133.880,75 unidades entraram em quantidade_atual sem uma
-- única movimentação. 21 desses insumos não têm movimentação nenhuma.
--
-- ─── POR QUE ISSO VIRA DIVERGÊNCIA PERMANENTE ──────────────────────────────
--
-- Os lotes são mantidos por GATILHO em cima do ledger (trg_mov_criar_lote abre
-- lote na ENTRADA, trg_mov_custear_baixa consome por PEPS na baixa). O saldo
-- NÃO: cada RPC atualiza quantidade_atual na mão. Então um saldo que nasce
-- fora do ledger nunca chega ao lote — o item já nasce divergente e assim fica
-- para sempre. Pior: a baixa seguinte não acha lote para consumir, e
-- fn_consumir_lotes_peps custeia por estimativa (RAISE WARNING). As 14.932,80
-- unidades que "o lote não acompanhou" são consequência disso, não causa
-- separada.
--
-- ─── POR QUE A MIGRATION DE 08/09 NÃO PEGOU ISSO ───────────────────────────
--
-- 20260908080000_saldo_nao_e_escrivel_por_fora revogou UPDATE de
-- quantidade_atual, mas o INSERT da coluna continuou concedido a anon e
-- authenticated. Fechou a porta e deixou a janela: dá para NASCER com saldo.
-- Não é hipótese — os insumos "(demo)" criados em 09/09, depois daquela
-- migration, nasceram com 5.000 e zero lote.
--
-- A regra "nasce zerado" existia só como convenção em Estoque.tsx
-- (`insert({ ...payload, quantidade_atual: 0 })`). Convenção em uma tela não
-- segura script de seed, importador novo nem outra tela. Aqui ela vira regra
-- do banco.
--
-- COMPATIBILIDADE: conferido antes de aplicar — todo produtor legítimo de
-- insumo já manda 0 (Estoque.tsx, EstoquePreparos.tsx, fn_semear_loja e
-- fn_importar_nfce, que insere com 0 e só depois lança a ENTRADA). Nenhum
-- deles muda de comportamento. Por isso o gatilho corrige em silêncio em vez
-- de abortar: quem manda 0 não percebe nada, e quem manda saldo é avisado no
-- log em vez de derrubar uma importação inteira em produção.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_insumo_nasce_zerado()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(NEW.quantidade_atual, 0) <> 0 THEN
    -- WARNING e não EXCEPTION de propósito: o estrago é o saldo sem lastro,
    -- e zerar já o evita. Derrubar a transação puniria uma importação de nota
    -- inteira por causa de um item.
    RAISE WARNING 'Insumo "%" tentou nascer com saldo %; gravado 0. Saldo inicial entra por fn_movimentar_estoque(ENTRADA), que abre o lote.',
      NEW.nome, NEW.quantidade_atual;
  END IF;

  -- O saldo inicial não é um campo de cadastro: é uma ENTRADA. Só a RPC move
  -- saldo e lote juntos, e é ela que dá lastro (custo, validade, PEPS).
  NEW.quantidade_atual := 0;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_insumo_nasce_zerado ON public.insumos;
CREATE TRIGGER tg_insumo_nasce_zerado
  BEFORE INSERT ON public.insumos
  FOR EACH ROW EXECUTE FUNCTION public.fn_insumo_nasce_zerado();

COMMENT ON FUNCTION public.fn_insumo_nasce_zerado() IS
  'Insumo nasce com saldo 0. Medido em 10/09: os 57 insumos divergentes de '
  'vw_divergencia_saldo_lotes eram exatamente os 57 com saldo fora do ledger, '
  'e o lote (mantido por gatilho sobre o ledger) nunca soube do saldo de '
  'nascimento. Saldo inicial entra por fn_movimentar_estoque(ENTRADA).';

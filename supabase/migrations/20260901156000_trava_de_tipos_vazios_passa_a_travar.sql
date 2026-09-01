-- A trava `array_length(painel_tv_tipos, 1) >= 1` NAO travava nada.
--
-- Em Postgres, `array_length('{}', 1)` devolve NULL, nao 0 — e `NULL >= 1` e
-- NULL, que um CHECK trata como satisfeito. A restricao aceitava exatamente o
-- caso que existia para impedir. Pego por teste em 01/09/2026, que conseguiu
-- gravar lista vazia numa loja de verdade.
--
-- Trava decorativa e pior que trava nenhuma: quem le o schema acredita que a
-- garantia existe e para de conferir.

-- Primeiro conserta quem ja esta invalido, senao a restricao nova nao sobe.
update public.lojas
   set painel_tv_tipos = array['RETIRADA_BALCAO', 'SALAO']::public.tipo_pedido[]
 where painel_tv_tipos is null
    or coalesce(array_length(painel_tv_tipos, 1), 0) = 0;

alter table public.lojas drop constraint if exists ck_lojas_painel_tv_tipos_nao_vazio;
alter table public.lojas
  add constraint ck_lojas_painel_tv_tipos_nao_vazio
    check (coalesce(array_length(painel_tv_tipos, 1), 0) >= 1);

-- O revoke da migration anterior não surtiu efeito: o EXECUTE não vinha de um
-- grant para anon/authenticated, e sim do default do Postgres, que concede
-- EXECUTE a PUBLIC em toda função criada. Revogar de anon deixa PUBLIC intacto.
-- Mesma lição de 20260819044956_comanda_revoga_de_public_nao_so_de_anon.
--
-- Verificado antes de aplicar, em transação com rollback: com EXECUTE revogado
-- de PUBLIC, um UPDATE feito pelo papel `authenticated` continua disparando o
-- gatilho — a checagem de EXECUTE acontece no CREATE TRIGGER, não a cada
-- disparo. Ou seja, gatilho não precisa desse grant para funcionar.

revoke execute on function public.fatores_conversao_valida()      from public, anon, authenticated;
revoke execute on function public.fn_insumos_normaliza_nome()     from public, anon, authenticated;
revoke execute on function public.fn_sync_tipo_item_is_preparo()  from public, anon, authenticated;
revoke execute on function public.fn_trg_cache_nutricao_ficha()   from public, anon, authenticated;
revoke execute on function public.fn_trg_cache_nutricao_insumo()  from public, anon, authenticated;
revoke execute on function public.fn_trg_ifood_status()           from public, anon, authenticated;
revoke execute on function public.fn_trg_incrementa_uso_cupom()   from public, anon, authenticated;
revoke execute on function public.set_faixas_entrega_updated_at() from public, anon, authenticated;
revoke execute on function public.update_timestamp_column()       from public, anon, authenticated;

-- Importação de nota fiscal é operação de estoque de staff logado. A função já
-- exige fn_tem_papel(admin|operador) internamente, então isto não fecha uma
-- porta aberta — tira uma camada que nunca deveria ter existido. `authenticated`
-- continua podendo: é por lá que o lojista chama.
revoke execute on function public.fn_importar_nfce(uuid, text, text, jsonb, boolean) from public, anon;

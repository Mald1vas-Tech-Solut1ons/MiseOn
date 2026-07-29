-- As 8 views pertencem a postgres e, sem security_invoker, rodam com os
-- privilégios do DONO — ou seja, atravessam a RLS das tabelas de origem.
-- Na prática um lojista autenticado conseguia ler DRE, custo, margem e lucro
-- de QUALQUER outra loja consultando a view em vez da tabela.
-- security_invoker=true faz a view aplicar a RLS de quem está consultando.
alter view public.vw_caixa_extrato        set (security_invoker = true);
alter view public.vw_custo_produto        set (security_invoker = true);
alter view public.vw_custo_real_estoque   set (security_invoker = true);
alter view public.vw_dre_mensal           set (security_invoker = true);
alter view public.vw_estoque_critico      set (security_invoker = true);
alter view public.vw_lucro_real_produto   set (security_invoker = true);
alter view public.vw_margem_produto_real  set (security_invoker = true);
alter view public.vw_produtos_sem_ficha   set (security_invoker = true);

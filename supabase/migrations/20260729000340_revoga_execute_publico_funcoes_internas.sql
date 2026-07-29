-- O Postgres concede EXECUTE a PUBLIC por padrão em toda função criada. Somado
-- a SECURITY DEFINER, isso deixava 41 funções chamáveis via RPC por QUALQUER
-- um com a chave anon — que vai no bundle do site. Entre elas:
--   fn_creditar_cashback  -> creditar cashback em qualquer conta
--   fn_usar_cashback      -> gastar cashback alheio
--   fn_baixar_estoque     -> zerar o estoque de qualquer loja
--   fn_email_enfileirar   -> disparar e-mail arbitrário pelo domínio da MiseOn
--   fn_lancar_receita_*   -> forjar lançamento financeiro
-- Aqui revogamos o acesso público de tudo que o app NÃO chama pelo cliente.
-- Mapeamento feito a partir das chamadas .rpc() reais em src/ e supabase/.

-- ── 1. Só edge function usa (service_role ignora grants) ─────────────────
revoke execute on function public.fn_email_enfileirar(uuid,text,text,jsonb,uuid,text) from public, anon, authenticated;
revoke execute on function public.fn_email_pedido_payload(uuid)                       from public, anon, authenticated;
revoke execute on function public.fn_email_reservar(integer,uuid)                     from public, anon, authenticated;
revoke execute on function public.fn_email_varrer_carrinhos(integer)                  from public, anon, authenticated;
revoke execute on function public.fn_recalcular_pedido(uuid)                          from public, anon, authenticated;

-- ── 2. Internas: chamadas só por trigger ou por outra função ─────────────
revoke execute on function public.fn_creditar_cashback(uuid)              from public, anon, authenticated;
revoke execute on function public.fn_consumir_lotes_peps(uuid,numeric)    from public, anon, authenticated;
revoke execute on function public.fn_lancar_estorno_pedido(uuid)          from public, anon, authenticated;
revoke execute on function public.fn_lancar_receita_pedido(uuid)          from public, anon, authenticated;
revoke execute on function public.fn_criar_contas_padrao()                from public, anon, authenticated;
revoke execute on function public.fn_registrar_etapa_kds(uuid,text)       from public, anon, authenticated;
revoke execute on function public.fn_proximo_numero(uuid)                 from public, anon, authenticated;
revoke execute on function public.fn_email_do_pedido(pedidos)             from public, anon, authenticated;
revoke execute on function public.fn_email_pode_marketing(uuid,text)      from public, anon, authenticated;
revoke execute on function public.fn_email_descadastrar(uuid)             from public;

-- ── 3. Funções de gatilho: nunca são chamadas diretamente ────────────────
revoke execute on function public.fn_chat_handoff()             from public, anon, authenticated;
revoke execute on function public.fn_insumos_sync_custo_lote()  from public, anon, authenticated;
revoke execute on function public.fn_lancar_custo_estoque()     from public, anon, authenticated;
revoke execute on function public.fn_mov_criar_lote()           from public, anon, authenticated;
revoke execute on function public.fn_mov_custear_baixa()        from public, anon, authenticated;
revoke execute on function public.fn_trg_email_pagamento()      from public, anon, authenticated;
revoke execute on function public.fn_trg_email_pedido_criado()  from public, anon, authenticated;
revoke execute on function public.fn_trg_email_pedido_status()  from public, anon, authenticated;
revoke execute on function public.fn_trg_numero_pedido()        from public, anon, authenticated;
revoke execute on function public.fn_trg_status_pedido()        from public, anon, authenticated;
revoke execute on function public.fn_trg_upsert_cliente()       from public, anon, authenticated;

-- ── 4. Cashback: sai de anon, fica só para usuário logado ────────────────
-- CheckoutDrawer e PDV chamam essas duas, mas ambos exigem sessão do cliente
-- ou do operador. Sem isso, qualquer visitante gastava o saldo alheio.
revoke execute on function public.fn_usar_cashback(uuid,uuid,uuid,numeric)  from public, anon;
revoke execute on function public.fn_quitar_pedido_cashback(uuid)           from public, anon;
grant  execute on function public.fn_usar_cashback(uuid,uuid,uuid,numeric)  to authenticated;
grant  execute on function public.fn_quitar_pedido_cashback(uuid)           to authenticated;

-- ── 5. Baixa de estoque: operação de caixa, nunca do visitante ───────────
-- src/lib/pedidos.ts é importado só pelo PDV, que é tela autenticada.
revoke execute on function public.fn_baixar_estoque(uuid) from public, anon;
grant  execute on function public.fn_baixar_estoque(uuid) to authenticated;

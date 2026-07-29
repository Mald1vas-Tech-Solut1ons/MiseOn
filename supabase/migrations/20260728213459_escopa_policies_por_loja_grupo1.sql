-- Policies FOR ALL com USING(true)/WITH CHECK(true) para PUBLIC.
-- Na prática era RLS desligada: ler, alterar e APAGAR com a chave anon, que
-- vai no bundle do site. Trocadas pelo padrão que o próprio banco já usa nas
-- outras tabelas: fn_meu_acesso(loja_id), que amarra a linha à loja do usuário.

-- balanca_configuracoes
drop policy if exists "Permitir leitura/escrita balanca_configuracoes por loja" on public.balanca_configuracoes;
create policy balanca_configuracoes_por_loja on public.balanca_configuracoes
  for all to authenticated
  using (fn_meu_acesso(loja_id)) with check (fn_meu_acesso(loja_id));

-- chamados_garcom
drop policy if exists "Permitir leitura/escrita chamados_garcom por loja" on public.chamados_garcom;
create policy chamados_garcom_por_loja on public.chamados_garcom
  for all to authenticated
  using (fn_meu_acesso(loja_id)) with check (fn_meu_acesso(loja_id));

-- reposicoes_buffet
drop policy if exists "Permitir leitura/escrita reposicoes_buffet por loja" on public.reposicoes_buffet;
create policy reposicoes_buffet_por_loja on public.reposicoes_buffet
  for all to authenticated
  using (fn_meu_acesso(loja_id)) with check (fn_meu_acesso(loja_id));

-- itens_pedido_opcoes não tem loja_id: sobe por item_id -> itens_pedido ->
-- pedidos.loja_id. A policy pub_cria_opcao (INSERT) fica intacta, senão o
-- checkout público do cardápio para de funcionar.
drop policy if exists adm_ipo on public.itens_pedido_opcoes;
create policy itens_pedido_opcoes_por_loja on public.itens_pedido_opcoes
  for all to authenticated
  using (
    exists (
      select 1 from public.itens_pedido ip
      join public.pedidos p on p.id = ip.pedido_id
      where ip.id = itens_pedido_opcoes.item_id and fn_meu_acesso(p.loja_id)
    )
  );

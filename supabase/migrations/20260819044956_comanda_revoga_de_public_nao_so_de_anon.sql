-- Correção da migration anterior: `revoke ... from anon` não faz nada quando o
-- GRANT real está em PUBLIC — toda função nasce com EXECUTE para PUBLIC, e o
-- anon herda dali. O teste mostrou o anônimo ainda executando a função (voltou
-- a exceção de negócio "Mesa inválida", não erro de permissão).
--
-- Tirar de PUBLIC e devolver só para authenticated (PDV/garçom logado).
-- fn_pedido_mesa_criar chama esta função por dentro e é SECURITY DEFINER, então
-- o pedido por QR do cliente anônimo continua passando — validado por teste.

revoke execute on function fn_comanda_aberta_mesa(uuid, uuid) from public;
revoke execute on function fn_comanda_aberta_mesa(uuid, uuid) from anon;
grant  execute on function fn_comanda_aberta_mesa(uuid, uuid) to authenticated, service_role;

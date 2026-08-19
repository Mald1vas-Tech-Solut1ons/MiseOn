-- A policy `adm_cli` liberava a tabela `clientes` inteira para QUALQUER pessoa
-- vinculada à loja — `fn_meu_acesso` só olha se existe vínculo, não olha papel.
-- Na prática o entregador (que em muitos casos é freelancer, ver migration
-- 20260725050000_entregador_freelancer_km_e_kyc) enxergava nome, telefone e
-- endereço de toda a base de clientes da loja. Confirmado por teste: 11 de 11
-- linhas visíveis para um user_id de papel 'entregador'.
--
-- Quem realmente precisa de `clientes` no produto:
--   · admin    — CRM, cashback, marketing;
--   · operador — PDV (src/components/pdv/CartSidebar.tsx busca cliente na venda);
--   · garcom   — mesmo PDV, o papel tem acesso à tela (src/lib/permissoes.ts).
-- O app do entregador (src/pages/entregador/*) não consulta `clientes` em
-- lugar nenhum — ele lê pedidos, rotas, entregadores, localização e mensagens.
-- Os dados de entrega de que ele precisa (nome, telefone, endereço) já estão
-- na própria linha do pedido, escopada pela policy de `pedidos`.
--
-- A policy `cliente_seu_perfil` (o próprio cliente vendo/editando seu cadastro)
-- continua intacta.

drop policy if exists adm_cli on clientes;

create policy equipe_ve_clientes on clientes
  for all
  using      (fn_tem_papel(loja_id, array['admin','operador','garcom']))
  with check (fn_tem_papel(loja_id, array['admin','operador','garcom']));

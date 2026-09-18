-- `vw_lucro_real_produto` sai da API pública.
--
-- Medido em 18/09/2026, com a chave anônima do próprio bundle, assim que o
-- serviço voltou do bloqueio por cota:
--
--   GET /rest/v1/vw_lucro_real_produto  ->  Content-Range: 0-120/121
--
-- Ou seja: um visitante não logado lia as 121 linhas — os produtos das 8 lojas
-- de uma vez — por uma view cujas colunas são `custo_real`, `receita_real`,
-- `resultado_exercicio`, `lucro_real` e `margem_pct`.
--
-- O que NÃO aconteceu, e importa dizer com precisão: nenhum valor financeiro
-- vazou. Todas as colunas de dinheiro voltam zero para qualquer um, inclusive
-- para o `postgres` — o join liga `lf.referencia_id` (que é um PEDIDO, pelo
-- próprio `referencia_tipo = 'PEDIDO'`) a `p.id` (que é um PRODUTO), e isso
-- nunca casa. A view está quebrada desde que nasceu. O que vazava de verdade
-- era nome e preço, que já são o cardápio público (policy `pub_produtos`).
--
-- Então isto aqui não é conserto de incidente: é fechar uma superfície
-- financeira que estava aberta por descuido e que viraria vazamento de
-- verdade no dia em que o join fosse corrigido ou o ledger mudasse de RLS.
-- É a mesma regra que o `CLAUDE.md` já registra — view de dado sensível
-- pendurada em tabela pública herda o público — e o mesmo tratamento que
-- `vw_margem_produto_real` (a sucessora, com `fn_meu_acesso` embutido) já
-- recebeu: ACL sem `anon`.
--
-- A view NÃO é dropada aqui de propósito. Ela está órfã (nenhum arquivo em
-- `src/` a consulta; só aparece em migrations antigas) e foi sucedida por
-- `vw_margem_produto_real`, mas remover objeto é decisão do dono e fica
-- registrada no backlog em vez de acontecer calada.

REVOKE ALL ON public.vw_lucro_real_produto FROM anon;
REVOKE ALL ON public.vw_lucro_real_produto FROM public;

COMMENT ON VIEW public.vw_lucro_real_produto IS
  'ÓRFÃ E QUEBRADA: o join referencia_id=produto.id nunca casa (referencia_tipo é PEDIDO), então todas as colunas financeiras são sempre zero. Sucedida por vw_margem_produto_real. Fora da API anônima desde 18/09/2026. Candidata a DROP.';

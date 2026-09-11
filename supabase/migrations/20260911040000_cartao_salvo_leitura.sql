-- ============================================================================
-- CARTÃO SALVO — a carteira precisava PODER SER LIDA
--
-- A migração 20260911030000 fechou `cartoes_salvos` para anon/authenticated
-- (correto: a coluna `payment_token` COBRA o cartão) e criou a view
-- `meus_cartoes` com `security_invoker = true`.
--
-- As duas coisas juntas não funcionam. `security_invoker` faz a view ler a
-- tabela com a identidade de QUEM CONSULTA — e essa identidade acabara de
-- perder o SELECT. O resultado seria "permission denied for table
-- cartoes_salvos" em cima do checkout, com o cliente vendo "não foi possível
-- carregar" sem explicação.
--
-- A saída NÃO é abrir a tabela nem transformar a view em security definer:
--   • abrir a tabela exporia o token de cobrança;
--   • view definer some do radar do RLS e vira exceção permanente.
--
-- A saída é dizer exatamente o que pode ser lido:
--   1. GRANT por COLUNA — `payment_token` e `titular_documento` ficam de fora,
--      então nem a view nem uma consulta direta conseguem trazê-los;
--   2. uma policy de SELECT que limita as linhas ao dono.
-- Assim o modelo continua sendo "o navegador nunca vê o token", agora por duas
-- barreiras independentes em vez de uma que se anulava.
-- ============================================================================

-- 1. Quais COLUNAS o cliente pode ler. Ausentes de propósito:
--    payment_token     — cobra o cartão;
--    titular_documento — CPF; a vitrine não precisa dele para exibir a carteira.
grant select (
  id, cliente_id, loja_id, bandeira, ultimos_digitos, titular_nome,
  validade_mes, validade_ano, apelido, ativo, ultimo_uso_em, criado_em
) on public.cartoes_salvos to authenticated;

-- 2. Quais LINHAS. Mesmo critério do delete que já existia: é do dono.
drop policy if exists cartoes_salvos_dono_le on public.cartoes_salvos;
create policy cartoes_salvos_dono_le
  on public.cartoes_salvos for select
  using (
    exists (
      select 1 from public.clientes c
      where c.id = cartoes_salvos.cliente_id
        and c.user_id = auth.uid()
    )
  );

comment on policy cartoes_salvos_dono_le on public.cartoes_salvos is
  'O cliente le os proprios cartoes. O token nao esta no grant de colunas, entao nem esta policy o alcanca.';

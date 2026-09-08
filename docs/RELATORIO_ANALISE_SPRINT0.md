# Relatório de Análise: Estado Atual do Sistema (Sprint 0)

Atendendo ao seu pedido, analisei os arquivos, migrations e o código fonte sem realizar nenhuma alteração. O objetivo foi entender exatamente o que já foi implementado e o que ainda precisa ser consolidado.

## 1. O que JÁ FOI FEITO (Backend / Banco de Dados)

O backend (PostgreSQL) passou por refatorações estruturais massivas muito recentemente (dia 05/09/2026). A base para a consolidação de estoque e PEPS já está implementada no banco!

**Arquivos de Migration Analisados (Ex: `20260905120000_estoque_autoridade_peps.sql`) revelam que:**
- **Consolidação do PEPS**: A trigger e as funções de custeio (`fn_transformar_estoque`, `fn_receber_compra`) já foram corrigidas para usar o método PEPS e a convenção correta de sinais ("positivo entra, negativo sai").
- **RPC Única para Movimentação (`fn_movimentar_estoque`)**: Foi criada uma função transacional que garante que a movimentação e o saldo caminham juntos, eliminando as chamadas soltas que existiam antes.
- **Estornos Seguros**: A função `fn_trg_status_pedido` já devolve o lote recriado com o custo real no caso de cancelamento.
- **Auditoria de Divergência**: A view `vw_divergencia_saldo_lotes` foi criada para detectar diferenças entre saldo físico e lotes.

**Conclusão sobre o Estoque:** A parte do banco de dados (regras invariantes) para o Estoque/PEPS foi muito bem consolidada.

## 2. O Problema Atual: Frontend Exercendo Autoridade Indevida

Apesar do backend ter o motor de PEPS pronto e funcional, **o Frontend ainda está contornando as regras ou agindo de forma não-atômica.**

Analisei como a criação de pedidos é feita hoje em dia em diferentes arquivos:

### `src/lib/pedidos.ts` (`createPedidoPedido`)
- Faz chamadas de `insert` não-atômicas: primeiro insere na tabela `pedidos`, depois um laço `for` insere na tabela `itens_pedido`, e por fim chama a RPC `fn_baixar_estoque`. 
- **Risco:** Se a internet do usuário cair no meio, o pedido é criado sem itens ou o estoque não é baixado, gerando divergência.

### `src/pages/admin/PainelGarcomMobile.tsx` (`lancarItemFracionado`)
- O garçom cria comandas, pedidos e fraciona itens (inserindo diretamente via `supabase.from('pedidos').insert()`).
- **Problema Crítico:** Este fluxo **NÃO chama** a RPC de baixar estoque (`fn_baixar_estoque`). Ou seja, vendas feitas pelo app do garçom estão contornando o PEPS e o inventário!

### `src/pages/admin/PainelBalanca.tsx` e `src/components/pdv/CartSidebar.tsx`
- Também possuem caminhos próprios para inserir pedidos diretamente no banco sem garantia de atomicidade.

## 3. Conclusão e Recomendação para Execução do Sprint 0

O seu diagnóstico estava perfeito: *"múltiplos caminhos de criação de pedido"* e *"código no frontend exercendo autoridade indevida"* são os problemas atuais mais graves para a integridade de dados do produto.

Como o banco já possui a fundação do PEPS corrigida, **o escopo prático do Sprint 0 deve ser exclusivamente:**

1. **Criar a Única Fonte de Verdade para Pedidos:** Desenvolver uma RPC (Stored Procedure) ou Edge Function chamada `create_order` que receba o payload inteiro do carrinho, insira o pedido, os itens e chame a `fn_baixar_estoque` **dentro da mesma transação no banco**.
2. **Refatorar o Frontend:** Substituir os inserts diretos espalhados (`pedidos.ts`, `PainelGarcomMobile.tsx`, `CartSidebar.tsx`, `PainelBalanca.tsx`) pela chamada dessa única função transacional.
3. **Travar a Segurança:** Atualizar o RLS da tabela `pedidos` para impedir que o frontend faça `insert` direto nela, garantindo que ninguém consiga burlar a regra do PEPS no futuro.

Com esse relatório, o cenário real está mapeado e documentado!

# Relatório — Go-live controlado do Sprint 1 (núcleo contábil)

**Data:** 05/09/2026 · **Branch:** `sprint-1-nucleo-integro` · **Status:** banco de produção atualizado e auditado; código commitado localmente, **push/deploy pendente**

---

## 1. O que foi aplicado na produção

Cinco migrations do Sprint 1 + dois hotfixes descobertos pelo próprio smoke, aplicadas pela
Management API e registradas em `supabase_migrations.schema_migrations` (created_by
`claude-code-sprint1-golive`):

| Migration | Assunto |
|---|---|
| `20260905100000` | Receita única no ledger — fim da dupla contagem Pix (S1-A) |
| `20260905110000` | Pedido de mesa via QR volta para a comanda (S1-B) |
| `20260905120000` | Estoque: autoridade única + PEPS de verdade (S1-C) |
| `20260905140000` | Gatilho do CMV espelha a regra "CMV é consumo" (S1-D) |
| `20260905150000` | KDS: etapa com estação opcional (só `COMMENT`) |
| `20260905160000` | **Hotfix 1** — cast `p_tipo::tipo_mov_estoque` na RPC nova (bug 42804) |
| `20260905170000` | **Hotfix 2** — revalida REVOKEs que o `DROP + CREATE` da 100000 derrubou |

O que ficou fora deste go-live: a outra metade do S1-A e o pipeline BAR/COZINHA do KDS são
frontend/Edge — só entram em produção com o push da branch.

## 2. Auditoria do smoke (evidências em `.smoke-golive-s1/`)

Procedimento: scripts numerados executados contra a produção pela Management API
(`run-sql.cjs`), na ordem — exames de diagnóstico (`00-*`), entradas e consumos de estoque
com PEPS (`01`/`02`), venda → cancelamento → receita/estorno no ledger (`03`/`03b`), pedido
de mesa (`04`), limpeza completa dos dados de teste (`05`), view de detecção de divergência
saldo × lotes (`06`) e revisão de segurança read-only de grants (`07`).

**Nenhuma divergência contábil:** CMV nasceu só no consumo (nunca na entrada), transformação
conservou valor, estorno devolveu o lote com o custo original, receita do Pix apareceu uma
única vez, e o caminho real do PostgREST (não só a chamada direta da RPC) foi exercitado.

**Fingerprint da produção idêntico antes/depois do smoke** (a limpeza devolveu o banco ao
estado original): 49 pedidos, 212 movimentações, 32 lançamentos, 5 comandas, 182 insumos,
144 lotes, 46 pagamentos, 13 clientes, 144 contas, 8 lojas.

## 3. Os dois bugs que o smoke pescou (e por que os gates não pegaram)

### 3.1 Hotfix 1 — a RPC nova nasceu quebrada (42804)

`fn_movimentar_estoque` (criada em `20260905120000`) declara `p_tipo TEXT` e o inseria
direto na coluna enum `movimentacoes_estoque.tipo`. Literal (`'SAIDA'`) é tipo desconhecido
e o PostgreSQL resolve como enum; **variável `text` não** — o catálogo não tem cast de
atribuição text → enum, e toda chamada morria com 42804, inclusive pelo caminho real do
PostgREST. Correção: cast explícito no único ponto onde a variável encontra a coluna
(`20260905160000`).

### 3.2 Hotfix 2 — o `DROP + CREATE` derrubou o hardening de grants

A migration `20260905100000` recriou `fn_lancar_receita_pedido` e `fn_lancar_estorno_pedido`
com `DROP + CREATE` — e `DROP` zera privilégios, restaurando o grant default de `PUBLIC`.
As duas voltaram a ser chamáveis pela chave `anon` que vai no bundle do site (a ameaça
nominal do hardening `20260729000340`). As funções de gatilho recriadas pela `120000` **não**
regrediram — `CREATE OR REPLACE` preserva grants. Correção: `20260905170000` re-revoga.

### 3.3 Por que os gates locais não pegaram: o falso-verde

As suítes de integração usavam `describe.runIf(isConfigured)` — sem
`SUPABASE_SERVICE_ROLE_KEY` elas **não falhavam, simplesmente deixavam de existir no
relatório**. Corrigido em `__tests__/integration/gate.ts`:

- configurado: roda de verdade;
- sem credencial local: aparece como `BLOCKED — NOT RUN` (skip explícito, nunca silêncio);
- sem credencial no job de integração do CI (`INTEGRACAO_OBRIGATORIA=1`): BLOCKED vira **falha**.

## 4. Regras de migration que este go-live estabeleceu

1. Recriar função interna = `CREATE OR REPLACE` (preserva grants) **ou** re-revogar no mesmo
   arquivo — `DROP + CREATE` desarma o hardening sem avisar.
2. Variável `text` indo para coluna enum precisa de cast explícito (literal funciona,
   variável não — PG 17.6 não tem cast text → enum no `pg_cast`).
3. A migration versionada pode estar defasada nos dois sentidos em relação à produção — ler
   `pg_get_functiondef` antes de reescrever qualquer função.

## 5. Achados de design (não são bugs)

- Pedido **FINALIZADO** não pode ser cancelado ("já foi encerrado") → o estorno financeiro de
  receita (`fn_lancar_estorno_pedido`) é **inalcançável pelo fluxo real hoje**; devolução
  pós-finalização não existe no produto.

## 6. Estado dos gates após os hotfixes (verificado em 05/09, máquina local)

| Gate | Resultado |
|---|---|
| `npm run typecheck` | ✅ limpo |
| `npm run lint` (`--max-warnings 0`) | ✅ limpo |
| `npm run build` (tsc + vite + prerender 40 páginas + sitemap 37 URLs) | ✅ |
| `npm test` | ✅ 350 passaram, 11 pulados — todos os 5 arquivos de integração como **BLOCKED explícito** |

O CI ainda precisa rodar na branch (o job de integração injeta a service key de um Supabase
local em Docker e agora falha se a suíte não executar).

## 7. Pendências

1. **Push da branch `sprint-1-nucleo-integro`** — a Vercel publica no instante do push;
   empurrar só quando for hora de o resto do Sprint 1 (frontend/Edge) entrar em produção.
2. Observar o primeiro dia de operação real da Natureba com o novo núcleo contábil.
3. Decidir o produto sobre estorno pós-finalização (seção 5).
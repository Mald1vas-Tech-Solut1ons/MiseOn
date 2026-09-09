# MiseOn — laudo de transferência para a Sprint 16

**Data de corte:** 09/09/2026  
**Origem:** Sprint 15C — ciclo recorrente da assinatura  
**Destino:** Sprint 16 — elegibilidade de pagamentos e pedidos do iFood  
**Branch de produção:** `main`  
**Baseline transferida:** `8ee8beff07b31e365d4e2a28df8569697508ecc7`  
**Parecer:** transferência tecnicamente apta, com a Sprint 15C em **PRONTO PARA REVISÃO**, não **ACEITA**. O código está versionado e publicado, e as verificações automatizadas passaram. A homologação controlada do ciclo real/sandbox da Efí e a revisão independente continuam sendo gates explícitos.

## 1. Objeto da transferência

Este laudo entrega à próxima sprint:

- a baseline implantada da assinatura recorrente, incluindo renovação, recusa, aprovação tardia, cancelamento, idempotência e reconciliação;
- as evidências de repositório, CI, frontend, Edge Functions e banco de produção;
- os riscos residuais que não podem ser tratados como resolvidos por inferência;
- a ordem recomendada de execução da Sprint 16;
- critérios objetivos de aceite, recuperação e interrupção segura.

Não fazem parte desta transferência as alterações locais ainda não commitadas de estoque, preparos, KDS e seeds. Elas pertencem a outro incremento em andamento e não devem ser misturadas com a branch/commit desta baseline.

## 2. Estado efetivamente entregue

| Camada | Evidência no corte | Resultado |
|---|---|---|
| Git | `HEAD == origin/main == 8ee8bef` | PASS |
| Implementação 15C | commit `2f853bd` | PASS |
| Checkpoint documental | commit `8ee8bef` | PASS |
| CI principal | run `34407714876`: lint, Deno lint, regressão fiscal, unitários, typecheck, build e integração Supabase | PASS |
| E2E | run `34407714904`: Cypress e cobertura | PASS |
| Testes unitários | 762 aprovados; 28 ignorados por dependência de ambiente | PASS com skips declarados |
| Frontend | deployment Vercel de produção do SHA `8ee8bef`; GET respondeu HTTP 200 | PASS |
| Banco | inbox, RPC atômica e campos de estado da Efí presentes | PASS |
| Webhook | `efi-assinatura-webhook` v31, público por contrato (`verify_jwt=false`) | ACTIVE |
| Cancelamento | `saas-cancelar` v2, protegido (`verify_jwt=true`) | ACTIVE |
| Contratação | `saas-assinar` v56, protegido (`verify_jwt=true`) | ACTIVE |
| Cobrança real nesta entrega | não executada | NOT RUN, intencional |

As invariantes transferidas são:

1. `active` identifica estado da assinatura, não comprova dinheiro recebido.
2. Somente cobrança `paid/settled`, vinculada e com valor contratual exato concede período.
3. O mesmo evento ou a mesma cobrança não pode criar nova fatura, nova extensão ou nova NFS-e.
4. Evento negativo posterior não rebaixa uma cobrança já paga.
5. Cancelamento interrompe recorrência futura e preserva o período já pago.
6. Falha fiscal não autoriza recobrança; a fatura paga permanece recuperável.

## 3. Gates antes de declarar a Sprint 15 aceita

| Ordem | Ação | Dono sugerido | Evidência de conclusão |
|---|---|---|---|
| G1 | Revisar o diff `2f853bd`, a RPC `fn_assinatura_processar_evento_efi`, os privilégios de `service_role` e a UX de cancelamento | Revisor independente | parecer registrado sem P0/P1 aberto |
| G2 | Executar uma assinatura mensal controlada no ambiente autorizado da Efí | Rafael + engenharia | correlação de assinatura, cobrança, fatura, período e evento, sem expor identificadores no documento |
| G3 | Reentregar o mesmo token/evento e confirmar efeito único | QA/engenharia | contagens e período inalterados na repetição |
| G4 | Exercitar recusa, aprovação tardia e cancelamento | QA/engenharia | estados coerentes e período pago preservado |
| G5 | Confirmar NFS-e e e-mail no caminho automático | Fiscal/operação | fatura, nota e recebimento correlacionados; nenhuma segunda cobrança |
| G6 | Tornar a reconciliação da inbox operacional | Infra | monitor/cron autenticado, alerta para `erro` e procedimento de reprocessamento |

Se não houver credencial ou ambiente autorizado para G2–G5, manter 15C como **PRONTO PARA REVISÃO/BLOCKED no gate externo** e começar 16A apenas nos cenários que não movimentam dinheiro.

## 4. Riscos e pendências transferidos

### P0 — tratar antes de qualquer emissão/cobrança de teste adicional

- `teste-relay-fiscal-rps` continua `ACTIVE` v5, embora o handoff anterior o descrevesse como desativado. Confirmar dependência e, com autorização, remover a função temporária. Não reutilizá-la como API de produção.
- Há drift histórico entre migrations locais e remotas. Não executar `supabase db push` até produzir inventário, classificação e reconciliação das versões. Mudanças urgentes devem continuar cirúrgicas, revisadas e comprovadas.

### P1 — fechar durante o início da Sprint 16

- Instrumentar a inbox `assinatura_notificacoes_efi`: idade do item, tentativas, último erro e alerta acionável.
- Registrar runbook de reconciliação e rollback sem apagar eventos, faturas ou evidência financeira.
- Atualizar Actions que ainda dependem de ações Node 20 antes que a compatibilidade forçada deixe de funcionar.
- Corrigir `origin/HEAD` se ainda apontar para `master`; `main` é a baseline efetivamente publicada.

### Trabalho paralelo a preservar

No momento do corte existem mudanças locais não commitadas em estoque, preparos, KDS, i18n, seeds, migrations e na nova Edge Function `preparo-sugerir`. A próxima sessão deve identificar o dono desse trabalho, isolá-lo em commit/branch próprios e jamais descartá-lo, sobrescrevê-lo ou incluí-lo acidentalmente na Sprint 16.

## 5. Próximos passos aprovados

1. Executar G1 e preparar G2–G6 da assinatura.
2. Isolar o trabalho local paralelo antes do primeiro commit da Sprint 16.
3. Abrir **Sprint 16A — elegibilidade de pagamento online**.
4. Só depois do contrato de elegibilidade estar provado, abrir **Sprint 16B — eventos e recuperação do iFood**.
5. Ao fim de cada incremento, registrar versão, ambiente, cenário, resultado, executor, riscos e recuperação em `docs/MISEON_HEAD_OF_ENGINEERING.md`.

## 6. Contrato da Sprint 16A

**Objetivo:** garantir que intenção de pagamento, pendência, análise, recusa ou expiração não produzam venda operacional. Ticket, impressão, som, push, e-mail, receita e preparo somente podem nascer após confirmação elegível do provedor para a loja, compra e valor corretos.

**Escopo inicial:**

- mapear Pix e cartão em todos os canais online até os efeitos em pedido, painel, KDS, estoque, financeiro e e-mail;
- estabelecer uma autoridade server-side para elegibilidade e transição idempotente;
- validar tenant, identificador da compra, valor, moeda, recebedor e estado consultado no provedor;
- definir tratamento explícito de pagamento parcial, confirmação tardia e intenção expirada;
- correlacionar intenção, evento externo, pagamento e pedido para auditoria e retomada;
- impedir payload adulterado e repetição com efeito duplo.

**Fora do escopo:** reformular todo o financeiro, mudar a política de pós-pagamento do salão sem decisão do PO, criar campanha de recuperação comercial ou trocar provedor de pagamento.

**Pontos de entrada mínimos:**

- `supabase/functions/pix-criar-cobranca/index.ts`;
- `supabase/functions/pix-webhook/index.ts` e `_shared/pedido-pix.ts`;
- `supabase/functions/cartao-pagar/index.ts`;
- migrations `20260908140000` a `20260908170000` e `20260909160006`;
- `src/pages/admin/PainelPedidos.tsx`, `src/lib/pedidoOperacional.ts` e fila de e-mails;
- `__tests__/pedido-pix.test.ts`, testes de pedido operacional e testes SQL de e-mail.

**Cenários obrigatórios:**

1. Pix pendente e cartão em análise permanecem invisíveis à operação.
2. Recusa e expiração não criam ticket, alerta, preparo, receita ou baixa de estoque.
3. Aprovação integral cria exatamente uma operação.
4. Evento duplicado ou fora de ordem não duplica efeito.
5. Valor, loja ou compra divergentes bloqueiam a transição e geram evidência recuperável.
6. Pagamento parcial permanece conciliável, sem ser marcado como venda paga.
7. Aprovação tardia após expiração segue política explícita: conciliar/reembolsar ou reativar, nunca ocultar.
8. Queda entre consulta do provedor e persistência pode ser retomada sem nova cobrança.

**Critério de aceite 16A:** zero efeito operacional antes da elegibilidade; uma aprovação válida produz uma única venda correlacionada; qualquer recebimento tardio ou divergente aparece numa fila recuperável; testes de falha não movimentam dinheiro real.

## 7. Contrato da Sprint 16B

**Objetivo:** tornar a integração iFood recuperável por evento, sem perda, duplicidade ou ACK indevido.

**Escopo inicial:** `ifood-auth`, `ifood-polling`, `ifood-webhook`, status, cancelamento/disputa e correlação com catálogo/pedido. Para cada item do lote, persistir e confirmar o resultado antes do ACK; HTTP 200 do lote não comprova sucesso individual.

**Cenários obrigatórios:** evento duplicado, fora de ordem, lote parcialmente inválido, interrupção após persistência, falha antes do ACK, reprocessamento, cancelamento, DELIVERY, retirada e pagamento na entrega conforme política oficial.

**Critério de aceite 16B:** pedido e evento correlacionados nos dois sistemas; nenhuma perda silenciosa; nenhuma duplicação; um único controlador por canal durante a migração; fila pendente recuperável sem limpar evento indiscriminadamente.

**Dependência externa:** credenciais e loja iFood autorizadas, catálogo piloto e política do pagamento na entrega. Sem isso, testes de contrato podem avançar, mas a jornada real permanece **BLOCKED** e não pode ser declarada homologada.

## 8. Plano de recuperação

- Pagamentos: pausar novas intenções no canal afetado, preservar todos os eventos e consultar o provedor antes de qualquer correção manual. Nunca marcar como pago localmente para contornar falha.
- Pedidos: impedir novos efeitos, manter registros pendentes e reconciliar antes de reentregar alertas, e-mails ou tickets.
- iFood: pausar polling/webhook do controlador afetado sem apagar a fila; retomar a partir dos eventos persistidos e só então enviar ACK.
- Assinatura: reprocessar inbox autenticada; falha fiscal não recobra; cancelamento não remove período pago.
- Banco: migration aditiva; rollback destrutivo somente depois de exportar inbox, eventos, faturas e estados financeiros.

## 9. Prompt de partida para a próxima sessão

> Assuma a Sprint 16 do MiseOn a partir da baseline de produção `8ee8bef`. Leia integralmente `docs/LAUDO-TRANSFERENCIA-SPRINT16.md`, `docs/HANDOFF-SONNET-EXECUCAO-SPRINTS.md` e o checkpoint mais recente de `docs/MISEON_HEAD_OF_ENGINEERING.md`. Preserve e isole as mudanças locais de estoque/preparos; elas não pertencem à Sprint 16. Confirme primeiro os gates e riscos transferidos, sem executar cobrança real. Inicie pela 16A: reproduza cada estado Pix/cartão e prove que nenhum ticket, som, impressão, e-mail, receita, estoque ou preparo ocorre antes de confirmação elegível. Use uma autoridade server-side, idempotência, correlação e recuperação. Registre causa comprovada, testes, publicação, riscos e rollback. Não marque 15C ou 16 como ACEITA sem revisão independente e homologação externa aplicável.

## 10. Termo de encerramento

A baseline `8ee8bef` está apta a ser recebida pela próxima sprint porque foi versionada, publicada e validada proporcionalmente ao risco sem movimentar dinheiro real. A transferência não elimina os gates externos nem autoriza ações destrutivas. O próximo responsável recebe um estado reproduzível, riscos nomeados e critérios objetivos para prosseguir ou interromper com segurança.

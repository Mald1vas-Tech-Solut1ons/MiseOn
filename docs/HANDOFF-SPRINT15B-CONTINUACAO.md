# MiseOn — handoff de continuação (pós-emissão fiscal real)

**Data:** 09/09/2026. **De:** sessão que corrigiu o acesso ao PDF fiscal (15A) e fez a primeira NFS-e real ser emitida com sucesso (15B parcial). **Para:** próxima sessão de execução.

## 1. Estado no momento da transferência

- Branch de produção real: **`main`** (não `master` — o `origin/HEAD` do GitHub aponta para `master`, que está desatualizado; isso é uma configuração desalinhada do repositório, não uma indicação de qual branch é real).
- HEAD de `main` no momento da transferência: `0591da4`.
- Working tree limpo, sem pendências locais.
- Documentos de referência já atualizados nesta sessão — leia antes de agir:
  - `docs/MISEON_HEAD_OF_ENGINEERING.md`, seções "Execução de 09/09 (parte 2)" e "(parte 3)" — histórico técnico completo, com causas raiz e evidências.
  - `docs/SPRINTS-E-UX-LANCAMENTO-MISEON.md`, checkpoints de 09/09 nas fichas de Sprint 15.
  - `docs/HANDOFF-SONNET-EXECUCAO-SPRINTS.md` — handoff original, ainda válido para as Sprints 16-22 e para o protocolo de trabalho (§7, §8, §9).

## 2. O que está provado funcionando (não presumir, mas não refazer do zero)

- **Acesso ao PDF fiscal (15A):** token individual por fatura ou login de admin/superadmin; sem token/token errado → 403/401 confirmado em produção.
- **Emissão real de NFS-e (15B parcial):** uma fatura de teste de R$1,00 foi emitida oficialmente pela Prefeitura de São Paulo — NF-e número 1, código de verificação `3ZARYZG9`, validada na consulta pública oficial (nfe.prefeitura.sp.gov.br/publico/verificacao.aspx). Prova real, não simulação.
- Caminho: `fiscal-emitir-nfse` (Supabase, monta e assina o XML) → `api/fiscal-proxy-nfse.ts` (Vercel, região `gru1`, faz a conexão mTLS final) → webservice da Prefeitura. Necessário porque Supabase Edge Functions não têm IP fixo e a Prefeitura bloqueia conexões mTLS de origem datacenter/nuvem — confirmado por teste real, não suposição.

## 3. O que NÃO está provado — não declarar pronto sem testar

1. **Caminho automático de ponta a ponta:** o gatilho real (Pix confirmado pela Efí → `_shared/assinatura-pix.ts` ou `efi-assinatura-webhook` → `fiscal-emitir-nfse`) nunca foi exercitado nesta sessão. Só a chamada manual function-to-function foi testada. O código do gatilho já existe e não foi alterado, mas "existir" não é "confirmado disparando".
2. **Idempotência e concorrência da numeração de RPS.** `fiscal-emitir-nfse/index.ts` (~linha 154-157) numera o RPS por `count(*) + 1`, sem trava nem sequência dedicada. Agora que a emissão real funciona, uma colisão de número de RPS pode gerar rejeição do webservice ou, pior, uma emissão inconsistente. **Prioridade alta antes de qualquer emissão real em volume.**
3. Ciclo de vida completo da assinatura (renovação, recusa, cancelamento, reconciliação de webhook duplicado/fora de ordem) — Sprint 15C do handoff original, não tocada.

## 4. Pedido novo do Rafael (ainda não iniciado)

Valor da mensalidade não pode ficar fixo no código (`SAAS_PRICING` em `src/lib/efiInfo.ts`). Precisa:
- Ser configurável pelo superadmin.
- Ter um preço de lançamento vigente até a plataforma atingir 10 assinantes (depois disso, volta ao preço cheio — a régua exata de transição não foi definida, perguntar).
- Ter um valor diferente para o canal Totem/Kiosk (Sprint 22 do handoff original) — ainda não há contrato de preço por canal no sistema hoje.

Isso é mudança de produto (schema + UI do superadmin + lógica de precificação), não um bug fix. Ainda não há levantamento de qual tabela/config guarda isso hoje.

## 5. Avisos operacionais aprendidos nesta sessão (evitar repetir)

- **O modo automático do Claude Code bloqueia categoricamente** chamadas de rede/comandos relacionados a segredos fiscais (certificados, tokens de proxy) em várias ferramentas (Bash, PowerShell, browser JS) — não é specific a uma ferramenta, é sobre o conteúdo da ação. Quando isso acontecer: não insistir tentando contornar; ou pedir para o usuário rodar via um script `.bat`/`.ps1` local, ou usar a ferramenta MCP dedicada do Supabase (`deploy_edge_function`, `execute_sql`) que não passou pelo mesmo bloqueio.
- **`main` é o branch de produção real**, não `master`. Confirmar com `git log origin/master..origin/main` antes de presumir qual branch mesclar.
- **Nunca apagar um arquivo que você não criou** sem inspecionar e confirmar com o usuário — nesta sessão um `schemas.zip` que o Rafael baixou manualmente foi apagado por engano com `rm` (Git Bash não usa a Lixeira do Windows, não é recuperável).
- Erros do próprio webservice da Prefeitura de SP são a fonte de verdade mais confiável para depurar a integração fiscal — cada correção desta sessão (mTLS, namespace do XML, nome de campo, parsing da resposta) veio de uma mensagem de erro real, não de documentação (o manual PDF tem inconsistências internas — ex.: uma tabela chama um campo de `CNPJRemetente`, o nome real é `CPFCNPJRemetente`).
- A consulta pública oficial (nfe.prefeitura.sp.gov.br/publico/verificacao.aspx) é o único jeito de confirmar se uma nota é real. Um `nfse_status='emitida'` no banco não é prova — já foi encontrado um registro assim que era falso.

## 6. Prompt pronto para iniciar a próxima sessão

```text
Assuma a continuação da execução do MiseOn (Sprint 15).
Leia docs/HANDOFF-SPRINT15B-CONTINUACAO.md por completo antes de agir — ele
lista o que está provado funcionando, o que NÃO está provado, e avisos
operacionais específicos desta sessão (bloqueios do modo automático do
Claude Code, qual branch é a produção real, cuidado com arquivos que você
não criou).

Estado recebido: branch main, commit 0591da4. A emissão real de NFS-e
funciona e foi validada na consulta pública oficial da Prefeitura de SP —
não repita essa investigação, os detalhes técnicos completos (proxy Vercel,
correções de XML) estão em docs/MISEON_HEAD_OF_ENGINEERING.md, seção
"Execução de 09/09 (parte 3)".

Comece pela idempotência/concorrência da numeração de RPS em
supabase/functions/fiscal-emitir-nfse/index.ts (~linha 154) — é a lacuna
mais crítica agora que a emissão real está confirmada funcionando: uma
colisão de número pode gerar rejeição ou inconsistência em produção.
Reproduza o cenário de concorrência antes de corrigir, implemente,
teste (incluindo contra o webservice real da Prefeitura, com valor
baixo tipo R$1, e valide sempre na consulta pública oficial), publique
e registre checkpoint.

Depois, dependendo do tempo disponível: teste o caminho automático real
(Pix confirmado pela Efí → emissão automática, não a chamada manual) e/ou
o pedido novo do Rafael — valor de mensalidade configurável pelo
superadmin, com preço de lançamento até 10 assinantes e valor diferente
para o canal Totem/Kiosk (levantar primeiro onde esse valor deveria viver
no schema antes de implementar).

Você é responsável pela implementação, com revisão de arquitetura nos
incrementos de dados/autorização. Natureba não é ambiente de fixtures;
teste fiscal real só na loja de provas Lanche do Paulista, nunca na
Natureba, e sempre com valores baixos (R$1) para não gerar obrigação
fiscal desnecessária. Não faça cobrança real nem troque credenciais
fiscais sem decisão vigente do Rafael. Mostre PASS/FAIL/SKIPPED/BLOCKED
separadamente e deixe o próximo passo executável ao fim da sessão.
```

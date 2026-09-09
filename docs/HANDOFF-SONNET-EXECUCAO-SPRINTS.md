# MiseOn — transferência de execução para Sonnet

**Data:** 09/09/2026. **Destinatário:** Sonnet, responsável pela implementação. **PO:** Rafael. **Objetivo:** colocar a N de Natureba em operação com segurança e melhorar sua rotina em relação ao Anota.ai; depois liberar as expansões por evidência. Este handoff transfere trabalho de engenharia, não apenas a redação de outro plano.

## 1. Como assumir

1. Leia este documento e confira `git status`, branch, HEAD e alterações posteriores. Preserve trabalho existente. A referência entregue é o commit `4f2380c`, na branch `codex/natureba-fiscal-e-confirmacao`; não faça reset para essa referência se houver trabalho mais novo.
2. Leia as seções “Execução de 09/09” de `docs/MISEON_HEAD_OF_ENGINEERING.md` e a ficha da sprint em `docs/SPRINTS-E-UX-LANCAMENTO-MISEON.md`. Consulte o plano técnico apenas para o fluxo que vai alterar.
3. Reconcilie o trecho relevante com produção: migrations, definições efetivas das funções/triggers, grants e versão da Edge Function. Commit, deploy e homologação são fatos distintos.
4. Abra a primeira história executável da Sprint 15 descrita no §5. Declare o resultado, os arquivos e os testes. Reproduza o problema, implemente e valide um incremento utilizável.
5. Ao terminar cada incremento, salve evidência, commit e próximo passo. Se uma dependência externa impedir uma prova, registre o bloqueio específico e avance no trabalho independente indicado no §4.

**Entrega esperada do Sonnet:** código, migrations quando necessárias, telas operáveis, testes, revisão e evidência de comportamento. Não encerrar a execução apenas com diagnóstico, novo cronograma ou lista de sugestões.

### Documentos de referência e precedência

| Material | Como usar |
|---|---|
| Instruções atuais de Rafael | Escopo e decisões de negócio; prevalecem sobre recomendações antigas |
| Este handoff | Ponto de retomada e sequência de implementação |
| `docs/SPRINTS-E-UX-LANCAMENTO-MISEON.md` | Fichas das sprints 15–22, UX, DoR/DoD e critérios de liberação |
| `docs/PLANO-LANCAMENTO-NATUREBA-KIOSK.md` | Backlog com IDs, achados, contratos de aceite e migração Anota.ai |
| `docs/PLANO-COMERCIAL-FEATURES-SEO.md` | Oferta, famílias de funcionalidades e arquitetura de páginas |
| `docs/MISEON_HEAD_OF_ENGINEERING.md` | Decisões de engenharia, histórico e últimas provas |
| `docs/AGENTES.md` | Papéis, contrato de tarefa e revisão independente; contém orientações históricas que precisam de contexto |
| `output/documents/Plano de execucao MiseOn.docx` | Versão de 17 páginas para leitura da equipe; o Markdown é a fonte editável |

Achados dos planos foram escritos antes das últimas correções. Um trecho antigo dizendo “endereço fictício” ou “gatilho sem guarda” não invalida automaticamente o registro posterior de correção. Em dúvida, verificar a implementação e registrar a diferença.

O manual antigo reserva SQL a um modelo chamado Opus e restringe Sonnet a frontend/functions. Rafael agora designou Sonnet para aplicar as sprints. Sonnet assume a implementação dos incrementos, incluindo a preparação técnica de SQL necessário, mantendo revisão de arquitetura para alterações de dados e autorização. Não travar trabalho por uma marca de modelo indisponível; não dispensar a revisão independente nem inventar uma aprovação.

## 2. Produto e cliente: fatos que devem orientar cada decisão

**N de Natureba:** baguetes de 15 e 30 cm, marmitex, bebidas e salgados fritos/assados. Canais: salão com garçom, balcão, delivery próprio, retirada online e iFood. Precisa de crédito/Pix e identificação clara para consumidor e motoboy. Atualmente utiliza Anota.ai. Não foi informado que ela opera rodízio no primeiro dia.

Separar no domínio e na interface: canal de entrada, forma de cobrança, mesa/comanda/participante, preparo por item/estação e destino de entrega. Vários canais podem funcionar simultaneamente na mesma loja.

Exemplos obrigatórios: duas baguetes com montagens diferentes; bebida com gelo/limão enviada ao Bar; produto pronto que não precisa de cozinha; salgado preparado sob demanda; pedido com itens em estações distintas. Ponto de carne é modificador do item, não uma etapa obrigatória para bebida. Não presumir que baguete de 30 cm consome exatamente o dobro da de 15 cm: usar ficha validada.

**Ainda a obter:** cardápio/preços/fichas reais e regras de montagem, pico e data da virada, funções efetivamente usadas no Anota.ai, responsáveis nominais, TV/rede e contrato técnico/equipamento Bravus. Obter essas informações cedo, agrupadas por responsável, enquanto a engenharia avança.

**Políticas não decididas:** preservar pagamento no fechamento do salão até orientação diferente; pagamento na entrega do iFood exige tratamento pelo contrato e dados do canal. Não classificar automaticamente esse pedido como abandono nem como pagamento liquidado. Não alterar preços, recebedor financeiro, tarifas de rodízio ou contratos por inferência.

## 3. Estado recebido: não refazer, não superestimar

| Item | Estado na transferência | Ação de Sonnet |
|---|---|---|
| Cadastro do emissor | Conferido com contrato social privado; já estava correto | Preservar; não copiar dados pessoais ou documentos para o repositório público |
| Resumo PDF fiscal | `fiscal-pdf-nfse` v5 publicada; endereço/razão social vêm do cadastro; removidos dados inventados | Preservar testes; fechar documento oficial, acesso e histórico |
| Prova do PDF publicado | PDF de fatura existente baixado e comparado com contrato; campos conferem | Evidência de apresentação, não certificado de autenticidade da NFS-e |
| Fila de confirmação | Migration `20260909160006_email_pedido_somente_apos_entrada_operacional` aplicada | Verificar caminhos restantes; não reintroduzir confirmação no INSERT de checkout pendente |
| Regex de e-mail | Divergência de produção corrigida; escapes duplicados rejeitavam e-mails válidos | Não colar SQL com novo escape de barras; verificar a função efetiva |
| Prova SQL | `supabase/tests/email-pedido-operacional.sql` passou na loja de testes com rollback interno | Reexecutar após alterações pertinentes; não executar fixtures na Natureba |
| Alertas no frontend | Cancelamento/estados finais deixam de soar como pedido novo; commit local | Ainda requer publicação e verificação do frontend |
| Testes locais | TypeScript PASS; Vitest 377 PASS / 14 SKIPPED; lint dos alterados PASS; handler fiscal Deno PASS | Base histórica, não resultado garantido do próximo commit |
| CI fiscal | Comando de teste Deno incluído no commit | Ainda precisa rodar no CI remoto após publicação do código |
| Assinatura completa | Não homologada nesta execução | Cobrança, acesso, renovação, falhas, nota e recebimento continuam abertos |
| iFood / montagem / KDS | Base existente; jornadas não homologadas para Natureba | Reproduzir e implementar incrementos das sprints 16/18 |
| Cast / Kiosk | Não homologados; Kiosk inspecionado é simulador | Provar compatibilidade e substituir o caminho de demonstração antes da oferta operacional |
| Git e produção | Commit local `4f2380c`; sem push dessa entrega; banco e função fiscal foram publicados separadamente | Conferir diferenças antes de qualquer release; não fazer deploy em massa |

### Riscos prioritários a levar para a execução

- O PDF é **resumo auxiliar**, com cadastro atual. Ainda faltam snapshot histórico do prestador, acesso protegido ao link legado e documento oficial consultável. Não renomear o resumo para “nota válida” para fechar a tarefa.
- Há registros fiscais em erro/processamento a reconciliar. A consulta oficial da Prefeitura não carregou na sessão anterior. Não reemitir nem cobrar novamente para obter uma demonstração.
- Revisar autenticação efetiva, idempotência e numeração de RPS no emissor. O código local utiliza contagem de notas para propor número: provar concorrência, retry e tratamento de resultado ambíguo antes de homologar.
- O histórico registra uso temporário de recebedor pessoal para cartão, devido a limite da conta PJ, e diferença entre código local/publicado de `cartao-pagar`. Revalidar o estado atual em fonte privada; não pressupor conta correta a partir de OAuth ou pagamento aprovado. Não trocar recebedor/secrets sem decisão vigente do PO.
- A correção de e-mail não prova que toda transição de pedido ou todo canal está protegido. Testar as RPCs, webhooks, atualização de status, impressão, push, KDS e receita, incluindo tentativas de avanço sem pagamento integral.
- Advisors apresentaram apontamentos preexistentes de segurança, inclusive views. Não declarar auditoria global limpa; revisar os objetos envolvidos e impedir alertas novos introduzidos pelo incremento.

## 4. Sequência de execução e dependências

Usar os números existentes como objetivos de sprint. Cadência proposta: uma semana, fatiada conforme capacidade real. Não prometer oito sprints completas em oito semanas. Uma história principal ativa por executor; tarefas de descoberta e revisão podem acompanhar o incremento.

| Ordem | Incremento utilizável | Dependência para concluir |
|---|---|---|
| 15A | Documento fiscal correto, histórico e acesso autorizado | Fonte fiscal e autorização reconciliadas |
| 15B | Emissão e recuperação sem duplicidade | Contrato de idempotência/RPS e ambiente de teste |
| 15C | Assinatura, acesso e entrega fiscal comprovados | 15A/B, recebedor e contratação vigentes |
| 16A | Pedido online e efeitos somente após confirmação elegível | Autoridade de pagamento e validação de valor/loja |
| 16B | iFood recuperável por evento e fluxo completo | Acesso autorizado e catálogo de prova |
| 17A/B | Conferência e primeira carga/consumo conciliados | Fixtures fiscais, regras de unidade e fichas |
| 18A/B/C | Montagem validada, rodadas completas e UX por estação | Autoridades de preço/estoque e modelo de ticket |
| 19A/B | Ensaio, migração e primeiro turno assistido | Marcos de assinatura, pedidos, estoque e KDS aceitos |
| 20A/B | Cast funcional e recuperável em TV compatível | Receiver, navegador, rede e equipamento reais |
| 21A/B | Rodízio misto com cobrança/consumo por participante | Política do pacote + 17/18 comprovados |
| 22A/B/C | Kiosk com compra e recuperação reais | Contrato Bravus + pagamentos/pedidos/KDS estáveis |

**Trabalho que começa cedo:** inventário Anota.ai, coleta do cardápio Natureba, contrato Bravus, matriz de TV e reconciliação comercial C01. Não deixar descoberta de hardware para o último sprint.

**Se um gate externo bloquear:** manter o item como BLOCKED, com dono e condição objetiva de desbloqueio. Exemplo: Prefeitura indisponível bloqueia a consulta oficial, mas não impede implementar acesso protegido, testes de idempotência ou 16A. Sem credencial iFood, concluir testes de contrato/recuperação e avançar 17/18; o teste real continua pendente. Sem hardware, produzir adaptador e estados de UX, sem declarar Cast/Kiosk homologados.

**Gate de lançamento Natureba:** 15–19 e C01 aplicável. Rodízio, Cast e Kiosk são marcos próprios; só passam a bloquear essa virada se forem formalmente incluídos no primeiro dia. A prioridade operacional da Natureba deve permanecer visível em todo Planning.

## 5. Primeira missão: Sprint 15A

**Papel:** engenheiro de produto responsável pelo fluxo fiscal da assinatura. **Resultado:** assinante acessa apenas o documento permitido; os dados históricos da emissão são preservados e distinguíveis do cadastro atual.

**Arquivos de entrada:**

- `supabase/functions/fiscal-pdf-nfse/index.ts`, `dados.ts`, `handler_test.ts`;
- `supabase/functions/fiscal-emitir-nfse/index.ts` e `_shared/sp-nfse-webservice.ts`;
- `supabase/functions/send-transactional-email/` e template `nota-fiscal-assinatura`;
- `src/pages/admin/Assinatura.tsx`, `src/pages/superadmin/Tenants.tsx`;
- schema/migrations de `faturas_assinatura` e `configuracoes_fiscais_plataforma`;
- `__tests__/nfse-dados.test.ts`, `supabase/config.toml` e CI relevante.

Ampliar o recorte apenas quando uma dependência concreta exigir; registrar a razão. Não fazer revisão de todo o ERP antes da primeira alteração.

### Passos de implementação

1. Levantar como o assinante recebe/abre o documento e quais dados o emissor realmente persiste. Conferir configuração de autenticação publicada e consumidor dos links existentes. Identificar a migração necessária, se houver.
2. Definir o contrato de acesso: usuário autorizado e/ou token individual restrito ao documento. Cobrir expiração/revogação e evitar expor dados de outro tenant. Um UUID de fatura conhecido não deve conceder acesso irrestrito. Planejar compatibilidade dos links já enviados sem manter acesso indevido como solução final.
3. Definir snapshot na emissão, com origem e campos efetivamente conhecidos. Para registros antigos sem snapshot, reconciliar com fonte oficial quando disponível ou identificar a limitação; não preencher historicamente com cadastro atual fingindo que era o original.
4. Implementar a menor alteração completa de servidor + cliente/e-mail. Separar documento autorizado, resumo e emissão pendente. Se a consulta oficial estiver indisponível, explicar o estado e permitir retomada.
5. Testar e preparar release compatível. Mudança de link exige validar o caminho recebido no e-mail, além do endpoint isolado. Não habilitar cobrança ou emissão real para testar apresentação.

### Aceite de 15A

- Usuário de outra loja e portador de referência inválida não acessam o documento; requisição anônima segue o contrato seguro explicitado.
- Assinante autorizado abre o documento pelo caminho entregue; estados de token inválido/expirado ou emissão pendente são compreensíveis.
- Alterar cadastro atual não reescreve dados de uma emissão com snapshot; registros históricos incompletos não ganham fatos inventados.
- Nota de teste, cancelada ou com autorização incompleta não aparece como documento válido disponível.
- Endpoint, e-mail, UI e banco usam o mesmo vínculo fatura/documento; nenhuma chave administrativa chega ao cliente.
- Evidência de apresentação, de autorização oficial e de recebimento são registradas separadamente. O restante da Sprint 15 continua aberto até 15B/C.

**Próximo incremento após 15A:** 15B. Caso a fonte oficial bloqueie somente a prova externa, concluir as alterações e revisões possíveis e iniciar 16A com checkpoint explícito; não encerrar a sessão apenas para esperar.

## 6. Contratos das demais sprints

### Sprint 15B/C — assinatura de ponta a ponta

Executar por ordem: autenticação/autorização e elegibilidade da fatura → número de RPS e idempotência → reconciliação após timeout → contratação crédito/Pix → concessão/período de acesso → renovação/recusa/cancelamento → fila/envio/recebimento fiscal. Conferir preço, parcelas e recebedor com a oferta vigente. Reusar `saas-assinar`, `saas-pix`, `efi-assinatura-webhook` e os adaptadores existentes.

**Prova:** webhook duplicado/fora de ordem não duplica cobrança, fatura, nota nem extensão; queda entre autorização e persistência é reconciliável; falha fiscal não exige recobrança; nota consultada corresponde à fatura e o assinante a recebe. SMTP aceito não significa caixa de entrada confirmada. Testes de falha não devem gerar cobranças reais.

### Sprint 16 — elegibilidade, abandono e iFood

**16A:** mapear entrada e efeitos de Pix/cartão por canal. Reproduzir pendente, recusado, expirado, aprovação integral, pagamento parcial e aprovação tardia. Garantir que cadastro de intenção não apareça como venda/preparo; preservar a política de salão. Conferir payload adulterado, valor, tenant, autoridade do provedor e retry. Publicar a correção local do alerta com a versão correta do frontend.

**16B:** rastrear `ifood-auth`, `ifood-polling`, `ifood-webhook`, catálogo, status e cancelamento/disputa. Confirmar persistência e resultado de cada evento antes do ACK; HTTP 200 de um lote não comprova sucesso de todos. Testar duplicados, fora de ordem, lote parcial e recuperação de interrupção, depois a jornada no ambiente autorizado do canal.

**Aceite:** zero ticket/impressão/som/push/e-mail de pedido antes da elegibilidade online; aprovação produz uma operação; abandono não esconde recebimento tardio; iFood correlacionado nos dois sistemas, sem perda de evento ou dois controladores durante a migração. Recuperação comercial de carrinho é independente e revalida conversão/pagamento.

### Sprint 17 — estoque e notas de entrada

**17A:** reproduzir a saída de conferência OCR/XML e sua gravação. Fazer `ModalImportarNFCe` mostrar linha/campo/motivo e impedir efetivação inconsistente, inclusive por chamada direta ao servidor. Dados estruturados da nota prevalecem sobre sugestão de IA.

**17B:** provar entrada → unidade/conversão → lote → consumo → PEPS → CMV. Cobrir KG/UN/CX/PC/LT, frações, embalagem, descontos, adicionais e produção em lote. Reimportação e cancelamento precisam preservar rastro e efeito único.

**Aceite:** 20 KG × R$ 18,90 = R$ 378,00 entra como 20 KG; 10 CX com fator validado 12 entra como 120 UN. Quantidade não vira valor. Saldo, lotes e custo reconciliados com carga não vazia. Não reescrever PEPS antes de seguir todos os triggers; não ajustar saldo diretamente para fazer teste passar.

### Sprint 18 — montagem, rodadas e KDS

**18A:** reproduzir a jornada de `PainelGarcomMobile` até itens, opções, despacho e `KDSEstacao`, autenticando um usuário exclusivamente garçom. Provar três itens na mesma estação e nova rodada após ticket concluído. Hipóteses: despacho antes das opções, conflito por pedido/estação e autorização de papel. Registrar causa comprovada antes de corrigir.

**18B:** convergir validação de produto/opção, tenant, disponibilidade, mínimos/máximos, duplicidade permitida e preço no servidor. Testar os dois tamanhos de baguete e marmitex com combinações diferentes. Identidade de item/rodada e estado precisam impedir perda ou repetição; concatenação cega de JSON não é uma solução aceitável.

**18C:** entregar UX de lançamento/revisão/envio e filas de montagem, Bar, forno e fritura com workflows próprios. Produto pronto e produção em lote seguem seus contratos. Mostrar opções no cartão, contexto mesa/senha/rodada e ação principal por estado; preservar tickets ativos ao editar workflow.

**Aceite:** todos os itens/opções chegam uma vez ao destino correto; nova rodada não some nem reabre trabalho concluído silenciosamente; duas montagens distintas não se fundem; preço/consumo conferem; erro/reconexão não perde seleção nem duplica pedido. Testar várias estações simultâneas e, se contratado, passagem do mesmo item por estações sequenciais.

### Sprint 19 — implantação Natureba e substituição Anota.ai

**19A:** inventariar funções usadas no sistema atual; obter carga autorizada e conferir catálogo, tamanhos, opções, preços por canal, fichas, horários, entrega, usuários e estações. Verificar uso real de WhatsApp antes de retirar dependências. API/exportação Anota.ai não é presumida.

**19B:** ensaiar cada canal e fechamento com operador; separar senhas de balcão, retirada online e motoboy. Preservar `tipo_pedido` e identificação iFood: DELIVERY não vira RETIRADA apenas para aparecer na TV. Validar `PainelTV` e configuração existente antes de criar fila paralela.

**Gate:** zero P0 dos fluxos contratados; testes críticos executados; tarefas operacionais aprovadas; carga conferida; versão e recuperação demonstradas. PO/loja definem janela e responsável único por entrada/status de cada canal. Pedidos antigos encerram na origem ou por procedimento reconciliado. Primeiro turno assistido e fechamento aprovado; acompanhamento dos três primeiros dias acordado. Não cancelar Anota.ai nem retirar o acesso histórico unilateralmente.

### Sprint 20 — Cast

**20A:** confirmar hardware/navegador/rede e documentar prova com Google Cast Web Sender + Custom Web Receiver. Conferir documentação vigente antes de implementar. Pareamento por URL pode servir de alternativa, mas não conta como Cast entregue.

**20B:** integrar ação Transmitir, escolha de tela/conteúdo e credencial limitada ao display. Testar revogação, troca de controlador, celular bloqueado, perda de rede e reinício da TV. TV pública não recebe sessão administrativa nem detalhes privados do KDS.

**Gate:** demonstração em equipamento compatível, estabilidade por turno e matriz observada. Mesmo Wi-Fi não basta; compatibilidade e suporte de navegador não devem ser anunciados por inferência.

### Sprint 21 — rodízio e operação mista

**21A:** obter política de pacote, tarifas, participantes, vigência, extras, serviço, cancelamento e transferência. Implementar adesão contextual com histórico.

**21B:** autoridade de cálculo aplica cobertura ao participante e ao momento correto; item incluído não cobra novamente, mas consome estoque e gera CMV/preparo aplicáveis. Integrar lançamento, conta e divisão de pagamento.

**Gate:** dois participantes no rodízio e outro no quilo, com itens avulsos e bebidas no mesmo atendimento; cobertura não vaza para não aderentes. Preço futuro não modifica conta histórica. Não zerar preço global do produto. Ilhas de serviço/preparo podem operar em paralelo com salão/delivery.

### Sprint 22 — Kiosk Bravus

**22A:** consolidar SKU, SO, drivers, impressora, pinpad, provedor/protocolo e acesso a equipamento. Identificar licenciamento, instalação e suporte. Fabricante não é presumido como gateway.

**22B:** substituir o fluxo operacional de catálogo mock/aprovação por timer por catálogo real, preço validado, sessão de dispositivo e adaptador de pagamento consultável. Reusar pedido, modificadores, despacho e senha.

**22C:** testar recusa, timeout, confirmação tardia, energia/rede, impressora sem papel, dois dispositivos e troca de sessão. Proteger os dados do cliente anterior e recuperar pagamento aprovado sem nova cobrança.

**Gate:** uma compra real autorizada no equipamento contratado correlaciona pagamento/pedido/ticket/senha; falhas são recuperáveis; piloto e suporte aprovados. Demo permanece identificada como demo até esse ponto. Não vender homologação genérica de todos os equipamentos.

### C01 e comercial — trabalho transversal

Conciliar oferta, checkout e cobrança antes do lançamento pago. Seguir `PLANO-COMERCIAL-FEATURES-SEO.md`: famílias de funcionalidades, páginas de solução/segmento/integração e critérios de publicação. Reusar a assinatura e a vertical Kiosk vigentes; não inventar planos, preço ou parcelamento.

Cada afirmação publicada deve ter capacidade, disponibilidade, dependência e prova. Remover ou qualificar promessa de homologação/performance sem evidência. Validar links, metadados, canonical, indexação, sitemap, navegação e CTA das páginas alteradas. A quantidade de landing pages não substitui conteúdo útil nem funcionamento real do produto.

## 7. Padrão obrigatório de UX e prova operacional

Reusar componentes e linguagem do produto. Premium significa operador concluir a tarefa com clareza, pouco esforço e recuperação de erro, além da aparência.

| Superfície | Comportamento a entregar e medir |
|---|---|
| Garçom/PDV | Mesa/comanda persistentes; tamanho/opções por item; revisão da rodada e confirmação real de envio |
| KDS | Modificadores visíveis, estado e tempo claros, ação principal, histórico de rodadas e permissões |
| Expedição | Pendências de todas as estações e destino inequívoco; bebida pronta não conclui automaticamente todo o delivery |
| Caixa | Consumo, adicionais, descontos, pagamentos confirmados e saldo; recebimento externo identificado como tal |
| Assinante | Pagamento e emissão separados; acesso ao documento correto e recuperação de pendência sem recobrança |
| Gerente | Configuração progressiva por operação, estação e personalização; validar exemplo antes de usar |
| TV/Kiosk | Leitura e toque no equipamento real; sessão restrita e estados de conexão honestos |

Cobrir vazio, carregando, enviando, confirmado, inválido, indisponível, sem conexão, retomada e sem permissão. Mensagem aponta o problema e a ação. Não esconder observação importante em tooltip. Cor acompanha texto; foco/teclado e contraste são verificados. Meta de toque: 48 px; viewport móvel: 375 px; conferir também desktop e equipamento real.

Metas propostas do documento-base: produto favorito sem opções em até três ações desde a comanda; configurável em até cinco além das escolhas necessárias; iniciar/concluir ticket em uma; confirmar retirada em até duas. Medir, sem remover controles de integridade para atingir o número.

Antes da virada, três participantes representando garçom, preparo e caixa/expedição executam dez tarefas. Meta: todas as tarefas críticas sem perda, cobrança indevida ou ajuda do moderador; 90% do conjunto sem ajuda. Comparar tempo/erros com o fluxo atual. Mockup e inspeção do desenvolvedor não equivalem a esse aceite.

## 8. Verificação, revisão e release

1. **Antes:** registrar HEAD, objetos/versões relevantes, hipótese, estado reproduzível e invariantes. Usar ambiente isolado. Testes de tenant autorizados somente na loja de provas Lanche do Paulista, com fingerprint e limpeza/rollback; nunca na Natureba.
2. **Implementar:** um incremento por problema; preço/estoque/cobrança com autoridade no servidor; autorização por loja e papel. Ler skills e instruções locais aplicáveis. Gerar migrations pela CLI do Supabase e conferir nomes/versões efetivamente aplicados.
3. **Validar:** testes de domínio, RPC/triggers/RLS quando pertinentes, typecheck e lint; tela inspecionada nos tamanhos exigidos. Integração obrigatória não pode passar por skip. Usar dados fictícios nos testes de transporte, sem imprimir secrets.
4. **Revisar:** outro revisor avalia diff e critérios, incluindo dados/acesso. Registrar resultado. Se não houver revisor disponível, marcar “pronto para revisão”, não “aceito”; continuar o trabalho independente possível.
5. **Publicar:** conferir autorização aplicável, CI, plano de recuperação e compatibilidade entre migrations, funções, frontend e links existentes. Push em main pode acionar Vercel; não usar push como teste. Não publicar todas as funções por conveniência, especialmente `cartao-pagar`, que tem divergência histórica de configuração.
6. **Depois:** consultar o estado real, executar smoke apropriado e registrar versão/ambiente/evidência. Se falhar, recuperar pelo procedimento preparado, preservando pagamentos, eventos, tickets e rastreio. Não apagar movimentos para “voltar ao verde”.

### Comandos conhecidos na máquina de origem

Na transferência, o launcher global de npm apresentou problema; comandos diretos funcionaram. Descobrir os executáveis disponíveis no ambiente do Sonnet antes de copiar caminhos pessoais. Não desabilitar hooks nem verificadores para concluir commit.

```powershell
git status --short
git branch --show-current
git log -3 --oneline
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run
node node_modules/eslint/bin/eslint.js <arquivos-alterados> --max-warnings 0
deno lint supabase/functions/fiscal-pdf-nfse
deno test --no-lock --node-modules-dir=none --allow-env supabase/functions/fiscal-pdf-nfse/handler_test.ts
git diff --check
```

`<arquivos-alterados>` é um marcador para substituição, não um comando pronto. Rodar build e checks exigidos pelo projeto antes do release. A suite completa tinha 14 SKIPPED na origem por dependências de ambiente: esses resultados não certificam integração. Docker local estava indisponível; a prova SQL entregue foi executada no banco com rollback de fixtures, sem envio SMTP.

**Fontes privadas:** contrato social fornecido em `C:\Users\rafae\OneDrive\Documents\CONTRATO-SOCIAL-APROVADO.pdf`; configuração efetiva no banco/secrets; histórico de credenciais operacionais fora do repositório. Se esse caminho não existir no ambiente seguinte, usar fonte autorizada equivalente. Não anexar contrato, PDF real, credencial ou identificadores financeiros ao Git público ou às evidências públicas.

## 9. Protocolo de continuidade entre sessões

Ao concluir uma história ou precisar transferir trabalho, atualizar `docs/MISEON_HEAD_OF_ENGINEERING.md` e registrar um checkpoint no arquivo da sprint. Uma sessão interrompida não deve obrigar o próximo agente a repetir a investigação inteira.

```text
Sprint / incremento / ID:
Objetivo e critério de aceite:
Status: EM EXECUÇÃO | PRONTO PARA REVISÃO | BLOCKED | ACEITO
Branch e commit:
Arquivos e objetos alterados:
Estado antes e causa reproduzida:
Estado depois e invariantes preservadas:
Testes: cenário / ambiente / PASS-FAIL-SKIPPED-BLOCKED-NOT RUN / evidência
Publicado: migration / função-versão / frontend-versão / data
Não publicado:
Pendências: dono / informação ou ação necessária / impacto
Recuperação e limitações conhecidas:
Próximo passo executável: arquivo ou objeto / ação / resultado esperado
```

Não usar “feito” para atividade que apenas gerou código. Encerramento da sprint exige critérios e evidências; aceite de negócio é de Rafael e da operação. Nenhuma sessão deve afirmar “pronto para mercado” enquanto os gates contratados estiverem abertos.

## 10. Prompt pronto para iniciar Sonnet

Copie o bloco abaixo na sessão do Sonnet com acesso ao repositório. Este documento não cria nem inicia outra sessão automaticamente.

```text
Assuma a execução do MiseOn para lançar a N de Natureba e continuar as sprints.
Leia docs/HANDOFF-SONNET-EXECUCAO-SPRINTS.md, especialmente §§1–5 e §8.
Base recebida: commit 4f2380c, branch codex/natureba-fiscal-e-confirmacao.
Confira o estado atual e preserve alterações posteriores; não faça reset.

Comece pela Sprint 15A: fechar acesso e integridade histórica do documento
fiscal da assinatura. O endereço do resumo PDF já foi corrigido e a função
v5 foi publicada; não refaça essa correção nem diga que ela prova nota válida.
Reproduza os riscos restantes, declare o contrato de acesso/snapshot, implemente
um incremento completo, teste, prepare revisão e registre evidência/commit.

Você é responsável pela implementação, com revisão de arquitetura nos
incrementos de dados/autorização e revisão independente do resultado.
Use as fichas existentes para seguir 15B/C, 16, 17, 18 e 19; inicie cedo
a descoberta de migração, TV e Bravus. Não invente preços, catálogo real,
recebedor financeiro, política de salão ou homologação de terceiros.

Natureba não é ambiente de fixtures. Código, banco e funções publicadas
podem divergir. Preserve PEPS, autoridade de preço, isolamento de tenant e
idempotência. Confira o recebedor de cartão antes de homologar pagamentos.
Não faça cobrança, reemissão fiscal ou troca de recebedor apenas para testar.

Avance no código e nas telas; não entregue somente outro plano. Se depender
de informação externa, registre exatamente a dependência e continue o
incremento independente previsto. Mostre PASS/FAIL/SKIPPED/BLOCKED/NOT RUN
separadamente e deixe o próximo passo executável ao fim de cada sessão.
```

# Plano de execução MiseOn

Versão 1 de 9 de setembro de 2026. Destinatários: produto, engenharia, design, qualidade e operação. Responsável pela prioridade e aceite de negócio: Rafael. Responsáveis técnicos são indicados por função e devem ser nominalmente designados no Planning.

O primeiro resultado é substituir o atendimento atual da N de Natureba com montagem correta, pedidos íntegros, pagamentos conciliados e operação simples. A assinatura do MiseOn também precisa funcionar: cobrar, conceder acesso e entregar ao assinante uma nota fiscal válida com dados corretos.

Este documento organiza oito objetivos de sprint, a UX operacional e as provas de lançamento. É um plano de execução proposto. Datas, capacidade da equipe, equipamentos e algumas políticas comerciais ainda dependem de confirmação. Nenhum marco está certificado apenas pela existência de código.

A Natureba vende baguetes de 15 e 30 cm, marmitex, bebidas e salgados fritos/assados. Atende mesa com garçom, balcão, iFood, delivery próprio e retiradas de clientes e motoboys. Usa Anota.ai e pretende substituí-lo. Rodízio é expansão prioritária; Cast e Kiosk têm homologação própria.

Decisão de prioridade: assinatura e NFS-e; pagamento e iFood; integridade de estoque; montagem e workflows; virada Natureba; Cast; operação mista; Kiosk. Refinamento comercial, migração e descoberta de hardware começam antes de seus marcos finais.

Leitura da equipe: governança e UX primeiro; depois a ficha da sprint em execução. Os planos técnicos e comerciais no repositório detalham as evidências e o catálogo de capacidades. A Review deve demonstrar tarefas reais, inclusive falhas e recuperação.

[[PAGE]]

# Governança e critérios de lançamento

Cadência proposta: uma semana por sprint. Os números 15 a 22 preservam a continuidade do histórico. Representam a ordem dos objetivos; um objetivo maior será fatiado em vários sprints e os seguintes renumerados. Não há compromisso de conclusão em oito semanas.

| Papel | Responsabilidade |
|---|---|
| PO Rafael | Prioridade, política comercial, escopo contratado e aceite de negócio |
| Engenharia | Arquitetura, implementação, integridade, observabilidade e recuperação |
| UX e produto | Fluxos, linguagem, protótipo, consistência e testes de tarefa |
| Qualidade e revisor | Provar invariantes e regressões; revisar com evidência independente |
| Operador Natureba | Validar montagem, preparo, atendimento, expedição e fechamento |
| Bravus e provedores | Confirmar contrato técnico, hardware e homologação aplicável |

Planning de 45 minutos; Daily de 15; refinamento de 30 no meio da semana; Review de 30; retrospectiva de 20. Cada história terá ID, dono nominal, tamanho após refinamento, dependências, PR, ambiente e evidência. Limite inicial: uma história principal em execução por pessoa. Planejar 70% da capacidade medida e reservar 30% para descoberta e incidentes do piloto; recalibrar semanalmente.

**Pronta para começar:** problema e usuário claros, invariante declarada, cenário de aceite, dependência acessível e recorte que produz comportamento utilizável. **Concluída:** implementação e revisão, testes aplicáveis, inspeção visual quando houver tela, migrations/functions verificadas em homologação, documentação e prova anexadas. PASS, FAIL, SKIPPED, BLOCKED e NOT RUN são estados distintos.

| Marco | Condição de liberação |
|---|---|
| S Assinatura | Pagamento conciliado, acesso correto, nota autenticada e recebida |
| N Natureba | Canais contratados, iFood, montagem, caixa e virada aprovados |
| D Cast | Transmissão, sessão e recuperação no equipamento compatível |
| M Operação mista | Rodízio, quilo e avulsos corretos por participante |
| K Kiosk | Compra e falhas homologadas no equipamento Bravus |
| C Comercial | Toda promessa ligada a oferta, dependência e prova atual |

P0 bloqueia o fluxo afetado por perda de pedido, dado, dinheiro ou acesso. P1 completa o marco contratado. Falhas críticas entram na prioridade sem reduzir a Definition of Done. A sprint entrega software; documentação e demo simulada não substituem a validação operacional.

[[PAGE]]

# UX operacional como requisito de produto

O operador precisa reconhecer o contexto, executar a próxima ação e perceber o resultado. O sistema mantém canal, cobrança, destino e estação separados; usa os dados disponíveis para evitar redigitação. A tela padrão mostra o trabalho daquele papel e turno.

| Princípio | Aplicação observável |
|---|---|
| Contexto persistente | Mesa, comanda, pessoa, destino e rodada permanecem visíveis durante o lançamento |
| Personalização por item | Baguete 15/30 e duas bebidas com opções diferentes não se fundem indevidamente |
| Uma ação principal | Selecionar, enviar rodada, iniciar preparo, concluir ou entregar conforme estado |
| Erro recuperável | Informar item afetado e correção; preservar preenchimento; evitar toast genérico |
| Confirmação de execução | Exibir recebido/enviado/pendente de conexão; nunca sucesso apenas pelo clique |
| Informação legível | Modificadores obrigatórios destacados; cor acompanhada de texto; sem hover obrigatório |
| Configuração progressiva | Operador vê sua tarefa; gerente configura estações e regras em área própria |

**Metas propostas de design:** controles primários de toque com pelo menos 48 px; corpo legível em 375 px; foco visível e contraste conforme WCAG 2.2 AA; operação com teclado quando aplicável. KDS deve ser testado na distância real de leitura e no equipamento da cozinha. O tamanho de 48 px é meta do projeto, não o mínimo normativo da WCAG.

**Orçamento inicial de interação:** produto favorito sem opções em até três ações a partir da comanda; produto configurável em até cinco, além das escolhas necessárias; iniciar ou concluir ticket em uma ação; confirmar retirada em até duas. Medir em teste de tarefa e ajustar, sem remover validações críticas para atingir números.

**Estados obrigatórios:** vazio que ensina, carregando, enviando, confirmado, erro de validação, indisponível, sem conexão, retomada e permissão insuficiente. Ação irreversível explica seu efeito. Cancelamento financeiro exige política e rastreabilidade; “desfazer” não pode simular estorno inexistente.

**Teste de usabilidade:** ao menos três participantes representando garçom, preparo e caixa/expedição, podendo acumular funções. Executar dez tarefas típicas com dados realistas, sem orientação durante a medição. Meta de aceite: 100% das tarefas críticas concluídas sem perda, cobrança indevida ou intervenção do moderador; pelo menos 90% do conjunto concluído sem ajuda. Comparar tempo, erro e correções com o fluxo atual da loja. São critérios propostos, ainda não resultados medidos.

Entrega de UX por sprint: fluxo, protótipo ou tela, textos/estados, critérios de acessibilidade e evidência em 375 px e desktop. Alterações em KDS/TV/Kiosk exigem também resolução e ambiente reais.

[[PAGE]]

# Atendimento e montagem por item

**Fluxo do garçom:** abrir mesa/comanda → selecionar pessoa quando aplicável → escolher produto/tamanho → personalizar → revisar rodada → enviar. A revisão agrupa por destino de preparo, sem obrigar o garçom a conhecer IDs ou configurar roteamento.

[[IMAGE waiter]]

Referência conceitual de interface. Não representa uma tela implementada ou homologada. Preços não foram definidos neste desenho.

**Baguete:** 15 cm e 30 cm têm preço e ficha compatíveis com o cadastro. Recheios e acompanhamentos pertencem ao item. Não assumir consumo em dobro só pelo comprimento. Para marmitex, reaproveitar grupos e limites conforme cardápio real. Gelo/limão e ponto da carne são modificadores; não viram etapas universais.

**Comportamento de envio:** obrigatório ausente destaca o grupo; opção indisponível informa alternativa; validação também ocorre no servidor. Duplo toque mantém uma operação idempotente. Falha de rede conserva a rodada como não confirmada; não mostrar “enviado” antes da confirmação.

**Revisão:** duas baguetes com montagens diferentes aparecem em linhas distintas. Alterar quantidade mantém consistência de opções. O resumo mostra mesa, pessoa, rodada, itens e adicionais cobrados. Observação livre complementa a seleção estruturada, sem substituí-la.

**Critérios de aceite:** lançar baguetes de ambos os tamanhos com opções diferentes; acrescentar bebida à mesma comanda; enviar nova rodada com ticket anterior concluído; retentar após falha de conexão; recusar produto/opção de outra loja; conferir opções no ticket, valor no caixa e consumo no estoque.

[[PAGE]]

# Preparo por estação e workflow

**Entrada do operador:** identificar-se → escolher estação permitida → acompanhar sua fila. Cada ticket destaca item, quantidade, modificadores, mesa/destino, rodada e tempo. Ação principal depende do estado. A visão de gestão pode consolidar estações sem obrigar cada operador a usá-la.

[[IMAGE kds]]

Referência conceitual de interface para montagem. Os nomes das etapas devem refletir a operação configurada; este desenho não comprova funcionalidade em produção.

**Workflows de referência:** montagem → conferência; fritura sob demanda → embalagem; forno sob demanda → embalagem; serviço de bebida → pronta. Salgado já pronto pode seguir direto à expedição. Reposição em lote é produção, com consumo próprio, não uma fritura nova por unidade vendida.

**Regras de interação:** começar e concluir com uma ação; indicar atraso por texto/tempo além de cor; modificadores visíveis no cartão; nenhum item escondido porque a estação já tem ticket. Nova rodada deve ser distinguível sem reabrir silenciosamente trabalho concluído.

**Configuração:** o gerente cria etapas e transições válidas, atribui workflow e estação ao produto e testa um exemplo. Mudança preserva versão/snapshot dos tickets ativos. Uma etapa desativada exige tratamento explícito. Item passando por várias estações em sequência tem teste próprio; múltiplos produtos em estações distintas não provam isso.

**Aceite:** executar montagem, forno, fritura e bar simultaneamente; enviar três itens à mesma estação; concluir e receber segunda rodada; cancelar item; recusar avanço por papel indevido; recuperar atualização de tela sem duplicar preparo ou consumo.

[[PAGE]]

# Expedição caixa e telas de gestão

**Expedição** consolida progresso das estações e o destino. Pronto no Bar não significa pedido inteiro pronto. A política permite servir bebida à mesa antes da refeição, enquanto o delivery aguarda os itens necessários à entrega.

| Destino | Identificação principal | Ação final |
|---|---|---|
| Mesa com garçom | Mesa, comanda e pessoa | Entregar item ou rodada e registrar serviço |
| Balcão | Senha conhecida pelo cliente | Chamar e confirmar retirada |
| Retirada online | Senha e pedido vinculado | Confirmar identidade operacional e entrega |
| Motoboy iFood | Referência iFood e fila de entregadores | Conferir volumes e registrar saída conforme canal |
| Delivery próprio | Pedido e responsável pela entrega | Despachar e acompanhar conclusão |

Não converter DELIVERY em RETIRADA para fazê-lo aparecer no painel. As migrations já permitem configurar tipos no painel; validar a configuração antes de criar solução paralela. Senha interna não substitui código oficial de confirmação do marketplace quando aplicável. Não expor endereço, telefone ou informação financeira na TV pública.

**Caixa** apresenta consumo, adicionais, descontos, pagamentos confirmados e saldo. Dividir pagamento não altera item/consumo. Cartão de maquininha externa deve dizer “Registrar pagamento recebido”, com confirmação explícita, e nunca fingir integração TEF. Recusa e pendência do gateway não recebem estilo de venda paga.

**Nota e assinatura** apresentam competência/período, valor, pagamento, situação fiscal e acesso ao documento correto. Emissão pendente orienta a próxima ação; nenhuma mensagem de sucesso fiscal enquanto faltar autorização. O administrador deve localizar e recuperar falhas sem pedir que o assinante pague novamente.

**Gerente** configura a operação em blocos: como vende, como prepara, personalizações, canais e entrega. Defaults são editáveis e adequados ao produto; a loja pode combinar capacidades. Produto DIRETO sem estação não vira trabalho de cozinha; com estação explícita pode exigir serviço de Bar.

**Aceite de linguagem e navegação:** ações descrevem resultado; termos técnicos ficam fora da jornada operacional; estados de pagamento/preparo/entrega têm vocabulário consistente; cada função chega ao trabalho com poucos passos. Treinar no próprio fluxo, com exemplos e estados vazios úteis.

[[PAGE]]

# Sprint 15 Assinatura e nota fiscal válidas

**Objetivo:** o assinante paga, recebe o acesso contratado e uma NFS-e válida com dados corretos. **IDs:** S01, S02, S03 e C01 aplicável. **Responsável:** engenharia financeira/fiscal; UX e QA apoiam; Rafael valida cadastro e oferta. **Risco:** alto, por cobrança e documento fiscal. Fatiar contratação, renovação e entrega fiscal se não couberem no timebox.

**Entrada:** dados corretos do prestador e tomador em fonte privada, configuração do provedor, plano/período aprovado e ambientes de teste disponíveis. Endereço fictício no PDF foi confirmado no código; a nota autorizada ainda precisa ser comparada.

| Trabalho | Resultado verificável |
|---|---|
| S01 Cadastro e PDF | Substituir identificação fixa por fonte fiscal/snapshot; comparar endereço do PDF e nota oficial |
| S02 Contratação | Validar crédito e Pix, preço, parcelas, período e concessão de acesso no servidor |
| S02 Ciclo de vida | Renovação, recusa, atraso, cancelamento e repetição com efeito único |
| S03 Emissão | Fatura vinculada à autorização, com consulta após timeout e retry sem duplicar nota |
| S03 Entrega | Fila, envio, recebimento e documento correto na caixa do assinante |
| C01 Oferta | Landing, checkout e cobrança com mesmas condições; separar anual parcelado e recorrência |

**UX:** erro de cadastro aponta o campo; aprovação financeira e situação fiscal aparecem separadas. Falha na nota gera pendência recuperável. O assinante vê documento e histórico, sem informação técnica do provedor.

**Cenários de aceite:** dada uma compra aprovada, o período de acesso e a fatura correspondem ao plano e valor; quando chega evento duplicado, não surge nova cobrança nem extensão dupla. Dada uma emissão autorizada, a consulta oficial confere com o PDF; quando o e-mail chega, o link abre apenas o documento permitido. Dado pagamento aprovado e falha fiscal, o sistema registra pendência e retenta a emissão sem recobrar.

**Testes:** contratação crédito/Pix, recusa, timeout, evento repetido/fora de ordem, renovação e cancelamento; comparação de dados fiscais e proteção de acesso; SMTP indisponível, destinatário inválido e retry. testada_ok não conta como nota emitida; fila ou SMTP aceito não contam como recebimento.

**Saída e Review:** dossiê privado com transação, fatura, acesso, autorização, consulta oficial e e-mail recebido. Uma transação legítima de produção comprova o fluxo liberado; cenários de falha/renovação usam ambiente apropriado. **Fora do escopo:** fiscal de venda do restaurante e importação de compra. **Recuperação:** preservar cobrança confirmada, suspender novas tentativas ambíguas e reconciliar antes de reprocessar.

**Checkpoint 09/09 (15A — PRONTO PARA REVISÃO):** o PDF (`fiscal-pdf-nfse`) exigia só `?id=<fatura>`, sem autenticação — corrigido com token individual por fatura (hash no banco, gerado na emissão) ou JWT de admin da loja/superadmin; nota emitida antes disso cai para o cadastro atual mas o PDF avisa que não há snapshot da época. Snapshot do prestador passa a ser gravado em `fiscal-emitir-nfse` no momento da emissão. Migration `20260909170000` aplicada, funções publicadas, smoke test real em produção confirmou 403/401 para acesso sem token/token errado. Detalhe completo em `docs/MISEON_HEAD_OF_ENGINEERING.md` (seção "Execução de 09/09 (parte 2)").

**Checkpoint 09/09 (15B parcial — emissão real confirmada, PRONTO PARA REVISÃO):** a única fatura "emitida" em produção era falsa (consulta oficial da Prefeitura devolvia "não conferem" — nota de teste antigo, nunca corrigida). Investigado e corrigido: (1) conectividade — a Prefeitura bloqueia mTLS de origem datacenter/nuvem; Supabase Edge Functions não têm IP fixo; criado `api/fiscal-proxy-nfse.ts` (Vercel, região gru1/São Paulo) para fazer a última perna da chamada a partir de lá; (2) três bugs de estrutura do XML do lote RPS (Id não declarado, namespace herdado incorretamente pelos elementos locais, parsing de `<NumeroNFe>` procurando `<Numero>`), cada um confirmado por um erro real e distinto do webservice. **Prova:** fatura de teste de R$1,00 emitida com NF-e número 1, código `3ZARYZG9`, validada na consulta pública oficial da Prefeitura (abre a nota real, com download). Detalhe completo, pendências e riscos em `docs/MISEON_HEAD_OF_ENGINEERING.md` (seção "Execução de 09/09 (parte 3)"). **Falta:** idempotência/concorrência da numeração de RPS (crítico agora que a emissão real funciona), testar o caminho automático real (Pix→webhook→emissão, não só chamada manual), 15C inteira (ciclo de vida da assinatura, entrega fiscal), revisão independente. **Pedido novo do Rafael, ainda não iniciado:** valor da mensalidade configurável pelo superadmin (preço de lançamento até 10 assinantes; valor diferente para o canal totem/Kiosk) — hoje é hardcoded em `src/lib/efiInfo.ts`.

**Checkpoint 09/09 (15B continuação — idempotência/concorrência do RPS corrigida e o caminho automático destravado, PRONTO PARA REVISÃO):** reproduzido em produção (não hipótese): `count(nfse_status='emitida')+1` sem trava — no estado real da tabela naquele momento, qualquer chamada próxima no tempo calcularia o mesmo `numeroRps`. Corrigido com contador dedicado (`fiscal_rps_sequencia` + `fn_fiscal_reservar_numero_rps`, `UPDATE...RETURNING` atômico, mesmo padrão de `fn_numero_pedido`) — número reservado persiste na fatura (`nfse_numero_rps`) e é reaproveitado em qualquer retentativa, nunca queimando um número novo sobre um RPS que não foi de fato aceito. Adicionada trava de reivindicação atômica por fatura (impede reprocessar uma fatura já `emitida`/`processando`) e guarda de idempotência (fatura já emitida retorna o resultado existente). **Achado não previsto, corrigido no mesmo commit:** a detecção de chamada service-role fazia parsing de JWT (`role===service_role`) — formato que este projeto não usa mais (API key nova da Supabase, `sb_secret_...`, sem ponto); isso fazia o caminho automático (Pix confirmado → `assinatura-pix.ts`/`efi-assinatura-webhook` → esta função) retornar 403 sempre, silenciosamente ("não bloqueia o pagamento" engole o erro) — só a chamada manual com JWT de superadmin real disfarçava o problema. Corrigido comparando a bearer key direto com `SUPABASE_SERVICE_ROLE_KEY`. **Mesmo bug (parsing de JWT para achar service-role) existe em `fiscal-onboarding-plataforma`, `ifood-catalog-import` e `ifood-catalog-sync` — não corrigido nesta sessão, fora do escopo do fiscal da assinatura.** **Prova real:** duas chamadas concorrentes de verdade para a mesma fatura de teste (R$1, Lanche do Paulista) — uma bloqueada (`concorrencia:true`, nunca tocou o webservice), a outra emitiu a NF-e real número 2 (RPS número 3), validada na consulta pública oficial; retentativa na fatura já emitida devolveu `ja_emitida:true` sem gerar nova nota. Migration `20260909180000` e a function publicadas via MCP do Supabase. **Falta:** commit local feito, mas `git push` foi bloqueado pelo classificador do modo automático do Claude Code — Rafael precisa empurrar manualmente ou autorizar; caminho automático fica coberto pela correção do bug de auth, mas não foi disparado por um Pix real de ponta a ponta (exigiria movimentar dinheiro de verdade); 15C inteira; revisão independente; pedido de preço configurável ainda não iniciado (ver Sprint 22 e handoff).

[[PAGE]]

# Sprint 16 Pagamento e pedidos do iFood

**Objetivo:** operação online e seus avisos nascem apenas após elegibilidade confirmada. **IDs:** O01, O02, N06, I01, I02. **Responsável:** engenharia de pedidos/pagamentos; QA e operador validam. **Dependências:** credenciais e loja iFood autorizadas, catálogo piloto e contrato dos meios de pagamento. **Risco:** alto, por pedido perdido ou duplicado.

| Trabalho | Resultado verificável |
|---|---|
| O01 Eventos | Guardas no servidor/fila para painel, KDS, impressão, som, push e e-mail |
| O01 Confirmação | Pagamento consultado no provedor para a compra, valor e loja; transição idempotente |
| O02 Abandono | Expiração separada de pendência/timeout; recuperação comercial sem aviso operacional |
| I01 Jornada | Token, de-para, tamanhos/opções, valores, status, entrega e cancelamento conferidos nos dois sistemas |
| I02 Recuperação | Reentrega, lote parcial e ACK com persistência por evento, sem perder os pendentes |

**UX:** comprador vê pendência/recusa e o que fazer; lojista não vê checkout não pago na fila operacional. Destinatários são configurados por papel: cliente, loja e administrador do SaaS. Recuperação de carrinho é comunicação comercial separada e revalida se a compra já foi paga.

**Cenários de aceite:** dado Pix pendente, durante todo o intervalo não há ticket, impressão, som, push, e-mail de pedido ou receita; quando confirmado, há uma operação e eventos deduplicados. Dado lote iFood com um evento inválido, os processados não duplicam e o pendente continua recuperável. Dado pagamento tardio de intenção expirada, o valor recebido é conciliado e tratado por política explícita, sem permanecer oculto como abandono.

**Testes:** eventos duplicados/fora de ordem, falha de rede, cartão em análise/recusado, Pix expirado, autenticação iFood, retorno de status, cancelamento, DELIVERY e retirada. Verificar cada resultado do lote: HTTP 200 não prova processamento de todos. O gatilho de e-mail no INSERT é um caminho prioritário de reprodução.

**Decisão em aberto:** pré-pagamento no salão foi perguntado ao PO; preservar o modelo pós-consumo até decisão. iFood com pagamento na entrega requer política própria e leitura dos dados oficiais; não virar abandono nem “pago” por inferência.

**Saída e Review:** registro correlacionado de evento externo, pedido interno, pagamento, ticket, aviso e retorno ao canal. Demonstrar também silêncio antes da aprovação. **Fora do escopo:** reformular todo o financeiro. **Recuperação:** pausar canal afetado, preservar eventos e conciliar antes de reentregar; não aceitar ACK indiscriminado para limpar fila.

[[PAGE]]

# Sprint 17 Estoque e entrada de notas

**Objetivo:** a primeira carga e o consumo da Natureba preservam quantidade, unidade, lote e custo. **IDs:** N02, N03. **Responsável:** engenharia de estoque/fiscal; QA e operador. **Dependências:** documentos/fixtures realistas e catálogo de unidades. **Risco:** alto, por contaminação de estoque e CMV.

| Trabalho | Resultado verificável |
|---|---|
| N02 Conferência | Modal consome a inconsistência detectada e exige correção antes da efetivação |
| N02 Autoridade | Gravação também valida; chamada direta não contorna o bloqueio |
| N03 Unidades | Compra/estoque/consumo separados; conversão explícita, determinística e auditável |
| N03 Rastreio | Entrada, lote, movimento, consumo PEPS e custo conciliados |
| N03 Reprocessamento | Duplicidade, cancelamento e contagem física com histórico e efeito único |

**UX:** mostrar quantidade, unidade, unitário e total em colunas inequívocas. Linha pendente identifica o motivo e o campo a corrigir. Sugestão de IA tem origem/confiança; fatos XML prevalecem. De-para aprendido reduz preenchimento sem sobrescrever revisão humana. Confirmação mostra o efeito em unidade de estoque antes de gravar.

**Cenários de aceite:** dada nota com 20 KG a R$ 18,90 e total R$ 378,00, entram 20 KG; dado 10 CX com fator 12 validado, entram 120 UN. Dada divergência aritmética, não há lote/movimento silencioso. Dada nota já efetivada, reimportar não duplica saldo. Ao cancelar consumo elegível, o rastro e o custo seguem a política de estorno existente.

**Testes:** KG, UN, CX, PC, LT, fração, descontos, preço unitário versus total, conversão ausente, lote/validade, duplicidade, concorrência e cancelamento. Conferir limpeza/embalagem fora da ficha alimentar quando apropriado. Provar também consumo de adicionais e produção em lote.

**Implementação:** antes de alterar SQL, mapear RPC, triggers das tabelas tocadas e funções chamadas. Preservar PEPS existente; não reimplementar porque o corpo de uma RPC não cita lotes. Divergências históricas do tenant de provas são investigação separada após fechar a fonte ativa.

**Saída e Review:** carga controlada e venda com saldo/lotes/custo conciliados, incluindo produto da montagem. **Fora do escopo:** reescrever o ledger ou saneamento massivo de dados antigos. **Recuperação:** impedir nova efetivação inconsistente, preservar staging/evidência e usar ajuste ou estorno rastreável; nunca editar saldo à mão para “bater”.

[[PAGE]]

# Sprint 18 Montagem rodadas e KDS dinâmico

**Objetivo:** cada item chega completo ao operador correto e segue o workflow aplicável. **IDs:** N04, N05, N08, N13, N15, W01. **Responsável:** engenharia de pedidos/KDS e UX; operador valida. **Risco:** alto, por item invisível, preparo errado ou consumo duplicado. Selecionar um fluxo vertical por incremento se necessário.

| Trabalho | Resultado verificável |
|---|---|
| N04 Despacho | Item e opções completos antes do snapshot operacional; várias linhas e rodadas recuperáveis |
| N05 Validação | Produto/opção/loja, disponibilidade, repetição, mínimo/máximo e preço no servidor |
| N13 Montagem | Baguetes 15/30 e marmitex com ficha/preço e escolhas individuais |
| N08 W01 Estações | Roteamento, etapas, transições e acesso por papel; histórico preservado ao editar configuração |
| N15 Salgados | Venda pronta, reposição em lote e preparo sob demanda sem fabricação/baixa duplicada |

**UX:** aplicar as referências de atendimento e KDS deste documento; contexto da comanda persistente, modificadores em destaque e ação principal por estado. Expedição mostra pendências por estação/destino. Erro ou desconexão mantém estado honesto e caminho de retomada.

**Cenários de aceite:** dada uma rodada com três itens da mesma estação, todos aparecem uma vez com opções. Dado ticket concluído, nova rodada é visível sem perder histórico. Dadas duas baguetes com tamanhos/recheios diferentes, preço, ficha, ticket e consumo correspondem a cada item. Dado workflow alterado pelo gerente, tickets ativos não mudam silenciosamente de significado.

**Testes:** opções inseridas depois do item, papel exclusivo de garçom, opções de outro produto/loja, preço adulterado, concorrência, retry, estação indisponível, cancelamento e avanço não autorizado. Executar montagem, bar, forno e fritura simultaneamente. Testar separadamente roteiro multiestação do mesmo item se fizer parte do escopo.

**Implementação:** decidir incrementalidade por identidade do item/rodada e estado; não concatenar JSONB cegamente. Reusar o modelo de estações/workflows e convergir regras de preço e consumo. O cliente não escolhe preço final por payload.

**Saída e Review:** garçom e operadores executam a jornada completa sem instrução do desenvolvedor; prints/gravação e rastreio por item anexados. **Fora do escopo:** rodízio e redesign geral do ERP. **Recuperação:** fila operacional persistente e auditável; pausar roteamento/configuração defeituosos sem apagar tickets ou repetir baixas.

[[PAGE]]

# Sprint 19 Virada da Natureba

**Objetivo:** a loja substitui o fluxo atual e completa um turno com caixa conciliado. **IDs:** N01 restante, N07, N09, N10, N12, N14, N11 aplicável. **Responsável:** PO e operação, com engenharia/QA/UX. **Dependências:** S, O, I, estoque e KDS aprovados nos canais contratados. **Risco:** alto, por interrupção de atendimento.

| Trabalho | Resultado verificável |
|---|---|
| N12 Inventário | Funções usadas no Anota.ai, cardápio, opções, horários, entrega, pagamentos e histórico identificados |
| N10 Carga | De-para, preços/fichas, catálogo, estações, equipe e permissões conferidos |
| N14 Retirada | Filas de balcão, online e motoboy claras; destino iFood preservado |
| N09 Ensaio | Jornada de cada canal, pico acordado, cancelamento e fechamento com operador |
| N07 Release | Versões de frontend/banco/functions e recuperação verificadas antes da produção |
| N12 Virada | Janela, responsável por canal, pedidos antigos e contingência acordados |

**UX:** treinar pelas tarefas reais. Operador encontra pedido por senha/referência/mesa, identifica o que falta, registra entrega e fecha a conta. Cadastro não exige conhecer nomenclatura interna. Publicar guia curto de abertura, operação, incidentes e fechamento.

**Cenários de aceite:** três retiradas simultâneas não confundem consumidor e motoboy; mesa não é chamada indevidamente ao balcão. Pedido antigo Anota.ai encerra na origem ou por procedimento reconciliado, sem ser importado como nova venda. Evento iFood repetido durante a troca não é comandado por dois sistemas. Caixa confere totais, cancelamentos e pagamentos.

**Testes:** ensaio de pico representativo definido com a loja, internet instável, impressora indisponível, permissão de garçom/caixa, estoque indisponível e pagamento pendente. Comparar tarefas ao sistema atual; não perder automação WhatsApp ou outra função utilizada sem perceber. Exportação/API Anota.ai dependem do acesso disponível, não são presumidas.

**Saída e Review:** aceite formal por marco e fluxo, zero P0 aberto, testes críticos sem skip, operadores habilitados, plano de suporte com horário e dono. Primeiro turno assistido e conferência ao fechar; acompanhamento acordado dos três primeiros dias.

**Fora do escopo:** cancelar unilateralmente contrato Anota.ai, importar todo o histórico sem estratégia ou implantar funções futuras junto à virada. **Recuperação:** controlar entrada de novos pedidos por canal; preservar histórico e pagamentos; reativação do fluxo anterior coordenada, sem reprocessar vendas pagas.

[[PAGE]]

# Sprint 20 Transmissão para TV com Cast

**Objetivo:** o operador seleciona uma TV compatível e transmite/controla o painel sem digitar URL. **IDs:** D01, D02. **Responsável:** engenharia de displays e UX. **Dependências:** receptor, firmware, rede e navegador reais; registro do receiver. A prova D01 começa antes deste sprint. **Risco:** médio, com dependência de plataforma.

| Trabalho | Resultado verificável |
|---|---|
| D01 Compatibilidade | Modelo, firmware, navegador e descoberta na rede registrados |
| D01 Receiver | Custom Web Receiver com painel dinâmico em dispositivo real |
| D02 Sender | Botão Transmitir, seletor de TV e escolha de função/conteúdo |
| D02 Sessão | Credencial restrita à loja/tela, expiração, revogação e troca de controlador |
| D02 Recuperação | Interrupção de rede, celular bloqueado, reinício da TV e retomada testados |

**Solução escolhida:** Google Cast Web Sender e Custom Web Receiver para conteúdo próprio do MiseOn. Reutilizar componentes de display; receptor de mídia padrão não resolve sozinho um painel operacional dinâmico. Mesmo Wi-Fi não garante compatibilidade ou descoberta; validar isolamento de clientes da rede.

**UX:** ação “Transmitir para TV” quando houver suporte; seleção reconhecível da tela; mostrar conectado, reconectando ou desconectado e como recuperar. Após conectar, operador escolhe senhas/cardápio ou função autorizada; pode parar ou transferir controle. Não enviar sessão administrativa à TV.

**Cenários de aceite:** dado receptor compatível na rede, o operador transmite em até três ações, além da seleção inicial de conteúdo; dado celular desconectado, a sessão se comporta conforme política testada, sem inventar continuidade garantida. Dada credencial de outra loja ou revogada, conteúdo/acesso são recusados. TV pública não exibe detalhes privados do KDS.

**Testes:** duas TVs, reconexão, troca de operador, sessão expirada, reinício, rede segregada, navegador não suportado e atualização de conteúdo. Medir estabilidade por um turno representativo. Publicar matriz de compatibilidade observada; Chrome no iOS não suporta o Cast web descrito pelo Google. Suporte nativo iOS é extensão separada.

**Saída e Review:** demonstração ao vivo com equipamento e condições documentados. **Fora do escopo:** prometer qualquer Smart TV, AirPlay universal ou funcionamento offline; app nativo sem necessidade comprovada. **Recuperação:** painel via navegador com pairing como alternativa explícita para dispositivo incompatível; não contabilizá-lo como entrega do Cast.

[[PAGE]]

# Sprint 21 Rodízio e operação mista

**Objetivo:** uma mesa combina rodízio, quilo e avulsos com cobrança e consumo corretos. **IDs:** M01, M02, M03. **Responsável:** PO e engenharia de domínio; UX/QA/operação validam. **Dependências:** rodadas, autoridade de preço e estoque comprovados. **Risco:** alto, por cobertura indevida e CMV incorreto.

| Trabalho | Resultado verificável |
|---|---|
| M01 Política | Pacotes, participantes, tarifas, adicionais, serviço e cancelamento aprovados |
| M02 Adesão | Participante vinculado ao pacote e vigência com registro histórico |
| M02 Cobrança | Incluído não soma novamente; avulso e extra cobram pela regra contextual |
| M02 Consumo | Item incluído ainda gera consumo/custo aplicável e vai ao KDS |
| M03 Operação | Rodízio, quilo, mesa, bar, pastas, sobremesas e delivery em paralelo |

**UX:** comanda mostra quem aderiu, qual pacote e quantidade de participantes. No lançamento, “Incluído no pacote” ou valor adicional ficam claros antes de enviar. Caixa explica adesões, itens incluídos, extras e saldo. Transferência/cancelamento preservam o vínculo histórico e a política aprovada.

**Cenários de aceite:** dois participantes no rodízio e um no quilo consomem na mesma mesa; item coberto não cobra de novo, bebida fora do pacote cobra e consumo de todos os itens aplicáveis permanece rastreável. Item de participante não aderente é avulso. Trocar preço futuro não altera conta histórica. Segunda rodada chega à estação correta sem duplicar adesão.

**Testes:** adulto/criança/cortesia apenas se contratados, adesão encerrada, opção extra, mudança de participante, cancelamento, divisão de pagamento, concorrência e tentativa de zerar preço no payload. Quilo respeita tara e unidade. Ilhas com preparo sob demanda e buffet já disponível usam o roteiro correto.

**Implementação:** pacote é contexto da adesão, não atributo global de produto gratuito. Cobertura deriva no servidor e mantém snapshot. Reusar comanda/participante e autoridade de cálculo, depois de comprovar seus caminhos; não criar soma paralela no frontend.

**Saída e Review:** mesa mista realista com extrato legível, tickets e CMV conciliados. Landing de rodízio só descreve o escopo comprovado. **Fora do escopo:** todas as combinações tarifárias futuras e produto composto genérico sem necessidade. **Recuperação:** impedir novas adesões inconsistentes, preservar consumo e recalcular somente por ação auditável e regra aprovada.

[[PAGE]]

# Sprint 22 Compra real no Kiosk Bravus

**Objetivo:** um cliente escolhe, paga e retira pelo equipamento real com recuperação de falhas. **IDs:** K01 a K05. **Responsável:** engenharia de pagamentos/dispositivos, Bravus e UX; PO fecha contrato. **Dependências:** SKU/SO/periféricos, protocolo de pagamento, equipamento e homologação. K01 inicia cedo. **Risco:** alto; provavelmente exige mais de um sprint.

| Trabalho | Resultado verificável |
|---|---|
| K01 Contrato técnico | Hardware, drivers, pinpad/impressora, provedor, suporte e ambiente definidos |
| K02 Pagamentos | Adaptador cria/consulta/cancela/reconcilia sem acoplar pedido ao fornecedor |
| K03 Jornada | Catálogo/opções reais, preço servidor, sessão de dispositivo e confirmação operacional |
| K04 Falhas | Timeout, rede, energia e impressora sem papel sem recobrança/perda |
| K05 Piloto | Provisionamento, revogação, privacidade, instalação e suporte aprovados |

**UX:** começar → escolher categoria/produto → personalizar por item → revisar → pagar → receber senha. CTA e controles de toque legíveis, ajuda acessível, sem jargão. Exibir indisponibilidade antes da cobrança; retentar conexão mantém contexto seguro. Sessão anterior não deixa dados do cliente para o próximo.

**Cenários de aceite:** compra real de baguete com opções gera um pagamento, pedido, ticket e senha correlacionados. Dado pagamento aprovado seguido de reinício, consulta recupera a venda sem cobrar novamente. Dada impressora sem papel, cliente ainda vê identificação e instrução para retirada; falha é informada ao operador. Dada sessão expirada, nenhuma informação pessoal permanece acessível ao próximo cliente.

**Testes:** aprovado, recusado, pendente, timeout, confirmação tardia, cancelamento/estorno homologados; perda de rede/energia; dois dispositivos; troca de turno; fila KDS e saldo. Provar cada combinação contratada de SO/periférico/provedor. Fabricante de hardware não é presumido como gateway.

**Saída e Review:** dossiê de homologação e piloto assistido, com duração de teste, equipamento e versão; licença, instalação, custos de terceiros e suporte definidos. A demo atual usa catálogo local e aprovação por timer e permanece identificada como demonstração até substituir o caminho operacional.

**Fora do escopo:** homologação de todo hardware disponível, TEF genérico ou novos fornecedores sem contrato. **Recuperação:** suspender novas compras no dispositivo afetado, consultar pagamentos em aberto e orientar atendimento assistido; nunca confirmar pagamento localmente para contornar falha do provedor.

[[PAGE]]

# Oferta comercial e páginas de produto

**C01 é bloqueante para vender com clareza.** Manter a assinatura principal e a vertical Kiosk separada conforme oferta atual, preservando contratos. Organizar capacidades sem criar novos níveis pagos por inferência. Preço, total anual, parcelas, descontos, trial, cancelamento e custos de terceiros devem coincidir com o backend.

| Família comercial | Conteúdo funcional | Página ou grupo |
|---|---|---|
| Atendimento e catálogo | PDV, mesa, QR, garçom, tamanhos, montagem, opções e rodadas | Lanchonete, restaurantes, cardápio QR |
| Canais e entrega | Delivery próprio, iFood, WhatsApp, retirada e entregador | Integração iFood, WhatsApp e segmentos |
| Operação | KDS, workflows, produção, bar, forno/fritura e expedição | Página KDS proposta e páginas por segmento |
| Estoque e resultado | Notas de compra, unidades, lotes, compras, PEPS, ficha, CMV e DRE | Estoque e gestão fiscal; ficha/CMV proposta |
| Fiscal e pagamentos | Fiscal ao consumidor, conciliação e assinatura com NFS-e | Gestão fiscal e oferta/checkout |
| Relacionamento | Clientes, cupons, cashback, recuperação e e-mails | Soluções de vendas e ajuda contextual |
| Especializadas | Nutrição, buffet/quilo, rodízio e multiunidade conforme escopo | Segmentos e conteúdo comprovado |
| Displays e Kiosk | Senhas, TV/Cast e autoatendimento Bravus | Painel de senhas TV e autoatendimento |

Cada recurso recebe ID, resultado, tela, estado (planejado/piloto/disponível), oferta, limites, dependências, responsável e evidência. A matriz completa está em PLANO-COMERCIAL-FEATURES-SEO.md. Não anunciar Cast universal, POS homologado ou “todos os recursos” sem qualificar o escopo efetivamente liberado.

**C02 acompanha as entregas:** problema do cliente → fluxo em tela → benefício observado → capacidades/limites → implantação → prova → CTA. Usar URLs existentes quando cobrirem a intenção. Novas páginas KDS, mesas/comandas, ficha/CMV e migração exigem conteúdo próprio e verificação de sobreposição. Estudo Natureba e comparações com Anota.ai dependem de resultados e autorização; não inventar superioridade ou depoimento.

**SEO técnico:** conferir roteador, public-routes, prerender, sitemap, canonical, robots, mobile, metadados e ligações internas. Dados estruturados refletem conteúdo visível; áreas privadas e documentos fiscais não são indexados. Não multiplicar páginas quase iguais nem prometer ranking.

**Medição:** visita → demonstração → cadastro qualificado → configuração → primeira venda operacional → assinatura paga conciliada → retenção. Carrinho não é receita. C01 aprova coerência; C02 aprova conteúdo/SEO e CTA funcionando. Publicação comercial acompanha o marco homologado.

[[PAGE]]

# Ensaio de lançamento e evidências

O lançamento pago exige assinatura/NFS-e, operação Natureba, iFood, notificações e KDS aprovados. Cast e Kiosk exigem seus marcos para serem vendidos como disponíveis. Toda evidência deve identificar versão, ambiente, cenário, resultado, executor e data, sem publicar dados fiscais, credenciais ou identificadores financeiros sensíveis.

| Cenário obrigatório | Resultado esperado |
|---|---|
| Assinatura e NFS-e | Cobrança/acesso corretos, nota autorizada e recebida com endereço fiel |
| Pendência e abandono | Zero efeitos operacionais antes da aprovação online; recuperação separada |
| Baguetes e marmitex | Tamanho, escolhas, preço, estação e consumo corretos por item |
| Rodadas e preparo | Três itens e novas rodadas visíveis; workflows distintos sem duplicidade |
| iFood e retiradas | Eventos recuperáveis; status nos dois lados; cliente/motoboy separados |
| Nota de compra e CMV | Quantidades e conversões corretas; saldo/lotes/custo conciliados |
| Caixa e virada | Pedido antigo e novo rastreáveis; fechamento sem divergência inexplicada |
| Dispositivos | Falhas e reconexão sem perda, vazamento ou recobrança |

**Pré publicação:** zero P0 aberto; testes críticos executados; papéis reais e isolamento de loja provados; catálogo/configuração aprovados; revisão de UX e operador concluída; versões de banco/functions/frontend compatíveis; suporte e contingência definidos. O CI existente não prova que o deploy da Vercel aguarda todos os checks: verificar o processo de release.

**Durante o piloto:** acompanhar pedidos confirmados sem ticket, duplicidades, atraso por estação, falhas de comunicação, divergência de caixa/lotes e necessidade de ajuda. Definir limites de tempo e volume com a loja antes do ensaio. Interromper o canal afetado por risco de integridade; preservar eventos/dados e reconciliar antes de retentar.

**Pendências para o Planning:** data e pico Natureba; regras reais de montagem; política de cobrança no salão e iFood na entrega; funções indispensáveis do Anota.ai; TV/navegador/rede; equipamento/documentação Bravus; responsáveis nominais e capacidade semanal. Pendência tem dono e próxima ação, nunca aprovação presumida.

**Base desta versão:** repositório local em e1076b6, mandato e handoff de 09/09/2026; TypeScript PASS, Vitest 377 PASS e 14 SKIPPED; handler fiscal Deno PASS. Atualização 09/09: PDF corrigido publicado e conferido com contrato social; gatilhos de confirmação de pedido corrigidos e verificados no banco, com rollback de fixtures. Sem nova prova de pagamento real, emissão, recebimento de e-mail, iFood, Cast ou hardware. Os testes locais não certificam esses fluxos.

**Documentos de trabalho:** PLANO-LANCAMENTO-NATUREBA-KIOSK.md concentra achados e contratos de aceite; PLANO-COMERCIAL-FEATURES-SEO.md detalha a oferta; MISEON_HEAD_OF_ENGINEERING.md registra decisões. Este documento é a referência de execução da equipe e deve ser atualizado junto ao board.

[[PAGE]]

# Referências e rastreabilidade

Fontes técnicas consultadas em 09/09/2026. Elas orientam o planejamento; não comprovam a configuração ou homologação específica do MiseOn. Registrar evidência de execução nos itens do backlog.

| Referência | Uso no plano |
|---|---|
| Scrum Guide oficial | Product Goal, Sprint Goal, responsabilidades e Definition of Done |
| GitHub Projects | Board, iterações, campos e ligação entre issues e PRs |
| W3C WCAG 2.2 | Acessibilidade e critérios para controles operacionais |
| Efí Notificações e Assinatura | Consulta de eventos, cobrança e recorrência |
| Prefeitura de São Paulo | Consulta de autenticidade da NFS-e, se confirmado o emissor |
| iFood Developer | Eventos/ACK e contratos de integração; acesso integral retornou 403 na pesquisa |
| Google Cast | Sender, Custom Web Receiver e limites de compatibilidade |
| Google Search Central | Conteúdo útil, confiável e orientado ao público |
| Bravus Core e Anota AI | Descoberta de hardware e possibilidades de integração/migração |

https://scrumguides.org/scrum-guide.html

https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects

https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

https://dev.efipay.com.br/docs/api-cobrancas/notificacoes/

https://dev.efipay.com.br/docs/api-cobrancas/assinatura/

https://nfe.prefeitura.sp.gov.br/publico/verificacao.aspx?tipo=0

https://developer.ifood.com.br/pt-BR/docs/guides/modules/events/polling-overview

https://developers.google.com/cast/docs/web_receiver

https://developers.google.com/cast/docs/web_sender

https://developers.google.com/search/docs/fundamentals/creating-helpful-content

https://bravuscore.com.br/

https://integ-public-platform-docs.anota.ai/

# MiseOn — diagnóstico técnico e consultoria de produto

Data: 13/09/2026. Base local: commit `9878b45`. Situação comercial informada: nenhum cliente ainda.

## Parecer executivo

O MiseOn tem uma base funcional ampla e investimento real no domínio de alimentos: ficha técnica, unidades, rendimento, produção, estoque por lotes e custo. Há espaço para transformá-la em uma oferta competitiva. A prontidão comercial, porém, está limitada por defeitos de acesso, permissões excessivas no banco e inconsistências no fluxo de venda. Minha recomendação é estabilizar uma operação específica, acompanhar os primeiros restaurantes e provar um resultado mensurável antes de expandir funcionalidades.

Não recomendo uma reescrita nem uma disputa por quantidade de módulos. Recomendo vender implantação acompanhada e controle confiável de custo e produção para um perfil estreito de restaurante.

## Escopo e grau de certeza

Inspecionados: autenticação e recuperação de senha; layout e vínculo de loja; criação de pedidos no PDV; chat; contingência offline; monitoramento de erros; configuração de testes e CI; páginas comerciais; estrutura dos módulos; migrations relevantes. Consultados em produção, somente para leitura: advisors de segurança e desempenho, definições e permissões de funções/views selecionadas. Pesquisados os sites oficiais dos três concorrentes e a documentação de autenticação do Supabase.

Esta é uma auditoria ampla por amostragem, com achados concretos, não uma certificação de todas as telas, integrações ou segurança. Não realizei login na conta Google do usuário, simulação de carga, emissão fiscal, cobrança real, restauração de backup ou exploração que alterasse dados. Não alterei código de aplicação, configurações ou banco de produção. As correções abaixo são propostas, ainda não implementadas.

Classificações: **confirmado** = código/configuração diretamente verificados; **risco** = caminho de falha identificado, sem comprovação de ocorrência; **hipótese comercial** = proposta a validar com clientes. P0 bloqueia abertura pública; P1 precede operação assistida; P2 entra após estabilização.

## 1. Login Google: causa encontrada

**P1 — confirmado no código; reprodução na conta real pendente.**

Em `src/App.tsx:105`, `AuthRecoveryRedirect` considera recuperação de senha quando encontra `type=recovery` **ou qualquer `access_token`** no fragmento da URL. Um retorno normal de OAuth no fluxo implícito também contém `access_token`. O login administrativo solicita corretamente retorno a `/admin` (`src/pages/admin/Login.tsx:76`), mas o redirecionador global pode desviá-lo para `/redefinir-senha`.

Em `src/pages/RedefinirSenha.tsx:47`, a tela abre o formulário tanto com `PASSWORD_RECOVERY` quanto com `SIGNED_IN`; também aceita qualquer sessão existente via `getSession`. Por isso, a sessão Google pode ser apresentada como oportunidade de cadastrar outra senha. Depois da troca, a tela encerra a sessão, e uma nova tentativa com Google volta a passar pelo mesmo desvio. Isso explica a repetição relatada; não significa que observei um loop infinito de navegação no navegador.

O defeito não depende de a conta Google precisar de uma senha local. Também pode afetar magic links e os acessos de clientes, porque o redirecionador fica acima das rotas. Há ainda uma regra ampla que transforma qualquer `error` na URL em recuperação expirada, mascarando cancelamentos/erros OAuth.

Correção proposta:

1. Reconhecer recuperação pelo parâmetro exato `type=recovery` e pelo evento `PASSWORD_RECOVERY`; nunca pela mera presença de token. Usar parsing de parâmetros, não busca textual ampla.
2. Preservar o destino e o portal de cada fluxo. Tratar erros de OAuth na experiência de login, sem classificá-los como senha expirada.
3. Separar intenção de recuperação de sessão normal, cuidando também do caso em que o SDK consome a URL antes de a tela montar.
4. Tratar o erro devolvido por `signInWithOAuth`: hoje o login administrativo ativa o carregamento e ignora o retorno de erro.
5. Conferir Site URL e Redirect URLs de produção/preview no Supabase. Essa configuração não foi auditada nesta sessão e é uma verificação complementar, não a causa necessária para explicar o defeito encontrado.

Aceite: Google retorna ao painel para usuário vinculado; usuário sem loja chega ao onboarding; cliente volta ao cardápio/pedidos; magic link entra sem pedir senha; recuperação válida permite trocar senha; link expirado e cancelamento OAuth mostram mensagens adequadas; logout e novo login não repetem o desvio.

Referências: [Google no Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google) e [eventos de autenticação](https://supabase.com/docs/reference/javascript/auth-onauthstatechange).

## 2. Achados de engenharia priorizados

| Prioridade | Achado e evidência | Consequência e ação |
|---|---|---|
| P0 | **Confirmado:** `fn_ajustar_operacao_nicho(uuid)` em produção é `SECURITY DEFINER`, pertence a papel com bypass de RLS, aceita execução por `anon` e `authenticated` e não verifica identidade/vínculo. A definição atual atualiza estação e modalidade de venda de produtos da loja recebida. | Superfície de alteração indevida da operação. Restringir execução ao contexto necessário e validar autorização no servidor. Não executei a mutação para demonstrar impacto. |
| P0 | **Confirmado:** `vw_insumos_a_revisar` permite SELECT a `anon`/`authenticated`, usa privilégios do criador e não filtra vínculo de loja. | Risco de leitura transversal de dados internos. Uma leitura agregada sob papel `anon` retornou **0 registros**; não foi demonstrado vazamento de registros existentes. Aplicar isolamento e testar duas lojas. |
| P1 | **Confirmado:** callback OAuth classificado como recuperação. | Bloqueia ativação e confiança; corrigir antes de enviar novos interessados ao cadastro. |
| P1 | **Confirmado no código:** PDV cria pedido, itens e opções em chamadas HTTP separadas (`src/lib/pedidos.ts:49–94`), depois cria pagamento na página. | Falha intermediária pode deixar venda incompleta; repetir a ação pode criar outro pedido. Consolidar criação em transação no servidor e usar chave de idempotência. Reproduzir falhas após cada etapa em ambiente de testes. |
| P1 | **Confirmado:** na conclusão do PDV, falha ao atualizar envio à cozinha só gera `console.error`; a tela ainda pode mostrar “Venda concluída!” (`src/pages/admin/PDV.tsx:309–324`). | Operador acredita que a cozinha recebeu. Exibir pendência recuperável e reconciliar envio, sem duplicar venda. |
| P1 | **Confirmado no código:** cabeçalho do chat é capturado na importação de `src/lib/supabase.ts`; `useChat` cria ou migra a credencial depois. | Na primeira visita, requisições podem sair sem a credencial exigida pela RLS. Definir uma autoridade para a sessão e obter o valor atualizado por requisição. Testar primeiro acesso, recarga e migração de sessão antiga. |
| P1 | **Risco confirmado por construção:** `monitorErros.ts` envia `window.location.href` integral para o banco. | Um erro durante callback pode registrar tokens presentes na URL. Registrar somente rota e parâmetros permitidos; remover fragmento e dados sensíveis também de mensagem/stack. Não consultei tokens reais nem confirmei exposição histórica. |
| P1 | **Lacuna confirmada:** `cypress/e2e/auth.cy.ts` injeta sessão e evita a saída OAuth; não exercita o retorno que está quebrado. | Cobertura nominal de autenticação não protege o cenário real. Acrescentar testes de callbacks e uma verificação manual de integração Google. |
| P1 | **Confirmado:** texto anual em `Home.tsx:2081` apresenta “3x, 6x, 8x ou 12x de R$ 149,90”. | As modalidades não totalizam o mesmo valor. Para total de R$ 1.798,80: 3x R$ 599,60; 6x R$ 299,80; 8x R$ 224,85; 12x R$ 149,90, antes de eventuais juros. Unificar valores do anúncio e checkout. |
| P2 | **Confirmado:** `localOfflineQueue.ts` existe, mas suas funções não têm consumidores em `src`; o service worker está configurado como `selfDestroying`. | Não há base para prometer que o PDV continua vendendo offline. Definir contingência honesta e testar recuperação da conexão. A ausência de SW sozinha não prova ausência de offline; a fila desconectada é a evidência adicional. |
| P2 | **Confirmado:** `AdminLayout` escolhe `rels[0]`, sem escolha explícita de loja. | Para conta com vários vínculos, falta seleção determinística da loja ativa. Evitar vender multiunidade antes de validar essa experiência. |
| P2 | **Risco de entrega:** CI e deploy Vercel são descritos como fluxos independentes em `.github/workflows/ci.yml`. | Não há evidência local de que testes reprovados impeçam publicação. Conferir proteções reais de branch/deploy e exigir os checks antes da promoção. Não verifiquei as configurações remotas do GitHub/Vercel. |

### Banco: o que os advisors significam

Segurança: três views sinalizadas, duas funções sem `search_path` fixo, proteção de senhas vazadas desabilitada e diversas funções privilegiadas executáveis pelos papéis de API. Nem tudo é vulnerabilidade: `lojas_publicas` contém projeção de campos de vitrine e filtra lojas ativas; `plataforma_pagamento_publico` também tem finalidade pública. Funções como `fn_definir_classificacao_insumo` verificam papel da loja. Não se deve revogar tudo indiscriminadamente.

As 12 tabelas com RLS sem políticas podem ser internas, acessadas por servidor. Isso não significa que estejam abertas: para o usuário comum, a ausência de política tende a bloquear o acesso.

Desempenho: 96 ocorrências de FK sem índice, 38 de avaliação de autenticação em políticas, 307 de políticas permissivas múltiplas e 25 índices classificados sem uso. São alertas de estrutura, **não medições de lentidão**. Priorizar consultas reais de pedidos/KDS/estoque, medir plano com dados representativos e revisar sobreposição de políticas. Com poucos dados, não remover índices apenas por ausência de uso.

A migration de `fn_ajustar_operacao_nicho` revoga PUBLIC, mas a função em produção está executável por `anon`. Isso comprova diferença entre a expectativa daquele arquivo e a permissão atual; requer rastrear grants posteriores/defaults e testar reconstrução, sem concluir que todas as migrations estão divergentes.

## 3. Pontos fortes e limites do produto

| Área | Base observada | Limite para a oferta |
|---|---|---|
| Custo e produção | Módulos de fichas, conversão de unidades, XML, lotes, PEPS, rendimento e preparos; testes específicos de domínio. | Melhor hipótese de diferenciação. Exige prova ponta a ponta com nota, quantidade real, venda e CMV conciliados. |
| Operação | PDV, mesas, garçom, KDS, entregas, totem e TV presentes. | Amplitude aumenta o custo de suporte. Começar com um fluxo principal validado. |
| Aquisição e relacionamento | Cardápio próprio, marketing, WhatsApp, chat e ferramentas comerciais. | Presença de tela não comprova confiabilidade de integração, entrega de mensagens ou aumento de vendas. |
| Integrações | Código para iFood, fiscal, Pix/cartão e balanças. | Não foram verificadas homologações, disponibilidade contratual nem compatibilidade física. Vender somente o que estiver validado para o caso do cliente. |
| Qualidade técnica | TypeScript estrito, testes de domínio, CI, integração local prevista e monitoramento de erros. | Há lacunas nos testes de jornada e transações; passar testes não equivale a prontidão operacional. |
| Experiência inicial | Onboarding guiado, configuração da loja, permissões e página para quem ainda não tem loja. | O acesso quebrado impede chegar a esses recursos; excesso de opções pode dificultar ativação. Validar com observação de usuários. |

Pontos fortes: conhecimento de operação de cozinha codificado; amplitude para acompanhar crescimento; oportunidades de automação usando dados já disponíveis; preocupação com auditoria e testes. Pontos fracos: confiabilidade desigual entre módulos, manutenção dispersa, primeira experiência vulnerável, pouca prova comercial e grande superfície para uma operação ainda sem clientes.

Em particular, a regra de cozinha aparece no serviço de pedidos e novamente no PDV com critérios diferentes. Essa duplicação deve convergir para uma decisão autoritativa no servidor. A documentação antiga também não deve substituir a evidência atual: relatórios de centenas de testes aprovados em outra execução não certificam o checkout e ambiente atuais.

## 4. Concorrência: o que é necessário para competir

Comparação baseada em páginas oficiais consultadas em 13/09/2026, não em testes independentes dos produtos. Quantidades de clientes e resultados publicados pelos fornecedores são alegações comerciais.

| Concorrente | Posicionamento e capacidades anunciadas | Implicação para o MiseOn |
|---|---|---|
| [Consumer](https://consumer.com.br/) | Gestão ampla com PDV, estoque, ficha técnica, fiscal e delivery; plano gratuito até 200 pedidos/mês, suporte e operação offline anunciados. | Ser apenas completo ou barato não cria vantagem suficiente. Implantação fácil e confiabilidade são parte da concorrência. |
| [Saipos](https://saipos.com/) | Gestão integrada de balcão, salão e delivery, fiscal, estoque, integrações, balanças/maquininhas e API pública. | Integração operacional já é expectativa. Evitar depender de promessas de compatibilidade não testadas. |
| [Anota AI](https://anota.ai/home/) | Ênfase em cardápio e automação de atendimento/vendas, com expansão para gestão. Na página: mensal de R$ 99,99 até 150 pedidos, R$ 199,99 de 151 a 250 e R$ 299,99 acima de 250, além de taxas de pagamento online. | “Ter IA no WhatsApp” é uma categoria concorrida. A oportunidade precisa aparecer no resultado entregue ao restaurante. |

Não encontrei base para afirmar que os concorrentes não têm controle de CMV, estoque ou fichas. O diferencial do MiseOn deve ser demonstrado na facilidade de executar e conferir a cadeia **compra → preparo → venda → custo**, e não apenas na existência das telas.

O preço local anunciado, R$ 169,90/mês, não é automaticamente caro ou barato frente a pacotes diferentes. Antes de baixar, medir custo por loja: infraestrutura, mensagens/IA, meios de pagamento suportados pela empresa, implantação e horas de atendimento. Fórmula gerencial: contribuição mensal = receita líquida da assinatura − custos variáveis por loja − custo do suporte recorrente. Separar implantação do suporte mensal para não esconder prejuízo no primeiro mês.

## 5. Estratégia para os primeiros clientes

**Hipótese de segmento inicial:** marmitarias/cozinhas de comida pronta ou saudável, de uma unidade, com produção recorrente e interesse em ficha técnica, porcionamento e desperdício. É uma hipótese coerente com o produto observado; entrevistas devem confirmar se a dor é urgente e se os responsáveis pagam para resolvê-la.

Proposta de valor a testar: **“Saiba quanto custa cada preparo e acompanhe o que foi comprado, produzido e vendido, com implantação acompanhada.”** Evitar prometer lucro garantido ou um percentual de economia sem medição.

Oferta inicial recomendada: um pacote principal, mensal, com escopo explícito e implantação pessoal. Escolher 3–5 parceiros de projeto, com teste por prazo definido, encontros semanais e compromisso de fornecer feedback. Buscar conversão paga; pilotos gratuitos indefinidos não validam disposição de pagar. Não tornar totem, 3D, televisão ou vários canais requisitos para começar.

Aquisição sugerida, como experimento e não previsão:

1. Selecionar 20–30 operações locais do mesmo perfil e entrevistar dez gestores.
2. Perguntar como apuram custo, onde perdem estoque e quanto tempo gastam fechando o dia. Pedir exemplos reais, sem apresentar dezenas de funcionalidades antes de ouvir.
3. Demonstrar o ciclo de uma nota e uma receita reais, com autorização do estabelecimento. Medir tempo e pontos de dúvida.
4. Convidar 3–5 para piloto assistido; migrar cardápio e configurar apenas o necessário.
5. Registrar motivos de adesão, desistência e não compra. Publicar um estudo de caso somente com dados reais e consentimento.

A home deveria responder rapidamente: para quem é, qual problema resolve, o que está incluído, como começar e qual o próximo passo. Reduzir dispersão visual e afirmações amplas. O texto atual contém promessas como redução de até 35% do preparo e audiência de milhares; exigir base verificável ou reformular como possibilidade/objetivo. Sem clientes, usar demonstrações identificadas como demonstrações, nunca criar aparência de depoimentos reais.

## 6. Plano de execução e critérios de saída

Prazos abaixo são faixas de planejamento, dependentes da capacidade de implementação e das validações; não compromisso de entrega.

| Etapa | Trabalho | Critério para avançar |
|---|---|---|
| Primeiros 2–3 dias | OAuth, permissões P0, sanitização de URLs e oferta anual. | Google/magic link/recovery corretos; acesso cruzado negado; anúncio coerente; nenhum token novo nos logs. |
| Semana 1–2 | Transação/idempotência de pedido, falhas de cozinha, chat inicial e testes de regressão. | Uma venda completa ou falha recuperável explícita; retry não duplica; chat funciona em sessão nova. |
| Semana 2–4 | Piloto com 3–5 operações do mesmo perfil; implantação e atendimento próximo. | Pedido, pagamento, cozinha, cancelamento e estoque conciliados em turno real; usuários conseguem repetir o processo. |
| Dias 30–60 | Corrigir fricções, medir suporte, ativação e custo por loja; fechar primeiras assinaturas. | Uso recorrente e disposição de pagar; gargalos identificados por evidência. |
| Dias 60–90 | Padronizar onboarding, materiais, suporte e um estudo de caso; ampliar prospecção com cautela. | Processo de implantação repetível e economia de atendimento sustentável. |

Responsabilidades: engenharia responde por integridade e regressões; fundador/comercial por entrevistas e conversão; implantação/suporte por primeira operação e incidentes. Mesmo sendo a mesma pessoa, reservar tempo distinto para essas tarefas.

Métricas a instrumentar: conversão visita→cadastro→primeiro login; sucesso de OAuth por tentativa; tempo até primeiro cardápio/pedido; operações ativas por semana; falhas por 100 pedidos; pagamentos pendentes sem resolução; pedidos sem itens; divergências de estoque; tempo de implantação e suporte por loja; piloto→pagante; cancelamento e motivo. Definir eventos sem tokens nem dados pessoais desnecessários.

Metas de piloto propostas: completar o primeiro fluxo em sessão acompanhada; nenhum pedido perdido ou duplicado nos cenários de aceite; toda divergência financeira explicada; responsável usando semanalmente e confirmando valor percebido. Com 3–5 lojas, trabalhar também com contagens absolutas: percentuais e churn ainda serão instáveis.

## 7. Validação técnica realizada e limites

- Vitest: **460 aprovados, 0 falhas, 17 pendentes/não executados**, de 477 testes reportados. Relatório em `scratch/diagnostico-vitest.json`. Integração que depende de credenciais não deve ser contabilizada como aprovada.
- TypeScript: `tsc -b --pretty false` aprovado. O compilador exigiu execução fora do sandbox por permissão de leitura da dependência.
- Advisors de segurança e desempenho consultados em produção; achados relevantes conferidos nas definições/permissões.
- Consulta agregada somente de leitura como `anon` à view de revisão: zero registros.
- ESLint: `eslint . --max-warnings 0` aprovado, sem saída de erros ou avisos; também exigiu execução fora do sandbox para ler a dependência instalada.
- Não executados: build completo/prerender, Cypress, OAuth real, testes físicos de periféricos, carga e recuperação de desastre. Não há declaração de homologação fiscal, LGPD ou certificação de segurança.

Antes da venda em escala, executar também: isolamento entre duas lojas e papéis; callbacks duplicados/de fora de ordem; pagamento recusado/cancelado; pedido com adicionais; cancelamento com recomposição correta do estoque; perda de rede no meio da venda; reabertura após deploy; recuperação de backup em ambiente isolado. A revisão jurídica e fiscal da oferta deve acompanhar a implementação quando aplicável.

Decisão recomendada: resolver os bloqueadores e abrir piloto acompanhado com escopo pequeno. Expandir após provar que o restaurante consegue operar, conferir seus números e deseja continuar pagando.

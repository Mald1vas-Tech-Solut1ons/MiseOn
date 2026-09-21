# Backlog de conversão — MiseOn

**Versão:** 19/09/2026  
**Critério:** primeiro proteger a credibilidade e o caminho de conversão; depois ampliar demonstração e segmentação; por fim refinar apresentação.

## Estado em 19/09/2026

| Item | Estado | Evidência |
|---|---|---|
| P0.1 Promessa da home | **Concluído localmente** | `src/pages/PositioningHome.tsx` |
| P0.2 DRE demonstrativa | **Mitigação concluída** | alerta persistente e teste em `DreGerencial` |
| P0.3 Prova social | **Concluído localmente** | redirect de `/depoimentos`, vídeos/cases removidos e artigos de risco em rascunho |
| P0.4 Preços | **Concluído para o site/schema** | `SAAS_PRICING` e schema sem `99,90` publicado |
| P0.5 Marca | **Concluído no repositório público** | “no/do MiseOn”; LinkedIn externo apenas auditado |
| P0.6 CTAs | **Concluído e verificado** | teste, demonstração e WhatsApp nas 32 rotas prerenderizadas |
| P0.7 Cadastro | **Implementado; aguarda fluxo autenticado completo** | cadastro separado do login e CTA validado até a entrada |
| P0.8 Qualificadores | **Concluído no site** | páginas distinguem disponível/configurável/demonstrativo |
| P0.9 Saúde das integrações | **Implementado; risco arquitetural registrado** | iFood/WhatsApp só ficam “Feito” quando saudáveis |
| P1.1 Fluxo visual | **Concluído e responsivo** | home validada em desktop e mobile |
| P1.2 Por que MiseOn | **Concluído** | cinco diferenciais verificáveis |
| P1.3 Cinco segmentos | **Concluído** | cinco rotas com conteúdo, evidência e SEO próprios |
| P1.4–P1.5 Demonstrações | **Parcial** | capturas reais versionadas; biblioteca completa de microdemonstrações ainda pendente |
| P1.6 Schema | **Concluído para as rotas públicas atuais** | `docs/auditoria-rotas-publicas.md` |
| P1.7 Instrumentação | **Pendente** | não foi criada telemetria nova nesta execução |
| P2.1–P2.2 Refinamento | **Concluído no escopo da nova home** | QA visual em 10 cenários e animação respeitando redução de movimento |

Nada foi publicado ou enviado ao remoto nesta execução.

## Definição de pronto global

Uma entrega só está pronta quando:

- funciona em português e inglês quando aplicável;
- passa `npx tsc -b --noEmit`, `npx vitest run` e `npm run build`;
- não cria depoimento, número, integração ativa ou resultado sem prova;
- não altera nem usa o tenant `natureba`;
- usa `registrarLead` e mostra o fallback de WhatsApp em caso de falha;
- mantém AdSense restrito ao blog;
- preserva title, description, canonical e um único H1 nas rotas públicas.

## P0 — clareza, marca e conversão

### P0.1 Trocar a promessa central da home

**Problema:** “lucro real” é prometido enquanto a DRE usa dados demonstrativos.  
**Entrega:** H1 “Do pedido ao custo real, o MiseOn conecta sua operação”, subtítulo e CTAs do mapa de mensagens.  
**Aceite:** nenhuma frase da home garante lucro apurado; o fluxo pedido → produção → estoque/custo fica explícito.

### P0.2 Identificar ou retirar a DRE demonstrativa

**Problema:** valores fixos podem ser confundidos com apuração real.  
**Entrega imediata:** selo persistente “Dados demonstrativos” e texto que proíba uso contábil.  
**Entrega definitiva:** ligar a DRE às fontes reais, documentar a fórmula e testar reconciliação.  
**Aceite:** nenhum valor fixo aparece como dado da loja.

### P0.3 Remover prova social não comprovada

**Problema:** `/depoimentos` e metadados falam em clientes reais sem comprovação.  
**Entrega:** converter a página em “Demonstrações do MiseOn” ou removê-la da navegação e do índice.  
**Aceite:** busca no projeto não encontra alegações de cliente pagante, volume de restaurantes ou depoimento não autorizado.

### P0.4 Unificar preços

**Problema:** schema e páginas usam valores diferentes.  
**Entrega:** uma única fonte de verdade para preço mensal/anual, consumida por planos, landing pages e JSON-LD.  
**Aceite:** testes comparam oferta visual e schema; nenhum `99.90` residual é publicado sem ser um plano real.

### P0.5 Padronizar a marca

**Problema:** há “na MiseOn” e “da MiseOn”.  
**Entrega:** revisão de conteúdo, metadata, Open Graph, schema e rodapé para “MiseOn”, “no MiseOn” e “do MiseOn”.  
**Aceite:** busca textual não encontra variantes indevidas; o LinkedIn oficial é revisado manualmente quando sua URL for fornecida.

### P0.6 Validar todos os CTAs

**Entrega:** três trilhas claras — testar, agendar demonstração e conhecer o WhatsApp com IA.  
**Aceite:** cada CTA abre o destino correto, preserva parâmetros de campanha, registra o lead por `registrarLead` e apresenta fallback se houver erro.

### P0.7 Concluir o acesso de novos usuários

**Situação encontrada:** alterações locais já diferenciam cadastro de login, iniciam por link mágico e permitem selecionar loja quando a conta administra mais de uma.  
**Entrega:** finalizar traduções, testes e revisão do fluxo sem publicar antes da validação completa.  
**Aceite:** novo usuário não vê “Bem-vindo de volta”; conta existente continua entrando por senha; administrador multiunidade consegue trocar de loja sem vazar contexto.

### P0.8 Qualificar integrações

**Entrega:** badges consistentes: “Disponível”, “Requer configuração”, “Demonstrativo”.  
**Aceite:** WhatsApp, iFood e NFC-e nunca aparecem como ativos por padrão; fiscal menciona homologação/configuração.

### P0.9 Fazer o onboarding refletir a saúde real

**Problema:** em 19/09/2026, o checklist mostrou iFood e WhatsApp como “Feito”, apesar de WhatsApp desconectado e iFood vinculado sem receber (HTTP 403).  
**Entrega:** separar “configuração concluída” de “conectado e saudável”, usando a autoridade de saúde de cada integração.  
**Aceite:** o checklist nunca usa “Feito” quando a integração está desconectada, bloqueada ou sem receber; o texto aponta a ação correta e não culpa a loja quando o bloqueio é da plataforma/parceiro.

## P1 — demonstração, segmentação e evidência

### P1.1 Criar o fluxo visual completo

**Entrega:** componente acessível para entrada do pedido → KDS → entrega → estoque/custo, com variações por canal.  
**Aceite:** funciona em mobile, tem texto alternativo e não inclui DRE como dado real.

### P1.2 Reestruturar “Por que MiseOn?”

**Entrega:** cinco diferenciais do mapa de mensagens, cada um ligado a uma evidência do produto.  
**Aceite:** nenhuma superlatividade ou comparação sem fonte.

### P1.3 Revisar as cinco páginas segmentadas

**Rotas:** restaurante com salão, hamburgueria, lanchonete, pizzaria e dark kitchen.  
**Entrega:** H1, dor, fluxo, funcionalidades relevantes, CTA primário e links para os quatro pilares.  
**Aceite:** não duplicar a home trocando apenas o nome do segmento; cada página responde a uma operação específica.

### P1.4 Criar demonstrações verificáveis

**Entrega:** vídeos e capturas feitos apenas no tenant `lanchepaulista`, com dados de demonstração identificados.  
**Aceite:** legenda informa quando a tela é exemplo; nenhuma peça usa `natureba` ou sugere cliente real.

### P1.5 Substituir “depoimentos” por evidência real de produto

**Entrega:** biblioteca de demonstrações curtas: abrir mesa, lançar item, receber no KDS, importar documento fiscal, consultar custo e enviar link pelo WhatsApp.  
**Aceite:** cada material tem roteiro, tela correta e data de captura.

### P1.6 Revisar schema por tipo de página

**Entrega:** matriz de `SoftwareApplication`, `FAQPage`, `BreadcrumbList` e conteúdo sem schema específico.  
**Aceite:** schema aparece somente quando o conteúdo correspondente está visível; preço é consistente.

### P1.7 Instrumentar o funil sem inventar resultado

**Eventos mínimos:** CTA visto, CTA clicado, cadastro iniciado, link mágico solicitado, lead enviado, fallback aberto, demonstração agendada.  
**Aceite:** dashboard separa evento de conversão real; nenhum percentual vira comunicação pública sem amostra e período documentados.

## P2 — refinamento visual e conteúdo secundário

### P2.1 Refinar hierarquia visual da home

**Entrega:** melhorar ritmo, contraste, imagens e responsividade depois do novo conteúdo estar aprovado.  
**Aceite:** Lighthouse e revisão manual em larguras móveis e desktop.

### P2.2 Adicionar animação do fluxo

**Entrega:** animação progressiva opcional, com fallback estático e respeito a `prefers-reduced-motion`.  
**Aceite:** não atrasa o primeiro carregamento nem esconde informação.

### P2.3 Criar conteúdo de apoio por tarefa

**Entrega:** artigos e FAQs sobre comanda, QR, ficha técnica, custo e atendimento no WhatsApp.  
**Aceite:** links internos apontam para a página comercial correta; números de mercado só entram com fonte.

### P2.4 Revisar imagens sociais

**Entrega:** Open Graph por pilar/segmento usando a identidade oficial.  
**Aceite:** sem logos de clientes, números de resultado ou telas que não correspondem ao texto.

## Matriz de execução sugerida

| Ordem | Item | Impacto | Dependência |
|---:|---|---|---|
| 1 | P0.2 DRE demonstrativa | Credibilidade | Nenhuma |
| 2 | P0.1 Promessa da home | Clareza | Decisão editorial já registrada |
| 3 | P0.3 Prova social | Risco reputacional | Nenhuma |
| 4 | P0.4 Preços | Confiança/SEO | Fonte única de oferta |
| 5 | P0.5 Marca | Consistência | Busca global |
| 6 | P0.6 CTAs | Conversão | Rotas e lead funcionando |
| 7 | P0.7 Cadastro | Ativação | Testes de autenticação |
| 8 | P0.8 Qualificadores | Expectativa correta | Inventário de integrações |
| 9 | P1.1 Fluxo visual | Entendimento | Mensagem P0 aprovada |
| 10 | P1.3 Segmentos | Aquisição | Componentes e CTAs comuns |
| 11 | P1.4–P1.5 Demonstrações | Evidência | Roteiro e tenant de teste |
| 12 | P2 Refinamentos | Apresentação | Conteúdo estável |

## QA de publicação

### Conteúdo

- [ ] “MiseOn” está escrito e flexionado de forma consistente.
- [ ] Não há promessa de cliente, volume ou resultado não comprovado.
- [ ] Integrações têm o qualificador correto.
- [ ] DRE demonstrativa não é apresentada como apuração.

### SEO

- [ ] Title único.
- [ ] Meta description específica.
- [ ] Canonical correto.
- [ ] Um H1.
- [ ] CTA funcional.
- [ ] Links internos úteis.
- [ ] Schema compatível e sem preço divergente.

### Produto

- [ ] TypeScript, testes e build passam antes de push.
- [ ] Cadastro, login e troca de loja foram testados.
- [ ] Nenhum dado foi gravado no tenant `natureba`.
- [ ] Prints e vídeos usam apenas dados de demonstração identificados.

## Fora de escopo até haver prova

- depoimentos ou logos de clientes;
- número de restaurantes;
- percentuais de economia, venda ou desperdício;
- alegação de liderança, superioridade ou exclusividade;
- DRE contábil/gerencial real enquanto a tela usar dados fixos;
- integração “ativa” quando existe apenas implementação/configuração.

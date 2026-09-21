# Auditoria comercial e de posicionamento — MiseOn

**Data:** 19/09/2026  
**Base analisada:** branch `main`, commit `228ecd3`, mais alterações locais ainda não commitadas nas telas de acesso e seleção de loja.  
**Escopo:** site público, rotas segmentadas, metadados, fluxos administrativos, funções Supabase e materiais já existentes no repositório.

## Resultado da execução

Esta auditoria deixou de ser apenas diagnóstico e foi aplicada ao produto local:

- nova home com a promessa “Do pedido ao custo real, o MiseOn conecta sua operação”;
- quatro frentes comerciais, fluxo visual do pedido, seção “Por que MiseOn?” e três CTAs distintos;
- cinco páginas segmentadas e páginas de capacidade com mensagens qualificadas pelo estado real;
- DRE identificada de forma persistente como demonstrativa;
- onboarding de iFood e WhatsApp baseado em saúde/conexão, não na simples presença de um identificador;
- `/depoimentos` redirecionado para demonstrações e alegações de clientes/cases removidas;
- 16 artigos com números ou resultados sem fonte reproduzível movidos para rascunho, sem exclusão do conteúdo;
- preço do schema corrigido para usar a oferta vigente e integrações externas qualificadas;
- auditoria automática aprovada em **32 rotas públicas** e auditoria visual aprovada em **10 cenários desktop/mobile**.

Evidências detalhadas: `docs/auditoria-rotas-publicas.md` e `docs/auditoria-visual-site.md`.

## Como ler esta auditoria

- **Confirmado no código:** há implementação verificável no repositório.
- **Requer configuração:** existe, mas depende de credencial, ativação, homologação ou conexão externa.
- **Demonstrativo:** aparece na interface, porém os dados não vêm hoje de uma apuração real.
- **Não verificado:** não há evidência suficiente para uma promessa comercial.

Esta revisão não alterou dados de produção. O tenant `natureba` não foi acessado nem modificado. As observações de produção registradas em 18/09/2026 foram tratadas como histórico fornecido, não como nova medição.

## Verificação autenticada em produção

Em 19/09/2026 foi realizada uma inspeção autenticada e somente leitura no tenant de provas **Lanche do Paulista**. Nenhum botão de salvar, testar integração, emitir, criar pedido, conectar ou desconectar foi acionado.

| Área | Estado observado | Consequência comercial |
|---|---|---|
| WhatsApp | **Desconectado**; nenhum número conectado | Não usar a captura antiga que mostrava conexão ativa. Comunicar como recurso que exige configuração. |
| iFood | **Vinculado, sem receber**; a tela informa falta de módulos no Portal do Desenvolvedor, 111 tentativas e HTTP 403 | Não anunciar pedidos iFood ativos. A loja não tem correção local a fazer segundo a própria interface. |
| Fiscal da loja | Zero notas, nenhum certificado A1, ambiente de homologação | Não afirmar emissão ativa em produção. A implementação existe, mas não há prova operacional nesta loja. |
| Financeiro | Extrato ao vivo sem vendas no período observado | A leitura operacional do extrato é real, mas não comprova DRE operacional. |
| DRE | Interface mostra “AO VIVO” e “tempo real”, porém o componente usa mês e valores fixos | Inconsistência P0. Rotular como demonstração e remover a aparência de dado real até ligar à autoridade financeira. |
| Assinatura | R$ 149,90/mês no anual; R$ 169,90/mês no mensal; 5% no Pix anual | Confirma a divergência dos schemas com `99,90`. |
| Onboarding | Mostra iFood e WhatsApp como “Feito” | “Feito” não representa saúde da integração; o checklist precisa consultar o estado real. |

Capturas com dados pessoais de equipe, cobrança ou identificação técnica não foram incorporadas ao manual.

## Resumo executivo

O MiseOn tem uma história comercial consistente quando se apresenta como o sistema que conecta o pedido à cozinha, ao estoque e ao custo. A melhor promessa não é “saber o lucro real” neste momento, porque a tela de DRE ainda trabalha com dados demonstrativos. A promessa mais defensável é:

> **Do pedido ao custo real, o MiseOn conecta sua operação.**

Complemento recomendado:

> Salão, delivery, WhatsApp, cozinha, estoque e custos trabalham no mesmo fluxo — sem transformar dado incompleto em margem bonita.

Os maiores riscos atuais são de credibilidade, não de ausência de produto:

1. a home promete lucro real enquanto a DRE é demonstrativa;
2. páginas e metadados apresentam “depoimentos de clientes reais”, apesar de não haver cliente pagante comprovado;
3. preços em dados estruturados divergem do preço exibido nos planos;
4. algumas integrações são comunicadas sem deixar claro que dependem de ativação;
5. há uso inconsistente de “na/da MiseOn”, quando a marca deve ser tratada como **o MiseOn**.

## Matriz de funcionalidades verificadas

| Item solicitado | Situação | Evidência principal | Comunicação comercial segura |
|---|---|---|---|
| Comanda eletrônica para garçons | **Confirmado no código** | `src/pages/admin/PainelGarcomMobile.tsx` | “Comanda móvel para lançar itens, adicionais e acompanhar mesas.” |
| Gestão de mesas | **Confirmado no código** | `src/pages/admin/Mesas.tsx` | “Mapa de mesas, comandas, transferência, taxa de serviço e chamados.” |
| Autoatendimento por QR Code | **Confirmado no código** | `src/pages/admin/Mesas.tsx` e validação de segredo do QR nas migrations | “QR individual por mesa para o cliente acessar o cardápio e pedir.” |
| DRE | **Demonstrativo** | `src/components/admin/DreGerencial.tsx` contém mês e valores fixos | Não vender como DRE operacional até ligar a dados reais. Rotular a tela atual como demonstração. |
| NFC-e | **Requer configuração** | `src/pages/admin/Fiscal.tsx`, funções `fiscal-emitir-nfce` e importação de NFC-e/XML | “Emissão e importação fiscal disponíveis após configuração e homologação.” |
| IA para atendimento no WhatsApp | **Requer configuração** | `supabase/functions/whatsapp-worker/index.ts`, `chat-ai-reception`, `src/pages/admin/WhatsApp.tsx` | “Atendimento com IA disponível após conectar e configurar o número.” |
| Respostas sobre o cardápio | **Confirmado no código** | O worker consulta categorias, produtos, preços, disponibilidade e taxas reais | “A IA consulta o cardápio configurado para responder dúvidas.” |
| Envio de link para pedido | **Confirmado no código** | O worker gera URL do cardápio com atribuição `?wa=` | “A conversa pode encaminhar o cliente ao link do pedido.” |
| Gestão de custos para cozinhas | **Confirmado no código** | Estoque, fichas técnicas, PEPS e `fn_custo_unitario_insumo` | “Fichas, estoque e custo com origem e confiança explícitas.” |

### Observações que protegem a promessa

- O custo unitário informa se o valor é confiável. Quando falta dado, a margem pode ficar nula com um motivo, em vez de exibir um percentual inventado.
- A correção manual do lojista na quantidade da embalagem prevalece sobre leituras automáticas.
- O custo de preparo pode subir recursivamente pela ficha técnica, respeitando o limite definido no banco.
- Venda por peso preserva o preço praticado no quilo.
- O WhatsApp tem transferência para atendimento humano em situações sensíveis, como alergias.
- iFood, WhatsApp e fiscal precisam de ativação/configuração. Implementação no código não é prova de operação ativa em um cliente.

## Diagnóstico da mensagem atual

### O que funciona

- O produto cobre o fluxo diário do salão ao KDS e ao estoque.
- Há páginas segmentadas para restaurante com salão, hamburgueria, lanchonete, pizzaria e dark kitchen.
- O sistema de custo tem um diferencial verificável: explicita a confiança e não força margem quando a base é insuficiente.
- O prerender já fiscaliza `title`, descrição, canonical, H1 único e vazamento de AdSense em rotas públicas.

### O que precisa mudar

#### P0 — promessa de lucro incompatível com a DRE

A home usa “lucro real” como principal resultado. Entretanto, `DreGerencial.tsx` usa valores fixos, inclusive comparação percentual com mês anterior. Enquanto a DRE não for ligada a dados reais, a mensagem deve falar em **operação conectada e custo rastreável**, não em lucro apurado.

#### P0 — prova social não comprovada

Metadados e navegação usam `/depoimentos` e expressões como “clientes reais” e “restaurantes que usam o MiseOn”. Sem cliente pagante comprovado, isso deve ser removido ou convertido em **demonstrações do produto**.

#### P0 — preços divergentes

Há schema com `99,90` e páginas segmentadas com `149,90`, enquanto os planos visíveis usam `149,90` no anual e `169,90` no mensal. O preço deve vir de uma única fonte para página, schema e checkout.

#### P0 — onboarding contradiz a saúde das integrações

Na sessão autenticada, o checklist marcou iFood e WhatsApp como “Feito”, embora o WhatsApp estivesse desconectado e o iFood vinculado sem receber. O onboarding deve separar **configuração iniciada/concluída** de **integração saudável e operacional**.

#### P0 — marca e gênero inconsistentes

Padronizar para **MiseOn**, sem variações, e usar “o MiseOn / do MiseOn / no MiseOn”. Site, metadata, Open Graph, schema e rodapé foram revisados. Não foi localizado um perfil empresarial oficial do MiseOn no LinkedIn. Foi localizada uma [publicação pessoal associada à marca](https://pt.linkedin.com/posts/rafael-paiva-dias_foodservice-autoatendimento-gest%C3%A3oderestaurantes-activity-7505778834089369602-0i7d), usando “MiseOn Kiosk”, mas também a expressão “margem real”. A marca está grafada de forma consistente; a promessa financeira não está alinhada à decisão atual e deve ser revisada pelo titular da publicação. Nenhuma alteração externa foi feita nesta execução.

## Arquitetura de oferta recomendada

### Promessa central

**Do pedido ao custo real, o MiseOn conecta sua operação.**

### Quatro pilares

1. **Operação de salão** — mesas, comandas, garçom, QR e KDS.
2. **Delivery e WhatsApp** — cardápio, checkout, entrega, link de pedido e atendimento com IA após configuração.
3. **Custos e gestão** — estoque, compras, fichas técnicas, rendimento, custo e margem com confiança explícita.
4. **Fiscal e financeiro** — importação fiscal, emissão após homologação, fluxo financeiro e futura DRE operacional.

### Seção “Por que MiseOn?”

Usar apenas diferenciais verificáveis:

- **O custo mostra a origem e a confiança.** Dado insuficiente não vira margem bonita.
- **A entrada fiscal alimenta o estoque.** QR/XML de NFC-e reduz redigitação após configuração.
- **O pedido segue um único fluxo.** Canal, produção, entrega e baixa de insumo permanecem conectados.
- **O atendimento conversa com o cardápio.** A IA do WhatsApp consulta produto e disponibilidade e pode transferir para uma pessoa.
- **A operação se adapta ao formato.** Salão, balcão, delivery e produção compartilham a mesma base.

Evitar “único do mercado”, “o mais completo”, “líder” ou comparação absoluta sem pesquisa independente.

## Fluxo visual recomendado para a home

```text
Cliente / Garçom / Balcão / WhatsApp
                 ↓
        Pedido e pagamento
                 ↓
          KDS e produção
                 ↓
       Entrega ou retirada
                 ↓
   Estoque, ficha e custo apurado
```

O desenho deve indicar que fiscal e integrações externas exigem configuração. A DRE só deve entrar no fluxo como apuração real depois que deixar de usar dados fixos.

## CTAs recomendados

| Intenção | Texto | Destino recomendado |
|---|---|---|
| Explorar sozinho | **Testar o MiseOn por 30 dias** | `/cadastre-se` |
| Venda consultiva | **Agendar uma demonstração** | `/contato` ou WhatsApp com origem registrada |
| Interesse específico | **Conhecer o WhatsApp com IA** | `/api-whatsapp-restaurantes` |

Todos os formulários devem usar `registrarLead`. Em erro, exibir o fallback gerado por `whatsappDoLead` e nunca mostrar sucesso falso.

## Páginas segmentadas

As cinco rotas solicitadas já existem no mapa público e devem manter a mesma promessa central, mudando a ênfase:

| Segmento | Dor principal | Ênfase verificável | CTA principal |
|---|---|---|---|
| Restaurante com salão | Mesa, garçom e cozinha desconectados | Mesas, comanda móvel, QR e KDS | Testar operação de salão |
| Hamburgueria | Adicionais, produção e delivery | Modificadores, KDS, cardápio e custos | Ver fluxo do pedido |
| Lanchonete | Velocidade no balcão | PDV, senha, KDS e estoque | Testar no balcão |
| Pizzaria | Sabores, tamanhos e entrega | Variações, delivery e produção | Agendar demonstração |
| Dark kitchen | Vários canais e expedição | Pedidos, KDS, entrega e custo | Conhecer o fluxo delivery |

Não criar números de economia, aumento de vendas ou redução de desperdício sem medição reproduzível.

## Auditoria técnica de SEO e conversão

### O que já está protegido

O script de prerender verifica, nas rotas públicas:

- `title`;
- meta description;
- canonical;
- exatamente um H1;
- título não duplicado;
- ausência de AdSense fora do blog.

### O que ainda exige revisão editorial

- CTA específico e funcional em cada página;
- links internos coerentes entre pilares e segmentos;
- schema adequado ao tipo de página, não apenas schema genérico;
- preço e oferta vindos da mesma fonte;
- remoção de prova social não comprovada;
- Open Graph consistente com o conteúdo final;
- LinkedIn: perfil empresarial oficial não localizado; publicação pessoal identificada e pendente de revisão editorial externa;
- rodapé e metadata usando sempre “MiseOn”.

## Comparativo honesto

Comparação baseada apenas nas páginas oficiais consultadas em 19/09/2026. Ela descreve comunicação pública, não uma avaliação independente do produto.

| Marca | Ênfase comunicada oficialmente | Leitura para o MiseOn |
|---|---|---|
| [Consumer](https://consumer.com.br/) | PDV, mesas, comanda mobile, delivery e ecossistema amplo; o [Consumer Cloud](https://consumer.com.br/consumer-cloud) reforça a amplitude da oferta | Não competir por escala declarada. Mostrar o fluxo integrado e a honestidade do custo. |
| [Saipos](https://saipos.com/) | Gestão ampla para food service, fiscal, financeiro, estoque, CMV, garçom e integrações | Evitar “mais completo”. Ser mais claro sobre como pedido, estoque e custo se conectam. |
| [GrandChef](https://www.grandchef.com.br/) | PDV, mesas, comandas, QR, delivery, integrações e [controle financeiro](https://www.grandchef.com.br/funcionalidades/controle-financeiro) | Diferenciar pela rastreabilidade do custo e pela comunicação sem promessa inflada. |
| [Anota AI](https://anota.ai/home/) | WhatsApp, cardápio, automação comercial, CRM e recuperação de vendas; também educa o mercado sobre [cardápio digital no WhatsApp](https://anota.ai/blog/cardapio-digital-no-whatsapp/) | Não disputar apenas “IA no WhatsApp”. Mostrar que o atendimento desemboca na operação e no custo. |

Nenhuma comparação autoriza dizer que o MiseOn é melhor, maior, mais barato ou exclusivo sem uma pesquisa separada e documentada. A decisão de posicionamento é competir por **clareza do fluxo e integridade do custo**, enquanto marcas estabelecidas comunicam amplitude e prova social e o Anota AI ocupa de forma mais direta o território de automação no WhatsApp.

## Decisão recomendada

Antes de ampliar conteúdo ou animações, executar os P0: alinhar a promessa, retirar prova social não comprovada, corrigir preços e consolidar a marca. Depois, demonstrar visualmente o fluxo e aprofundar as páginas segmentadas. O detalhamento executável está em `docs/backlog-conversao-miseon.md`; a redação-base está em `docs/mapa-de-mensagens-miseon.md`.

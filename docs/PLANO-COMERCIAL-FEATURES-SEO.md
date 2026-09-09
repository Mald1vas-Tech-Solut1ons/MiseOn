# MiseOn plano comercial e arquitetura de conteúdo

09/09/2026. Proposta de organização da oferta; não altera preços, contratos, permissões ou páginas publicadas. Vinculada ao [plano de lançamento](PLANO-LANCAMENTO-NATUREBA-KIOSK.md).

## Decisão de oferta

Manter uma assinatura principal do software e a vertical Kiosk separada, como a comunicação atual já indica. Organizar as funcionalidades em famílias compreensíveis, com capacidades habilitadas pela operação. Não criar novos planos pagos para corrigir problemas de confiabilidade ou cobrar separadamente algo já contratado. Comercialização de integrações e periféricos deve distinguir licença MiseOn, custos de terceiros, equipamento, instalação e suporte.

A home anuncia “todos os recursos” e “sem taxas extras” para iFood; a vertical Kiosk tem contratação própria. C01 deve reconciliar essas afirmações e explicar precisamente abrangência e dependências. O código `SAAS_PRICING` e a UI atual indicam ciclos mensal/anual, mas existem textos de até 12 parcelas enquanto a configuração apresenta opções até 3. Verificar cobrança efetiva e padronizar antes da contratação; os valores no código não constituem preços novos aprovados por este plano.

## Matriz de famílias funcionais

Estado “base” significa código/telas existentes, sujeito à homologação; nunca significa automaticamente disponível em produção. “Planejado” não pode aparecer como recurso entregue. Alocação proposta para C01, preservando contratos existentes.

| Família | Funcionalidades cobertas | Oferta proposta | Estado e prova necessária |
|---|---|---|---|
| Vendas e catálogo | Produtos, categorias, tamanhos, grupos/opções, adicionais, disponibilidade e preços | Software principal | Base; N05/N13 e de-para por canal |
| Atendimento | PDV, balcão, QR, mesa, comanda, garçom, rodadas e divisão de conta | Software principal | Base; N04/N09 e operação com papéis reais |
| Delivery | Cardápio próprio, endereço, frete, retirada, despacho e entregador | Software principal | Base; fluxo completo, preço e cancelamento |
| Marketplace | iFood, autorização, catálogo, pedidos, opções, status, eventos e disputas aplicáveis | Integração vinculada à assinatura e elegibilidade | Base; I01/I02 e limites do contrato |
| Produção operacional | KDS por estação, workflow, etapas, operador, receita, modificadores e expedição | Software principal | Base a evoluir; W01 com montagem/fritura/forno/bar |
| Buffet e operações mistas | Balança, quilo, comanda individual, adesão a rodízio e extras | Capacidades do software; hardware à parte | Quilo tem base; rodízio planejado M01–M03 |
| Estoque e compras | Entrada fiscal, unidades/conversões, fornecedores, lotes, validade, inventário e compras | Software principal | Base; N02/N03 e rastreabilidade |
| Preparos e custos | Ficha técnica, rendimento, produção em lote, PEPS, CMV e margem | Software principal | Base; consumo e conciliação aprovados |
| Financeiro | Caixa, recebimentos, contas, conciliação e DRE gerencial | Software principal | Base; prova venda → custo → financeiro |
| Pagamento ao restaurante | Pix/crédito online, registro de maquininha externa, cancelamento/estorno | Software + tarifas do provedor claramente separadas | Base; N06/O01; TEF não presumido |
| Fiscal do restaurante | Emissão fiscal e histórico ao consumidor conforme ambiente habilitado | Escopo contratado + requisitos fiscais/provedor | Base; homologação específica, distinta da NFS-e SaaS |
| Assinatura do MiseOn | Contratação, ciclos, renovação, acesso, faturas e NFS-e ao assinante | Obrigação operacional do serviço | S01–S03 bloqueiam lançamento pago |
| Relacionamento | Clientes, cupons, cashback, marketing, recuperação e e-mails transacionais | Software; custos variáveis explícitos se aplicáveis | Base; comprovar cálculo, entrega e preferências |
| WhatsApp | Canal de atendimento, automação e comunicação habilitada | Integração com requisitos e custos publicados | Base; elegibilidade, mensagens e eventual dependência Anota.ai |
| Nutrição | Ficha/nutrição, estimativas, revisão e publicação de informações | Capacidade especializada; validação profissional quando aplicável | Escopo e níveis do plano nutricional precisam de aceite; não prometer laudo ou garantia de ausência de alérgenos |
| Displays | Cardápio/TV, senhas, chamadas e filas cliente/motoboy | Software em dispositivos compatíveis | Base de TV; D01/D02 para Cast |
| Kiosk | Autoatendimento, personalização, pagamento, senha e periféricos | Vertical própria com licença/hardware/homologação | Demo; K01–K05 antes de vender como operacional |
| Administração | Equipe, papéis, configurações, lojas, onboarding, histórico e suporte | Software principal; multiunidade conforme escopo validado | Base; isolamento, provisionamento e limites comprovados |
| Plataforma e parceiros | Operação SaaS, observabilidade, integrações, suporte e gestão comercial | Responsabilidade interna; contratos de parceiro separados | Provar fluxos e serviço contratado; não expor ferramentas internas como benefício sem resultado |

Cada funcionalidade detalhada deve ter um registro no catálogo comercial: ID, nome público, resultado, módulo/tela, estado (planejado/piloto/disponível), oferta, limites, dependências, evidência, responsável, última revisão e páginas que a mencionam. Inventariar rotas/admin/ajuda e contratos para completar subfuncionalidades; não tratar esta matriz de famílias como certificação de cada ação do produto.

## Rede de páginas

Manter URLs existentes quando a intenção já estiver coberta. Uma página por problema principal, com conteúdo específico e ligações entre solução, segmento, demonstração e contratação.

| Grupo | Rotas existentes verificadas ou propostas | Intenção e conteúdo |
|---|---|---|
| Entrada | `/`, `/sobre`, `/contato`, `/cadastre-se` existentes | Proposta clara, prova operacional, oferta, implantação, suporte e CTA |
| Segmentos | `/sistema-para-lanchonete`, `/sistema-para-hamburgueria`, `/sistema-para-restaurantes`, `/sistema-para-pizzaria` existentes | Fluxo próprio de cada operação, limitações e exemplos; Natureba inspira lanchonete/montagem sem inventar depoimento |
| Operações | `/sistema-para-restaurante-por-quilo`, `/sistema-para-bar`, `/sistema-para-dark-kitchen` existentes | Capacidades combináveis, estações, comanda e produção; página de rodízio só após prova M |
| Canais | `/integracao-ifood`, `/cardapio-qr-code`, `/api-whatsapp-restaurantes` existentes | Entrada, tratamento de falhas, requisitos, custos e demonstração do fluxo homologado |
| Gestão | `/gestao-de-estoque-3d`, `/gestao-fiscal-nfe` existentes | Resultado de estoque/fiscal com exemplos corretos; distinguir emissão do restaurante, entrada de compra e NFS-e da assinatura |
| Operacional | Propostas `/kds-cozinha`, `/gestao-mesas-comandas`, `/ficha-tecnica-cmv` | Fluxos e provas reais; criar somente após verificar sobreposição e demanda, sem duplicar páginas de ajuda |
| Displays | `/painel-de-senhas-tv` existente | Cliente/motoboy, equipamento compatível, sessão; seção Cast após D, sem promessa de qualquer Smart TV |
| Kiosk | `/autoatendimento`, `/demo-kiosk` existentes | Demonstração identificada, configuração Bravus, integração, instalação e proposta comercial |
| Oferta | Home existente; proposta `/planos` se melhorar comparação | Ciclo, total, parcelas, descontos, terceiros, equipamentos, trial, cancelamento e suporte coerentes com backend |
| Migração | Proposta `/migracao-de-sistema` | Processo, de-para, continuidade e treino; comparação Anota.ai somente factual, datada e verificável |
| Prova e educação | `/videos`, `/blog` existentes | Vídeos identificando ambiente/versão, guias úteis e estudo Natureba apenas após resultados e autorização |

Estrutura de cada landing: problema e público → tarefa real em tela → como o fluxo funciona → capacidades e limites → implantação/migração → prova verificável → contratação/contato. Interface premium precisa aparecer em imagens reais do incremento aprovado; protótipos recebem identificação de proposta.

## SEO e medição

C02 verifica roteador, `scripts/public-routes.mjs`, prerender, sitemap, canonical, robots, metadados e links. Páginas privadas, pagamento, documento fiscal e dispositivos não entram em indexação pública. Redirecionar aliases quando apropriado; não publicar cópias quase iguais por cidade/segmento. Conteúdo principal precisa ser acessível, legível no mobile e coerente com o conteúdo que o buscador recebe. Dados estruturados devem representar informações visíveis e verdadeiras, sem avaliações fabricadas.

Usar conteúdo útil com experiência demonstrável, conforme [Google Search Central](https://developers.google.com/search/docs/fundamentals/creating-helpful-content). Não prometer ranking, primeira posição ou resultados de ROI sem dados. Avaliar indexação e intenção por página, velocidade, acessibilidade e conversão, além de impressões/cliques.

Funil: visita à solução → demonstração → cadastro qualificado → configuração concluída → primeira venda operacional → assinatura paga e conciliada → retenção. Deduplicar conversão paga no servidor; carrinho ou intenção de cobrança não é receita. Guardar origem comercial sem expor dados pessoais nas URLs e nas ferramentas de medição.

## Critérios de conclusão comercial

1. C01: todas as promessas presentes em home, landings, ajuda e checkout mapeadas à capacidade e evidência; preços/parcelas/limites consistentes, exceções comerciais aprovadas.
2. C02: cada página priorizada com intenção distinta, conteúdo útil, screenshots identificados, CTA funcional, SEO técnico verificado e vínculo à oferta.
3. Produto em piloto recebe esse rótulo; homologação específica, alcance de suporte e custos de terceiros ficam claros antes da contratação.
4. Estudo de caso depende de resultado medido e autorização de uso; nenhuma comparação afirma superioridade universal sem prova.
5. PO aprova oferta; engenharia comprova comportamentos; UX comprova tarefas; responsável comercial acompanha conversão e qualidade dos clientes ativados.

Prioridade de publicação: corrigir inconsistências existentes → oferta e lanchonete/Natureba → iFood/KDS/displays homologados → expansão rodízio → Kiosk operacional. A execução acompanha os sprints, sem criar um sprint de marketing que anuncie software ainda não entregue.

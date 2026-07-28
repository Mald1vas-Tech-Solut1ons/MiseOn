export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  category: 'Engenharia de Cardápio' | 'Operação & KDS' | 'Tecnologia & IA' | 'Gestão Financeira';
  publishedAt: string;
  readTime: string;
  coverImage: string;
  author: {
    name: string;
    role: string;
    avatar: string;
  };
  tags: string[];
  seo: {
    title: string;
    description: string;
    keywords: string;
    canonicalUrl: string;
  };
  summary: string;
  content: string;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'evolucao-do-cmv-do-caderno-ao-custeio-peps-3d',
    title: 'A Evolução do CMV no Food Service: Do Caderno de Receitas à Engenharia de Estoque 3D e Custeio PEPS',
    description: 'Como o controle de custos na gastronomia evoluiu de palpites em cadernos para o custeio real por lote PEPS e a inteligência de rendimento com perda de cocção.',
    category: 'Gestão Financeira',
    publishedAt: '2026-07-28',
    readTime: '8 min de leitura',
    coverImage: '/blog-covers/cmv-peps-cover.png',
    author: {
      name: 'Rafael Maldivas',
      role: 'Head de Engenharia e Arquitetura do MiseOn',
      avatar: '/icon-192.png',
    },
    tags: ['CMV', 'Ficha Técnica', 'Custeio PEPS', 'Estoque 3D', 'Gestão de Restaurante'],
    seo: {
      title: 'A Evolução do CMV no Food Service: Do Caderno ao Custeio PEPS — MiseOn',
      description: 'Entenda a evolução do Custo de Mercadoria Vendida (CMV) no food service. Descubra como o custeio PEPS e a perda de cocção protegem a margem de restaurantes.',
      keywords: 'cmv restaurante, custeio peps restaurante, ficha tecnica alimentos, perda de coccao comida, calculo cmv hamburgueria',
      canonicalUrl: 'https://miseon.app.br/blog/evolucao-do-cmv-do-caderno-ao-custeio-peps-3d',
    },
    summary: 'Historicamente, restaurantes calculavam suas margens com base no preço de compra bruto dos ingredientes. A revolução do custeio PEPS (Primeiro a Entrar, Primeiro a Sair) e o tratamento da perda de cocção transformaram a gestão financeira gastronômica moderna.',
    content: `
# A Evolução do CMV no Food Service: Do Caderno de Receitas à Engenharia de Estoque 3D

Durante décadas, a gestão financeira da maioria dos restaurantes brasileiros operava sobre uma ilusão confortável: a margem teórica. O dono da hamburgueria comprava 10 kg de carne por R$ 35,00/kg, dividia o valor pelo número de hambúrgueres teóricos e acreditava que seu Custo de Mercadoria Vendida (CMV) estava controlado em 25%.

Na prática, ao final do mês, a conta bancária não fechava. Onde estava o vazamento de lucro?

A resposta reside na diferença brutal entre o **passado artesanal da gestão** e a **engenharia de alimentos moderna**.

---

## 1. O Passado: O Mito da "Ficha Técnica Estática"

No modelo tradicional, as fichas técnicas eram planilhas do Excel ou anotações em cadernos atualizadas uma vez por ano. Esse modelo cometia três erros fatais:

1. **Ignorava a Inflação de Fornecedores**: Se o pão subia de R$ 1,20 para R$ 1,85 na terça-feira, a ficha técnica continuava calculando a margem com o preço antigo.
2. **Ignorava os Preparos Internos**: Quando a cozinha moía a carne, temperava e moldava o blend, ou reduzia 10 litros de molho de tomate para 6 litros concentrados, esse "trabalho de panela" entrava no estoque valendo ZERO. O produto pronto nascia barato na ficha, mas caro na vida real.
3. **Não Trata a Perda de Cocção (Descarte de Água e Gordura)**: Se 10 kg de peça crua de cupim perdem 30% do peso no forno e viram 7 kg prontos para a travessa do buffet, o custo dos 10 kg precisa ser concentrado nos 7 kg líquidos servidos. Se você diluir o custo nos 10 kg brutos, estará vendendo com prejuízo a cada grama servida.

---

## 2. O Presente: Valoração por Lote e Método PEPS (Primeiro a Entrar, Primeiro a Sair)

A engenharia moderna de software para food service trouxe o método **PEPS (Primeiro a Entrar, Primeiro a Sair)** para o centro da cozinha.

Quando um restaurante produz 20 receitas de molho ou 50 blends de carne:
- O sistema consulta os lotes de insumos brutos no estoque em ordem cronológica de compra.
- Baixa primeiro a carne comprada no lote de semana passada pelo preço X.
- Quando o lote antigo acaba, consome o lote novo pelo preço Y.
- **Soma exatamente o valor total gasto na panela** e divide pela quantidade de unidades ou kg finais obtidos.

O preparo entra no estoque já com seu **Custo Apropriado Real**. Quando o garçom lança um prato no salão ou um pedido entra no iFood, a baixa da ficha técnica deduz o valor exato desse lote.

---

## 3. O Futuro: Observabilidade de Estoque 3D e Análise Preditiva de Perdas

O futuro da gestão de restaurantes não é apenas saber *quanto custou*, mas visualizar *onde o estoque está* e *quando ele vai vencer*.

Com mapeamento tridimensional de prateleiras e câmaras frias, aliando rastreabilidade de lote e data de validade com alertas sonoros na cozinha:
- O cozinheiro sabe exatamente qual lote de molho deve ser consumido primeiro (FEFO: First Expire, First Out).
- Lotes vencidos geram alerta de descarte por perda no sistema, impedindo que ingredientes deteriorados sejam servidos ao cliente ou fiquem acumulando custo fantasma no balanço.

---

## Conclusão: A Margem Que Não Mente

A diferença entre um restaurante que estagna e um grupo gastronômico que escala com saúde financeira é a precisão dos seus números. Deixar de tratar o estoque como um "depósito genérico" e passá-lo a enxergar como **dinheiro estocado em transformação** é o primeiro passo para garantir a vida longa do seu negócio.
`,
  },
  {
    slug: 'o-fim-do-papel-na-cozinha-kds-kanban-operacional',
    title: 'O Fim do Papel na Cozinha: Como o KDS Kanban Transforma a Eficiência Operacional e Elimina o Caos nos Picos',
    description: 'Análise técnica da transição de comandas de papel para a tela de produção KDS (Kitchen Display System), reduzindo o tempo de ticket em até 35%.',
    category: 'Operação & KDS',
    publishedAt: '2026-07-28',
    readTime: '6 min de leitura',
    coverImage: '/blog-covers/kds-kanban-cover.png',
    author: {
      name: 'Rafael Maldivas',
      role: 'Head de Engenharia e Arquitetura do MiseOn',
      avatar: '/icon-192.png',
    },
    tags: ['KDS', 'Cozinha sem Papel', 'Eficiência Operacional', 'Hamburgueria', 'Pizzaria'],
    seo: {
      title: 'O Fim do Papel na Cozinha: Como o KDS Kanban Transforma a Operação — MiseOn',
      description: 'Descubra como telas digitais de cozinha (KDS) com colunas Kanban reduzem o tempo de preparo, eliminam erros de pedidos e organizam praças de produção.',
      keywords: 'kds cozinha, kitchen display system, cozinha sem papel, gestao de cozinha restaurante, kanban producao comida',
      canonicalUrl: 'https://miseon.app.br/blog/o-fim-do-papel-na-cozinha-kds-kanban-operacional',
    },
    summary: 'A comanda de papel engordurada e perdida na chapa é o maior gargalo das cozinhas de alta demanda. A adoção de monitores digitais KDS com Kanban por etapas revoluciona o tempo de entrega e a comunicação entre balcão e produção.',
    content: `
# O Fim do Papel na Cozinha: Como o KDS Kanban Transforma a Eficiência Operacional

Na hora do pico da noite — seja em uma hamburgueria com a chapa cheia, em uma pizzaria com o forno a 400°C ou no salão de um restaurante lotado —, o maior inimigo da equipe não é a quantidade de clientes. É a **quebra na comunicação**.

O pedaço de papel térmico impresso no caixa que engordura ao lado da chapa, se perde embaixo da bancada ou acumula sem uma fila clara de prioridade é responsável por **mais de 80% dos atrasos e cancelamentos de pedidos no food service**.

---

## 1. As 4 Limitações Críticas da Comanda de Papel

1. **Visibilidade Unilateral**: O garçom ou o caixa sabe que o pedido foi feito, mas não tem ideia se o prato está no início da montagem ou pronto para sair.
2. **Tempo Cego (Lack of Metrics)**: O papel não mede quantos minutos o pedido ficou parado em cada etapa. Você não descobre onde está o gargalo (se na chapa, na montagem ou na expedição).
3. **Erros de Modificações e Adicionais**: Pedidos com observações ("Sem cebola", "Ponto mal passado", "Molho à parte") em texto pequeno são facilmente ignorados pelo cozinheiro na correria.
4. **Custo e Sujeira**: Papéis impressos geram lixo constante, exigem troca de bobinas no meio do serviço e acumulam sujeira na área de manipulação de alimentos.

---

## 2. A Arquitetura do KDS (Kitchen Display System) Kanban

O KDS digital substitui o papel por uma tela touch ou monitor instalado nas praças de produção. Em vez de uma lista estática, ele organiza os pedidos no método **Kanban visual por colunas de processo**:

- **Coluna 1 — Fila (Recebidos)**: Pedidos que acabaram de entrar (seja do iFood, do Cardápio QR Code, do Garçom ou do PDV Balcão). Alerta sonoro avisa a equipe.
- **Coluna 2 — Em Preparo (Chapa / Forno / Montagem)**: O cozinheiro toca na tela e o card avança. O temporizador da comanda muda de cor (Verde → Amarelo → Vermelho) caso ultrapasse a meta de tempo estabelecida.
- **Coluna 3 — Pronto / Expedição**: O embalador ou expedidor sabe exatamente qual mesa ou entregador deve receber o prato.

---

## 3. Impactos Reais na Operação

As métricas registradas em restaurantes que migraram do papel para o KDS demonstram ganhos imediatos:
- **Redução de até 35% no tempo total de ticket** (do pedido à entrega).
- **Redução a zero de pedidos perdidos** na cozinha.
- **Sincronia total entre Salão e Cozinha**: O garçom vê o status do prato no seu próprio celular sem precisar correr até a cozinha para perguntar se a mesa 4 está saindo.

A transição para a cozinha digital não é mais um luxo futurista — é a infraestrutura básica para qualquer operação que pretenda atender com velocidade e margem de lucro.
`,
  },
  {
    slug: 'ia-no-whatsapp-do-restaurante-atendimento-oficial-meta-vs-bots-amadores',
    title: 'Atendimento por Inteligência Artificial no WhatsApp: Conexão Oficial Meta vs Bots Amadores',
    description: 'Por que o atendimento automatizado no WhatsApp exige a API Cloud Oficial da Meta com dados reais do cardápio para evitar banimentos e garantir vendas sem erros.',
    category: 'Tecnologia & IA',
    publishedAt: '2026-07-28',
    readTime: '7 min de leitura',
    coverImage: '/blog-covers/whatsapp-ia-cover.png',
    author: {
      name: 'Rafael Maldivas',
      role: 'Head de Engenharia e Arquitetura do MiseOn',
      avatar: '/icon-192.png',
    },
    tags: ['WhatsApp IA', 'Meta API', 'Automação Delivery', 'Atendimento Restaurante', 'IA Gastronomia'],
    seo: {
      title: 'IA no WhatsApp do Restaurante: Oficial Meta vs Bots Amadores — MiseOn',
      description: 'Entenda os riscos de banimento em sistemas paralelos de WhatsApp e descubra como a IA conectada à API Oficial da Meta atende restaurantes sem errar.',
      keywords: 'whatsapp ia restaurante, api oficial whatsapp meta, robo whatsapp delivery, atendimento automatico delivery, whatsapp business cloud api',
      canonicalUrl: 'https://miseon.app.br/blog/ia-no-whatsapp-do-restaurante-atendimento-oficial-meta-vs-bots-amadores',
    },
    summary: 'O WhatsApp se tornou o principal canal de vendas diretas do delivery no Brasil. Contudo, utilizar "automações paralelas" com emuladores de celular coloca a operação em risco iminente de banimento definitivo do número da loja.',
    content: `
# Atendimento por Inteligência Artificial no WhatsApp: Conexão Oficial Meta vs Bots Amadores

No Brasil, o WhatsApp não é apenas um aplicativo de mensagens instantâneas. Para restaurantes, hamburguerias e pizzarias, ele é a **principal praça de vendas diretas livre de comissões**.

No entanto, a busca por responder clientes rapidamente levou muitos estabelecimentos a cometerem um erro fatal: a contratação de **softwares paralelos não autorizados (bots pirateados)** baseados em escaneamento de QR Code pessoal e emuladores de WhatsApp Web.

---

## 1. O Perigo Oculto dos Bots Paralelos (Não Oficiais)

Os sistemas não oficiais funcionam simulando a navegação humana num navegador web ou celular emulado. Para os algoritmos de segurança da Meta (proprietária do WhatsApp), esse comportamento é identificado como **spam de automação não autorizada**.

As consequências para a loja são devastadoras:
- **Banimento Instantâneo do Número**: O número principal da loja é bloqueado permanentemente de sexta-feira para sábado, sem direito a aviso prévio ou recuperação de histórico.
- **Perda da Cartela de Clientes**: Milhares de contatos e conversas ativas somem do dia para a noite.
- **Respostas Inventadas (Alucinação)**: Bots baseados em regras genéricas ou IAs desconectadas do banco de dados tendem a informar preços desatualizados, aceitar pedidos de itens esgotados ou prometer taxas de entrega erradas.

---

## 2. A Solução Enterprise: WhatsApp Business Cloud API Oficial da Meta

A única arquitetura 100% segura e homologada pela Meta para empresas é a **WhatsApp Business Cloud API (Meta Verified)**.

Nessa arquitetura:
1. **Zero Risco de Banimento**: O número da loja é verificado oficialmente junto aos servidores da Meta na nuvem.
2. **Conexão Nativa ao Banco de Dados da Loja**: A Inteligência Artificial não "chuta" respostas. Ela consulta em tempo real no banco de dados do MiseOn se o restaurante está aberto, quais produtos estão em estoque, quais os ingredientes de cada prato e quais as taxas de entrega por bairro.
3. **Proteção Anti-Injeção e Alergênicos**: Se o cliente digitar no chat que é alérgico a amendoim ou camarão, a automação silencia imediatamente e transfere o atendimento para um operador humano (Handoff de Segurança).

---

## 3. O Papel Correto da IA no WhatsApp

A IA ideal para o delivery não deve tentar "inventar conversa solta" nem tentar fechar pagamentos complexos em texto puro onde o cliente digita o endereço com erros de grafia.

O papel correto da IA é:
1. **Atender no primeiro segundo**: Responder saudações, tirar dúvidas sobre horários, localização e opções vegetarianas/sem glúten.
2. **Enviar o Link de Atribuição Direta**: Direcionar o cliente para montar o carrinho no Cardápio Digital da loja com fotos e adicionais organizados.
3. **Notificar a Equipe**: Caso o cliente solicite falar com um atendente, o painel central do restaurante acende o alerta para interatividade humana instantânea.

Proteger o canal de atendimento mais valioso da sua loja com tecnologia oficial e segura é o único caminho para um crescimento sustentável.
`,
  },
  {
    slug: 'verdade-sobre-venda-por-quilo-perda-coccao-peso-inteligente',
    title: 'A Verdade sobre a Venda por Quilo: Como a Perda de Cocção e o Peso Inteligente Decidem a Margem do Buffet',
    description: 'Estudo profundo sobre estabelecimentos self-service e buffets a quilo. Descubra como tratar o peso fracionado e o encolhimento de assados e grelhados.',
    category: 'Engenharia de Cardápio',
    publishedAt: '2026-07-28',
    readTime: '9 min de leitura',
    coverImage: '/blog-covers/peso-quilo-cover.png',
    author: {
      name: 'Rafael Maldivas',
      role: 'Head de Engenharia e Arquitetura do MiseOn',
      avatar: '/icon-192.png',
    },
    tags: ['Restaurante por Quilo', 'Buffet Self Service', 'Peso Inteligente', 'Perda de Cocção', 'Engenharia de Alimentos'],
    seo: {
      title: 'A Verdade sobre a Venda por Quilo: Perda de Cocção & Peso Inteligente — MiseOn',
      description: 'Aprenda como calcular a perda de cocção em buffets por quilo e como a baixa automática por peso servido protege o lucro em restaurantes self-service.',
      keywords: 'restaurante por quilo, buffet self service, baixa de estoque por peso, perda de coccao assados, sistema para comida por quilo',
      canonicalUrl: 'https://miseon.app.br/blog/verdade-sobre-venda-por-quilo-perda-coccao-peso-inteligente',
    },
    summary: 'Restaurantes self-service e comidinhas por peso operam com margens extremamente estreitas. A maioria dos sistemas trata o prato a quilo como uma "unidade genérica", tornando impossível descobrir quanto do estoque de proteína foi realmente consumido.',
    content: `
# A Verdade sobre a Venda por Quilo: Como a Perda de Cocção e o Peso Inteligente Decidem a Margem do Buffet

O modelo de restaurante self-service por quilo é um patrimônio da gastronomia brasileira. Milhares de trabalhadores e famílias almoçam diariamente escolhendo exatamente as proporções do seu prato.

Entretanto, do ponto de vista de **engenharia de estoque e gestão de margens**, o modelo por quilo é um dos mais difíceis de controlar.

---

## 1. O Drama do Insumo Cru vs. Insumo Cozido (Fator de Correção e Cocção)

Quando a cozinha de um buffet compra 20 kg de alcatra ou picanha:
- A peça crua passa pela limpeza (retirada de aparas e sebo indevido) — **Fator de Correção**.
- Em seguida, vai para a grelha ou forno, onde perde água e volume — **Fator de Cocção**.
- Os 20 kg brutos de compra viram frequentemente apenas 13,5 kg de carne assada fatiada na travessa do buffet.

Se o dono do restaurante calcula o custo do kg servido com base nos R$ 40,00/kg que pagou no açougue, ele está cometendo um erro grave. O custo real daquela carne pronta para o cliente é de **R$ 59,25/kg**.

Sem ajustar essa métrica no sistema, a margem de lucro calculada no balcão é uma ilusão.

---

## 2. A Solução do Peso Inteligente MiseOn

Para resolver essa equação sem sobrecarregar o cozinheiro ou o operador de caixa, o MiseOn desenvolveu o **Módulo de Venda por Peso Inteligente**:

1. **Rendimento Padrão da Receita em Kg**: Ao cadastrar a receita da "Picanha Assada do Buffet", a cozinha informa o rendimento esperado pós-cozimento (ex: 1 lote de 10 kg cru rende 7 kg pronto).
2. **Custeio Concentrado no Peso Líquido**: O sistema concentra todo o custo da compra no peso líquido que realmente chega à travessa.
3. **Baixa Proporcional por Grama Servida**: Quando o cliente passa na balança do caixa e registra 0,380 kg de buffet, a Ficha Técnica multiplica a proporção exata da receita e baixa os gramas consumidos de cada ingrediente no estoque.

---

## 3. Métricas Reais de Clientes Servidos

Outra distorção clássica dos sistemas legados era contar "0,35 kg" como "0,35 vendas" em relatórios de curva ABC.

O MiseOn ajusta a contagem inteligível: 0,35 kg lançado na balança conta como **1 cliente servido**, permitindo calcular com precisão:
- O **Ticket Médio Real por Cliente**.
- A **Gramatura Média consumida por pessoa**.
- O **Custo Médio de Prato** servido no almoço.

Com dados reais e precisão decimal, o restaurante por quilo elimina os vazamentos invisíveis e garante a lucratividade em cada prato servido.
`,
  },
];

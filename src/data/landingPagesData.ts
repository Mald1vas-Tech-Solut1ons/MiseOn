export interface LandingPageData {
  slug: string;
  category: 'nicho' | 'funcionalidade';
  seo: {
    title: string;
    description: string;
    keywords: string;
    canonicalUrl: string;
  };
  badge: string;
  h1Title: string;
  h1Highlight: string;
  subheadline: string;
  heroMetrics: { label: string; value: string }[];
  painPointsTitle: string;
  painPointsSubtitle: string;
  painPoints: {
    semMiseOn: string;
    comMiseOn: string;
  }[];
  featuresTitle: string;
  featuresSubtitle: string;
  features: {
    iconName: string;
    title: string;
    description: string;
    tag: string;
  }[];
  businessRules: {
    title: string;
    description: string;
    items: string[];
  };
  faqs: {
    pergunta: string;
    resposta: string;
  }[];
}

export const LANDING_PAGES_DATA: Record<string, LandingPageData> = {
  'sistema-para-bar': {
    slug: 'sistema-para-bar',
    category: 'nicho',
    seo: {
      title: 'Sistema para Bar e Pub | Comanda, Mesa e Fechamento de Conta — MiseOn',
      description: 'Sistema de gestão para bares e pubs: comanda por mesa, divisao de conta, controle de caixa por turno, estoque de bebidas com dose e custo real por drink.',
      keywords: 'sistema para bar, sistema para pub, comanda eletronica bar, controle de estoque bebidas, pdv para bar, gestão de bar',
      canonicalUrl: 'https://miseon.app.br/sistema-para-bar',
    },
    badge: 'Comanda, Mesa e Caixa por Turno',
    h1Title: 'O bar cheio não pode parar',
    h1Highlight: 'na hora de fechar a conta',
    subheadline: 'Comanda aberta por mesa, pedido que cai direto na copa e conta fechada sem fila no caixa. O estoque de bebidas baixa a cada rodada, com o custo real de cada dose.',
    heroMetrics: [
      { label: 'Comanda por mesa', value: 'Aberta' },
      { label: 'Baixa de estoque', value: 'Por rodada' },
      { label: 'Caixa', value: 'Por turno' },
    ],
    painPointsTitle: 'O que trava um bar na noite cheia',
    painPointsSubtitle: 'Não e falta de cliente. E o atrito entre salão, copa e caixa:',
    painPoints: [
      {
        semMiseOn: 'Comanda de papel rasurada, com rodada anotada em cima de rodada.',
        comMiseOn: 'Comanda digital por mesa: cada rodada entra com hora, item e quem lancou.',
      },
      {
        semMiseOn: 'Fila no caixa na hora do fechamento, porque alguém precisa somar tudo na mão.',
        comMiseOn: 'Conta fechada na hora, com o total ja calculado e o pagamento no próprio painel.',
      },
      {
        semMiseOn: 'Garrafa que some sem ninguem saber se foi venda, quebra ou cortesia.',
        comMiseOn: 'Cada venda baixa a bebida do estoque; perda e cortesia entram como movimento próprio.',
      },
      {
        semMiseOn: 'Custo do drink no chute, sem saber quanto de destilado e de insumo saiu.',
        comMiseOn: 'Ficha técnica do drink com dose exata e custo pelo lote PEPS.',
      },
    ],
    featuresTitle: 'Feito para a operação de bar',
    featuresSubtitle: 'Os recursos que sustentam salão cheio, copa rapida e caixa fechado sem susto:',
    features: [
      {
        iconName: 'UtensilsCrossed',
        title: 'Comanda por Mesa com Salão 3D',
        description: 'Mapa do salão com mesa livre, ocupada ou fechando conta. A comanda fica aberta e recebe rodada por rodada.',
        tag: 'Salao',
      },
      {
        iconName: 'Boxes',
        title: 'Estoque de Bebidas com Dose',
        description: 'Cada drink baixa a dose do destilado e os insumos da ficha. A garrafa some do estoque na medida certa.',
        tag: 'Custo por Dose',
      },
      {
        iconName: 'ScanLine',
        title: 'Estoque pelo Cupom do Mercado',
        description: 'Escaneie o QR Code da nota da compra e as bebidas entram no estoque com quantidade e custo real, sem digitar item por item.',
        tag: 'NFC-e Automática',
      },
      {
        iconName: 'Wallet',
        title: 'Caixa por Turno e Pix na Conta',
        description: 'Abertura e fechamento de turno com conferência de dinheiro. Pix cai direto na conta do bar, com conciliação automática.',
        tag: 'Financeiro',
      },
    ],
    businessRules: {
      title: 'Como o MiseOn se comporta num bar',
      description: 'Regras que valem na prática durante o serviço:',
      items: [
        'Comanda permanece aberta na mesa até o fechamento, aceitando novas rodadas a qualquer momento.',
        'Cada lancamento registra hora e responsavel, o que resolve discussao de conta no fim da noite.',
        'A baixa de estoque acontece na venda, usando a ficha técnica do drink ou o item direto no caso da garrafa.',
        'Perda, quebra e cortesia sao movimentos separados da venda, para não contaminar o CMV.',
        'O fechamento de turno separa dinheiro, cartao e Pix, e aponta a diferenca de caixa quando existe.',
      ],
    },
    faqs: [
      {
        pergunta: 'Da para controlar a dose de destilado?',
        resposta: 'Sim. O drink e cadastrado com ficha técnica: cada componente entra com a quantidade que realmente vai no copo. A venda baixa essa quantidade do estoque e o custo sai pelo lote PEPS, com o preço que você pagou na última compra.',
      },
      {
        pergunta: 'Como fica a conta quando a mesa quer dividir?',
        resposta: 'A comanda mostra todos os itens lancados na mesa e o fechamento permite receber em mais de uma forma de pagamento, registrando cada parte no caixa do turno.',
      },
      {
        pergunta: 'Preciso cadastrar cada bebida na mão?',
        resposta: 'Não. Ao voltar da compra, escaneie o QR Code do cupom fiscal: o sistema le a nota na SEFAZ e traz os itens com quantidade e custo. Você confere, desmarca o que não entra e da entrada de tudo de uma vez.',
      },
    ],
  },

  'sistema-para-dark-kitchen': {
    slug: 'sistema-para-dark-kitchen',
    category: 'nicho',
    seo: {
      title: 'Sistema para Dark Kitchen | Delivery, iFood e CMV Real — MiseOn',
      description: 'Sistema de gestão para dark kitchen e cozinha exclusiva de delivery: pedidos do iFood e do canal próprio na mesma tela, KDS de produção, estoque e CMV por prato.',
      keywords: 'sistema para dark kitchen, cozinha delivery, gestão dark kitchen, sistema delivery próprio, kds delivery, cmv dark kitchen',
      canonicalUrl: 'https://miseon.app.br/sistema-para-dark-kitchen',
    },
    badge: 'Operação 100% Delivery',
    h1Title: 'Cozinha sem salão precisa de',
    h1Highlight: 'margem, não de mesa',
    subheadline: 'Sem salão para diluir custo, a dark kitchen vive de duas coisas: volume de pedido e CMV sob controle. O MiseOn junta iFood e canal próprio numa tela so, e mostra o custo real de cada prato.',
    heroMetrics: [
      { label: 'Canais', value: 'iFood + próprio' },
      { label: 'Comissão no canal próprio', value: 'Zero' },
      { label: 'Custo por prato', value: 'Real (PEPS)' },
    ],
    painPointsTitle: 'O que corroi a margem de uma dark kitchen',
    painPointsSubtitle: 'Sem salão, cada ponto de margem perdido aparece direto no resultado:',
    painPoints: [
      {
        semMiseOn: 'Um tablet por marketplace, cada um apitando de um jeito.',
        comMiseOn: 'Pedidos do iFood e do canal próprio na mesma fila, com selo de origem.',
      },
      {
        semMiseOn: 'Comissão de marketplace em 100% do faturamento, sem canal próprio nenhum.',
        comMiseOn: 'Cardápio digital com link e QR próprios, sem comissão por pedido.',
      },
      {
        semMiseOn: 'Preço de venda definido por comparacao com o concorrente, sem saber o custo.',
        comMiseOn: 'CMV por prato calculado pela ficha técnica, com o custo do lote que entrou.',
      },
      {
        semMiseOn: 'Insumo que acaba no meio do pico e derruba o item em todos os canais.',
        comMiseOn: 'O cardápio consulta a ficha técnica e sinaliza o que ficou sem insumo.',
      },
    ],
    featuresTitle: 'O que a cozinha de delivery precisa ter',
    featuresSubtitle: 'Produção, canais e custo tratados como uma coisa so:',
    features: [
      {
        iconName: 'ShoppingBag',
        title: 'iFood e Canal Próprio na Mesma Fila',
        description: 'Integração nativa com iFood: o pedido entra no mesmo painel do seu cardápio próprio, com selo de origem para separar o faturamento.',
        tag: 'Multicanal',
      },
      {
        iconName: 'ChefHat',
        title: 'KDS de Produção sem Papel',
        description: 'Fila por etapa com tempo correndo em cada ficha e estações separadas por tipo de preparo.',
        tag: 'Producao',
      },
      {
        iconName: 'ScanLine',
        title: 'Estoque pelo Cupom do Mercado',
        description: 'A compra de insumo entra no estoque escaneando o QR Code da nota, com custo real de cada item — sem digitacao.',
        tag: 'NFC-e Automática',
      },
      {
        iconName: 'BarChart3',
        title: 'CMV por Prato e DRE Gerencial',
        description: 'Custo real por prato pelo método PEPS e DRE com margem de contribuição, custo fixo e lucro líquido.',
        tag: 'Margem',
      },
    ],
    businessRules: {
      title: 'Como o MiseOn trata uma operação sem salão',
      description: 'O painel se ajusta ao negocio que so entrega:',
      items: [
        'O perfil Dark Kitchen tira mesa e balcão da frente de quem so opera delivery.',
        'Pedidos de marketplace e do canal próprio convivem na mesma fila de produção, sem retranscricao.',
        'O faturamento fica separado por origem, para você comparar quanto custa cada canal.',
        'A baixa de estoque acontece por ficha técnica, independente do canal que originou o pedido.',
        'Entregas próprias tem taxa por faixa de distancia e acompanhamento da rota ao vivo.',
      ],
    },
    faqs: [
      {
        pergunta: 'Consigo operar iFood e cardápio próprio ao mesmo tempo?',
        resposta: 'Sim, e essa e a ideia. O pedido do iFood entra no mesmo painel do seu cardápio próprio, com selo de origem. Você mantem o volume do marketplace e desenvolve o canal sem comissão ao mesmo tempo, comparando o resultado de cada um.',
      },
      {
        pergunta: 'Como sei se estou ganhando dinheiro em cada prato?',
        resposta: 'Pela ficha técnica. Cada prato tem seus insumos e quantidades; o custo sai do lote que realmente entrou no estoque (metodo PEPS). Com o preço de venda, o sistema mostra a margem por prato — e o DRE mostra o resultado depois do custo fixo.',
      },
      {
        pergunta: 'Preciso de equipamento específico?',
        resposta: 'Não. O MiseOn roda no navegador do computador, tablet ou celular que você ja tem. A cozinha usa uma tela comum como KDS e o cardápio digital dispensa impressão.',
      },
    ],
  },

  'sistema-para-hamburgueria': {
    slug: 'sistema-para-hamburgueria',
    category: 'nicho',
    seo: {
      title: 'Sistema para Hamburgueria | KDS, iFood e Ficha Técnica — MiseOn',
      description: 'O sistema para hamburgueria completo: controle de adicionais, KDS na chapa, baixa de insumos no estoque por Ficha Técnica, iFood e Pix direto na sua conta.',
      keywords: 'sistema para hamburgueria, gestão hamburgueria, kds chapa hamburgueria, cardápio digital hamburgueria, ficha técnica blend',
      canonicalUrl: 'https://miseon.app.br/sistema-para-hamburgueria',
    },
    badge: 'Hamburguerias e Smashes',
    h1Title: 'O sistema para hamburgueria que organiza a chapa e',
    h1Highlight: 'centraliza toda a sua operação',
    subheadline: 'Centralize pedidos do balcão, cardápio digital e iFood em uma tela de cozinha (KDS) em tempo real. Controle adicionais, fichas técnicas no estoque e Pix automático direto na sua conta.',
    heroMetrics: [
      { label: 'Redução no tempo de preparo', value: '-35%' },
      { label: 'Pedidos centralizados na cozinha', value: '100%' },
      { label: 'Controle de insumos e CMV', value: '+18%' },
    ],
    painPointsTitle: 'Chega de perder tempo com desorganização na cozinha e no caixa',
    painPointsSubtitle: 'Veja como o MiseOn simplifica o fluxo da sua hamburgueria do pedido ao estoque:',
    painPoints: [
      {
        semMiseOn: 'Pedidos em papel que engorduram na chapa ou se perdem durante o fluxo de trabalho.',
        comMiseOn: 'KDS em tela digital com colunas Kanban por etapas (Fila, Preparo, Pronto) e aviso sonoro.',
      },
      {
        semMiseOn: 'Dificuldade para saber quanto pão, blend de carne e queijo foram consumidos na semana.',
        comMiseOn: 'Estoque por Ficha Técnica e CMV: cada venda baixa automaticamente os insumos cadastrados.',
      },
      {
        semMiseOn: 'Atender iFood em uma tela e pedidos do salão/delivery em outra gera confusão na equipe.',
        comMiseOn: 'Fila única no mesmo painel: pedidos do iFood, cardápio online e PDV balcão juntos no KDS.',
      },
      {
        semMiseOn: 'O blend que você mói, o molho da casa e a cebola caramelizada entram no estoque sem custo nenhum — e a ficha do lanche mostra uma margem que não existe.',
        comMiseOn: 'Cada produção da cozinha é custeada na hora: o sistema soma o que saiu do estoque e mostra quanto custou a panela e quanto custa cada unidade pronta.',
      },
    ],
    featuresTitle: 'Funcionalidades reais do MiseOn para a sua hamburgueria',
    featuresSubtitle: 'Recursos nativos desenvolvidos para a rotina prática do food service:',
    features: [
      {
        iconName: 'ScanLine',
        title: 'Estoque pelo Cupom do Mercado',
        description: 'Escaneie o QR Code da nota da compra e os itens entram no estoque com quantidade e custo real, sem digitar produto por produto.',
        tag: 'NFC-e Automática',
      },

      {
        iconName: 'ChefHat',
        title: 'KDS Kanban Configurável',
        description: 'Tela de cozinha com etapas customizáveis (ex: Fila, Chapa, Montagem, Pronto) e temporizador por card.',
        tag: 'Cozinha Sem Papel',
      },
      {
        iconName: 'Boxes',
        title: 'Estoque & Ficha Técnica',
        description: 'Baixa automática de insumos (bacon, cheddar, pão) a cada venda realizada no sistema.',
        tag: 'Controle de Insumos',
      },
      {
        iconName: 'ShoppingBag',
        title: 'Integração Nativa iFood',
        description: 'Os pedidos do iFood entram no mesmo painel e KDS com baixa unificada de estoque.',
        tag: 'Fila Única',
      },
      {
        iconName: 'QrCode',
        title: 'Cardápio Digital & Pix',
        description: 'Link próprio e QR Code para mesas e delivery. Pagamento via Pix Efí direto na sua conta bancária.',
        tag: 'Vendas Diretas',
      },
      {
        iconName: 'BarChart3',
        title: 'Custo Real do Blend e dos Molhos',
        description: 'O que a sua cozinha produz entra no estoque valendo o que custou. A cada produção o sistema mostra o custo da panela e o custo por unidade — e esse valor entra na ficha do lanche.',
        tag: 'CMV Que Não Mente',
      },
    ],
    businessRules: {
      title: 'Recursos e Regras Operacionais para Hamburguerias',
      description: 'Como o MiseOn otimiza o dia a dia do seu estabelecimento:',
      items: [
        'KDS Kanban configurável por etapas com acompanhamento do tempo em cada processo.',
        'Opções e adicionais por grupos no cardápio digital (com seleções mínimas e máximas).',
        'Impressão de vias de produção em impressoras térmicas de balcão e cozinha.',
        'Pagamento Pix com recebimento direto e conciliação automática sem retenção pelo sistema.',
        'Gestão de entregas e motoboys com histórico de rotas.',
        'Produção de preparos custeada em transação única: os ingredientes saem pelo custo real de compra (PEPS) e o preparo entra no estoque já valendo o que custou.',
        'Perda de cocção entra no custo: se 10 kg de carne rendem 7 kg prontos, o custo se concentra nos 7 — não fica diluído nos 10.',
      ],
    },
    faqs: [
      {
        pergunta: 'O sistema permite configurar grupos de adicionais e opções para os hambúrgueres?',
        resposta: 'Sim! Você cria grupos como "Escolha os Adicionais" ou "Escolha a Bebida", definindo o preço de cada opção e limites de escolha.',
      },
      {
        pergunta: 'Como o KDS funciona na cozinha da hamburgueria?',
        resposta: 'O KDS é acessado via navegador em qualquer tablet ou monitor. Os pedidos entram automaticamente com alerta sonoro e podem avançar entre colunas personalizadas.',
      },
      {
        pergunta: 'Consigo controlar o estoque dos insumos (pão, carne, molhos)?',
        resposta: 'Sim. Ao cadastrar os produtos com Ficha Técnica, o sistema realiza a baixa automática dos ingredientes no estoque a cada venda concluída.',
      },
      {
        pergunta: 'O sistema sabe quanto custa o blend que eu mesmo moldo e o molho que faço na casa?',
        resposta: 'Sim, e essa é uma diferença importante. Na maioria dos sistemas só o que você compra tem preço; o que a cozinha produz entra no estoque sem custo, e a ficha do lanche fica mais barata do que a realidade. No MiseOn, cada produção soma o custo real dos ingredientes que saíram do estoque e divide pela quantidade que saiu da panela. O blend passa a valer o que custou, e esse valor entra automaticamente na ficha de todos os lanches que o usam.',
      },
      {
        pergunta: 'Por que o custo do meu lanche pode estar errado hoje?',
        resposta: 'Se o item mais caro do prato é algo que a sua cozinha prepara — blend, molho, cebola caramelizada —, esse custo costuma sumir da conta. Um lanche com blend de R$ 8,10, molho e cebola pode aparecer custando R$ 4,52 quando custa R$ 13,24. A diferença muda o CMV de 14% para 41%: de "excelente" para "no limite". É com esse número que você decide preço e promoção.',
      },
    ],
  },

  'sistema-para-lanchonete': {
    slug: 'sistema-para-lanchonete',
    category: 'nicho',
    seo: {
      title: 'Sistema para Lanchonete | PDV Balcão, Comandas e Estoque — MiseOn',
      description: 'Sistema para lanchonetes: PDV de balcão rápido, comandas de mesas, controle de estoque, ficha técnica e Pix direto na conta. Teste grátis!',
      keywords: 'sistema para lanchonete, pdv balcão lanchonete, comanda lanchonete, cardápio digital lanchonete',
      canonicalUrl: 'https://miseon.app.br/sistema-para-lanchonete',
    },
    badge: 'Lanchonetes e Casas de Salgados',
    h1Title: 'O sistema para lanchonete com PDV de balcão',
    h1Highlight: 'rápido e controle total da loja',
    subheadline: 'Agilize o atendimento no caixa de balcão, gerencie comandas por mesa, controle o estoque de bebidas e salgados e receba via Pix direto na sua conta.',
    heroMetrics: [
      { label: 'Atendimento ágil no caixa', value: 'Em segundos' },
      { label: 'Controle de fechamento de caixa', value: '100%' },
      { label: 'Redução de erros em pedidos', value: '-85%' },
    ],
    painPointsTitle: 'Sua lanchonete precisa de um caixa ágil e sem complicações',
    painPointsSubtitle: 'Evite filas, erros de caixa e falta de estoque no final do expediente:',
    painPoints: [
      {
        semMiseOn: 'Sistemas complicados que travam o operador de caixa na hora de registrar salgados e sucos.',
        comMiseOn: 'PDV Balcão com busca rápida, atalhos intuitivos e fechamento de venda acelerado.',
      },
      {
        semMiseOn: 'Falta de clareza sobre o valor real em caixa e divergências na troca de turno.',
        comMiseOn: 'Controle de turnos de caixa com registro de sangria, reforço e fechamento de caixa.',
      },
      {
        semMiseOn: 'Dificuldade para controlar a saída de bebidas e produtos vendidos no balcão.',
        comMiseOn: 'Estoque integrado com relatórios de movimentação e alerta de estoque mínimo.',
      },
    ],
    featuresTitle: 'Funcionalidades reais do MiseOn para o seu balcão',
    featuresSubtitle: 'Recursos práticos desenvolvidos para lanchonetes e estabelecimentos de comida rápida:',
    features: [
      {
        iconName: 'ScanLine',
        title: 'Estoque pelo Cupom do Mercado',
        description: 'Escaneie o QR Code da nota da compra e os itens entram no estoque com quantidade e custo real, sem digitar produto por produto.',
        tag: 'NFC-e Automática',
      },

      {
        iconName: 'UtensilsCrossed',
        title: 'PDV Balcão Frente de Caixa',
        description: 'Venda rápida de itens com suporte a leitores de código de barras e atalhos de teclado.',
        tag: 'Caixa Rápido',
      },
      {
        iconName: 'Wallet',
        title: 'Fechamento & Movimentação de Caixa',
        description: 'Abertura, sangrias, reforço de troco e fechamento com prestação de contas organizada por turno.',
        tag: 'Caixa Seguro',
      },
      {
        iconName: 'QrCode',
        title: 'Cardápio Digital QR Code',
        description: 'Link e QR Code para que o cliente veja o cardápio e faça pedidos direto do celular.',
        tag: 'Autoatendimento',
      },
      {
        iconName: 'Boxes',
        title: 'Controle de Estoque Real',
        description: 'Acompanhe as quantidades de produtos e insumos, evitando que itens esgotem sem você saber.',
        tag: 'Estoque Atualizado',
      },
    ],
    businessRules: {
      title: 'Recursos Operacionais para Lanchonetes',
      description: 'Como o MiseOn agiliza o dia a dia da sua lanchonete:',
      items: [
        'PDV Balcão com abertura, sangria e fechamento por operador de caixa.',
        'Impressão de comprovantes de venda e vias de produção em impressoras térmicas.',
        'Comandas por mesa para consumo no local com lançamento rápido de itens.',
        'Recebimento Pix via Efí com QR Code na tela ou no checkout online.',
        'Relatórios de vendas por produto, categoria e meio de pagamento.',
      ],
    },
    faqs: [
      {
        pergunta: 'O PDV funciona em qualquer computador de caixa?',
        resposta: 'Sim! O MiseOn é 100% web e roda direto no navegador (Chrome, Edge, Firefox) em computadores, notebooks ou tablets.',
      },
      {
        pergunta: 'Consigo emitir cupom impresso para a cozinha ou para o cliente?',
        resposta: 'Sim. O sistema integra com impressoras térmicas (Epson, Bematech, Elgin, Daruma) para impressão de cupons de produção e recibos.',
      },
      {
        pergunta: 'Como funciona o recebimento via Pix no balcão?',
        resposta: 'Com a integração Efí, o Pix gera o QR Code na tela e a confirmação do pagamento cai instantaneamente no sistema, liberando a venda.',
      },
    ],
  },

  'sistema-para-pizzaria': {
    slug: 'sistema-para-pizzaria',
    category: 'nicho',
    seo: {
      title: 'Sistema para Pizzaria | Comandas, KDS de Forno e Delivery — MiseOn',
      description: 'Sistema para pizzaria completo: controle de comandas, KDS de forno e montagem, taxa de entrega por raio/bairro, iFood e Pix direto na conta.',
      keywords: 'sistema para pizzaria, gestão pizzaria, kds forno pizza, delivery pizzaria, cardápio digital pizzaria',
      canonicalUrl: 'https://miseon.app.br/sistema-para-pizzaria',
    },
    badge: 'Pizzarias e Deliveries de Pizza',
    h1Title: 'O sistema para pizzaria que organiza o forno e',
    h1Highlight: 'agiliza as entregas do seu delivery',
    subheadline: 'Centralize pedidos do salão, balcão e delivery em um painel único. Acompanhe a produção no KDS, gerencie motoboys e calcule taxas de entrega com precisão.',
    heroMetrics: [
      { label: 'Organização de forno e montagem', value: '100%' },
      { label: 'Precisão na gestão de entregas', value: '100%' },
      { label: 'Pedidos centralizados', value: 'iFood + Site' },
    ],
    painPointsTitle: 'Mantenha o forno e o delivery da sua pizzaria sob controle',
    painPointsSubtitle: 'Elimine erros de produção e atrasos nas entregas de pizza:',
    painPoints: [
      {
        semMiseOn: 'Comandas de pizza acumuladas na mesa do pizzaiolo sem ordem clara de saída.',
        comMiseOn: 'KDS em tela digital com colunas de acompanhamento de preparo e forneamento em tempo real.',
      },
      {
        semMiseOn: 'Confusão no controle de taxas de entrega e atribuição de pedidos aos motoboys.',
        comMiseOn: 'Módulo de Gestão de Entregas com atribuição de motoboy e acompanhamento de status.',
      },
      {
        semMiseOn: 'Operar iFood e vendas diretas em sistemas separados atrasando a forno.',
        comMiseOn: 'Pedidos do iFood e do cardápio online caindo no mesmo painel com baixa de estoque unificada.',
      },
      {
        semMiseOn: 'A massa artesanal e o molho de tomate preparados na casa entram no estoque com valor zerado — e a margem calculada para a pizza fica maquiada.',
        comMiseOn: 'Custeio em lote de preparos: o sistema calcula o valor exato da produção da massa e do molho com base nos insumos consumidos pelo PEPS e repassa à ficha da pizza.',
      },
    ],
    featuresTitle: 'Funcionalidades reais do MiseOn para a sua pizzaria',
    featuresSubtitle: 'Recursos nativos projetados para a produção e entrega de pizzas:',
    features: [
      {
        iconName: 'ScanLine',
        title: 'Estoque pelo Cupom do Mercado',
        description: 'Escaneie o QR Code da nota da compra e os itens entram no estoque com quantidade e custo real, sem digitar produto por produto.',
        tag: 'NFC-e Automática',
      },

      {
        iconName: 'ChefHat',
        title: 'KDS de Produção & Forno',
        description: 'Tela de cozinha com Kanban por etapas para organizar a fila de montagem e forneamento.',
        tag: 'Cozinha KDS',
      },
      {
        iconName: 'Bike',
        title: 'Gestão de Entregas & Motoboys',
        description: 'Atribua pedidos aos entregadores, organize rotas e acompanhe o status de saída do delivery.',
        tag: 'Delivery Sob Controle',
      },
      {
        iconName: 'ShoppingBag',
        title: 'Integração Nativa iFood',
        description: 'Sincronização de pedidos iFood direto no painel da pizzaria com baixa de estoque unificada.',
        tag: 'iFood Unificado',
      },
      {
        iconName: 'Boxes',
        title: 'Estoque por Ficha Técnica',
        description: 'Controle o consumo de farinha, queijos e insumos conforme os produtos são vendidos.',
        tag: 'Estoque de Insumos',
      },
      {
        iconName: 'BarChart3',
        title: 'Custo Real de Massas e Molhos',
        description: 'Tudo o que sua cozinha produz (massa fermentada, molho de tomate, recheios) é custeado na produção e entra na ficha técnica com preço apurado por kg ou porção.',
        tag: 'CMV da Pizza',
      },
    ],
    businessRules: {
      title: 'Recursos Operacionais para Pizzarias',
      description: 'Tudo o que sua pizzaria precisa para operar com eficiência:',
      items: [
        'KDS Kanban configurável por etapas com timer de permanência dos pedidos.',
        'Atribuição de motoboys por pedido e acompanhamento do status do delivery.',
        'Cálculo de taxa de entrega configurável por bairros ou por raio em km.',
        'Cardápio digital próprio com opções configuráveis para produtos.',
        'Recebimento direto via Pix Efí no checkout do cliente.',
        'Produção de massas e molhos da casa com custeio automático por lote no estoque e abatimento por PEPS.',
      ],
    },
    faqs: [
      {
        pergunta: 'Como o KDS auxilia o pizzaiolo durante o expediente?',
        resposta: 'Os pedidos entram na tela da cozinha com os detalhes e observações destacados. O pizzaiolo altera a etapa com um toque, sinalizando o progresso para o balcão.',
      },
      {
        pergunta: 'O sistema permite controlar os motoboys e entregas da pizzaria?',
        resposta: 'Sim! No módulo de Entregas você vincula os pedidos aos entregadores cadastrados e acompanha os status de saída e retorno.',
      },
      {
        pergunta: 'Consigo integrar os pedidos do iFood com os pedidos do meu site?',
        resposta: 'Sim. A integração oficial iFood envia os pedidos diretamente para a mesma fila de produção no KDS do MiseOn.',
      },
      {
        pergunta: 'Como o MiseOn calcula o custo das pizzas com massas e molhos caseiros?',
        resposta: 'Quando o pizzaiolo produz 10 kg de massa ou 5 litros de molho, o MiseOn calcula em tempo real o valor total dos insumos consumidos pelo PEPS e atribui o custo exato por kg ou litro. Assim, ao vender a pizza, o custo da fatia de massa e da concha de molho é abatido com precisão no CMV.',
      },
    ],
  },

  'sistema-para-restaurantes': {
    slug: 'sistema-para-restaurantes',
    category: 'nicho',
    seo: {
      title: 'Sistema para Restaurantes | Comanda Eletrônica, Mesas e Fiscal — MiseOn',
      description: 'Sistema completo para restaurantes: comanda eletrônica no celular do garçom, gestão de mesas, autoatendimento QR Code, DRE e NFC-e. Experimente!',
      keywords: 'sistema para restaurante, comanda eletronica garçom, gestão de mesas restaurante, emissão nfce restaurante, ficha técnica cmv',
      canonicalUrl: 'https://miseon.app.br/sistema-para-restaurantes',
    },
    badge: 'Restaurantes, Bares e Gastronomia',
    h1Title: 'O sistema para restaurante que integra salão, garçons,',
    h1Highlight: 'cozinha e gestão financeira',
    subheadline: 'Integre seu salão com comanda eletrônica no celular do garçom, mapa de mesas em tempo real, autoatendimento QR Code, DRE financeiro e emissão fiscal NFC-e.',
    heroMetrics: [
      { label: 'Giro de mesas no salão', value: 'Otimizado' },
      { label: 'Integração Salão x Cozinha', value: '100%' },
      { label: 'Economia em retrabalho fiscal', value: '100%' },
    ],
    painPointsTitle: 'Sincronia total entre o atendimento de salão e a cozinha',
    painPointsSubtitle: 'Elimine erros de pedidos, atrasos no atendimento e burocracia no fechamento de contas:',
    painPoints: [
      {
        semMiseOn: 'Garçom anotando em bloco de papel e tendo que ir até a cozinha entregar cada comanda.',
        comMiseOn: 'Comanda Eletrônica no celular: o garçom lança o pedido na mesa e ele cai direto no KDS da cozinha.',
      },
      {
        semMiseOn: 'Demora para visualizar quais mesas estão ocupadas, quais pediram a conta ou precisam de atenção.',
        comMiseOn: 'Mapa de Mesas interativo com visualização do tempo de permanência e status de cada mesa.',
      },
      {
        semMiseOn: 'Perda de tempo na hora de emitir o cupom fiscal do cliente no final da refeição.',
        comMiseOn: 'Emissão de NFC-e / NF-e integrada via FocusNFe ao fechar o pedido ou a comanda.',
      },
    ],
    featuresTitle: 'Funcionalidades reais do MiseOn para o seu restaurante',
    featuresSubtitle: 'Recursos completos para salão, cozinha e gestão financeira do seu restaurante:',
    features: [
      {
        iconName: 'ScanLine',
        title: 'Estoque pelo Cupom do Mercado',
        description: 'Escaneie o QR Code da nota da compra e os itens entram no estoque com quantidade e custo real, sem digitar produto por produto.',
        tag: 'NFC-e Automática',
      },

      {
        iconName: 'UtensilsCrossed',
        title: 'Comanda Eletrônica para Garçom',
        description: 'Aplicação web leve que roda no smartphone do garçom para lançar pedidos direto da mesa.',
        tag: 'Atendimento Ágil',
      },
      {
        iconName: 'BarChart3',
        title: 'Mapa de Mesas & Comandas',
        description: 'Visualização completa das mesas ocupadas, livres e em fechamento com divisão de conta.',
        tag: 'Gestão de Salão',
      },
      {
        iconName: 'Boxes',
        title: 'Estoque, Ficha Técnica & CMV',
        description: 'Controle de insumos e cálculo do CMV dos pratos com baixa de estoque automatizada.',
        tag: 'Gestão Financeira',
      },
      {
        iconName: 'ShieldCheck',
        title: 'Emissão Fiscal NFC-e Integrada',
        description: 'Emissão de notas fiscais de consumidor (NFC-e) homologada junto à SEFAZ via FocusNFe.',
        tag: 'FocusNFe Nativo',
      },
    ],
    businessRules: {
      title: 'Recursos Operacionais para Restaurantes',
      description: 'Como o MiseOn organiza a operação do seu restaurante:',
      items: [
        'Comanda eletrônica web para garçons com envio direto para a tela do KDS na cozinha.',
        'Mapa de mesas interativo com divisão de conta por pessoas e taxa de serviço configurável.',
        'Cardápio digital QR Code na mesa permitindo autoatendimento pelo próprio cliente.',
        'Painel financeiro com DRE, controle de movimentações e conciliação Pix Efí.',
        'Emissão de NFC-e / NF-e com certificado A1 e envio automático para a contabilidade.',
      ],
    },
    faqs: [
      {
        pergunta: 'Os garçons precisam de um aplicativo instalado ou equipamento especial?',
        resposta: 'Não! A comanda eletrônica é web e roda em qualquer smartphone Android ou iOS comum usando o navegador.',
      },
      {
        pergunta: 'Como funciona o fechamento e divisão de conta nas mesas?',
        resposta: 'No painel da mesa, você ajusta a taxa de serviço, divide o total entre os pagantes e registra os pagamentos (Pix, cartão, dinheiro).',
      },
      {
        pergunta: 'O sistema faz a emissão de Nota Fiscal (NFC-e)?',
        resposta: 'Sim. Através da integração nativa com o FocusNFe, o MiseOn autoriza NFC-e diretamente junto à SEFAZ e disponibiliza o cupom fiscal.',
      },
    ],
  },

  'integracao-ifood': {
    slug: 'integracao-ifood',
    category: 'funcionalidade',
    seo: {
      title: 'Integração iFood para Restaurantes | Margem na Tela — MiseOn',
      description: 'Integração iFood via API: pedidos no mesmo painel do salão e do site, comanda completa, cancelamento com motivo oficial e a comissão do iFood descontada pedido a pedido.',
      keywords: 'integração ifood restaurante, sincronizar cardápio ifood, kds unificado ifood, sistema integrado com ifood, margem ifood',
      canonicalUrl: 'https://miseon.app.br/integracao-ifood',
    },
    // "Oficial" é palavra que o iFood reserva para integrações homologadas por
    // eles. Enquanto a homologação não sai, dizer "via API do iFood" é o que é
    // verdade — e é o que não vira problema quando um analista deles abrir esta
    // página durante a análise de parceiro.
    badge: 'Integração via API do iFood',
    h1Title: 'Integração iFood para restaurantes',
    h1Highlight: 'com a margem de cada pedido na tela',
    subheadline: 'Os pedidos do iFood entram no mesmo painel do salão, do site e do WhatsApp — com a comanda inteira, a comissão descontada pedido a pedido e o preço sugerido para o seu cardápio de lá não comer sua margem.',
    heroMetrics: [
      { label: 'Comissão do iFood por pedido', value: 'Descontada na tela' },
      { label: 'Redigitação de pedidos', value: 'Zerada' },
      { label: 'Mudanças no seu iFood sem você mandar', value: 'Nenhuma' },
    ],
    painPointsTitle: 'Opere o iFood sem perder margem nem informação no caminho',
    painPointsSubtitle: 'O que muda quando o marketplace conversa com o seu sistema de verdade:',
    painPoints: [
      {
        semMiseOn: 'Operador redigitando os pedidos do iFood no sistema interno, com o risco de errar item e endereço.',
        comMiseOn: 'O pedido entra direto no painel com aviso sonoro: itens, complementos, endereço com complemento e ponto de referência, observação de entrega, troco e bandeira do cartão.',
      },
      {
        semMiseOn: 'Faturamento do iFood entrando cheio no caixa e a comissão aparecendo só no repasse, semanas depois.',
        comMiseOn: 'Bruto, taxa retida e líquido por pedido e por canal. E o preço sugerido para o cardápio do iFood, calculado a partir da sua taxa de contrato.',
      },
      {
        semMiseOn: 'Cancelou no seu sistema e o pedido continua vivo no app do cliente, que segue esperando comida que ninguém vai fazer.',
        comMiseOn: 'Cancelamento com o motivo que o próprio iFood aceita para aquele pedido. Se eles recusarem, a tela avisa — e o pedido não some do painel por engano.',
      },
      {
        semMiseOn: 'Itens esgotando no balcão enquanto continuam disponíveis no iFood, gerando cancelamento e nota baixa.',
        comMiseOn: 'Ficha técnica ligada ao pedido do iFood: cada venda baixa os insumos do mesmo estoque do salão.',
      },
    ],
    featuresTitle: 'O que a integração faz, na prática',
    featuresSubtitle: 'Recursos que existem na tela, não no roteiro de vendas:',
    features: [
      {
        iconName: 'Percent',
        title: 'Margem protegida por markup',
        description: 'Você informa a taxa do seu contrato e o MiseOn calcula quanto cobrar no iFood para, depois da comissão, sobrar o preço do seu PDV.',
        tag: 'Margem Real',
      },
      {
        iconName: 'ShoppingBag',
        title: 'Comanda completa do pedido',
        description: 'Endereço com complemento e referência, observação de entrega em destaque, bandeira do cartão, troco calculado, cupom com quem o banca e CPF para a nota — na tela e na via impressa.',
        tag: 'Sem Retrabalho',
      },
      {
        iconName: 'Ban',
        title: 'Cancelamento que não mente',
        description: 'A lista de motivos vem do próprio iFood para aquele pedido. O MiseOn só dá baixa depois que eles aceitam — e mostra o motivo da recusa quando não aceitam.',
        tag: 'Sem Divergência',
      },
      {
        iconName: 'KeyRound',
        title: 'Conferência por código',
        description: 'Código do entregador do iFood na coleta e código do cliente na entrega, conferidos com a plataforma antes de a sacola sair ou o pedido fechar.',
        tag: 'Entrega Conferida',
      },
      {
        iconName: 'ChefHat',
        title: 'KDS e impressão centralizados',
        description: 'Pedido do iFood na mesma fila de preparo do salão, do site e do WhatsApp, com selo de origem — na tela da cozinha ou na impressora térmica.',
        tag: 'Cozinha Unificada',
      },
      {
        iconName: 'BarChart3',
        title: 'Faturamento por canal',
        description: 'Quanto veio do iFood, do site, do balcão e das mesas, com a taxa do marketplace separada do que de fato entrou no caixa.',
        tag: 'Visão de Vendas',
      },
    ],
    businessRules: {
      title: 'Como funciona na operação',
      description: 'O que acontece de um lado e do outro, e o que fica na sua mão:',
      items: [
        'Pedido novo é confirmado no iFood dentro do prazo de 8 minutos deles — ou você assume o aceite manual, se preferir.',
        'Em preparo, pronto, despachado e concluído: cada passo daqui atualiza o acompanhamento que o cliente vê no app.',
        'Cancelamento partindo da loja ou vindo do iFood são tratados nos dois sentidos, com o motivo registrado no histórico do pedido.',
        'Cada interruptor da integração é independente e começa desligado: nada é alterado no seu iFood sem você ligar.',
        'A baixa de estoque e o custo na DRE dependem do de-para de produtos — o código do item no iFood ligado ao produto daqui. É parte do onboarding, e o painel avisa quando algum pedido entra sem vínculo.',
        'Emissão de NFC-e para o pedido do iFood, para quem usa o módulo fiscal.',
      ],
    },
    faqs: [
      {
        pergunta: 'Os pedidos do iFood caem na mesma tela dos pedidos do meu site e salão?',
        resposta: 'Sim. Todos entram na mesma fila do painel central e no KDS da cozinha, com o selo identificador "iFood".',
      },
      {
        pergunta: 'Preciso configurar alguma coisa para o estoque baixar quando eu vender no iFood?',
        resposta: 'Sim, e é rápido: cada produto precisa ter o mesmo código nos dois sistemas (o "Código PDV" do iFood). Sem esse vínculo o pedido entra e fatura normalmente, mas não baixa insumo nem lança custo. A tela de De-Para mostra quantos produtos já estão ligados, e o painel marca todo pedido que entrar sem vínculo.',
      },
      {
        pergunta: 'O MiseOn vai mexer no meu cardápio do iFood sozinho?',
        resposta: 'Não. Enviar cardápio, sincronizar preço e sincronizar disponibilidade são interruptores separados, todos desligados por padrão, e o envio só acontece quando você manda. Muito lojista cobra mais no iFood por causa da comissão — por isso o preço nunca vai junto sem você pedir.',
      },
      {
        pergunta: 'A integração funciona para entrega própria e para entrega do iFood?',
        resposta: 'Sim. O pedido diz quem entrega, e a tela muda junto: entrega própria tem despacho e código de entrega do cliente; entrega do iFood tem a conferência do código que o entregador deles apresenta na coleta.',
      },
      {
        pergunta: 'Como vocês calculam a comissão do iFood?',
        resposta: 'Você informa a taxa percentual e a taxa fixa do seu contrato, e o MiseOn aplica pedido a pedido para mostrar bruto, taxa retida e líquido. É estimativa baseada no seu contrato: o valor oficial continua sendo o do repasse do iFood.',
      },
    ],
  },

  'cardapio-qr-code': {
    slug: 'cardapio-qr-code',
    category: 'funcionalidade',
    seo: {
      title: 'Cardápio Digital QR Code Sem Taxas para Restaurantes — MiseOn',
      description: 'Crie seu cardápio digital com QR Code e link próprio. Sem comissões por pedido, atualização em tempo real e Pix direto na sua conta. Comece já!',
      keywords: 'cardápio digital qr code, cardápio online sem taxa, cardápio para mesa, cardápio digital restaurante',
      canonicalUrl: 'https://miseon.app.br/cardapio-qr-code',
    },
    badge: 'Cardápio Digital Sem Taxas',
    h1Title: 'Cardápio Digital com QR Code para mesas e delivery',
    h1Highlight: 'sem pagar comissão por pedido',
    subheadline: 'Coloque sua loja no ar com link personalizado e QR Code para mesas ou balcão. Fotos atraentes, grupos de adicionais e pagamentos via Pix direto na sua conta.',
    heroMetrics: [
      { label: 'Comissão por pedido feito no site', value: '0%' },
      { label: 'Reimpressões de papel', value: 'Zeradas' },
      { label: 'Atualização de preços', value: 'Em tempo real' },
    ],
    painPointsTitle: 'Tenha seu próprio canal de vendas digital e livre de taxas',
    painPointsSubtitle: 'Economize com impressão de cardápios e elimine taxas sobre suas vendas:',
    painPoints: [
      {
        semMiseOn: 'Gastar dinheiro reimprimindo cardápios de papel a cada alteração de preço ou prato indisponível.',
        comMiseOn: 'Atualização instantânea: altere um preço no painel e o cardápio digital atualiza na hora.',
      },
      {
        semMiseOn: 'Pagar porcentagens sobre cada venda feita no seu próprio estabelecimento.',
        comMiseOn: 'Zero comissão sobre pedidos: 100% do faturamento das suas vendas é seu.',
      },
      {
        semMiseOn: 'Clientes aguardando o garçom trazer o cardápio impresso na mesa.',
        comMiseOn: 'QR Code na mesa: o cliente aponta o celular, vê o cardápio e faz o pedido com agilidade.',
      },
    ],
    featuresTitle: 'Recursos reais do Cardápio Digital MiseOn',
    featuresSubtitle: 'Recursos práticos para vendas online e autoatendimento:',
    features: [
      {
        iconName: 'QrCode',
        title: 'QR Code para Mesas e Balcão',
        description: 'Gere QR Codes exclusivos para cada mesa ou balcão da sua loja.',
        tag: 'Autoatendimento',
      },
      {
        iconName: 'Sparkles',
        title: 'Aplicação Web Leve',
        description: 'Carregamento rápido no celular do cliente sem necessidade de baixar aplicativos.',
        tag: 'Web App',
      },
      {
        iconName: 'Wallet',
        title: 'Pagamento Pix via Efí',
        description: 'Checkout com Pix Copia e Cola direto na conta bancária do lojista.',
        tag: 'Pix Direto',
      },
      {
        iconName: 'Megaphone',
        title: 'Cupons & Promoções',
        description: 'Crie cupons de desconto (ex: PRIMEIRACOMPRA) para incentivar vendas no seu canal próprio.',
        tag: 'Marketing',
      },
    ],
    businessRules: {
      title: 'Recursos Operacionais do Cardápio Digital',
      description: 'Como o cardápio online do MiseOn funciona na prática:',
      items: [
        'Personalização com a logomarca, cores principais e banner da sua loja.',
        'Grupos de opções e adicionais obrigatórios ou opcionais por produto.',
        'Modo Delivery (com taxa de entrega) e Modo Mesa/Balcão.',
        'Horários de funcionamento automatizados que abrem e fecham a loja no site.',
        'Acompanhamento do status do pedido pelo cliente no celular.',
      ],
    },
    faqs: [
      {
        pergunta: 'O cliente precisa baixar algum aplicativo no celular?',
        resposta: 'Não! O cardápio digital é uma página web moderna que abre no navegador do celular ao escanear o QR Code ou clicar no link.',
      },
      {
        pergunta: 'O MiseOn cobra comissão sobre os pedidos feitos no cardápio digital?',
        resposta: 'Não. Você paga apenas a mensalidade do plano MiseOn. Zero taxa percentual por pedido.',
      },
      {
        pergunta: 'Como recebo o dinheiro das vendas por Pix?',
        resposta: 'O Pix cai direto na conta bancária vinculada à sua conta Efí (Gerencianet), sem retenção de saldo pelo MiseOn.',
      },
    ],
  },

  'api-whatsapp-restaurantes': {
    slug: 'api-whatsapp-restaurantes',
    category: 'funcionalidade',
    seo: {
      title: 'Atendimento por WhatsApp com IA para Restaurantes — MiseOn',
      description: 'Automatize seu WhatsApp com a API Oficial da Meta e IA. Responda dúvidas com dados reais da loja e envie o link do cardápio!',
      keywords: 'whatsapp ia restaurante, robo whatsapp delivery, atendimento automático whatsapp comida, api oficial whatsapp meta',
      canonicalUrl: 'https://miseon.app.br/api-whatsapp-restaurantes',
    },
    badge: 'API Oficial Meta Verified',
    h1Title: 'Atendimento inteligente via WhatsApp com IA Oficial Meta',
    h1Highlight: 'para o seu restaurante',
    subheadline: 'Atenda clientes no WhatsApp com Inteligência Artificial conectada à API Oficial da Meta. Responda dúvidas sobre cardápio, horários e envie o link do seu cardápio digital.',
    heroMetrics: [
      { label: 'Conexão WhatsApp', value: 'API Oficial Meta' },
      { label: 'Tempo de resposta', value: 'Instantâneo' },
      { label: 'Risco de banimento', value: '0%' },
    ],
    painPointsTitle: 'Atendimento rápido e oficial no WhatsApp do seu delivery',
    painPointsSubtitle: 'Elimine a demora nas respostas no canal de atendimento mais usado pelos clientes:',
    painPoints: [
      {
        semMiseOn: 'Demora para responder mensagens simples como "Manda o cardápio" nos horários de pico.',
        comMiseOn: 'IA que responde imediatamente, tira dúvidas reais do cardápio e envia o link para pedido.',
      },
      {
        semMiseOn: 'Risco de bloqueio por utilizar sistemas não autorizados de automação de WhatsApp.',
        comMiseOn: 'Integração 100% Oficial via WhatsApp Business Cloud API da Meta (Meta Verified).',
      },
      {
        semMiseOn: 'Atendentes sobrecarregados digitando respostas repetitivas toda noite.',
        comMiseOn: 'A IA assume o atendimento inicial e silencia automaticamente quando um humano intervém.',
      },
    ],
    featuresTitle: 'Recursos reais do Atendimento WhatsApp MiseOn',
    featuresSubtitle: 'Tecnologia oficial e segura para a comunicação da sua loja:',
    features: [
      {
        iconName: 'MessageCircle',
        title: 'IA com Dados Reais da Loja',
        description: 'A IA responde com base nos produtos, preços e horários cadastrados no seu painel MiseOn.',
        tag: 'Dados Reais',
      },
      {
        iconName: 'ShieldCheck',
        title: 'Conexão Oficial Meta',
        description: 'Integração via WhatsApp Business Cloud API Oficial da Meta sem risco de banimento de número.',
        tag: 'Meta Official',
      },
      {
        iconName: 'QrCode',
        title: 'Envio do Link do Cardápio',
        description: 'A IA direciona o cliente para montar o pedido com precisão no seu cardápio digital.',
        tag: 'Link Direto',
      },
      {
        iconName: 'Headset',
        title: 'Controle e Transição Humana',
        description: 'Painel centralizado para atendentes assumirem a conversa a qualquer momento.',
        tag: 'Atendimento Misto',
      },
    ],
    businessRules: {
      title: 'Recursos Operacionais do WhatsApp com IA',
      description: 'Como a automação do WhatsApp funciona na sua loja:',
      items: [
        'Respostas automáticas para dúvidas sobre cardápio, preços, localização e horário.',
        'Envio do link do cardápio digital para que o cliente monte o carrinho no site.',
        'Notificações de status de pedidos enviados pelo WhatsApp.',
        'Painel centralizador de chat para atendimento humano com histórico de conversas.',
        'Silenciamento automático da IA quando um atendente digita na conversa.',
      ],
    },
    faqs: [
      {
        pergunta: 'O número de WhatsApp da loja corre risco de ser banido?',
        resposta: 'Não! O MiseOn utiliza exclusivamente a API Oficial da WhatsApp Business Platform da Meta, garantindo total conformidade e segurança.',
      },
      {
        pergunta: 'A IA fecha o pedido sozinha no WhatsApp?',
        resposta: 'Ela responde todas as dúvidas sobre seu cardápio e envia o link do cardápio digital para que o cliente selecione os itens e finalize o pedido sem erros.',
      },
      {
        pergunta: 'Um atendente humano pode intervir na conversa do WhatsApp?',
        resposta: 'Sim! No painel de Chat do MiseOn você pode visualizar todas as conversas e responder o cliente. A IA silencia assim que o atendente assume.',
      },
    ],
  },

  'gestao-fiscal-nfe': {
    slug: 'gestao-fiscal-nfe',
    category: 'funcionalidade',
    seo: {
      title: 'Emissor Fiscal NFC-e e NF-e para Restaurantes — MiseOn',
      description: 'Emissão de Nota Fiscal Eletrônica (NFC-e e NF-e) para restaurantes. Integração nativa com FocusNFe, suporte a certificado A1 e exportação para contabilidade.',
      keywords: 'emissão nfce restaurante, sistema fiscal delivery, emissor nota fiscal restaurante, focusnfe restaurante',
      canonicalUrl: 'https://miseon.app.br/gestao-fiscal-nfe',
    },
    badge: 'Módulo Fiscal FocusNFe Nativo',
    h1Title: 'Emissão de Nota Fiscal (NFC-e / NF-e) simplificada',
    h1Highlight: 'para restaurantes e deliveries',
    subheadline: 'Cumpra as obrigações fiscais da sua loja. Emita cupons fiscais eletrônicos (NFC-e) de forma integrada via FocusNFe direto do seu painel de vendas.',
    heroMetrics: [
      { label: 'Emissão de NFC-e', value: 'Integrada' },
      { label: 'Certificado Digital', value: 'Modelo A1' },
      { label: 'Conformidade SEFAZ', value: '100%' },
    ],
    painPointsTitle: 'Facilite a emissão fiscal no seu estabelecimento',
    painPointsSubtitle: 'Mantenha sua loja em dia com a SEFAZ sem retrabalho na hora de vender:',
    painPoints: [
      {
        semMiseOn: 'Abrir um software fiscal separado e digitar novamente os itens da venda.',
        comMiseOn: 'Emissão direta: autorize a NFC-e com 1 clique no painel ou no fechamento da venda.',
      },
      {
        semMiseOn: 'Dificuldade para configurar regras de tributação dos produtos.',
        comMiseOn: 'Cadastro fiscal simplificado com vinculação de NCM, CEST e regras tributárias por produto.',
      },
      {
        semMiseOn: 'Trabalho manual no final do mês para enviar arquivos fiscais ao contador.',
        comMiseOn: 'Exportação e envio de lotes mensais de XMLs para a contabilidade.',
      },
    ],
    featuresTitle: 'Recursos reais do Módulo Fiscal MiseOn',
    featuresSubtitle: 'Integração oficial com a plataforma FocusNFe:',
    features: [
      {
        iconName: 'ScanLine',
        title: 'Estoque pelo Cupom do Mercado',
        description: 'Escaneie o QR Code da nota da compra e os itens entram no estoque com quantidade e custo real, sem digitar produto por produto.',
        tag: 'NFC-e Automática',
      },

      {
        iconName: 'ShieldCheck',
        title: 'Emissão de NFC-e de Consumidor',
        description: 'Emissão de notas fiscais de consumidor para vendas de balcão, delivery e salão.',
        tag: 'NFC-e Integrada',
      },
      {
        iconName: 'ShieldCheck',
        title: 'Emissão de NF-e (Modelo 55)',
        description: 'Emissão de notas fiscais eletrônicas com dados completos do comprador quando solicitado.',
        tag: 'NF-e Modelo 55',
      },
      {
        iconName: 'Boxes',
        title: 'Cadastro Tributário de Produtos',
        description: 'Campos para configuração de NCM, CEST, CSOSN/CST e tributação nos produtos.',
        tag: 'Regras Fiscais',
      },
      {
        iconName: 'BarChart3',
        title: 'Gerenciamento de XMLs',
        description: 'Download de XMLs e DANFEs emitidos para conferência e envio ao escritório contábil.',
        tag: 'Exportação Contábil',
      },
    ],
    businessRules: {
      title: 'Recursos Operacionais do Módulo Fiscal',
      description: 'Como a emissão fiscal funciona no MiseOn:',
      items: [
        'Suporte a Certificados Digitais modelo A1 (arquivo .pfx / .p12 em nuvem).',
        'Impressão do DANFE da NFC-e em impressoras térmicas de balcão.',
        'Emissão integrada via FocusNFe homologada junto às SEFAZs estaduais.',
        'Cancelamento e inutilização de numeração dentro dos prazos legais.',
        'Relatórios de notas autorizadas e rejeitadas para acompanhamento.',
      ],
    },
    faqs: [
      {
        pergunta: 'Qual modelo de certificado digital é compatível com o MiseOn?',
        resposta: 'O sistema utiliza o Certificado Digital A1 (arquivo .p12 ou .pfx), emitido por qualquer autoridade certificadora.',
      },
      {
        pergunta: 'Como é feita a integração fiscal no sistema?',
        resposta: 'O MiseOn possui integração nativa com a API do FocusNFe. Você insere os dados da loja e certificado no painel e começa a emitir.',
      },
      {
        pergunta: 'O sistema atende a SEFAZ do meu estado?',
        resposta: 'Sim. A tecnologia FocusNFe está homologada para emissão de NFC-e e NF-e junto às Secretarias de Fazenda de todos os estados do Brasil.',
      },
    ],
  },

  'sistema-para-restaurante-por-quilo': {
    slug: 'sistema-para-restaurante-por-quilo',
    category: 'nicho',
    seo: {
      title: 'Sistema para Restaurante por Quilo e Self-Service | Peso Inteligente — MiseOn',
      description: 'O sistema definitivo para restaurantes a quilo e self-service: baixa automática de insumos por peso real via Ficha Técnica, R$/kg flexível, PDV balança e métricas de porção.',
      keywords: 'sistema para restaurante por quilo, sistema self service, restaurante comida por quilo, baixa de estoque por peso, pdv balanca comida quilo',
      canonicalUrl: 'https://miseon.app.br/sistema-para-restaurante-por-quilo',
    },
    badge: 'Buffet Self-Service & Comida por Quilo',
    h1Title: 'O único sistema para restaurante por quilo com',
    h1Highlight: 'baixa automática de estoque por peso real',
    subheadline: 'Elimine o prejuízo do buffet por falta de controle. Calcule pratos por peso (R$/kg) ou unidade com a precisão da Ficha Técnica MiseOn. Cada grama servida reduz o estoque exato dos seus insumos.',
    heroMetrics: [
      { label: 'Redução no desperdício do buffet', value: '-30%' },
      { label: 'Precisão de baixa por peso consumido', value: '100%' },
      { label: 'Lançamento de peso no PDV', value: 'Em segundos' },
    ],
    painPointsTitle: 'Pare de perder dinheiro e margem no buffet por quilo',
    painPointsSubtitle: 'Veja como o Peso Inteligente MiseOn elimina os vazamentos de lucro na sua comida por peso:',
    painPoints: [
      {
        semMiseOn: 'Sistemas legados que tratam o prato por quilo como uma "unidade genérica" e nunca baixam os insumos reais (carne, feijão, arroz).',
        comMiseOn: 'Peso Inteligente MiseOn: o cliente serve 350g e a Ficha Técnica baixa exatamente a proporção exata dos insumos cadastrados.',
      },
      {
        semMiseOn: 'Dificuldade para reajustar o preço do quilo quando os insumos sobem no fornecedor.',
        comMiseOn: 'Gestão flexível de R$/kg com cálculo de custo por prato e simulação de margem em tempo real.',
      },
      {
        semMiseOn: 'Métricas distorcidas em relatórios que contam 0.35kg como "0.35 vendas" em vez de 1 porção consumida.',
        comMiseOn: 'Contagem de "Mais Pedidos" baseada em porções servidas reais, fornecendo inteligência de negócios de verdade.',
      },
      {
        semMiseOn: 'A perda de cocção no buffet (10 kg de peça crua que viram 7 kg assados) dilui a margem sem o dono perceber quanto cada prato na travessa realmente custou.',
        comMiseOn: 'Custo de produção com rendimento real: o MiseOn registra o peso pronto da travessa após o cozimento e absorve a perda no custo por kg do alimento pronto.',
      },
    ],
    featuresTitle: 'Funcionalidades reais do Módulo de Venda por Peso',
    featuresSubtitle: 'Construído para a rotina dinâmica de buffets, marmitas e restaurantes self-service:',
    features: [
      {
        iconName: 'ScanLine',
        title: 'Estoque pelo Cupom do Mercado',
        description: 'Escaneie o QR Code da nota da compra e os itens entram no estoque com quantidade e custo real, sem digitar produto por produto.',
        tag: 'NFC-e Automática',
      },

      {
        iconName: 'UtensilsCrossed',
        title: 'Configuração Flexível (R$/kg ou Unidade)',
        description: 'Defina se o produto é vendido por peso (R$/kg) ou unidade inteira com 1 único clique.',
        tag: 'Configurável por Produto',
      },
      {
        iconName: 'Boxes',
        title: 'Baixa Automática Por Peso Real',
        description: 'A Ficha Técnica multiplica o consumo exato da receita pelo peso servido no prato.',
        tag: 'Estoque de Precisão',
      },
      {
        iconName: 'UtensilsCrossed',
        title: 'Lançamento Rápido no PDV Balcão',
        description: 'Digite o peso em gramas ou kg em segundos no caixa do balcão ou nas comandas de mesa.',
        tag: 'PDV Express',
      },
      {
        iconName: 'QrCode',
        title: 'Cardápio Digital com Seletor de Peso',
        description: 'Seletor intuitivo com atalhos rápidos (250g, 350g, 500g, 1kg) para pedidos online e marmitas a peso.',
        tag: 'Autoatendimento',
      },
      {
        iconName: 'BarChart3',
        title: 'Perda de Cocção & Custo do Buffet',
        description: 'Apuração automática de rendimento pós-cozimento: se 10 kg de carne viram 7 kg prontos na travessa, o custo de compra se ajusta ao peso final pronto para servir.',
        tag: 'Rendimento Real',
      },
    ],
    businessRules: {
      title: 'Recursos Operacionais para Restaurantes por Quilo',
      description: 'Como o MiseOn opera no modelo self-service:',
      items: [
        'Lançamento por peso fracionado com precisão de até 4 casas decimais (ex: 0,350 kg).',
        'Tabela de porções vendidas com contador inteligente de clientes servidos.',
        'Suporte a produtos híbridos no mesmo caixa (buffet a quilo + bebidas unitárias + sobremesa).',
        'Impressão de comanda e romaneio com formatação clara de peso (ex: 0,350 kg).',
        'Relatórios de margem por prato baseados no valor do kg e custo dos insumos.',
        'Cálculo de perda de cocção em preparos de buffet: o custo se concentra no peso líquido pronto para servir, eliminando margens maquiadas pelo peso bruto cru.',
      ],
    },
    faqs: [
      {
        pergunta: 'Como funciona a baixa de estoque para produtos vendidos a quilo?',
        resposta: 'Na ficha técnica, você cadastra os insumos necessários por quilo (ex: 0.3kg de feijão para cada 1kg de feijoada). Se o cliente serve 350g (0.350kg), o sistema baixa exatamente 0.105kg de feijão.',
      },
      {
        pergunta: 'Posso vender produtos por peso e produtos unitários no mesmo pedido?',
        resposta: 'Com certeza! O sistema é 100% híbrido. Você pode lançar o prato por peso (0,450 kg) junto com um refrigerante por unidade (1x Coca-Cola) na mesma comanda.',
      },
      {
        pergunta: 'Preciso de alguma balança específica para usar com o sistema?',
        resposta: 'Não! O operador de caixa digita diretamente o peso (em gramas ou kg) indicado na balança, garantindo agilidade extrema sem travas de homologação de hardware.',
      },
      {
        pergunta: 'Como o sistema calcula a perda de cocção dos assados e grelhados do buffet?',
        resposta: 'No MiseOn, a ordem de produção permite informar o rendimento padrão em kg após o cozimento. Se você cozinha 10 kg de carne e obtém 7 kg de assado pronto na travessa, o sistema ajusta o custo unitário por kg final servido. Dessa forma, o valor por grama consumido pelo cliente reflete 100% do custo real do ingrediente.',
      },
    ],
  },
};

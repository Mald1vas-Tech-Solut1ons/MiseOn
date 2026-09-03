import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import confetti from 'canvas-confetti';

export interface TourStep {
  id: string;
  categoria: string;        // PT
  categoriaEn: string;      // EN
  titulo: string;           // PT
  tituloEn: string;         // EN
  descricao: string;        // PT
  descricaoEn: string;      // EN
  dicaExtra?: string;       // PT
  dicaExtraEn?: string;     // EN
  rota: string;
  targetDataTour: string;
  posicao?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  clicarElementoTarget?: boolean;
}

export const TOUR_STEPS: TourStep[] = [
  // ── Módulo 1: Painel de Pedidos & Bastão Balcão ──
  {
    id: 'passo-pedidos-header',
    categoria: 'Central de Vendas (Balcão)',
    categoriaEn: 'Sales Command Center (Counter)',
    titulo: '1. Central de Comando dos Pedidos 🛎️',
    tituloEn: '1. Orders Command Center 🛎️',
    descricao: 'Esta é a tela principal de acompanhamento operacional do seu restaurante. Todos os pedidos — venham do Cardápio Digital (QR Code nas mesas), do site de Delivery, da Integração iFood ou do WhatsApp Inteligente — chegam unificados aqui.',
    descricaoEn: 'This is the main operational hub for your restaurant. All orders — from the Digital Menu (QR Code at tables), the Delivery website, iFood Integration or WhatsApp AI — arrive unified here.',
    dicaExtra: 'Pedidos novos acionam um alarme sonoro instantâneo e destacam na tela para não deixar o cliente esperando.',
    dicaExtraEn: 'New orders trigger an instant audio alert and are highlighted on screen so you never keep a customer waiting.',
    rota: '/admin/pedidos',
    targetDataTour: 'tour-pedidos-header',
    posicao: 'bottom',
  },
  {
    id: 'passo-pedidos-bastao',
    categoria: 'Passa-Bastão Operacional',
    categoriaEn: 'Operational Handoff',
    titulo: '2. Regra do Bastão & Baixa de Estoque 🏃‍♂️💨',
    tituloEn: '2. Handoff Rule & Inventory Deduction 🏃‍♂️💨',
    descricao: 'O MiseOn possui uma trava de segurança contra perdas: ao clicar em "Aceitar Pedido", o bastão passa para o balcão e o estoque das fichas técnicas é reduzido automaticamente no banco de dados. Em seguida, enviar o pedido para a cozinha transfere o bastão para a tela KDS.',
    descricaoEn: 'MiseOn has a built-in loss-prevention lock: when you click "Accept Order", the handoff passes to the counter and recipe-sheet inventory is automatically deducted. Sending the order to the kitchen then transfers the handoff to the KDS screen.',
    dicaExtra: 'A transição de bastão garante que nenhum pedido saia sem passar pelo preparo e sem abater o ingrediente do estoque.',
    dicaExtraEn: 'The handoff transition ensures no order leaves without going through preparation and without deducting ingredients from stock.',
    rota: '/admin/pedidos',
    targetDataTour: 'tour-pedidos-filtros',
    posicao: 'bottom',
  },

  // ── Módulo 2: Gestão de Estoque Completo ──
  {
    id: 'passo-estoque-insumos',
    categoria: 'Gestão de Estoque',
    categoriaEn: 'Inventory Management',
    titulo: '3. Aba Matérias-Primas (Insumos Brutos) 📦',
    tituloEn: '3. Raw Materials Tab 📦',
    descricao: 'Aqui você gerencia tudo o que compra do seu fornecedor: fardos de farinha, caixas de carne, fardos de refri ou sachês de molho. Todos os itens brutos da despensa ficam centralizados nesta aba.',
    descricaoEn: 'Here you manage everything you buy from suppliers: flour bundles, meat boxes, soda cases or sauce sachets. All raw pantry items are centralized in this tab.',
    dicaExtra: 'Você pode filtrar insumos por categoria (Ingredientes, Embalagens, Limpeza) ou buscar direto pelo nome.',
    dicaExtraEn: 'You can filter ingredients by category (Ingredients, Packaging, Cleaning) or search directly by name.',
    rota: '/admin/estoque',
    targetDataTour: 'tour-estoque-aba-insumos',
    posicao: 'bottom',
    clicarElementoTarget: true,
  },
  {
    id: 'passo-estoque-campo-nome',
    categoria: 'Cadastro de Insumo',
    categoriaEn: 'Ingredient Registration',
    titulo: '4. Nome & Categoria do Insumo 📝',
    tituloEn: '4. Ingredient Name & Category 📝',
    descricao: 'Informe o nome comercial do ingrediente (ex: "Queijo Mussarela Peça" ou "Carne de Hambúrguer 180g"). Selecione a Categoria ou crie uma nova na hora.',
    descricaoEn: 'Enter the commercial name of the ingredient (e.g. "Mozzarella Block" or "Burger Patty 180g"). Select a Category or create a new one on the spot.',
    dicaExtra: 'O campo Setor de Armazenamento organiza se o item fica no Freezer, Geladeira ou Prateleira Seca para o Rastreio 3D.',
    dicaExtraEn: 'The Storage Sector field organizes whether the item goes in the Freezer, Fridge or Dry Shelf for the 3D Tracking view.',
    rota: '/admin/estoque',
    targetDataTour: 'tour-estoque-campo-nome',
    posicao: 'bottom',
  },
  {
    id: 'passo-estoque-campo-compra',
    categoria: 'Cadastro de Insumo',
    categoriaEn: 'Ingredient Registration',
    titulo: '5. Como você Compra no Fornecedor? 🛒',
    tituloEn: '5. How Do You Buy from the Supplier? 🛒',
    descricao: 'Preencha a Unidade de Compra (ex: Caixa, Fardo, Peça, Kg), o Preço Pago pela embalagem fechada (R$) e a Quantidade inicial em estoque.',
    descricaoEn: 'Fill in the Purchase Unit (e.g. Box, Bundle, Unit, Kg), the Price Paid for the closed package and the starting Stock Quantity.',
    dicaExtra: 'Se você comprou um fardo com 12 unidades por R$ 60,00, coloque Unidade = Fardo e Preço = 60,00.',
    dicaExtraEn: 'If you bought a bundle with 12 units for R$ 60.00, set Unit = Bundle and Price = 60.00.',
    rota: '/admin/estoque',
    targetDataTour: 'tour-estoque-campo-compra',
    posicao: 'right',
  },
  {
    id: 'passo-estoque-campo-conversao',
    categoria: 'Fracionamento Inteligente',
    categoriaEn: 'Smart Yield Tracking',
    titulo: '6. Regra de Conversão & Fracionamento ⚙️',
    tituloEn: '6. Yield & Conversion Rule ⚙️',
    descricao: 'A MÁGICA DO MISEON: defina o rendimento de uso! Exemplo: 1 Fardo rende 12 Unidades, ou 1 Peça de 5kg de queijo rende 250 Fatias. O sistema calcula o custo unitário por fatia ou grama sozinho!',
    descricaoEn: 'THE MISEON MAGIC: define the usage yield! Example: 1 Bundle yields 12 Units, or 1 block of 5kg of cheese yields 250 Slices. The system calculates the unit cost per slice or gram automatically!',
    dicaExtra: 'Quando um hambúrguer for vendido, o sistema baixa exatamente a quantidade de fatias ou gramas usadas, sem complicação.',
    dicaExtraEn: 'When a burger is sold, the system deducts exactly the number of slices or grams used — no manual work needed.',
    rota: '/admin/estoque',
    targetDataTour: 'tour-estoque-campo-conversao',
    posicao: 'left',
  },
  {
    id: 'passo-estoque-campo-minimo',
    categoria: 'Segurança de Estoque',
    categoriaEn: 'Stock Safety',
    titulo: '7. Margem de Estoque Mínimo & Alertas 🚨',
    tituloEn: '7. Minimum Stock Level & Alerts 🚨',
    descricao: 'Defina o saldo de segurança. Quando a quantidade em estoque atingir este limite, o sistema emitirá um alerta de risco em amarelo e sugerirá a reposição na Central de Compras.',
    descricaoEn: 'Set the safety stock level. When inventory reaches this threshold, the system will issue a yellow risk alert and suggest replenishment in the Purchasing Hub.',
    dicaExtra: 'Evite surpresas de ficar sem ingrediente no meio de um sábado à noite de movimento intenso!',
    dicaExtraEn: 'Avoid running out of ingredients in the middle of a busy Saturday night!',
    rota: '/admin/estoque',
    targetDataTour: 'tour-estoque-campo-minimo',
    posicao: 'top',
  },
  {
    id: 'passo-estoque-receitas',
    categoria: 'Fichas Técnicas & Receitas',
    categoriaEn: 'Recipe Sheets & COGS',
    titulo: '8. Fichas Técnicas & Custo da Mercadoria (CMV) 🍔',
    tituloEn: '8. Recipe Sheets & Cost of Goods (COGS) 🍔',
    descricao: 'Na aba "Receitas & Preparos", você monta a composição dos pratos (ex: 150g de blend de carne + 1 pão brioche + 30g de bacon). O MiseOn calcula o custo exato de produção (CMV) e a sua margem de lucro real.',
    descricaoEn: 'In the "Recipes & Preparations" tab, you build the dish composition (e.g. 150g meat blend + 1 brioche bun + 30g bacon). MiseOn calculates the exact production cost (COGS) and your real profit margin.',
    dicaExtra: 'Também é possível cadastrar sub-receitas intermediárias (ex: molho especial, massa de pizza que rende 20 discos).',
    dicaExtraEn: 'You can also register intermediate sub-recipes (e.g. special sauce, pizza dough that yields 20 discs).',
    rota: '/admin/estoque',
    targetDataTour: 'tour-estoque-aba-preparos',
    posicao: 'bottom',
    clicarElementoTarget: true,
  },

  // ── Módulo 3: Observabilidade & Visão Tridimensional 3D ──
  {
    id: 'passo-estoque-3d',
    categoria: 'Observabilidade 3D',
    categoriaEn: '3D Observability',
    titulo: '9. Visualização Tridimensional de Custos 🌐',
    tituloEn: '9. 3D Cost Visualization 🌐',
    descricao: 'A aba "Custo 3D" projeta visualmente no espaço 3D a distribuição do seu dinheiro retido em estoque. Você enxerga onde o capital está concentrado e como os insumos se desdobram.',
    descricaoEn: 'The "3D Cost" tab projects your locked-up inventory capital visually in 3D space. You can see where capital is concentrated and how ingredients break down.',
    dicaExtra: 'Use o mouse para rotacionar a cena em 360° e dar zoom nas esferas de produto.',
    dicaExtraEn: 'Use the mouse to rotate the scene 360° and zoom into product spheres.',
    rota: '/admin/estoque',
    targetDataTour: 'tour-estoque-aba-3d',
    posicao: 'bottom',
    clicarElementoTarget: true,
  },
  {
    id: 'passo-estoque-3d-canvas',
    categoria: 'Cena Tridimensional 3D',
    categoriaEn: '3D Interactive Scene',
    titulo: '10. Grafo 3D Interativo de Capital Retido 🔮',
    tituloEn: '10. Interactive 3D Capital Graph 🔮',
    descricao: 'Este é o modelo WebGL tridimensional vivo! As esferas flutuantes representam seus produtos fisicamente no espaço. Você pode clicar nas esferas para ver detalhes de lote, rotacionar a câmera e analisar ramificações de fornecedor.',
    descricaoEn: 'This is the live 3D WebGL model! Floating spheres represent your products physically in space. Click spheres to view batch details, rotate the camera and analyze supplier branches.',
    dicaExtra: 'Gire com o botão esquerdo do mouse e aperte Scroll para aproximar das peças de alta densidade financeira.',
    dicaExtraEn: 'Rotate with the left mouse button and scroll to zoom into high-value items.',
    rota: '/admin/estoque',
    targetDataTour: 'tour-estoque-3d-canvas',
    posicao: 'bottom',
  },
  {
    id: 'passo-estoque-3d-legenda',
    categoria: 'Entendendo a Legenda 3D',
    categoriaEn: 'Reading the 3D Legend',
    titulo: '11. Legenda & Analogia Físico-Mapeada 🔍',
    tituloEn: '11. Legend & Physical Mapping 🔍',
    descricao: 'Como ler a cena 3D: ⚽ Tamanho da esfera = Volume físico em estoque (kg/L/unidades). 🌡️ Cor da esfera = Custo unitário (🟢 Econômico ➔ 🟡 Moderado ➔ 🔴 Alta densidade financeira). 🔗 Dutos = Conexão entre a compra original e o fracionamento.',
    descricaoEn: 'How to read the 3D scene: ⚽ Sphere size = Physical volume in stock (kg/L/units). 🌡️ Sphere color = Unit cost (🟢 Low ➔ 🟡 Medium ➔ 🔴 High financial density). 🔗 Pipes = Connection between original purchase and fractioning.',
    dicaExtra: 'Clique no botão "Analogia do Mundo Físico" para expandir a explicação detalhada de cada símbolo 3D.',
    dicaExtraEn: 'Click the "Physical World Analogy" button to expand the detailed explanation of each 3D symbol.',
    rota: '/admin/estoque',
    targetDataTour: 'tour-estoque-3d-legenda',
    posicao: 'bottom',
    clicarElementoTarget: true,
  },
  {
    id: 'passo-estoque-3d-rastreio',
    categoria: 'Rastreio 3D por Setores',
    categoriaEn: '3D Tracking by Sector',
    titulo: '12. Cartões de Rastreio por Setor (Freezer/Dispensa) ❄️🗄️',
    tituloEn: '12. Sector Tracking Cards (Freezer/Pantry) ❄️🗄️',
    descricao: 'Na aba "Rastreio 3D", você acompanha os itens divididos por Setores da Cozinha (Geladeira ❄️, Armário 🗄️, Dispensa 🥫). Os cartões exibem a esteira de perdas, lotes PEPS ativos e alertas de rendimento humano (⚠️).',
    descricaoEn: 'In the "3D Tracking" tab, you monitor items split by Kitchen Sectors (Fridge ❄️, Cupboard 🗄️, Pantry 🥫). Cards show the loss pipeline, active FIFO batches and human yield alerts (⚠️).',
    dicaExtra: 'Você pode selecionar uma receita na busca superior para simular se o estoque atual cobre a produção esperada!',
    dicaExtraEn: 'Select a recipe in the top search to simulate whether current stock covers the expected production run!',
    rota: '/admin/estoque',
    targetDataTour: 'tour-estoque-aba-rastreio3d',
    posicao: 'bottom',
    clicarElementoTarget: true,
  },

  // ── Módulo 4: Salão 3D & Atendimento de Mesas ──
  {
    id: 'passo-mesas-salao3d',
    categoria: 'Salão 3D & Comandas',
    categoriaEn: '3D Floor Plan & Tabs',
    titulo: '13. Planta Baixa do Salão 3D & Atendimento 🍽️',
    tituloEn: '13. 3D Floor Plan & Table Service 🍽️',
    descricao: 'Controle o layout físico do salão em 3D ou Grade 2D! Arraste mesas no espaço 3D, visualize a ocupação em tempo real, abra comandas agrupadas por cliente e imprima QR Codes para pedidos autônomos.',
    descricaoEn: 'Control the physical floor layout in 3D or 2D Grid! Drag tables in 3D space, view occupancy in real time, open tabs grouped by customer and print QR Codes for self-ordering.',
    dicaExtra: 'Toque na mesa 3D para ver os assentos ocupados, tempo de permanência do cliente e conta parcial instantânea.',
    dicaExtraEn: 'Tap a 3D table to see occupied seats, customer dwell time and an instant partial bill.',
    rota: '/admin/mesas',
    targetDataTour: 'tour-mesas-header',
    posicao: 'bottom',
  },

  // ── Módulo 5: Cardápio Digital 2D & 3D ──
  {
    id: 'passo-cardapio-digital',
    categoria: 'Cardápio Digital 2D/3D',
    categoriaEn: 'Digital Menu 2D/3D',
    titulo: '14. Gestão de Cardápio Digital & Vitrine 📜',
    tituloEn: '14. Digital Menu Management & Storefront 📜',
    descricao: 'Gerencie categorias, preços, fotos e disponibilização de itens em tempo real. O cardápio digital do MiseOn funciona em smartphones de clientes sem precisar baixar aplicativos!',
    descricaoEn: 'Manage categories, prices, photos and item availability in real time. MiseOn\'s digital menu works on customer smartphones without any app download!',
    dicaExtra: 'Produtos sem estoque de insumo são pausados automaticamente para evitar vender pratos indisponíveis.',
    dicaExtraEn: 'Items with zero ingredient stock are automatically paused to prevent selling unavailable dishes.',
    rota: '/admin/cardapio',
    targetDataTour: 'tour-cardapio-header',
    posicao: 'bottom',
  },

  // ── Módulo 6: KDS Kanban Cozinha ──
  {
    id: 'passo-kds-kanban',
    categoria: 'KDS Cozinha',
    categoriaEn: 'Kitchen KDS',
    titulo: '15. Kanban de Produção da Cozinha 👨‍🍳',
    tituloEn: '15. Kitchen Production Kanban 👨‍🍳',
    descricao: 'Substitua as impressoras de papel por uma tela touch em formato Kanban Trello. Os cozinheiros visualizam os itens por ordem de chegada, cronômetro de tempo de preparo e observações do cliente.',
    descricaoEn: 'Replace paper ticket printers with a Trello-style Kanban touch screen. Kitchen staff see items by arrival order, preparation timers and customer notes.',
    dicaExtra: 'Ao arrastar ou clicar em "Concluir Prato", o bastão retorna automaticamente para o balcão entregar.',
    dicaExtraEn: 'When you drag or click "Finish Dish", the handoff automatically returns to the counter for delivery.',
    rota: '/admin/kds',
    targetDataTour: 'tour-kds-header',
    posicao: 'bottom',
  },

  // ── Módulo 7: Frente de Caixa (PDV) ──
  {
    id: 'passo-pdv-caixa',
    categoria: 'Frente de Caixa (PDV)',
    categoriaEn: 'Point of Sale (POS)',
    titulo: '16. PDV Ultra-Rápido & Atendimento de Mesas 💳',
    tituloEn: '16. Ultra-Fast POS & Table Service 💳',
    descricao: 'Para vendas de balcão e comandas de mesas. Registre pedidos em segundos com toque direto nos produtos, atalhos de teclado (F2 para busca, F4 para finalizar), leitor de código de barras e controle de caixa.',
    descricaoEn: 'For counter sales and table tabs. Register orders in seconds with direct product taps, keyboard shortcuts (F2 to search, F4 to finalize), barcode scanner and cash register control.',
    dicaExtra: 'Permite fechar vendas em dinheiro (com cálculo de troco), cartão de crédito/débito e Pix estático/dinâmico.',
    dicaExtraEn: 'Supports closing sales in cash (with change calculation), credit/debit card and static/dynamic Pix.',
    rota: '/admin/pdv',
    targetDataTour: 'tour-pdv-header',
    posicao: 'bottom',
  },

  // ── Módulo 8: Integração iFood ──
  {
    id: 'passo-ifood-conexao',
    categoria: 'Integração iFood',
    categoriaEn: 'iFood Integration',
    titulo: '17. Vínculo Oficial de Loja iFood 🛵',
    tituloEn: '17. Official iFood Store Link 🛵',
    descricao: 'Integre sua loja iFood com a API oficial em poucos passos. Os pedidos que entram no app iFood caem sozinhos no seu painel, sem necessidade de digitar nada.',
    descricaoEn: 'Integrate your iFood store with the official API in a few steps. Orders placed on the iFood app land directly in your dashboard — no manual entry needed.',
    dicaExtra: 'As taxas retidas pelo iFood são calculadas no módulo financeiro para mostrar seu lucro líquido exato.',
    dicaExtraEn: 'iFood fees are calculated in the financial module to show your exact net profit.',
    rota: '/admin/ifood',
    targetDataTour: 'tour-ifood-aba-credenciais',
    posicao: 'bottom',
    clicarElementoTarget: true,
  },
  {
    id: 'passo-ifood-depara',
    categoria: 'Integração iFood',
    categoriaEn: 'iFood Integration',
    titulo: '18. Tabela De-Para (Código PDV iFood) 🔗',
    tituloEn: '18. Product Mapping Table (iFood PDV Code) 🔗',
    descricao: 'Mapeie o Código PDV do iFood (externalCode) com os produtos do seu cardápio! É através deste código que o sistema reconhece o item vendido no iFood e dá a baixa automática no seu estoque.',
    descricaoEn: 'Map iFood\'s PDV Code (externalCode) to your menu products! This code is how the system recognizes the item sold on iFood and automatically deducts it from your inventory.',
    dicaExtra: 'Cole os códigos exibidos no Portal do Parceiro iFood nos produtos da lista.',
    dicaExtraEn: 'Paste the codes shown in the iFood Partner Portal into the product list.',
    rota: '/admin/ifood',
    targetDataTour: 'tour-ifood-aba-depara',
    posicao: 'bottom',
    clicarElementoTarget: true,
  },

  // ── Módulo 9: WhatsApp IA ──
  {
    id: 'passo-whatsapp-ia',
    categoria: 'WhatsApp IA',
    categoriaEn: 'WhatsApp AI',
    titulo: '19. Atendimento com Inteligência Artificial 💬🤖',
    tituloEn: '19. AI-Powered Customer Service 💬🤖',
    descricao: 'A IA do MiseOn conversa com os seus clientes no WhatsApp 24 horas por dia: ela tira dúvidas de ingredientes, preços, horários de atendimento e envia o link direto do seu cardápio digital para o cliente pedir.',
    descricaoEn: 'MiseOn\'s AI chats with your customers on WhatsApp 24/7: it answers questions about ingredients, prices, opening hours and sends the direct link to your digital menu.',
    dicaExtra: 'Se o cliente solicitar falar com uma pessoa, o sistema ativa o Handoff e chama sua equipe imediatamente.',
    dicaExtraEn: 'If the customer asks to speak to a human, the system activates the Handoff and immediately calls your team.',
    rota: '/admin/whatsapp',
    targetDataTour: 'tour-whatsapp-header',
    posicao: 'bottom',
  },

  // ── Módulo 10: Financeiro & Efí Bank ──
  {
    id: 'passo-loja-pagamentos-aba',
    categoria: 'Financeiro & Recebimentos',
    categoriaEn: 'Finance & Payments',
    titulo: '20. Configurações de Pagamento da Loja & Efí 🏦',
    tituloEn: '20. Store Payment Settings & Efí 🏦',
    descricao: 'Nesta aba você configura as formas de pagamento aceitas e habilita o Identificador Efí Bank (Payee Code). Cada venda cai 100% direta na sua conta sem intermediários!',
    descricaoEn: 'In this tab you configure accepted payment methods and enable the Efí Bank Identifier (Payee Code). Every sale lands 100% directly in your account with no intermediaries!',
    dicaExtra: 'Você tem controle total dos prazos e antecipação de recebíveis no seu próprio painel Efí.',
    dicaExtraEn: 'You have full control over settlement schedules and receivables advance in your own Efí panel.',
    rota: '/admin/loja',
    targetDataTour: 'tour-loja-aba-pagamentos',
    posicao: 'bottom',
    clicarElementoTarget: true,
  },

  // ── Módulo 11: TV do Salão (Cardápio 4K & Painel de Senhas) ──
  {
    id: 'passo-loja-tv-links',
    categoria: 'TV do Salão',
    categoriaEn: 'Dining Room TV',
    titulo: '21. Os dois links da TV 📺',
    tituloEn: '21. The Two TV Links 📺',
    descricao: 'A TV do salão não faz login: ela só abre um link no próprio navegador. Por isso existem dois — "Cardápio na TV 4K" abre no cardápio girando, e "Painel de Senhas na TV" abre direto chamando os pedidos prontos. Escolha o link pelo lugar onde a TV está: cardápio na fila, senhas no balcão de retirada.',
    descricaoEn: 'The dining room TV doesn\'t log in — it just opens a link in its own browser. That\'s why there are two — "4K Menu on TV" opens the rotating menu, and "Order Board on TV" goes directly to calling ready orders. Choose the link based on where the TV is: menu for the queue, order board at the pickup counter.',
    dicaExtra: 'A TV lembra o modo mesmo depois de desligar da tomada. Antes ela voltava sempre para o cardápio e o balcão ficava sem chamar ninguém sem que ninguém percebesse.',
    dicaExtraEn: 'The TV remembers its mode even after being unplugged. Before, it always went back to the menu and the counter would stop calling numbers without anyone noticing.',
    rota: '/admin/loja',
    targetDataTour: 'tour-loja-tv-links',
    posicao: 'bottom',
  },
  {
    id: 'passo-loja-tv-tipos',
    categoria: 'TV do Salão',
    categoriaEn: 'Dining Room TV',
    titulo: '22. Quem é chamado na TV 🔔',
    tituloEn: '22. Who Gets Called on TV 🔔',
    descricao: 'Senha é chamada de balcão: só faz sentido para quem está no salão esperando o pedido. Por isso o padrão é Balcão + Mesa, e Delivery vem desligado — não adianta a TV anunciar "retire no balcão" para um cliente que está em casa esperando o entregador.',
    descricaoEn: 'Order numbers are called at the counter: they only make sense for customers waiting in the dining area. That\'s why the default is Counter + Table, and Delivery is off — it makes no sense for the TV to announce "collect at the counter" to someone waiting at home for a delivery.',
    dicaExtra: 'A senha é curta de propósito: vai de 1 a 999 e zera todo dia às 4h da manhã. Quem fecha depois da meia-noite continua no mesmo dia de operação, como a casa conta.',
    dicaExtraEn: 'Order numbers are deliberately short: they run from 1 to 999 and reset every day at 4am. Venues closing after midnight stay in the same operating day, just as the house counts it.',
    rota: '/admin/loja',
    targetDataTour: 'tour-loja-tv-tipos',
    posicao: 'top',
  },
  {
    id: 'passo-loja-tv-credencial',
    categoria: 'TV do Salão',
    categoriaEn: 'Dining Room TV',
    titulo: '23. A credencial no fim do link 🔑',
    tituloEn: '23. The Credential at the End of the Link 🔑',
    descricao: 'Repare que os links terminam com um código. É ele que impede qualquer pessoa de abrir o painel da sua loja e ver seus pedidos. Copie sempre o link por aqui — se copiar da barra de endereço da TV, o código fica de fora e o painel para de mostrar as senhas.',
    descricaoEn: 'Notice that the links end with a code. This is what prevents anyone from opening your store\'s board and seeing your orders. Always copy the link from here — if you copy from the TV\'s address bar, the code is left out and the board stops showing order numbers.',
    dicaExtra: 'Se o link vazar, clique em "Gerar credencial nova". As TVs já instaladas vão precisar receber o link novo, então faça isso fora do horário de pico.',
    dicaExtraEn: 'If the link leaks, click "Generate new credential". Installed TVs will need the new link, so do this outside peak hours.',
    rota: '/admin/loja',
    targetDataTour: 'tour-loja-tv-credencial',
    posicao: 'top',
  },

  // ── Módulo 12: Acessibilidade & Configurações da Conta ──
  {
    id: 'passo-acessibilidade',
    categoria: 'Acessibilidade (WCAG)',
    categoriaEn: 'Accessibility (WCAG)',
    titulo: '24. Escala de Fonte em 1-Clique 🔍',
    tituloEn: '24. Font Scale in 1-Click 🔍',
    descricao: 'O MiseOn é 100% acessível. Se você ou seus funcionários preferirem letras maiores, basta ajustar a Escala de Fonte na sua Conta. Todo o sistema se ajusta proporcionalmente sem quebrar o layout.',
    descricaoEn: 'MiseOn is 100% accessible. If you or your staff prefer larger text, simply adjust the Font Scale in your Account. The entire system scales proportionally without breaking the layout.',
    dicaExtra: 'Acesse o menu inferior e clique em "Configurações da Conta" para encontrar o bloco "Acessibilidade Visual (WCAG 2.1)".',
    dicaExtraEn: 'Go to the bottom menu and click "Account Settings" to find the "Visual Accessibility (WCAG 2.1)" block.',
    rota: '/admin/conta',
    targetDataTour: 'tour-acessibilidade',
    posicao: 'top',
  },
];

export function useGuidedTour(lojaId?: string) {
  const nav = useNavigate();
  const location = useLocation();

  const [modoTour, setModoTour] = useState<'COMPLETO' | 'PAGINA'>(() => {
    return (sessionStorage.getItem('miseon_tour_modo') as 'COMPLETO' | 'PAGINA') || 'COMPLETO';
  });

  const [ativo, setAtivo] = useState<boolean>(() => {
    return sessionStorage.getItem('miseon_tour_ativo') === 'true';
  });

  const [passoIndex, setPassoIndex] = useState<number>(() => {
    const salvo = sessionStorage.getItem('miseon_tour_passo_index');
    return salvo ? Math.min(Number(salvo), TOUR_STEPS.length - 1) : 0;
  });

  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);

  const [concluido, setConcluido] = useState<boolean>(() => {
    if (!lojaId) return false;
    return localStorage.getItem(`miseon_tour_concluido_${lojaId}`) === 'true';
  });

  useEffect(() => {
    if (ativo) {
      sessionStorage.setItem('miseon_tour_ativo', 'true');
      sessionStorage.setItem('miseon_tour_passo_index', String(passoIndex));
      sessionStorage.setItem('miseon_tour_modo', modoTour);
    } else {
      sessionStorage.removeItem('miseon_tour_ativo');
      sessionStorage.removeItem('miseon_tour_passo_index');
      sessionStorage.removeItem('miseon_tour_modo');
    }
  }, [ativo, passoIndex, modoTour]);

  const passoAtual = TOUR_STEPS[passoIndex] || TOUR_STEPS[0];

  const iniciarTourCompleto = useCallback(() => {
    setModoTour('COMPLETO');
    sessionStorage.setItem('miseon_tour_modo', 'COMPLETO');
    setPassoIndex(0);
    setTargetElement(null);
    setAtivo(true);
    sessionStorage.setItem('miseon_tour_ativo', 'true');
    sessionStorage.setItem('miseon_tour_passo_index', '0');
    if (TOUR_STEPS[0].rota !== location.pathname) {
      nav(TOUR_STEPS[0].rota);
    }
  }, [location.pathname, nav]);

  const iniciarTourDaPagina = useCallback(
    (rotaAtual?: string) => {
      const rotaTarget = rotaAtual || location.pathname;
      const passosDaPagina = TOUR_STEPS.filter((s) => s.rota === rotaTarget);

      if (passosDaPagina.length === 0) {
        iniciarTourCompleto();
        return;
      }

      setModoTour('PAGINA');
      sessionStorage.setItem('miseon_tour_modo', 'PAGINA');

      const primeiroPassoIndex = TOUR_STEPS.findIndex((s) => s.id === passosDaPagina[0].id);
      const idxInicial = primeiroPassoIndex >= 0 ? primeiroPassoIndex : 0;

      setPassoIndex(idxInicial);
      setTargetElement(null);
      setAtivo(true);
      sessionStorage.setItem('miseon_tour_ativo', 'true');
      sessionStorage.setItem('miseon_tour_passo_index', String(idxInicial));
    },
    [location.pathname, iniciarTourCompleto]
  );

  useEffect(() => {
    const handleTriggerCompleto = () => iniciarTourCompleto();
    const handleTriggerPagina = (e: Event) => {
      const customEvent = e as CustomEvent;
      iniciarTourDaPagina(customEvent.detail?.rota);
    };

    window.addEventListener('iniciar-guided-tour', handleTriggerCompleto);
    window.addEventListener('iniciar-guided-tour-completo', handleTriggerCompleto);
    window.addEventListener('iniciar-guided-tour-pagina', handleTriggerPagina);

    return () => {
      window.removeEventListener('iniciar-guided-tour', handleTriggerCompleto);
      window.removeEventListener('iniciar-guided-tour-completo', handleTriggerCompleto);
      window.removeEventListener('iniciar-guided-tour-pagina', handleTriggerPagina);
    };
  }, [iniciarTourCompleto, iniciarTourDaPagina]);

  const encerrarTour = useCallback(() => {
    setAtivo(false);
    setTargetElement(null);
    sessionStorage.removeItem('miseon_tour_ativo');
    sessionStorage.removeItem('miseon_tour_passo_index');
    sessionStorage.removeItem('miseon_tour_modo');
    if (lojaId) {
      localStorage.setItem(`miseon_tour_concluido_${lojaId}`, 'true');
      setConcluido(true);
    }
  }, [lojaId]);

  const concluirTour = useCallback(() => {
    encerrarTour();
    try {
      confetti({
        particleCount: 160,
        spread: 100,
        origin: { y: 0.6 },
      });
    } catch (e) {
      console.warn('Erro ao disparar confete:', e);
    }
  }, [encerrarTour]);

  const mudoPasso = useCallback(
    (novoIndex: number) => {
      setTargetElement(null);
      setPassoIndex(novoIndex);
      sessionStorage.setItem('miseon_tour_passo_index', String(novoIndex));
      const destino = TOUR_STEPS[novoIndex];
      if (destino && destino.rota !== location.pathname) {
        nav(destino.rota);
      }
    },
    [location.pathname, nav]
  );

  const proximoPasso = useCallback(() => {
    if (modoTour === 'PAGINA') {
      const rotaAtualPasso = passoAtual?.rota;
      const proximoPassoGlobal = TOUR_STEPS[passoIndex + 1];
      if (!proximoPassoGlobal || proximoPassoGlobal.rota !== rotaAtualPasso) {
        concluirTour();
        return;
      }
    }

    if (passoIndex < TOUR_STEPS.length - 1) {
      mudoPasso(passoIndex + 1);
    } else {
      concluirTour();
    }
  }, [passoIndex, modoTour, passoAtual, mudoPasso, concluirTour]);

  const passoAnterior = useCallback(() => {
    if (modoTour === 'PAGINA') {
      const rotaAtualPasso = passoAtual?.rota;
      const passoAnteriorGlobal = TOUR_STEPS[passoIndex - 1];
      if (!passoAnteriorGlobal || passoAnteriorGlobal.rota !== rotaAtualPasso) {
        return;
      }
    }

    if (passoIndex > 0) {
      mudoPasso(passoIndex - 1);
    }
  }, [passoIndex, modoTour, passoAtual, mudoPasso]);

  // ── BUSCA ROBUSTA DO ELEMENTO COM AUTO-RECUPERAÇÃO DE ABAS ──────────────
  // Regra: SEMPRE acionar a aba pai ANTES de tentar querySelector. A lógica
  // anterior era condicional (só clicava se o elemento não existia), o que
  // criava uma condição de corrida: o elemento aparecia antes da aba ser
  // processada e o click nunca vinha, deixando o formulário fechado.
  useEffect(() => {
    if (!ativo || !passoAtual) return;

    if (location.pathname !== passoAtual.rota) {
      return;
    }

    let cancelado = false;
    let tentativa = 0;
    let abaClicada = false;

    const delayInicial = ['tour-estoque-campo-nome', 'tour-estoque-campo-compra', 'tour-estoque-campo-conversao', 'tour-estoque-campo-minimo', 'tour-estoque-3d-canvas', 'tour-estoque-3d-legenda', 'tour-estoque-aba-rastreio3d', 'tour-loja-aba-pagamentos'].includes(passoAtual.targetDataTour) ? 300 : 100;

    const buscarElemento = () => {
      if (cancelado) return;

      // ── Clicar na aba/modo pai APENAS UMA VEZ por mudança de passo ──
      if (!abaClicada) {
        abaClicada = true;

        if (['tour-estoque-campo-nome', 'tour-estoque-campo-compra', 'tour-estoque-campo-conversao', 'tour-estoque-campo-minimo'].includes(passoAtual.targetDataTour)) {
          const abaInsumos = document.querySelector<HTMLElement>('[data-tour="tour-estoque-aba-insumos"]');
          if (abaInsumos) { try { abaInsumos.click(); } catch (e) { console.warn(e); } }
        }

        if (passoAtual.targetDataTour === 'tour-estoque-campo-conversao') {
          const btnAvancado = document.querySelector<HTMLElement>('[data-tour="tour-estoque-btn-modo-avancado"]') || Array.from(document.querySelectorAll<HTMLElement>('button')).find(b => b.textContent?.includes('Conversão de Embalagem'));
          if (btnAvancado) { try { btnAvancado.click(); } catch (e) { console.warn(e); } }
        }

        if (['tour-estoque-3d-canvas', 'tour-estoque-3d-legenda'].includes(passoAtual.targetDataTour)) {
          const aba3D = document.querySelector<HTMLElement>('[data-tour="tour-estoque-aba-3d"]');
          if (aba3D) { try { aba3D.click(); } catch (e) { console.warn(e); } }
        }

        if (['tour-estoque-3d-legenda-rastreio', 'tour-estoque-3d-cartoes', 'tour-estoque-aba-rastreio3d'].includes(passoAtual.targetDataTour)) {
          const abaRastreio = document.querySelector<HTMLElement>('[data-tour="tour-estoque-aba-rastreio3d"]');
          if (abaRastreio) { try { abaRastreio.click(); } catch (e) { console.warn(e); } }
        }

        if (['tour-loja-aba-pagamentos', 'tour-loja-efi-payee', 'tour-loja-pagamentos'].includes(passoAtual.targetDataTour)) {
          const abaPagamentos = document.querySelector<HTMLElement>('[data-tour="tour-loja-aba-pagamentos"]');
          if (abaPagamentos) { try { abaPagamentos.click(); } catch (e) { console.warn(e); } }
        }

        if (passoAtual.targetDataTour === 'tour-ifood-aba-depara') {
          const abaDepara = document.querySelector<HTMLElement>('[data-tour="tour-ifood-aba-depara"]');
          if (abaDepara) { try { abaDepara.click(); } catch (e) { console.warn(e); } }
        }

        if (passoAtual.targetDataTour === 'tour-ifood-aba-credenciais') {
          const abaCred = document.querySelector<HTMLElement>('[data-tour="tour-ifood-aba-credenciais"]');
          if (abaCred) { try { abaCred.click(); } catch (e) { console.warn(e); } }
        }
      }

      const el = document.querySelector<HTMLElement>(`[data-tour="${passoAtual.targetDataTour}"]`);
      if (el) {
        setTargetElement(el);
        if (passoAtual.clicarElementoTarget) {
          try { el.click(); } catch (e) { console.warn(e); }
        }
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (e) {
          console.warn(e);
        }
      } else if (tentativa < 15) {
        tentativa++;
        setTimeout(buscarElemento, 200);
      } else {
        setTargetElement(null);
      }
    };

    const timerInicial = setTimeout(buscarElemento, delayInicial);

    return () => {
      cancelado = true;
      clearTimeout(timerInicial);
    };
  }, [ativo, passoIndex, passoAtual, location.pathname]);

  useEffect(() => {
    if (!ativo) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') encerrarTour();
      if (e.key === 'ArrowRight') proximoPasso();
      if (e.key === 'ArrowLeft') passoAnterior();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ativo, encerrarTour, proximoPasso, passoAnterior]);

  return {
    ativo,
    concluido,
    modoTour,
    passoAtual,
    passoIndex,
    totalPassos: TOUR_STEPS.length,
    targetElement,
    iniciarTour: iniciarTourCompleto,
    iniciarTourCompleto,
    iniciarTourDaPagina,
    encerrarTour,
    concluirTour,
    proximoPasso,
    passoAnterior,
  };
}

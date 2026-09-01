import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import confetti from 'canvas-confetti';

export interface TourStep {
  id: string;
  categoria: string;
  titulo: string;
  descricao: string;
  dicaExtra?: string;
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
    titulo: '1. Central de Comando dos Pedidos 🛎️',
    descricao: 'Esta é a tela principal de acompanhamento operacional do seu restaurante. Todos os pedidos — venham do Cardápio Digital (QR Code nas mesas), do site de Delivery, da Integração iFood ou do WhatsApp Inteligente — chegam unificados aqui.',
    dicaExtra: 'Pedidos novos acionam um alarme sonoro instantâneo e destacam na tela para não deixar o cliente esperando.',
    rota: '/admin/pedidos',
    targetDataTour: 'tour-pedidos-header',
    posicao: 'bottom',
  },
  {
    id: 'passo-pedidos-bastao',
    categoria: 'Passa-Bastão Operacional',
    titulo: '2. Regra do Bastão & Baixa de Estoque 🏃‍♂️💨',
    descricao: 'O MiseOn possui uma trava de segurança contra perdas: ao clicar em "Aceitar Pedido", o bastão passa para o balcão e o estoque das fichas técnicas é reduzido automaticamente no banco de dados. Em seguida, enviar o pedido para a cozinha transfers o bastão para a tela KDS.',
    dicaExtra: 'A transição de bastão garante que nenhum pedido saia sem passar pelo preparo e sem abater o ingrediente do estoque.',
    rota: '/admin/pedidos',
    targetDataTour: 'tour-pedidos-filtros',
    posicao: 'bottom',
  },

  // ── Módulo 2: Gestão de Estoque Completo ──
  {
    id: 'passo-estoque-insumos',
    categoria: 'Gestão de Estoque',
    titulo: '3. Aba Matérias-Primas (Insumos Brutos) 📦',
    descricao: 'Aqui você gerencia tudo o que compra do seu fornecedor: fardos de farinha, caixas de carne, fardos de refri ou sachês de molho. Todos os itens brutos da despensa ficam centralizados nesta aba.',
    dicaExtra: 'Você pode filtrar insumos por categoria (Ingredientes, Embalagens, Limpeza) ou buscar direto pelo nome.',
    rota: '/admin/estoque',
    targetDataTour: 'tour-estoque-aba-insumos',
    posicao: 'bottom',
    clicarElementoTarget: true,
  },
  {
    id: 'passo-estoque-campo-nome',
    categoria: 'Cadastro de Insumo',
    titulo: '4. Nome & Categoria do Insumo 📝',
    descricao: 'Informe o nome comercial do ingrediente (ex: "Queijo Mussarela Peça" ou "Carne de Hambúrguer 180g"). Selecione a Categoria ou crie uma nova na hora.',
    dicaExtra: 'O campo Setor de Armazenamento organiza se o item fica no Freezer, Geladeira ou Prateleira Seca para o Rastreio 3D.',
    rota: '/admin/estoque',
    targetDataTour: 'tour-estoque-campo-nome',
    posicao: 'bottom',
  },
  {
    id: 'passo-estoque-campo-compra',
    categoria: 'Cadastro de Insumo',
    titulo: '5. Como você Compra no Fornecedor? 🛒',
    descricao: 'Preencha a Unidade de Compra (ex: Caixa, Fardo, Peça, Kg), o Preço Pago pela embalagem fechada (R$) e a Quantidade inicial em estoque.',
    dicaExtra: 'Se você comprou um fardo com 12 unidades por R$ 60,00, coloque Unidade = Fardo e Preço = 60,00.',
    rota: '/admin/estoque',
    targetDataTour: 'tour-estoque-campo-compra',
    posicao: 'right',
  },
  {
    id: 'passo-estoque-campo-conversao',
    categoria: 'Fracionamento Inteligente',
    titulo: '6. Regra de Conversão & Fracionamento ⚙️',
    descricao: 'A MÁGICA DO MISEON: defina o rendimento de uso! Exemplo: 1 Fardo rende 12 Unidades, ou 1 Peça de 5kg de queijo rende 250 Fatias. O sistema calcula o custo unitário por fatia ou grama sozinho!',
    dicaExtra: 'Quando um hambúrguer for vendido, o sistema baixa exatamente a quantidade de fatias ou gramas usadas, sem complicação.',
    rota: '/admin/estoque',
    targetDataTour: 'tour-estoque-campo-conversao',
    posicao: 'left',
  },
  {
    id: 'passo-estoque-campo-minimo',
    categoria: 'Segurança de Estoque',
    titulo: '7. Margem de Estoque Mínimo & Alertas 🚨',
    descricao: 'Defina o saldo de segurança. Quando a quantidade em estoque atingir este limite, o sistema emitirá um alerta de risco em amarelo e sugerirá a reposição na Central de Compras.',
    dicaExtra: 'Evite surpresas de ficar sem ingrediente no meio de um sábado à noite de movimento intenso!',
    rota: '/admin/estoque',
    targetDataTour: 'tour-estoque-campo-minimo',
    posicao: 'top',
  },
  {
    id: 'passo-estoque-receitas',
    categoria: 'Fichas Técnicas & Receitas',
    titulo: '8. Fichas Técnicas & Custo da Mercadoria (CMV) 🍔',
    descricao: 'Na aba "Receitas & Preparos", você monta a composição dos pratos (ex: 150g de blend de carne + 1 pão brioche + 30g de bacon). O MiseOn calcula o custo exato de produção (CMV) e a sua margem de lucro real.',
    dicaExtra: 'Também é possível cadastrar sub-receitas intermediárias (ex: molho especial, massa de pizza que rende 20 discos).',
    rota: '/admin/estoque',
    targetDataTour: 'tour-estoque-aba-preparos',
    posicao: 'bottom',
    clicarElementoTarget: true,
  },

  // ── Módulo 3: Observabilidade & Visão Tridimensional 3D ──
  {
    id: 'passo-estoque-3d',
    categoria: 'Observabilidade 3D',
    titulo: '9. Visualização Tridimensional de Custos 🌐',
    descricao: 'A aba "Custo 3D" projeta visualmente no espaço 3D a distribuição do seu dinheiro retido em estoque. Você enxerga onde o capital está concentrado e como os insumos se desdobram.',
    dicaExtra: 'Use o mouse para rotacionar a cena em 360° e dar zoom nas esferas de produto.',
    rota: '/admin/estoque',
    targetDataTour: 'tour-estoque-aba-3d',
    posicao: 'bottom',
    clicarElementoTarget: true,
  },
  {
    id: 'passo-estoque-3d-canvas',
    categoria: 'Cena Tridimensional 3D',
    titulo: '10. Grafo 3D Interativo de Capital Retido 🔮',
    descricao: 'Este é o modelo WebGL tridimensional vivo! As esferas flutuantes representam seus produtos fisicamente no espaço. Você pode clicar nas esferas para ver detalhes de lote, rotacionar a câmera e analisar ramificações de fornecedor.',
    dicaExtra: 'Gire com o botão esquerdo do mouse e aperte Scroll para aproximar das peças de alta densidade financeira.',
    rota: '/admin/estoque',
    targetDataTour: 'tour-estoque-3d-canvas',
    posicao: 'bottom',
  },
  {
    id: 'passo-estoque-3d-legenda',
    categoria: 'Entendendo a Legenda 3D',
    titulo: '11. Legenda & Analogia Físico-Mapeada 🔍',
    descricao: 'Como ler a cena 3D: ⚽ Tamanho da esfera = Volume físico em estoque (kg/L/unidades). 🌡️ Cor da esfera = Custo unitário (🟢 Econômico ➔ 🟡 Moderado ➔ 🔴 Alta densidade financeira). 🔗 Dutos = Conexão entre a compra original e o fracionamento.',
    dicaExtra: 'Clique no botão "Analogia do Mundo Físico" para expandir a explicação detalhada de cada símbolo 3D.',
    rota: '/admin/estoque',
    targetDataTour: 'tour-estoque-3d-legenda',
    posicao: 'bottom',
    clicarElementoTarget: true,
  },
  {
    id: 'passo-estoque-3d-rastreio',
    categoria: 'Rastreio 3D por Setores',
    titulo: '12. Cartões de Rastreio por Setor (Freezer/Dispensa) ❄️🗄️',
    descricao: 'Na aba "Rastreio 3D", você acompanha os itens divididos por Setores da Cozinha (Geladeira ❄️, Armário 🗄️, Dispensa 🥫). Os cartões exibem a esteira de perdas, lotes PEPS ativos e alertas de rendimento humano (⚠️).',
    dicaExtra: 'Você pode selecionar uma receita na busca superior para simular se o estoque atual cobre a produção esperada!',
    rota: '/admin/estoque',
    targetDataTour: 'tour-estoque-aba-rastreio3d',
    posicao: 'bottom',
    clicarElementoTarget: true,
  },

  // ── Módulo 4: Salão 3D & Atendimento de Mesas ──
  {
    id: 'passo-mesas-salao3d',
    categoria: 'Salão 3D & Comandas',
    titulo: '13. Planta Baixa do Salão 3D & Atendimento 🍽️',
    descricao: 'Controle o layout físico do salão em 3D ou Grade 2D! Arraste mesas no espaço 3D, visualize a ocupação em tempo real, abra comandas agrupadas por cliente e imprima QR Codes para pedidos autônomos.',
    dicaExtra: 'Toque na mesa 3D para ver os assentos ocupados, tempo de permanência do cliente e conta parcial instantânea.',
    rota: '/admin/mesas',
    targetDataTour: 'tour-mesas-header',
    posicao: 'bottom',
  },

  // ── Módulo 5: Cardápio Digital 2D & 3D ──
  {
    id: 'passo-cardapio-digital',
    categoria: 'Cardápio Digital 2D/3D',
    titulo: '14. Gestão de Cardápio Digital & Vitrine 📜',
    descricao: 'Gerencie categorias, preços, fotos e disponibilização de itens em tempo real. O cardápio digital do MiseOn funciona em smartphones de clientes sem precisar baixar aplicativos!',
    dicaExtra: 'Produtos sem estoque de insumo são pausados automaticamente para evitar vender pratos indisponíveis.',
    rota: '/admin/cardapio',
    targetDataTour: 'tour-cardapio-header',
    posicao: 'bottom',
  },

  // ── Módulo 6: KDS Kanban Cozinha ──
  {
    id: 'passo-kds-kanban',
    categoria: 'KDS Cozinha',
    titulo: '15. Kanban de Produção da Cozinha 👨‍🍳',
    descricao: 'Substitua as impressoras de papel por uma tela touch em formato Kanban Trello. Os cozinheiros visualizam os itens por ordem de chegada, cronômetro de tempo de preparo e observações do cliente.',
    dicaExtra: 'Ao arrastar ou clicar em "Concluir Prato", o bastão retorna automaticamente para o balcão entregar.',
    rota: '/admin/kds',
    targetDataTour: 'tour-kds-header',
    posicao: 'bottom',
  },

  // ── Módulo 7: Frente de Caixa (PDV) ──
  {
    id: 'passo-pdv-caixa',
    categoria: 'Frente de Caixa (PDV)',
    titulo: '16. PDV Ultra-Rápido & Atendimento de Mesas 💳',
    descricao: 'Para vendas de balcão e comandas de mesas. Registre pedidos em segundos com toque direto nos produtos, atalhos de teclado (F2 para busca, F4 para finalizar), leitor de código de barras e controle de caixa.',
    dicaExtra: 'Permite fechar vendas em dinheiro (com cálculo de troco), cartão de crédito/débito e Pix estático/dinâmico.',
    rota: '/admin/pdv',
    targetDataTour: 'tour-pdv-header',
    posicao: 'bottom',
  },

  // ── Módulo 8: Integração iFood ──
  {
    id: 'passo-ifood-conexao',
    categoria: 'Integração iFood',
    titulo: '17. Vínculo Oficial de Loja iFood 🛵',
    descricao: 'Integre sua loja iFood com a API oficial em poucos passos. Os pedidos que entram no app iFood caem sozinhos no seu painel, sem necessidade de digitar nada.',
    dicaExtra: 'As taxas retidas pelo iFood são calculadas no módulo financeiro para mostrar seu lucro líquido exato.',
    rota: '/admin/ifood',
    targetDataTour: 'tour-ifood-aba-credenciais',
    posicao: 'bottom',
    clicarElementoTarget: true,
  },
  {
    id: 'passo-ifood-depara',
    categoria: 'Integração iFood',
    titulo: '18. Tabela De-Para (Código PDV iFood) 🔗',
    descricao: 'Mapeie o Código PDV do iFood (externalCode) com os produtos do seu cardápio! É através deste código que o sistema reconhece o item vendido no iFood e dá a baixa automática no seu estoque.',
    dicaExtra: 'Cole os códigos exibidos no Portal do Parceiro iFood nos produtos da lista.',
    rota: '/admin/ifood',
    targetDataTour: 'tour-ifood-aba-depara',
    posicao: 'bottom',
    clicarElementoTarget: true,
  },

  // ── Módulo 9: WhatsApp IA ──
  {
    id: 'passo-whatsapp-ia',
    categoria: 'WhatsApp IA',
    titulo: '19. Atendimento com Inteligência Artificial 💬🤖',
    descricao: 'A IA do MiseOn conversa com os seus clientes no WhatsApp 24 horas por dia: ela tira dúvidas de ingredientes, preços, horários de atendimento e envia o link direto do seu cardápio digital para o cliente pedir.',
    dicaExtra: 'Se o cliente solicitar falar com uma pessoa, o sistema ativa o Handoff e chama sua equipe imediatamente.',
    rota: '/admin/whatsapp',
    targetDataTour: 'tour-whatsapp-header',
    posicao: 'bottom',
  },

  // ── Módulo 10: Financeiro & Efí Bank ──
  {
    id: 'passo-loja-pagamentos-aba',
    categoria: 'Financeiro & Recebimentos',
    titulo: '20. Configurações de Pagamento da Loja & Efí 🏦',
    descricao: 'Nesta aba você configura as formas de pagamento aceitas e habilita o Identificador Efí Bank (Payee Code). Cada venda cai 100% direta na sua conta sem intermediários!',
    dicaExtra: 'Você tem controle total dos prazos e antecipação de recebíveis no seu próprio painel Efí.',
    rota: '/admin/loja',
    targetDataTour: 'tour-loja-aba-pagamentos',
    posicao: 'bottom',
    clicarElementoTarget: true,
  },

  // ── Módulo 11: TV do Salão (Cardápio 4K & Painel de Senhas) ──
  {
    id: 'passo-loja-tv-links',
    categoria: 'TV do Salão',
    titulo: '21. Os dois links da TV 📺',
    descricao: 'A TV do salão não faz login: ela só abre um link no próprio navegador. Por isso existem dois — "Cardápio na TV 4K" abre no cardápio girando, e "Painel de Senhas na TV" abre direto chamando os pedidos prontos. Escolha o link pelo lugar onde a TV está: cardápio na fila, senhas no balcão de retirada.',
    dicaExtra: 'A TV lembra o modo mesmo depois de desligar da tomada. Antes ela voltava sempre para o cardápio e o balcão ficava sem chamar ninguém sem que ninguém percebesse.',
    rota: '/admin/loja',
    targetDataTour: 'tour-loja-tv-links',
    posicao: 'bottom',
  },
  {
    id: 'passo-loja-tv-tipos',
    categoria: 'TV do Salão',
    titulo: '22. Quem é chamado na TV 🔔',
    descricao: 'Senha é chamada de balcão: só faz sentido para quem está no salão esperando o pedido. Por isso o padrão é Balcão + Mesa, e Delivery vem desligado — não adianta a TV anunciar "retire no balcão" para um cliente que está em casa esperando o entregador.',
    dicaExtra: 'A senha é curta de propósito: vai de 1 a 999 e zera todo dia às 4h da manhã. Quem fecha depois da meia-noite continua no mesmo dia de operação, como a casa conta.',
    rota: '/admin/loja',
    targetDataTour: 'tour-loja-tv-tipos',
    posicao: 'top',
  },
  {
    id: 'passo-loja-tv-credencial',
    categoria: 'TV do Salão',
    titulo: '23. A credencial no fim do link 🔑',
    descricao: 'Repare que os links terminam com um código. É ele que impede qualquer pessoa de abrir o painel da sua loja e ver seus pedidos. Copie sempre o link por aqui — se copiar da barra de endereço da TV, o código fica de fora e o painel para de mostrar as senhas.',
    dicaExtra: 'Se o link vazar, clique em "Gerar credencial nova". As TVs já instaladas vão precisar receber o link novo, então faça isso fora do horário de pico.',
    rota: '/admin/loja',
    targetDataTour: 'tour-loja-tv-credencial',
    posicao: 'top',
  },
];

export function useGuidedTour(lojaId?: string) {
  const nav = useNavigate();
  const location = useLocation();

  // Modo de Tour: 'COMPLETO' ou 'PAGINA'
  const [modoTour, setModoTour] = useState<'COMPLETO' | 'PAGINA'>(() => {
    return (sessionStorage.getItem('miseon_tour_modo') as 'COMPLETO' | 'PAGINA') || 'COMPLETO';
  });

  // Restaurar estado ativo e passo da sessão para sobreviver a trocas de chunks lazy e re-mounts
  const [ativo, setAtivo] = useState<boolean>(() => {
    return sessionStorage.getItem('miseon_tour_ativo') === 'true';
  });

  const [passoIndex, setPassoIndex] = useState<number>(() => {
    const salvo = sessionStorage.getItem('miseon_tour_passo_index');
    return salvo ? Math.min(Number(salvo), TOUR_STEPS.length - 1) : 0;
  });

  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);

  // Carregar preferência se já concluiu no passado
  const [concluido, setConcluido] = useState<boolean>(() => {
    if (!lojaId) return false;
    return localStorage.getItem(`miseon_tour_concluido_${lojaId}`) === 'true';
  });

  // Persistir estado do tour na sessionStorage
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

  // Iniciar Tour Completo do Sistema (20 Passos)
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

  // Iniciar Tour Contextual Exclusivo da Página Atual
  const iniciarTourDaPagina = useCallback(
    (rotaAtual?: string) => {
      const rotaTarget = rotaAtual || location.pathname;
      const passosDaPagina = TOUR_STEPS.filter((s) => s.rota === rotaTarget);

      if (passosDaPagina.length === 0) {
        // Se a página atual não tiver passos específicos, executa o tour completo
        iniciarTourCompleto();
        return;
      }

      setModoTour('PAGINA');
      sessionStorage.setItem('miseon_tour_modo', 'PAGINA');

      // Encontrar o índice inicial do primeiro passo dessa página no array global TOUR_STEPS
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

  // Escutar eventos globais 'iniciar-guided-tour', 'iniciar-guided-tour-completo', 'iniciar-guided-tour-pagina'
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

  // Encerrar Tour
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

  // Concluir Tour com Confete
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

  // Ir para um passo específico garantindo reset de targetElement e navegação única
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

  // Avançar Passo Inteligente (Respeita se é Tour da Página ou Tour Completo)
  const proximoPasso = useCallback(() => {
    if (modoTour === 'PAGINA') {
      const rotaAtualPasso = passoAtual?.rota;
      const proximoPassoGlobal = TOUR_STEPS[passoIndex + 1];
      // Se o próximo passo pertence a OUTRA rota, conclui o tour da página atual!
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

  // Passo Anterior
  const passoAnterior = useCallback(() => {
    if (modoTour === 'PAGINA') {
      const rotaAtualPasso = passoAtual?.rota;
      const passoAnteriorGlobal = TOUR_STEPS[passoIndex - 1];
      // Se o passo anterior pertence a outra rota, não sai da página no modo de página
      if (!passoAnteriorGlobal || passoAnteriorGlobal.rota !== rotaAtualPasso) {
        return;
      }
    }

    if (passoIndex > 0) {
      mudoPasso(passoIndex - 1);
    }
  }, [passoIndex, modoTour, passoAtual, mudoPasso]);

  // Buscar e focar elemento no DOM continuamente com alta resiliência e auto-recuperação de abas
  useEffect(() => {
    if (!ativo || !passoAtual) return;

    // Se ainda está navegando via React Router para a rota do passo, aguarda renderizar
    if (location.pathname !== passoAtual.rota) {
      return;
    }

    let cancelado = false;
    let tentativa = 0;

    const buscarElemento = () => {
      if (cancelado) return;

      // Auto-recuperação de aba: Matérias-Primas (Insumos)
      if (['tour-estoque-campo-nome', 'tour-estoque-campo-compra', 'tour-estoque-campo-conversao', 'tour-estoque-campo-minimo'].includes(passoAtual.targetDataTour)) {
        const abaInsumos = document.querySelector<HTMLElement>('[data-tour="tour-estoque-aba-insumos"]');
        if (abaInsumos && !document.querySelector(`[data-tour="${passoAtual.targetDataTour}"]`)) {
          try { abaInsumos.click(); } catch (e) { console.warn(e); }
        }
      }

      // Auto-recuperação de aba: Custo 3D & Grafo Canvas 3D
      if (['tour-estoque-3d-canvas', 'tour-estoque-3d-legenda'].includes(passoAtual.targetDataTour)) {
        const aba3D = document.querySelector<HTMLElement>('[data-tour="tour-estoque-aba-3d"]');
        if (aba3D && !document.querySelector(`[data-tour="${passoAtual.targetDataTour}"]`)) {
          try { aba3D.click(); } catch (e) { console.warn(e); }
        }
      }

      // Auto-recuperação de aba: Rastreio 3D
      if (['tour-estoque-3d-legenda-rastreio', 'tour-estoque-3d-cartoes'].includes(passoAtual.targetDataTour)) {
        const abaRastreio = document.querySelector<HTMLElement>('[data-tour="tour-estoque-aba-rastreio3d"]');
        if (abaRastreio && !document.querySelector(`[data-tour="${passoAtual.targetDataTour}"]`)) {
          try { abaRastreio.click(); } catch (e) { console.warn(e); }
        }
      }

      // Auto-recuperação de aba para as configurações da Loja e Efí Bank
      if (['tour-loja-efi-payee'].includes(passoAtual.targetDataTour)) {
        const abaPagamentos = document.querySelector<HTMLElement>('[data-tour="tour-loja-aba-pagamentos"]');
        if (abaPagamentos && !document.querySelector(`[data-tour="${passoAtual.targetDataTour}"]`)) {
          try { abaPagamentos.click(); } catch (e) { console.warn(e); }
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
      } else if (tentativa < 60) {
        // Tenta por até 15 segundos (60 x 250ms) aguardando dados e renderização da página
        tentativa++;
        setTimeout(buscarElemento, 250);
      }
    };

    const timerInicial = setTimeout(buscarElemento, 100);

    return () => {
      cancelado = true;
      clearTimeout(timerInicial);
    };
  }, [ativo, passoIndex, passoAtual, location.pathname]);

  // Atalhos de Teclado
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

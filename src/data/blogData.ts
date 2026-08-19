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
    slug: 'dark-kitchen-hamburgueria-gestao-multi-marcas-logistica-delivery',
    title: 'Dark Kitchens e Hamburguerias de Escala: Como Operar Multi-Marcas no Mesmo Estoque com KDS Centralizado',
    description: 'Guia avançado de engenharia de delivery: gestão de múltiplas marcas virtuais, unificação de insumos em chapa de alta produção e roteamento de despacho sem erros.',
    category: 'Operação & KDS',
    publishedAt: '2026-08-18',
    readTime: '10 min de leitura',
    coverImage: '/blog-covers/dark-kitchen-burger-cover.jpg',
    author: {
      name: 'Rafael Maldivas',
      role: 'Head de Engenharia e Arquitetura do MiseOn',
      avatar: '/icon-192.png',
    },
    tags: ['Dark Kitchen', 'Hamburgueria', 'Multi-Marcas', 'KDS Centralizado', 'Delivery de Escala'],
    seo: {
      title: 'Dark Kitchens & Hamburguerias Multi-Marcas: Operação & KDS — MiseOn',
      description: 'Saiba como rodar múltiplas marcas virtuais de hamburgueria e delivery no mesmo espaço físico com KDS unificado e controle de estoque por PEPS.',
      keywords: 'dark kitchen brasil, hamburgueria delivery kds, sistema multi marcas delivery, comanda digital hamburgueria, gestão de dark kitchen',
      canonicalUrl: 'https://miseon.app.br/blog/dark-kitchen-hamburgueria-gestao-multi-marcas-logistica-delivery',
    },
    summary: 'Operar uma Dark Kitchen ou hamburgueria de alto volume exige máxima eficiência por metro quadrado. Veja como integrar múltiplas marcas no mesmo estoque de pães e carnes, rotear pedidos para praças distintas e zerar o tempo de embalagem com o KDS MiseOn.',
    content: `
# Dark Kitchens e Hamburguerias de Escala: Operação Multi-Marcas com KDS Centralizado

O modelo de **Dark Kitchen** (ou *Ghost Kitchen*) revolucionou a economia do food service ao permitir que donos de restaurantes operem 2, 3 ou até 5 marcas virtuais distintas a partir da mesma estrutura física de cozinha.

Você pode ter uma marca focada em **Smash Burgers ultra-baratos**, outra marca premium de **Hambúrgueres Artesanais de 200g** e uma terceira de **Porções e Batatas Recheadas**, todas compartilhando a mesma chapa, a mesma fritadeira e a mesma equipe.

Contudo, sem uma engenharia de sistemas robusta, o modelo multi-marcas rapidamente descamba para o caos: **embalagens trocadas, motoboys com pedidos errados e colapso no estoque**.

Neste artigo, mostramos como a arquitetura do **MiseOn** viabiliza o controle absoluto de operações multi-marcas e hamburguerias de alta velocidade.

---

## 1. O Princípio dos Insumos Compartilhados (Unificação de Estoque)

O segredo financeiro de uma Dark Kitchen bem-sucedida é o **compartilhamento de insumos base**.

Em vez de comprar 5 tipos de queijo e 4 tipos de batata para marcas diferentes:
- As marcas compartilham o mesmo pão brioche, a mesma maionese da casa e o mesmo blend de carne bovina.
- Cada marca diferencia seu produto final pelo **molho especial, topping exclusivo e embalagem personalizada**.

No **MiseOn**:
- O estoque de insumos (ex: *Lote de Blend de Carne 160g*) é **único e centralizado**.
- Quando entra um pedido da *Marca A (Burger Classic)* ou da *Marca B (Smash King)*, a Ficha Técnica deduz do **mesmo saldo de carne no estoque PEPS**.
- O gestor enxerga o consumo consolidado por insumo e o faturamento individual por marca no DRE.

---

## 2. Roteamento Inteligente de Pedidos no KDS Central

Na chapa durante o pico das 21h de domingo, o chapeiro não pode ficar olhando para 3 celulares ou 4 impressoras térmicas diferentes cuspindo papel.

O **KDS Multi-Marcas do MiseOn** unifica todas as origens em um único painel central inteligente:

1. **Badge de Identificação de Marca**: Cada card de pedido no KDS exibe a cor e o logotipo da marca de origem (*ex: 🔴 Smash Burger Co. | 🔵 Smash & Shake*).
2. **Agrupamento por Praça de Produção**:
   - **Chapa**: Recebe apenas as carnes que devem ir para a grelha/chapa com a gramatura e ponto indicados.
   - **Fritadeira**: Recebe as porções de batata, anéis de cebola e nugggets.
   - **Montagem & Embalagem**: Exibe o pedido completo e a embalagem exata (Saco Kraft da Marca A ou Caixa Premium da Marca B).

---

## 3. Gestão do Tempo de Despacho e Atribuição de Entregadores

Em uma Dark Kitchen, o cliente não está vendo a cozinha. A única experiência dele é a velocidade e a temperatura em que o lanche chega na casa dele.

O MiseOn integra a esteira de despacho:
- **Status em Tempo Real**: Assim que a embalagem recebe o lacre, o operador toca no botão **"PRONTO PARA EXPEDIÇÃO"**.
- **Notificação Automática via WhatsApp**: O cliente e o motoboy cadastrado recebem a mensagem: *"Seu pedido da Burger Co. está pronto e saindo para entrega com o entregador Marcos!"*.
- **Controle de Tempo de Balcão**: Se a embalagem fica mais de 5 minutos aguardando retirada na bancada de expedição, a tela de expedição acende um alerta visual para o gerente intervir.

Com o MiseOn, sua Dark Kitchen ganha escala de multinacional com a simplicidade de um software intuitivo feito para o dia a dia gastronômico.
`,
  },
  {
    slug: 'engenharia-de-pizzarias-kds-sabores-meio-a-meio-forno-alta-temperatura',
    title: 'Engenharia para Pizzarias: Como Gerenciar Pedidos Meio a Meio, Tempo de Forno e Fichas Técnicas de Massas',
    description: 'Guia definitivo de operação para pizzarias: controle de CMV em pizzas de sabores mistos, gestão de bordas recheadas, KDS para praça de forno e lote de longa fermentação.',
    category: 'Operação & KDS',
    publishedAt: '2026-08-18',
    readTime: '9 min de leitura',
    coverImage: '/blog-covers/pizzaria-kds-forno-cover.jpg',
    author: {
      name: 'Rafael Maldivas',
      role: 'Head de Engenharia e Arquitetura do MiseOn',
      avatar: '/icon-192.png',
    },
    tags: ['Pizzaria', 'KDS Forno', 'Sabores Meio a Meio', 'Longa Fermentação', 'CMV Pizzaria'],
    seo: {
      title: 'Engenharia para Pizzarias: Pedidos Meio a Meio, KDS & CMV — MiseOn',
      description: 'Aprenda a controlar o CMV de pizzas meio a meio, separar praças no KDS de pizzaria e gerenciar estoques de massa de longa fermentação no MiseOn.',
      keywords: 'kds pizzaria, pizza meio a meio cmv, sistema para pizzaria, ficha técnica pizza, forno a lenha kds',
      canonicalUrl: 'https://miseon.app.br/blog/engenharia-de-pizzarias-kds-sabores-meio-a-meio-forno-alta-temperatura',
    },
    summary: 'Pizzarias possuem uma das operações mais complexas do food service devido à customização extrema de pizzas meio a meio, bordas recheadas e sincronização de tempo de forno. Descubra como o KDS especializado do MiseOn elimina erros na montagem e garante a margem de cada fatia.',
    content: `
# Engenharia para Pizzarias: Como Gerenciar Pedidos Meio a Meio, Tempo de Forno e Fichas Técnicas

A operação de uma pizzaria de alto volume é uma verdadeira corrida contra o relógio. Entre o momento em que o cliente faz o pedido no WhatsApp ou no balcão e a hora em que a caixa quente chega à mesa ou ao motoboy, a massa passa por uma sequência precisa de etapas: **boleamento, abertura, molho, recheio, forno a 400°C e expedição**.

O grande gargalo histórico das pizzarias está em duas palavras que tiram o sono de qualquer dono: **"Meio a Meio"**.

Neste artigo, explicamos como a engenharia de software especializada em food service do **MiseOn** resolve o cálculo de CMV fracionado de pizzas mistas, automatiza a praça de forno no KDS e controla lotes de massa de longa fermentação.

---

## 1. O Desafio Math-CMV das Pizzas Meio a Meio

Em sistemas legados de restaurante, o cadastro de uma pizza meio a meio era feito como um item "genérico" ou cobrando sempre o valor do sabor mais caro sem dar baixa correta no estoque.

Isso gerava dois grandes problemas:
1. **Furo de Estoque Inevitável**: Se o cliente pede 1/2 Pepperoni (insumo caro) e 1/2 Muçarela (insumo médio), a baixa no estoque precisa ser de **exactos 50% da gramatura de pepperoni** e **50% da gramatura de muçarela**.
2. **Distorção do Custo Real da Fatia**: Quando o cliente adiciona borda recheada de Catupiry ou Vulcão de Cheddar, o custo do insumo salta significativamente.

No **MiseOn**, a Ficha Técnica de Pizzas é nativamente **fracionada por fatias e setores**:
- A base (massa + molho de tomate pelati + orégano) é abatida integralmente (1 unidade).
- Cada metade deduz proporcionalmente as proteínas, queijos e temperos específicos.
- A borda recheada baixa o lote de requeijão ou cream cheese pelo peso exato de aplicação.

---

## 2. KDS com Separação de Praças: Montagem vs. Forneiro

Uma pizzaria de alta demanda não pode depender de um papel colado no balcão de montagem. Se o forneiro não sabe exatamente a ordem de entrada das pizzas no forno, o tempo de assado fica descompensado.

O KDS do MiseOn separa as telas de produção por **Praças Específicas**:

1. **Tela 1 — Praça de Montagem (Pizzaiolo)**: Exibe a lista de pizzas com marcação clara de sabores (ex: *Lado A: Calabresa com Cebola | Lado B: Marguerita Especial*), além da borda escolhida e observações ("Massa bem assada", "Sem azeitona").
2. **Tela 2 — Praça de Forno (Forneiro)**: Quando o pizzaiolo finaliza a montagem e toca na tela, o pedido avança instantaneamente para a tela do Forneiro.
   - O forneiro visualiza o tempo de permanência no forno (ex: 3 minutos a 420°C).
   - O temporizador pisca em verde para "Em assamento" e emite alerta sonoro no tempo exato de retirar a pizza com a pá.
3. **Tela 3 — Expedição & Corte**: Onde a pizza é cortada na mesa inox, recebe os azeites e lacres de segurança e é colocada na caixa correta para o entregador.

---

## 3. Lotes de Massa de Longa Fermentação e Maturação (Fermento PEPS)

Pizzarias modernas trabalham com fermentação natural (Levain, Massa Madre) ou maturação de 24h a 72h na geladeira.

O módulo de **Preparos e Lotes do MiseOn** permite registrar a produção da massa base:
- Ao produzir um saco de 25 kg de farinha tipo 00 italiana, água, sal e fermento, o sistema gera o lote de **120 bolas de massa de 350g**.
- Cada bola de massa recebe seu custo PEPS individualizado acumulando a farinha e a energia de refrigeração.
- Se uma bola passa da data limite de maturação e precisa ser descartada, a perda é registrada como descarte técnico no DRE, mantendo a precisão total do CMV.

Com tecnologia direcionada para os desafios reais da pizzaria, sua operação ganha velocidade nos picos de fim de semana e mantém a margem de lucro protegida em cada fatia.
`,
  },
  {
    slug: 'como-transformar-smart-tv-salao-menu-board-4k-chamada-por-voz',
    title: 'Como Transformar Qualquer Smart TV em um Menu Board 4K com Chamada de Pedidos por Voz em Viva-Voz',
    description: 'Guia prático para eliminar filas no balcão e modernizar o salão: aprenda a conectar a Smart TV do restaurante ao KDS da cozinha com alertas sonoros e QR Code de autoatendimento.',
    category: 'Tecnologia & IA',
    publishedAt: '2026-08-15',
    readTime: '7 min de leitura',
    coverImage: '/blog-covers/smart-tv-cover.jpg',
    author: {
      name: 'Rafael Maldivas',
      role: 'Head de Engenharia e Arquitetura do MiseOn',
      avatar: '/icon-192.png',
    },
    tags: ['Smart TV 4K', 'Digital Menu Board', 'Chamada por Voz', 'KDS Cozinha', 'Autoatendimento'],
    seo: {
      title: 'Smart TV no Restaurante: Menu Board 4K & Chamada por Voz — MiseOn',
      description: 'Descubra como conectar a Smart TV do salão ao KDS da cozinha. Exiba seu cardápio em 4K e chame pedidos por voz sintetizada automaticamente.',
      keywords: 'tv restaurante cardápio, digital menu board, chamada de senhas tv, kds cozinha tv, comanda eletronica tv salão',
      canonicalUrl: 'https://miseon.app.br/blog/como-transformar-smart-tv-salao-menu-board-4k-chamada-por-voz',
    },
    summary: 'Restaurantes modernos estão substituindo placas impressas por Smart TVs integradas ao KDS. Veja como configurar o painel 2-em-1 do MiseOn com cardápio 4K, QR Code de mesa e chamada de senhas por voz sintetizada.',
    content: `
# Como Transformar Qualquer Smart TV em um Menu Board 4K com Chamada de Pedidos por Voz

No cenário ultracompetitivo do Food Service atual, a primeira impressão visual do cliente ao entrar no seu estabelecimento define a percepção de valor da sua marca.

Placas de papelão impressas, lousas de giz manchadas e painéis de senhas antigos transmitem uma imagem ultrapassada. Por outro lado, **Smart TVs integradas ao sistema de produção da cozinha** oferecem um visual de alta tecnologia estilo *fast-casual* americano.

Neste artigo, explicamos como a arquitetura de **Painel TV 4K do MiseOn** funciona na prática e como configurá-la em qualquer Smart TV do seu restaurante em menos de 2 minutos.

---

## 1. O Conceito 2-em-1: Cardápio Noturno + Chamada de Senhas

A maioria das soluções do mercado cobra licenças caras para exibir um menu board e exige a compra de um segundo aparelho para chamar senhas no balcão.

O MiseOn unifica ambas as necessidades em uma única tela inteligente:
1. **Menu Board 4K Rotativo**: Enquanto nenhum pedido é chamado, a TV exibe as categorias do seu cardápio com fotos em alta definição, preços atualizados e o selo de destaques ("Mais Pedidos"). A tela alterna automaticamente de categoria a cada 12 segundos.
2. **QR Code de Autoatendimento**: Exibe no canto da tela o QR Code direto para o cardápio no celular do cliente, eliminando filas no balcão de atendimento.
3. **Interrupção para Chamada de Voz**: Quando o cozinheiro avança o pedido para **PRONTO** na tela do KDS da cozinha, a TV faz um efeito neon piscando com a senha do cliente e a **voz sintetizada da TV anuncia em viva-voz**:
   > *"Atenção! Pedido número 142 de Rodrigo está pronto para retirada!"*

---

## 2. Passo a Passo de Configuração na Prática

### Passo 1: Ligar a Smart TV ao Wi-Fi da Loja
Conecte sua Smart TV (Samsung Tizen, LG WebOS, Android TV, TCL ou Chromecast) à rede de internet da loja.

### Passo 2: Abrir o Navegador da TV
Abra o aplicativo de **Navegador (Browser)** nativo da televisão.

### Passo 3: Digitar o Endereço do Painel TV
Acesse a URL da sua loja: \`https://miseon.app.br/tv/slug-da-loja\`
*(Dica: você pode copiar este link diretamente no botão "Cardápio na TV 4K" na aba de configurações do seu painel administrativo MiseOn)*.

### Passo 4: Alternar para Tela Cheia
Pressione **F11** no teclado ou clique no botão de **Expandir Tela (Fullscreen)**. A aplicação se ajustará perfeitamente à resolução 4K ou Full HD sem bordas.

---

## 3. Os Benefícios Operacionais Imediatos

- **Redução do Tempo de Retirada**: Clientes ouvem o chamado em viva-voz e buscam a refeição no segundo exato em que sai da cozinha, evitando que os pratos esfriem no balcão.
- **Zero Impressão de Papel**: Mudou o preço do hambúrguer? Altere no painel administrativo e a TV atualiza no mesmo segundo.
- **Aumento do Ticket Médio**: Pratos com fotos profissionais exibidos em tela grande despertam o desejo de consumo nos clientes que aguardam na fila.

Eleve a experiência visual do seu restaurante hoje mesmo com a tecnologia nativa para Smart TV do MiseOn.
`,
  },
  {
    slug: 'estrategia-whatsapp-atribuicao-pixel-meta-vendas-sem-comissao',
    title: 'Como Criar uma Máquina de Vendas no WhatsApp Sem Pagar Comissões: Atribuição de Pedidos e Meta Pixel',
    description: 'Guia definitivo de growth para food service: como transformar o WhatsApp do seu restaurante em um canal direto rastreável com Meta Pixel, IA consultiva e atribuição de vendas.',
    category: 'Tecnologia & IA',
    publishedAt: '2026-08-15',
    readTime: '9 min de leitura',
    coverImage: '/blog-covers/whatsapp-sales-attribution-cover.jpg',
    author: {
      name: 'Rafael Maldivas',
      role: 'Head de Engenharia e Arquitetura do MiseOn',
      avatar: '/icon-192.png',
    },
    tags: ['WhatsApp Sales', 'Meta Pixel', 'Atribuição de Vendas', 'Sem Comissão', 'Growth Food Service'],
    seo: {
      title: 'Como Criar uma Máquina de Vendas no WhatsApp Sem Pagar Comissões — MiseOn',
      description: 'Aprenda a rastrear vendas do WhatsApp com Meta Pixel, token de atribuição e IA consultiva LLaMA 3.3 sem pagar comissões por pedido.',
      keywords: 'vendas whatsapp restaurante, pixel meta cardápio, atribuicao pedidos whatsapp, delivery sem comissão, gestão vendas whatsapp',
      canonicalUrl: 'https://miseon.app.br/blog/estrategia-whatsapp-atribuicao-pixel-meta-vendas-sem-comissao',
    },
    summary: 'Restaurantes chegam a pagar 27% de comissão por pedido em marketplaces de delivery. Aprenda a transformar seu WhatsApp próprio em um canal direto com IA consultiva, token de atribuição e rastreamento Meta Pixel para dobrar a margem de lucro.',
    content: `
# Como Criar uma Máquina de Vendas no WhatsApp Sem Pagar Comissões

Se você administra um restaurante, hamburgueria ou pizzaria no Brasil, sabe que o maior ralador de margens de lucro é a comissão de 12% a 27% cobrada pelos marketplaces de delivery.

Embora os aplicativos sejam úteis para aquisição inicial de clientes, a sobrevivência financeira do seu restaurante exige que a **segunda compra do cliente aconteça no seu canal próprio**.

Neste artigo, revelamos como a arquitetura do **MiseOn** combina **Inteligência Artificial Consultiva LLaMA 3.3 70B**, **tokens de atribuição de pedido (?wa=)** e **rastreamento Meta Pixel** para transformar o WhatsApp no seu canal mais lucrativo.

---

## 1. O Problema dos "Links Secos" no WhatsApp

A maioria dos restaurantes comete um de dois erros no atendimento do WhatsApp:
1. **Atendimento Manual Lento**: Deixar um funcionário digitando manualmente de quinta a domingo, gerando filas de espera de 20 minutos e perda de pedidos por demora.
2. **Robôs Rígidos com Links Secos**: Instalar um bot que responde com uma mensagem fria e um link genérico sem contexto. O cliente se sente mal atendido e fecha a conversa.

---

## 2. A Solução: Atendimento Consultivo com IA LLaMA 3.3 70B

A Inteligência Artificial do MiseOn atua como um garçom experiente de balcão. Em vez de simplesmente soltar um link, ela:
- Cumprimenta o cliente pelo nome.
- Responde a dúvidas reais ("Temos opções vegetarinas?", "O molho tem lactose?", "Qual é o prato mais vendido?").
- Sugere 2 ou 3 opções deliciosas do cardápio real com preços atualizados.
- Faz venda cruzada (*upsell*) sugerindo bebidas e sobremesas.
- **Envia o link do cardápio digital com um token de atribuição atômico (\`?wa=<wa_token>\`)**.

---

## 3. O que é Atribuição de Pedidos e Por Que Ela Garante o Seu Lucro?

Quando o cliente clica no link gerado pela IA no WhatsApp, o token \`?wa=\` acompanha o navegador até o checkout.

Quando o pedido é finalizado:
1. O banco de dados do MiseOn vincula o pedido diretamente à conversa do WhatsApp de origem.
2. O balcão e a cozinha visualizam o badge **🟢 WhatsApp** na fila de produção.
3. Se você utiliza tráfego pago no Instagram/Facebook, o **Meta Pixel** dispara o evento nativo \`Purchase\` informando à Meta que aquele anúncio gerou uma venda real de R$ 85,00.

---

## 4. O Resultado Prático na Sua Conta Bancária

Com vendas diretas pelo WhatsApp:
- **0% de Comissão por Pedido**: O faturamento de R$ 100.000,00 entra integralmente na conta da sua loja.
- **Split Instantâneo via Efí**: O dinheiro pago via Pix ou Crédito cai direto na sua conta bancária sem intermediação.
- **Base de Clientes Própria**: Seus clientes são seus, com histórico de compras e segmentação RFM para futuras campanhas de reengajamento.

Inicie hoje a transição do seu delivery para o canal próprio e recupere o controle da sua margem de lucro.
`,
  },
  {
    slug: 'dre-gastronomico-margem-lucro-liquido-restaurantes',
    title: 'DRE Gastronômico: A Diferença entre Faturar R$ 100 Mil e Sobrar Dinheiro no Bolso',
    description: 'Como a Demonstração do Resultado do Exercício (DRE) com escrituração contábil por dupla entrada revela a margem líquida real de restaurantes e elimina sangrias de caixa.',
    category: 'Gestão Financeira',
    publishedAt: '2026-08-15',
    readTime: '10 min de leitura',
    coverImage: '/blog-covers/dre-gastronomico-cover.jpg',
    author: {
      name: 'Rafael Maldivas',
      role: 'Head de Engenharia e Arquitetura do MiseOn',
      avatar: '/icon-192.png',
    },
    tags: ['DRE', 'Financeiro Restaurante', 'Margem Liquida', 'CMV Real', 'Gestão Financeira'],
    seo: {
      title: 'DRE Gastronômico: Faturar vs Lucrar no Restaurante — MiseOn',
      description: 'Aprenda a montar a Demonstração do Resultado do Exercício (DRE) do seu restaurante e descubra seu lucro líquido real com o sistema MiseOn.',
      keywords: 'dre restaurante, demonstracao resultado exercicio comida, lucro liquido restaurante, calculo margem gastronomia, sistema financeiro restaurante',
      canonicalUrl: 'https://miseon.app.br/blog/dre-gastronomico-margem-lucro-liquido-restaurantes',
    },
    summary: 'Muitos donos de restaurantes comemoram o faturamento de R$ 100 mil no mês sem perceber que o caixa está negativo. A Demonstração do Resultado do Exercício (DRE) automatizada por dupla entrada é a única ferramenta capaz de separar vaidade de lucro real.',
    content: `
# DRE Gastronômico: A Diferença entre Faturar R$ 100 Mil e Sobrar Dinheiro no Bolso

Na gastronomia, existe um ditado brutal que todo gestor experiente conhece: **"Faturamento é vaidade, lucro é sanidade e caixa é rei."**

É muito comum encontrar estabelecimentos de food service com salas cheias, motoboys saindo sem parar e faturamento mensal de R$ 100.000,00 a R$ 200.000,00, mas cujo proprietário precisa aportar dinheiro do próprio bolso para pagar os salários no dia 5.

Por que isso acontece? Porque a gestão estava olhando apenas para o **Fluxo de Caixa bruto** e ignorando a **Demonstração do Resultado do Exercício (DRE)**.

---

## 1. Fluxo de Caixa vs. DRE: A Armadilha dos Números

- **Fluxo de Caixa**: Mostra apenas o que *entrou* e o que *saiu* da conta em determinado dia. Se você antecipar R$ 50 mil de vendas de cartão hoje, seu fluxo de caixa parecerá excelente, mas seu negócio pode estar operando no prejuízo.
- **DRE (Competência)**: Mostra a **eficiência real da operação**. Ele confronta todas as vendas do mês contra todos os custos operacionais (CMV dos pratos, salários, aluguel, energia, taxas de maquininha e impostos), independente de quando o dinheiro foi pago ou recebido.

---

## 2. A Estrutura Canônica do DRE no Food Service

Para que o seu restaurante tenha uma operação saudável, a estrutura do seu DRE deve seguir estas proporções ideais:

| Linha do DRE | Descrição | Meta Saudável |
|---|---|---|
| **(=) Faturamento Bruto** | Total de vendas (Balcão + Salão + Delivery + iFood) | 100% |
| **(-) Impostos & Taxas de Maquininha** | Simples Nacional, taxas iFood e de cartão | 8% a 14% |
| **(=) Receita Líquida** | O dinheiro que realmente pertence ao restaurante | 86% a 92% |
| **(-) Custo de Mercadoria Vendida (CMV)** | Baixa de insumos e embalagens consumidas no período | **28% a 33%** |
| **(=) Lucro Bruto** | Margem após pagar os ingredientes | 55% a 62% |
| **(-) Custos Operacionais Fixos** | Aluguel, energia, água, gás, software, marketing | 15% a 20% |
| **(-) Mão de Obra (Folha + Encargos)** | Equipe de cozinha, salão, atendimento e pro-labore | 18% a 22% |
| **(=) LUCRO LÍQUIDO OPERACIONAL** | **O que REALMENTE sobra para os sócios** | **15% a 25%** |

---

## 3. Como o Ledger de Dupla Entrada do MiseOn Automatiza Seu DRE

No MiseOn, você não precisa preencher planilhas no fim do mês. A cada ação realizada no sistema:
1. **Uma venda no PDV ou no WhatsApp**: Credita a Receita e debita o Caixa/Contas a Receber.
2. **A baixa do ingrediente na cozinha**: Debita a conta \`3.1.01 CMV\` e credita \`1.1.03 Estoque de Insumos\` pelo custo PEPS exato.
3. **O pagamento da conta de energia**: Lança o débito em Despesas Operacionais.

Ao final do mês, a tela de **Financeiro & DRE** do MiseOn gera a Demonstração do Resultado pronta, revelando exatamente a margem de lucro de cada produto e onde a sua operação pode economizar.
`,
  },
  {
    slug: 'engenharia-de-cardapio-combos-upsell-lucratividade',
    title: 'Engenharia de Cardápio e Venda Cruzada: Como Aumentar o Ticket Médio em até 28% sem Subir Preços',
    description: 'Técnicas avançadas de psicologia de preços, matriz de lucratividade (Estrelas, Enigmas, Burros de Carga e Cães) e automação de upsell no cardápio digital.',
    category: 'Engenharia de Cardápio',
    publishedAt: '2026-08-15',
    readTime: '8 min de leitura',
    coverImage: '/blog-covers/engenharia-cardapio-cover.jpg',
    author: {
      name: 'Rafael Maldivas',
      role: 'Head de Engenharia e Arquitetura do MiseOn',
      avatar: '/icon-192.png',
    },
    tags: ['Engenharia de Cardápio', 'Ticket Médio', 'Upsell', 'Combos', 'Psicologia de Preços'],
    seo: {
      title: 'Engenharia de Cardápio: Aumente o Ticket Médio em 28% — MiseOn',
      description: 'Aprenda a aplicar a Engenharia de Cardápio no seu restaurante. Classifique pratos na Matriz de BCG gastronômica e automatize o upsell digital.',
      keywords: 'engenharia de cardápio, matriz bcg restaurante, aumentar ticket medio delivery, upsell cardápio digital, precificacao pratos comida',
      canonicalUrl: 'https://miseon.app.br/blog/engenharia-de-cardapio-combos-upsell-lucratividade',
    },
    summary: 'Aumentar o faturamento do restaurante não exige necessariamente atrair mais clientes. Aplicando os 4 quadrantes da Engenharia de Cardápio e disparando complementos estratégicos no checkout, o ticket médio cresce até 28% de forma imediata.',
    content: `
# Engenharia de Cardápio e Venda Cruzada: Como Aumentar o Ticket Médio em até 28%

Muitos donos de restaurantes acreditam que para faturar mais é preciso gastar rios de dinheiro em anúncios para trazer novos clientes.

Existe, porém, um caminho muito mais rápido, barato e rentável: **fazer com que o cliente que já está no seu cardápio gaste R$ 15,00 a R$ 25,00 a mais por pedido**.

Isso é alcançado através da **Engenharia de Cardápio (Menu Engineering)** aliada à automação de vendas cruzadas (*upsell*).

---

## 1. Os 4 Quadrantes da Matriz de Cardápio

A Engenharia de Cardápio classifica cada item do seu menu cruzando dois fatores: **Volume de Vendas (Popularidade)** e **Margem de Lucro Bruto (Lucratividade)**.

- **⭐ ESTRELAS (Alta Margem + Altas Vendas)**: Seus campeões! Devem ter destaque máximo no topo do cardápio digital, fotos profissionais e selos de "Mais Pedido".
- **🐎 BURROS DE CARGA (Baixa Margem + Altas Vendas)**: Pratos muito populares, mas com custo de ingrediente alto. **Estratégia**: Reduzir levemente a gramatura ou criar um combo com bebida/sobremesa de alta margem para recuperar a margem total.
- **❓ ENIGMAS (Alta Margem + Baixas Vendas)**: Pratos muito lucrativos que poucos clientes pedem. **Estratégia**: Reescrever a descrição de forma mais apetitosa ou oferecer através da IA no WhatsApp.
- **🐕 CÃES (Baixa Margem + Baixas Vendas)**: Ocupam espaço na cozinha, exigem estoque de insumos raros e não dão lucro. **Estratégia**: Elimine do cardápio imediatamente.

---

## 2. A Magia dos Complementos Obrigatórios e Recomendados (Upsell)

Quando o cliente seleciona um hambúrguer ou uma refeição no Cardápio Digital do MiseOn:
- O sistema abre os **Grupos de Opções Inteligentes**: *"Deseja adicionar bacon duplo por R$ 4,50?"*, *"Transforme em Combo com Batata M + Refrigerante por R$ 12,00"*.
- **Psicologia de Preços**: Para o cliente, R$ 4,50 adicionados a um pedido de R$ 38,00 parecem um valor irrelevante. Para o restaurante, esse adicional possui uma margem de lucro de 70%!

---

## 3. Recompensas de Cashback para Segunda Compra

Para fechar o ciclo de retenção, o MiseOn devolve 5% a 10% do valor do pedido em **Cashback** para ser utilizado na próxima compra.

O cliente percebe o saldo acumulado como um incentivo exclusivo da sua loja, garantindo que no próximo fim de semana ele peça novamente direto no seu site em vez de procurar alternatives nos aplicativos concorrentes.
`,
  },
  {
    slug: 'gestao-de-suprimentos-compras-peps-fornecedores',
    title: 'Gestão de Compras e Suprimentos no Food Service: O Guia Definitivo para Não Queimar Caixa no Estoque',
    description: 'Como automatizar ordens de compra, negociar com fornecedores baseado no histórico de preços e evitar que ingrediente vire lixo nas prateleiras.',
    category: 'Operação & KDS',
    publishedAt: '2026-08-15',
    readTime: '7 min de leitura',
    coverImage: '/blog-covers/gestao-suprimentos-cover.jpg',
    author: {
      name: 'Rafael Maldivas',
      role: 'Head de Engenharia e Arquitetura do MiseOn',
      avatar: '/icon-192.png',
    },
    tags: ['Compras', 'Fornecedores', 'Suprimentos', 'Estoque PEPS', 'Redução de Custos'],
    seo: {
      title: 'Gestão de Compras e Suprimentos no Food Service — MiseOn',
      description: 'Descubra como o módulo de compras e fornecedores do MiseOn calcula a sugestão de pedido por giro e evita capital parado no estoque do restaurante.',
      keywords: 'gestão de compras restaurante, fornecedores comida, controle de suprimentos food service, estoque mínimo insumos, ordem de compra whatsapp',
      canonicalUrl: 'https://miseon.app.br/blog/gestao-de-suprimentos-compras-peps-fornecedores',
    },
    summary: 'Comprar de menos paralisa a cozinha no meio do pico de vendas; comprar de mais queima capital de giro e gera perdas por validade. Saiba como o módulo de Suprimentos do MiseOn equilibra esse ciclo com precisão matemática.',
    content: `
# Gestão de Compras e Suprimentos no Food Service: O Guia Definitivo

A cozinha de um restaurante é uma indústria de transformação acelerada. Todos os dias, quilos de proteínas, laticínios, vegetais e embalagens entram pela porta de serviços e saem em forma de pratos finalizados ou caixas de entrega.

O grande desafio do gestor de compras é responder a duas perguntas diárias:
1. **O que eu preciso comprar hoje?**
2. **De quem eu devo comprar para obter a melhor margem?**

---

## 1. O Princípio Dourado: "Pedido é Intenção, Recebimento é Fato"

Em muitas operações sem sistema integrado, o comprador faz o pedido por telefone com o distribuidor por R$ 200,00. Quando o caminhão chega, a nota fiscal vem em R$ 240,00 com duas marcas trocadas e 3 itens em falta.

No módulo de **Suprimentos do MiseOn**:
- A **Ordem de Compra** registra a *intenção* (o que foi acordado com o fornecedor).
- O **Recebimento de Compra** registra o *fato* (o que realmente chegou na conferência da nota).
- A diferença entre a intenção e o fato é registrada em relatórios de histórico de fornecedor, permitindo que você descubra quais distribuidores cumprem prazos e preços de forma transparente.

---

## 2. Sugestão Inteligente de Compra por Giro de Vendas

Em vez de "adivinhar" quanto queijo ou carne comprar para a semana, o MiseOn analisa a visão de **Giro de Insumos (\`vw_insumo_giro\`)**:
- **Consumo Médio Diário**: O sistema calcula quantos gramas do insumo a sua cozinha consome por dia com base na baixa real das fichas técnicas.
- **Prazo de Entrega do Fornecedor**: Se o distribuidor de laticínios leva 3 dias para entregar, o sistema avisa exatamente quando o estoque atingiu o **Ponto de Pedido**.
- **Sugestão Automática**: Gera a lista de compras perfeita para cobrir os próximos X dias sem deixar capital parado desnecessariamente na câmara fria.

---

## 3. Disparo de Ordens de Compra via WhatsApp para Fornecedores

Com a ordem de compra gerada no MiseOn, o comprador não precisa digitar tudo de novo. Com 1 clique no botão **"Enviar Ordem de Compra no WhatsApp"**, o sistema formata a lista completa de produtos, unidades, marcas exigidas e observações de entrega e abre a conversa diretamente com o representante do distribuidor.

Sua cozinha ganha agilidade, seu estoque opera sem perdas e seu caixa preserva a liquidez que o seu negócio precisa para crescer.
`,
  },
  {
    slug: 'evolucao-do-cmv-do-caderno-ao-custeio-peps-3d',
    title: 'A Evolução do CMV no Food Service: Do Caderno de Receitas à Engenharia de Estoque 3D e Custeio PEPS',
    description: 'Como o controle de custos na gastronomia evoluiu de palpites em cadernos para o custeio real por lote PEPS e a inteligência de rendimento com perda de cocção.',
    category: 'Gestão Financeira',
    publishedAt: '2026-07-28',
    readTime: '8 min de leitura',
    coverImage: '/blog-covers/evolucao-cmv-cover.jpg',
    author: {
      name: 'Rafael Maldivas',
      role: 'Head de Engenharia e Arquitetura do MiseOn',
      avatar: '/icon-192.png',
    },
    tags: ['CMV', 'Ficha Técnica', 'Custeio PEPS', 'Estoque 3D', 'Gestão de Restaurante'],
    seo: {
      title: 'A Evolução do CMV no Food Service: Do Caderno ao Custeio PEPS — MiseOn',
      description: 'Entenda a evolução do Custo de Mercadoria Vendida (CMV) no food service. Descubra como o custeio PEPS e a perda de cocção protegem a margem de restaurantes.',
      keywords: 'cmv restaurante, custeio peps restaurante, ficha técnica alimentos, perda de coccao comida, calculo cmv hamburgueria',
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
2. **Ignorava os Preparos Internos**: Quando a cozinha moía a carne, temperava e moldava o blend, ou reduzida 10 litros de molho de tomate para 6 litros concentrados, esse "trabalho de panela" entrava no estoque valendo ZERO. O produto pronto nascia barato na ficha, mas caro na vida real.
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
    coverImage: '/blog-covers/kds-kanban-cover.jpg',
    author: {
      name: 'Rafael Maldivas',
      role: 'Head de Engenharia e Arquitetura do MiseOn',
      avatar: '/icon-192.png',
    },
    tags: ['KDS', 'Cozinha sem Papel', 'Eficiência Operacional', 'Hamburgueria', 'Pizzaria'],
    seo: {
      title: 'O Fim do Papel na Cozinha: Como o KDS Kanban Transforma a Operação — MiseOn',
      description: 'Descubra como telas digitais de cozinha (KDS) com colunas Kanban reduzem o tempo de preparo, eliminam erros de pedidos e organizam praças de produção.',
      keywords: 'kds cozinha, kitchen display system, cozinha sem papel, gestão de cozinha restaurante, kanban produção comida',
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
    coverImage: '/blog-covers/whatsapp-oficial-ia-cover.jpg',
    author: {
      name: 'Rafael Maldivas',
      role: 'Head de Engenharia e Arquitetura do MiseOn',
      avatar: '/icon-192.png',
    },
    tags: ['WhatsApp IA', 'Meta API', 'Automação Delivery', 'Atendimento Restaurante', 'IA Gastronomia'],
    seo: {
      title: 'IA no WhatsApp do Restaurante: Oficial Meta vs Bots Amadores — MiseOn',
      description: 'Entenda os riscos de banimento em sistemas paralelos de WhatsApp e descubra como a IA conectada à API Oficial da Meta atende restaurantes sem errar.',
      keywords: 'whatsapp ia restaurante, api oficial whatsapp meta, robo whatsapp delivery, atendimento automático delivery, whatsapp business cloud api',
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
    coverImage: '/blog-covers/venda-por-quilo-cover.jpg',
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

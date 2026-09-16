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
    slug: 'delivery-da-dinheiro-a-conta-por-canal-que-quase-ninguem-faz',
    title: 'Delivery Dá Dinheiro? A Conta por Canal que Quase Ninguém Faz',
    description: 'Comissão, embalagem, taxa de entrega e cupom saem do mesmo prato. Como montar a margem por canal e descobrir qual venda está pagando a conta e qual está cobrando por ela.',
    category: 'Gestão Financeira',
    publishedAt: '2026-09-16',
    readTime: '10 min de leitura',
    coverImage: '/blog-covers/delivery-margem-por-canal-cover.jpg',
    author: {
      name: 'Rafael Maldivas',
      role: 'Head de Engenharia e Arquitetura do MiseOn',
      avatar: '/icon-192.png',
    },
    tags: ['Delivery', 'Margem por Canal', 'iFood', 'Embalagem', 'Precificação'],
    seo: {
      title: 'Delivery Dá Dinheiro? A Margem por Canal na Prática — MiseOn',
      description: 'Comissão, embalagem e taxa saem do mesmo prato. Monte a margem por canal do seu delivery e veja qual venda paga a conta e qual cobra por ela.',
      keywords: 'margem delivery restaurante, comissao ifood calculo, custo embalagem delivery, precificacao por canal, delivery da lucro',
      canonicalUrl: 'https://miseon.app.br/blog/delivery-da-dinheiro-a-conta-por-canal-que-quase-ninguem-faz',
    },
    summary: 'Faturamento de delivery é fácil de ver e margem de delivery é fácil de ignorar. Comissão de marketplace, embalagem, taxa de entrega e cupom saem todos do mesmo prato — e cada canal come uma fatia diferente. Este artigo monta a conta por canal e mostra por que o mesmo prato pode ser lucrativo no balcão e prejuízo no aplicativo.',
    content: `
# Delivery Dá Dinheiro? A Conta por Canal que Quase Ninguém Faz

Delivery cresceu e virou obrigação. A pergunta que quase nunca é respondida com número é outra: **delivery dá dinheiro?**

A resposta honesta é: depende do canal. E como quase ninguém separa a margem por canal, a loja soma tudo num caixa só e acha que está tudo bem — ou acha que está tudo mal — sem saber qual venda pagou a conta e qual cobrou por ela.

---

## O mesmo prato, três preços de custo

Pegue um prato de R$ 45,00 no balcão, com R$ 15,00 de insumo. Margem bruta de R$ 30,00.

Agora mande o mesmo prato pelos três caminhos:

- **Balcão**: R$ 45,00 menos R$ 15,00 de insumo. Sobram R$ 30,00
- **Delivery próprio**: acrescente embalagem, sacola e talher (digamos R$ 3,50) e o custo de entrega. Se você paga R$ 8,00 ao entregador e cobra R$ 6,00 do cliente, faltam R$ 2,00. Sobram R$ 24,50
- **Marketplace**: acrescente a embalagem (R$ 3,50) e a comissão do canal sobre o valor total. A comissão não incide sobre o seu lucro: incide sobre a venda inteira

Três números diferentes para o mesmo prato saindo da mesma chapa. Um cardápio que tem um preço só está financiando o canal mais caro com o dinheiro do canal mais barato.

Os valores são um exemplo aritmético para mostrar a estrutura da conta, não a medição de uma loja.

---

## 1. A comissão não é desconto: é sócio no faturamento

Desconto sai uma vez. Comissão sai em toda venda, para sempre, sobre o valor cheio — incluindo a taxa de entrega que o cliente pagou e, em muitos contratos, incluindo o que você bancou de promoção.

Isso muda a natureza da conta. Um canal com comissão alta só se justifica se ele **trouxer cliente que você não teria** — e se o preço praticado ali comportar a comissão. Se você usa o marketplace para vender ao mesmo cliente que já compraria no seu WhatsApp, está pagando pedágio numa estrada que já era sua.

---

## 2. Embalagem é ingrediente

Marmita, tampa, sacola, lacre, talher, guardanapo, molho em sachê, etiqueta. Nada disso aparece na receita, tudo isso sai do mesmo prato.

Em cardápio de ticket baixo, a embalagem chega a pesar mais que um ingrediente inteiro da ficha. E ela tem uma característica cruel: **é a mesma para o prato barato e para o caro**. Ou seja, ela morde proporcionalmente muito mais a margem do item de entrada — justamente o que mais sai.

Se a sua ficha técnica não tem uma linha de embalagem por canal, ela não descreve o que sai pela porta.

---

## 3. A taxa de entrega quase nunca fecha

Cobrar R$ 6,00 e pagar R$ 9,00 ao entregador é uma decisão legítima de marketing — desde que seja uma decisão, com o rombo medido e coberto pela margem do pedido.

O problema é quando ninguém fez essa conta e a diferença some no caixa do dia. Aí a loja tem a sensação de que o delivery "não rende", sem saber que o buraco está numa linha só, fácil de corrigir: raio de entrega, pedido mínimo por faixa de distância, ou preço de entrega por bairro.

---

## 4. Cupom bom e cupom que só transfere dinheiro

Existe cupom que traz cliente novo e existe cupom que dá desconto para quem já ia comprar.

O primeiro é investimento: tem custo de aquisição e retorno esperado. O segundo é só margem indo embora, com a agravante de treinar o cliente a nunca mais comprar pelo preço cheio.

A diferença entre os dois não está no cupom — está na regra. Cupom de primeira compra, cupom por janela de horário para mover gente do pico para a borda do serviço, cupom para reativar quem não compra há sessenta dias: tudo isso é investimento com alvo. Cupom permanente na home é desconto com outro nome.

---

## 5. O pico não escala como você imagina

No balcão, o limite é a cadeira. No delivery, o limite é a cozinha — e ele aparece em forma de atraso, não de fila visível.

Quando o tempo de preparo estoura, o efeito não é só a avaliação ruim. É comida saindo fria, reembolso, refação, entregador parado esperando (e entregador parado é custo). Uma operação que aceita mais pedidos do que consegue montar está comprando faturamento com margem.

Fila que você não vê é fila mesmo assim.

---

## Como montar a margem por canal em uma tarde

- **Separe a venda por canal.** Balcão, delivery próprio, marketplace, mesa. Sem essa separação, nada do resto funciona
- **Liste o custo que só existe naquele canal.** Embalagem, comissão, taxa de entrega paga, cupom, imposto quando o regime difere
- **Calcule a margem por pedido, não por prato.** O delivery é vendido em pedido: um pedido de item único paga embalagem inteira; um pedido de quatro itens dilui
- **Compare a margem por hora de cozinha, não só por pedido.** Um prato de margem alta que trava a chapa por dez minutos pode render menos que dois de margem média
- **Decida o preço por canal.** Preço diferente por canal não é truque: é reconhecer que o custo é diferente

---

## O que o MiseOn faz com isso

- **Pedido do iFood entra com o preço COM o markup do canal** — o sistema não reprecifica por cima, porque o preço praticado ali é aquele mesmo
- **Custo por item vindo da ficha técnica**, com a nota de compra por trás
- **Cupom com regra**: janela de horário, dia da semana, primeira compra — desconto decidido no servidor, não no navegador do cliente
- **Cada canal é um canal**, do balcão ao aplicativo, e o relatório não mistura o que não é igual

---

**Delivery não é uma decisão de sim ou não. É uma decisão por canal, por prato e por horário** — e essas três perguntas só têm resposta com a margem separada.
`,
  },
  {
    slug: 'restaurante-amador-na-internet-o-que-faz-perder-a-venda',
    title: 'O Que Faz um Restaurante Parecer Amador na Internet (e Perder a Venda Antes do Cardápio)',
    description: 'A decisão de comprar acontece em segundos, antes do primeiro item. Os sinais que fazem o cliente desconfiar da sua loja — e o que arrumar primeiro.',
    category: 'Tecnologia & IA',
    publishedAt: '2026-09-16',
    readTime: '8 min de leitura',
    coverImage: '/blog-covers/presenca-digital-restaurante-cover.jpg',
    author: {
      name: 'Rafael Maldivas',
      role: 'Head de Engenharia e Arquitetura do MiseOn',
      avatar: '/icon-192.png',
    },
    tags: ['Cardápio Digital', 'Presença Digital', 'Conversão', 'WhatsApp', 'Experiência do Cliente'],
    seo: {
      title: 'Restaurante Amador na Internet: O Que Faz Perder a Venda — MiseOn',
      description: 'Foto ruim, cardápio desatualizado, link que não abre e WhatsApp sem resposta. Os sinais que derrubam a venda antes do cliente ver o primeiro prato.',
      keywords: 'cardapio digital restaurante, site de restaurante que vende, presenca digital food service, qr code cardapio, conversao delivery proprio',
      canonicalUrl: 'https://miseon.app.br/blog/restaurante-amador-na-internet-o-que-faz-perder-a-venda',
    },
    summary: 'Ninguém decide comer num lugar lendo o cardápio inteiro: decide em segundos, por sinais. Foto escura, preço desatualizado, link que pede aplicativo, WhatsApp que não responde. Este artigo lista os sinais que fazem um restaurante bom parecer amador na internet e a ordem em que vale a pena corrigir.',
    content: `
# O Que Faz um Restaurante Parecer Amador na Internet (e Perder a Venda Antes do Cardápio)

Um cliente não avalia a sua comida pela internet. Ele avalia o **risco** de pedir.

Essa decisão acontece em poucos segundos, antes de o primeiro item ser lido, e é feita por sinais. Cozinha excelente com sinais ruins perde para cozinha mediana com sinais bons — e isso não é injustiça do algoritmo, é como qualquer pessoa decide onde gastar quarenta reais e a própria fome.

Abaixo, os sinais que mais derrubam venda, em ordem de estrago.

---

## 1. Foto escura, tremida ou de outro prato

A foto é a única prova que o cliente tem antes de pagar. Quando ela é escura, desfocada ou claramente baixada da internet, a mensagem que chega não é "foto ruim": é **"não sei o que vou receber"**.

Não é preciso estúdio. É preciso luz da janela, fundo limpo, o prato montado como sai de verdade e a mesma moldura para todos os itens. Um cardápio onde cada foto tem um enquadramento e uma cor diferentes parece uma colcha de retalhos, mesmo com fotos boas.

E foto que não corresponde ao prato real é pior que foto nenhuma: gera reclamação, reembolso e avaliação negativa — três custos, não um.

---

## 2. Preço desatualizado e item indisponível

O cliente monta o pedido, chega no fim e descobre que o item acabou ou que o preço é outro. Essa é uma das poucas coisas capazes de fazer alguém desistir depois de já ter decidido comprar.

Cardápio impresso envelhece em silêncio. Cardápio digital envelhece em público — e por isso precisa de um lugar só onde o preço é alterado, valendo na mesma hora para a mesa, o balcão e o delivery. Preço que mora em três lugares diverge nos três.

---

## 3. Link que pede aplicativo, cadastro ou senha

Cada passo antes do "quero este" derruba uma parte das pessoas. Pedir instalação de aplicativo para um pedido de vinte e cinco reais é pedir um casamento no primeiro encontro.

Cardápio que abre no navegador, em dois segundos, sem cadastro, converte mais — e não é opinião: é a diferença entre uma tela e quatro.

---

## 4. A página que demora

Três segundos de espera na tela do celular, no ponto de ônibus, é uma eternidade. Foto pesada demais, vídeo tocando sozinho na abertura, fonte que carrega antes do texto: tudo isso é tempo que o cliente não te deve.

Velocidade não é vaidade técnica. É a primeira promessa que a sua loja faz — se a página é lenta, a entrega também deve ser.

---

## 5. WhatsApp que não responde (ou responde às 23h)

Muita loja transformou o WhatsApp no seu principal canal de venda e o atende como quem responde recado de vizinho.

A conta é simples: se dez pessoas mandam mensagem no pico e três desistem por demora, o custo não foi o atendimento — foi o pedido. E, pior, foi o cliente que aprendeu que ali demora.

Ou tem gente dedicada no horário de pico, ou tem atendimento automatizado para as perguntas repetidas — horário, taxa de entrega, formas de pagamento, status do pedido. Quase toda mensagem de restaurante é uma de cinco perguntas.

---

## 6. Nenhum sinal de que a loja existe de verdade

Endereço, horário de funcionamento, telefone, fotos do salão, respostas às avaliações. Cada um desses é uma prova de vida.

Perfil sem endereço, sem horário e com a última publicação de oito meses atrás passa uma mensagem involuntária: talvez tenha fechado. E, na dúvida, ninguém pede.

---

## A ordem em que vale a pena arrumar

- **Primeiro: o cardápio que abre rápido e está certo.** Preço correto, item indisponível marcado, sem cadastro
- **Segundo: as fotos dos dez itens que mais saem.** Não o cardápio inteiro — os dez
- **Terceiro: a resposta no canal onde o cliente fala.** Automatize o repetitivo, reserve a pessoa para o resto
- **Quarto: as provas de vida.** Horário, endereço, avaliações respondidas
- **Só então: identidade visual, campanha, tráfego pago.** Investir em anúncio antes disso é pagar para mostrar o problema a mais gente

---

## Onde o MiseOn entra

- **Cardápio digital por QR Code**, que abre no navegador, sem aplicativo e sem taxa por pedido
- **Um lugar só para o preço**: alterou, vale na hora na mesa, no balcão e no delivery
- **Atendimento no WhatsApp pela API oficial da Meta** — as cinco perguntas de sempre respondidas na hora, a conversa difícil com gente
- **Item indisponível some do cardápio quando o estoque acaba**, em vez de virar frustração no fim do pedido

---

**Parecer profissional não é ter o site mais bonito. É não dar ao cliente nenhum motivo para desconfiar** — e quase todos os motivos são pequenos, baratos e corrigíveis nesta semana.
`,
  },
  {
    slug: 'padaria-da-dinheiro-onde-exatamente-esta-o-lucro',
    title: 'Padaria Dá Dinheiro: Onde Exatamente Está o Lucro',
    description: 'O pão francês enche a loja e quase não deixa margem. O lucro da padaria está na produção própria, no mix e no que acontece depois das dez da manhã.',
    category: 'Engenharia de Cardápio',
    publishedAt: '2026-09-16',
    readTime: '9 min de leitura',
    coverImage: '/blog-covers/padaria-onde-esta-o-lucro-cover.jpg',
    author: {
      name: 'Rafael Maldivas',
      role: 'Head de Engenharia e Arquitetura do MiseOn',
      avatar: '/icon-192.png',
    },
    tags: ['Padaria', 'Mix de Produtos', 'Produção Própria', 'Margem', 'Ficha Técnica'],
    seo: {
      title: 'Padaria Dá Dinheiro: Onde Está o Lucro de Verdade — MiseOn',
      description: 'O pão francês é isca, não lucro. Como separar produção própria de revenda, medir a margem por categoria e usar as horas ociosas da padaria.',
      keywords: 'padaria da lucro, margem padaria, producao propria padaria, mix de produtos padaria, ficha tecnica panificacao',
      canonicalUrl: 'https://miseon.app.br/blog/padaria-da-dinheiro-onde-exatamente-esta-o-lucro',
    },
    summary: 'Padaria é o negócio de food service com mais fluxo de gente e uma das margens mais mal distribuídas. O pão francês traz a cidade inteira para dentro e quase não deixa dinheiro; a margem está na produção própria, no salgado, na confeitaria e no horário que a loja hoje desperdiça. Este artigo separa o que é isca do que é lucro.',
    content: `
# Padaria Dá Dinheiro: Onde Exatamente Está o Lucro

Padaria é provavelmente o negócio de food service com mais fluxo de gente por metro quadrado no Brasil. E é também um dos que mais confunde movimento com resultado.

O motivo é estrutural: o produto que traz a cidade para dentro da loja é justamente o que menos deixa margem.

---

## O pão francês é isca, e isca não precisa dar lucro

O pão francês tem três características que, juntas, esmagam a margem:

- **Preço de referência público.** O cliente sabe quanto custa o quilo, e sabe quanto custa na padaria da esquina
- **Insumo de commodity.** Farinha é cotada; quando ela sobe, sobe para todo mundo, e o repasse é lento porque o preço é sensível
- **Mão de obra intensiva e horário cruel.** Alguém precisa estar assando às cinco da manhã

Isso não significa que ele deva sair do cardápio — significa que ele tem outra função. Ele é o motivo pelo qual duzentas pessoas entram na sua loja antes das nove da manhã. **O lucro não está na isca. Está no que entra na sacola junto.**

A pergunta certa não é "quanto ganho no pão", e sim "quanto sai de margem por cliente que veio buscar pão".

---

## As quatro padarias dentro da mesma padaria

Uma padaria não é um negócio. São quatro, com margens e horários completamente diferentes:

- **Panificação** — pão, produção própria, margem apertada, fluxo enorme
- **Revenda** — refrigerante, leite, bolacha, produto industrializado. Margem baixa e previsível, sem trabalho de produção. É conveniência, e conveniência é serviço, não fabricação
- **Salgados, lanches e almoço** — produção própria com margem maior, concentrada em duas janelas do dia
- **Confeitaria e encomenda** — bolo, doce, torta, festa. Margem alta, produção planejada, cliente que avisa antes

Somar as quatro num caixa só é o que produz a frase "a padaria vende muito e não sobra". Cada uma tem um custo, um horário e um limite diferente. Sem separação, não existe decisão: existe palpite.

---

## Revenda merece atenção separada

Produto industrializado tem uma margem que você não controla, um preço que o cliente compara com o mercado e um capital parado na prateleira.

Isso não o torna vilão: ele é conveniência, e conveniência prende cliente. Mas ele precisa ser tratado pelo que é — um serviço com giro, não uma fábrica. Refrigerante encalhado é dinheiro dormindo; refrigerante que gira é margem pequena muitas vezes.

O erro comum é encher a prateleira do que dá orgulho comprar em promoção e não do que gira.

---

## O que acontece com a sua loja entre 10h e 16h

A padaria tem dois picos claros — manhã e fim de tarde — e um vale enorme no meio.

Nesse vale, você continua pagando aluguel, energia, forno e equipe. Toda margem que sair dali é margem incremental: o custo fixo já foi pago pelos picos.

É esse o espaço do almoço executivo, do salgado de meio de tarde, do café com bolo, da encomenda que se produz enquanto a loja está vazia. Não é "vender mais". É usar uma capacidade que já está paga.

---

## A conta que separa isca de lucro

- **Classifique cada item em uma das quatro padarias.** Panificação, revenda, salgado/lanche, confeitaria
- **Faça a ficha técnica dos dez itens de produção própria que mais saem.** Farinha, fermento, gordura, recheio, embalagem — e o rendimento medido no SEU forno, não na tabela
- **Meça a perda de fim de dia por categoria.** Pão que sobra é dinheiro que já foi gasto: farinha, gás, hora de padeiro
- **Some a margem por categoria e divida pelo número de clientes.** Você vai descobrir quanto cada cliente que entra deixa de verdade
- **Olhe o vale do meio do dia.** Quanto de custo fixo está sendo pago por quantas vendas?

---

## O que dá para fazer nesta semana

- **Pare de tratar o pão como termômetro do negócio.** Ele é o convite, não a fatura
- **Ataque a perda de fim de dia com ajuste de produção, não com desconto.** Assar menos no último ciclo vale mais que remarcar
- **Coloque um item de margem alta no caminho da fila.** Quem veio buscar pão precisa esbarrar no que dá dinheiro
- **Trate encomenda como produto de verdade**, com prazo, sinal e ficha técnica
- **Refaça o custo quando a farinha subir.** Em padaria, reajuste não repassado corrói mais rápido que em qualquer outro segmento

---

## Onde o MiseOn entra

- **Ficha técnica com rendimento medido na sua loja** — massa que ganha ou perde peso no forno é o número que decide o custo do pão
- **Custo puxado da nota de compra**, para o preço da farinha desta semana valer na conta desta semana
- **Categoria por categoria**, com a margem separada entre o que você fabrica e o que você revende
- **Quando o dado não é confiável, o sistema diz o motivo** em vez de mostrar uma margem inventada

---

**Padaria dá dinheiro. Só que raramente no produto que leva o nome dela** — e enxergar isso é a diferença entre uma loja cheia e uma loja lucrativa.
`,
  },
  {
    slug: 'voce-nunca-olhou-para-um-buffet-desse-jeito',
    title: 'Você Nunca Olhou Para um Buffet Desse Jeito: a Engenharia do Balcão',
    description: 'Cada cuba do self-service ocupa um espaço que custa dinheiro. A ordem dos itens, a reposição e o fim do serviço decidem a margem do quilo.',
    category: 'Engenharia de Cardápio',
    publishedAt: '2026-09-16',
    readTime: '9 min de leitura',
    coverImage: '/blog-covers/buffet-engenharia-do-balcao-cover.jpg',
    author: {
      name: 'Rafael Maldivas',
      role: 'Head de Engenharia e Arquitetura do MiseOn',
      avatar: '/icon-192.png',
    },
    tags: ['Buffet', 'Self-Service', 'Venda por Quilo', 'Reposição', 'Perda'],
    seo: {
      title: 'A Engenharia do Balcão do Buffet: Cuba, Ordem e Perda — MiseOn',
      description: 'No self-service o cardápio é o balcão. Como a ordem das cubas, o tamanho da porção reposta e o fim do serviço decidem a margem do quilo.',
      keywords: 'buffet por quilo margem, self service restaurante gestao, reposicao buffet perda, engenharia de cardapio buffet, custo por cuba',
      canonicalUrl: 'https://miseon.app.br/blog/voce-nunca-olhou-para-um-buffet-desse-jeito',
    },
    summary: 'No self-service o cliente monta o prato e o dono descobre o resultado só no fim do dia. Mas o balcão é um cardápio: a ordem das cubas, o tamanho da porção reposta e a decisão da última hora de serviço movem a margem mais do que qualquer tabela de preço. Este artigo trata o balcão como engenharia.',
    content: `
# Você Nunca Olhou Para um Buffet Desse Jeito: a Engenharia do Balcão

No restaurante à la carte, o cliente escolhe de uma lista que você escreveu. No self-service, ele monta o próprio prato — e a sensação é de que o dono perdeu o controle da margem.

Não perdeu. Só que o cardápio deixou de ser um papel e virou **o balcão**: a ordem das cubas, o tamanho de cada uma, a colher que você coloca em cada item e a hora em que a reposição para.

Isso é engenharia, e quase ninguém trata assim.

---

## O balcão é um cardápio com ordem obrigatória

A pessoa entra com o prato vazio e passa por todos os itens na sequência em que você os dispôs. Diferente do cardápio impresso, aqui ela **não pode pular** a primeira página.

Isso significa que a posição de cada item é uma decisão econômica:

- O que está no começo do balcão entra no prato quando ele está vazio — e o prato vazio aceita mais
- O que está no fim disputa espaço com o que já foi servido
- O que está na altura dos olhos sai mais do que o que está embaixo

Arroz, massa, salada e guarnição de custo baixo na entrada; proteína nobre depois do prato já ter volume. Não é para enganar ninguém: é a mesma lógica de qualquer cardápio bem montado, aplicada ao espaço em vez do papel.

---

## Cada cuba ocupa um espaço que custa dinheiro

Um balcão tem um número fixo de cubas. Isso é o seu estoque de vitrine, e ele é finito.

Cada cuba ocupada por um item que sai pouco é uma cuba que não está ocupada por um item que sai muito. Além do espaço, ela custa:

- **Produção** — alguém preparou aquilo
- **Energia** — banho-maria ou refrigeração ligados o serviço inteiro
- **Perda** — o que sobrar dali dificilmente volta amanhã igual

Um item que sai pouco e sobra sempre não é variedade: é custo fixo disfarçado de escolha. Medir a saída por cuba, por dia da semana, é a informação mais barata e mais ignorada do self-service.

---

## A reposição decide a perda antes de ela existir

A pergunta que define a margem do dia não é quanto produzir. É **quanto repor de cada vez, e até que horas**.

Cuba cheia às 14h30 é bonita para quem chega e é prejuízo garantido para quem fecha. Cuba vazia às 12h20 é venda perdida e cliente irritado.

O caminho do meio é repor pouco e com frequência no fim do serviço, trocando recipiente grande por menor, e concentrar o item caro nas duas primeiras horas. Isso exige uma decisão consciente — e alguém encarregado dela —, não o hábito de "deixar bonito até o fim".

---

## Perda de fim de serviço é o CMV que ninguém lança

O que sobra na cuba já consumiu compra, preparo, gás e mão de obra. Ele é custo cheio com receita zero.

Mesmo assim, quase nenhuma operação pesa a sobra. Sem pesar, a perda vira "sensação de que sobrou bastante hoje" — e sensação não entra em planilha, não vira decisão e não corrige a produção de amanhã.

Pesar a sobra por item, ainda que por duas semanas, costuma reorganizar o balcão inteiro.

---

## O preço do quilo e o prato médio

O preço do quilo é único, mas o custo do prato não é: ele depende do que o cliente colocou.

Isso quer dizer que a sua margem real é determinada pelo **prato médio** — a composição que a maioria monta. E o prato médio responde ao balcão: ordem, volume das cubas, presença de itens de saciedade barata, temperatura e aparência.

Mexer no balcão é mexer no prato médio. É a alavanca mais forte que o self-service tem, e não custa nada além de atenção.

---

## O peso que muda depois do fogo

Uma última peça, que o cliente nunca vê: o alimento muda de peso ao ser preparado.

Arroz ganha peso ao cozinhar. Carne perde na aparação e perde de novo na chapa. Isso significa que o custo por quilo **servido** não é o custo por quilo **comprado** — e a diferença não é pequena.

Quem calcula o custo do buffet pelo preço de compra está errando em todos os itens ao mesmo tempo, uns para mais, outros para menos. O número certo sai do rendimento medido na própria cozinha.

---

## O que dá para fazer nesta semana

- **Pese a sobra de cada cuba no fim do serviço, por duas semanas.** Só isso já paga o trabalho
- **Reorganize a ordem do balcão** pensando no prato vazio que passa por ele
- **Troque a cuba grande por duas menores no último terço do serviço**
- **Tire da linha o item que sobra sempre e sai pouco.** Variedade que não sai é perda com nome bonito
- **Meça o rendimento dos cinco itens mais caros na sua cozinha.** Comprado não é servido

---

## Onde o MiseOn entra

- **Rendimento medido pela loja vence a tabela de referência** — ganho e perda, porque arroz cozido pesa mais e carne pesa menos
- **Custo por item com a nota de compra por trás**, para o preço do quilo acompanhar a realidade
- **Venda por peso conserva o preço praticado do quilo**, sem reprecificar por fora o que a balança já resolveu
- **Quando o custo não é confiável, o sistema mostra o motivo** em vez de fingir precisão

---

**No self-service, o cardápio não é escrito: é montado em aço inox, todo dia, por quem repõe.** Quem enxerga o balcão como engenharia decide a margem antes de o primeiro cliente pegar o prato.
`,
  },
  {
    slug: 'loja-lotada-divida-enorme-por-que-fila-na-porta-nao-e-lucro',
    title: 'Loja Lotada, Dívida Enorme: Por Que Fila na Porta Não Significa Dinheiro no Caixa',
    description: 'Movimento mede quantas vezes a operação rodou; margem mede quanto sobrou de cada vez. Os cinco mecanismos que fazem uma loja cheia acumular dívida — e a conta que revela o buraco em uma tarde.',
    category: 'Gestão Financeira',
    publishedAt: '2026-09-16',
    readTime: '9 min de leitura',
    coverImage: '/blog-covers/loja-lotada-divida-enorme-cover.jpg',
    author: {
      name: 'Rafael Maldivas',
      role: 'Head de Engenharia e Arquitetura do MiseOn',
      avatar: '/icon-192.png',
    },
    tags: ['Capital de Giro', 'CMV Real', 'Ficha Técnica', 'Precificação', 'Gestão Financeira'],
    seo: {
      title: 'Loja Lotada e Dívida Enorme: Fila na Porta Não é Lucro — MiseOn',
      description: 'Por que restaurante cheio acumula dívida: margem unitária negativa, capital de giro e preço copiado do vizinho. A conta que mostra o vazamento em uma tarde.',
      keywords: 'restaurante cheio sem lucro, capital de giro restaurante, margem negativa food service, precificacao ficha tecnica, por que restaurante quebra, cmv real restaurante',
      canonicalUrl: 'https://miseon.app.br/blog/loja-lotada-divida-enorme-por-que-fila-na-porta-nao-e-lucro',
    },
    summary: 'Movimento e margem são números diferentes, e não existe lei que obrigue o segundo a crescer junto com o primeiro. Quando a margem por item está negativa, o volume não salva: ele multiplica. Este artigo abre os cinco mecanismos por trás da loja cheia com o caixa vazio e entrega, passo a passo, a conta que encontra o vazamento nos dez itens que mais saem.',
    content: `
# Loja Lotada, Dívida Enorme: Por Que Fila na Porta Não Significa Dinheiro no Caixa

Existe uma cena que todo mundo do food service já viu, e quase ninguém explica direito: a loja vive cheia, a fila dobra a esquina, o movimento é inveja do bairro — e o dono não dorme, porque deve.

Não é contradição. É contabilidade.

Movimento é uma medida de **quantas vezes a operação rodou**. Margem é uma medida de **quanto sobrou de cada vez que ela rodou**. São dois números diferentes, e não existe nenhuma lei que obrigue o segundo a crescer junto com o primeiro. Quando a margem por item está negativa, o movimento não salva: ele acelera a queda.

Este artigo destrincha os cinco mecanismos que produzem essa cena e mostra a conta que revela o buraco — a mesma conta, feita à mão, que um sistema de gestão faz todo dia.

---

## O paradoxo: quanto mais vende, mais afunda

Imagine um combo vendido a R$ 32,00. O dono acredita que ele custa R$ 12,00 de insumo. Então acredita que sobram R$ 20,00 por venda.

Só que a ficha técnica nunca foi medida de verdade. O pão subiu na última compra, o queijo veio em embalagem de 2,5 kg e o rendimento foi estimado no olho, a carne perde peso na chapa, e a embalagem do delivery entrou depois — sem ninguém recalcular o preço.

O custo real é R$ 21,40. Sobram R$ 10,60, não R$ 20,00.

Agora multiplique pelos dois cenários:

- **150 combos por dia**: a distância entre o que ele acha que ganha e o que ganha é de R$ 1.410,00 por dia
- **300 combos por dia**: a distância dobra, para R$ 2.820,00 por dia

O erro não é de R$ 9,40. O erro é de R$ 9,40 **vezes o movimento**. É por isso que dobrar a fila pode dobrar o rombo: volume é um multiplicador, e ele não pergunta se o número que está multiplicando é positivo ou negativo.

Os valores acima são um exemplo aritmético, não a medição de uma loja específica. O que importa aqui é a estrutura da conta — e ela vale para qualquer cardápio.

---

## 1. O preço veio do vizinho, não da ficha técnica

A forma mais comum de precificar no Brasil é olhar quanto o concorrente cobra e ficar um pouco abaixo. Isso não é estratégia: é uma aposta de que o custo dele é igual ao seu.

Quase nunca é. Ele compra em outro volume, negocia outro prazo, paga outro aluguel, tem outra perda e talvez outro rendimento na mesma receita. Copiar o preço do vizinho é copiar a resposta de uma conta cujos números você nunca viu.

Preço honesto nasce de baixo para cima: custo do insumo na embalagem que você comprou, rendimento medido na sua cozinha, perda real do seu processo, e só então a margem que você decidiu praticar.

---

## 2. O prazo do dinheiro não bate com o prazo da conta

Este é o mecanismo mais cruel, porque derruba operações que **são** lucrativas.

Olhe o calendário de uma venda no cartão:

- O cliente come hoje
- O fornecedor de proteína vence em 7 dias
- A folha vence no dia 5
- A maquininha credita em 30 dias

A operação pode ter margem positiva e mesmo assim faltar dinheiro no dia 5 — porque o lucro existe, só que ainda não chegou. Quando isso vira rotina, entram o cheque especial, a antecipação de recebíveis e o empréstimo curto. Cada um resolve a semana e piora o ano.

Lucro é uma opinião sobre o mês. Caixa é um fato sobre o dia.

---

## 3. O que o volume faz com um erro pequeno

Um erro de R$ 0,80 por prato parece desprezível. Ninguém briga por oitenta centavos.

Some assim: 200 pratos por dia, 26 dias por mês.

**R$ 0,80 × 200 × 26 = R$ 4.160,00 por mês.**

É um salário evaporando dentro de um arredondamento que ninguém enxerga — porque ele nunca aparece numa linha só. Ele aparece diluído em 5.200 vendas.

É também por isso que vender mais é o conselho errado para quem está nessa situação. Vender mais multiplica o que já existe. Se o que existe é um vazamento, o conselho certo é medir primeiro.

---

## 4. A dívida cara vira sócia majoritária

Quando o capital de giro falta com frequência, a loja passa a operar com dinheiro de terceiro caro — e o custo financeiro deixa de ser um evento para virar despesa fixa.

O efeito é perverso: a partir de certo ponto, uma parte do faturamento já está comprometida antes de o primeiro cliente sentar. A loja continua cheia, continua vendendo, e a dívida continua lá — porque dívida não é paga com movimento. É paga com **margem**.

---

## 5. O que não é medido vira sensação

Sem ficha técnica, sem CMV apurado e sem custo por item, o dono administra por sensação: esse prato deve dar dinheiro, acho que o desperdício aumentou, parece que a carne subiu.

Sensação erra numa direção previsível: ela subestima o custo e superestima a margem, porque ninguém tem memória afetiva do que perdeu na aparação, no cozimento, na embalagem e na troca de pedido errado.

Um número honesto é sempre melhor que uma certeza confortável. E quando não dá para medir, a resposta certa é **não sei** — nunca um percentual inventado.

---

## A conta que revela o buraco em uma tarde

Você não precisa de sistema nenhum para começar. Precisa de disciplina e de uma tarde:

- **Escolha os 10 itens que mais saem.** Em quase todo cardápio, poucos itens respondem pela maior parte do faturamento
- **Abra a nota fiscal da última compra de cada insumo.** Não o preço que você lembra: o preço da nota, na embalagem que chegou
- **Meça o rendimento na sua cozinha.** Quanto sai de carne limpa de uma peça inteira? Quanto o arroz ganha ao cozinhar? Isso muda o custo por porção mais do que qualquer negociação
- **Some a embalagem, o descartável e o molho de cortesia.** Não estão na receita, mas estão na conta
- **Subtraia tudo do preço de venda.** O que sobrou é a margem real daquele item
- **Multiplique pela quantidade vendida no mês.** Agora você tem a contribuição real de cada item — e talvez descubra que alguns campeões de venda são os que menos deixam dinheiro

Se algum item der margem negativa, você encontrou o motivo da loja cheia com o caixa vazio.

---

## O que dá para fazer nesta semana

- **Corrija o preço dos itens negativos, ou tire-os do cardápio.** Item que dá prejuízo não se conserta no volume
- **Renegocie prazo antes de renegociar preço.** Trinta dias a mais no fornecedor costumam valer mais que 3% de desconto
- **Separe o dinheiro do dia do dinheiro do mês.** O caixa do dia paga a operação; o resto já tem dono e data
- **Pare de antecipar recebível por hábito.** Antecipação é remédio de emergência, não regime alimentar
- **Refaça a ficha técnica quando o insumo subir.** Reajuste de fornecedor não repassado é o vazamento mais silencioso do setor

---

## Onde o MiseOn entra

O MiseOn existe para que essa conta deixe de ser uma tarde de trabalho e vire a tela que você abre de manhã:

- **Ficha técnica com custo real**, puxando o preço da nota de compra que entrou no estoque
- **Rendimento medido pela loja vence a tabela de referência** — o que a sua cozinha mediu vale mais do que qualquer média de mercado
- **Custo por item e margem por produto**, com um detalhe que faz diferença: quando o dado não é confiável, o sistema mostra **o motivo** em vez de exibir um percentual inventado
- **Entrada de estoque pelo QR Code do cupom fiscal**, para que o preço que entra na conta seja o preço que você pagou de verdade

Movimento é bom. Movimento com margem medida é negócio.

---

**A fila na porta é a prova de que a sua comida presta. A margem na tela é a prova de que o negócio presta.** As duas provas são necessárias — e só uma delas aparece sozinha.
`,
  },
  {
    slug: 'calculadora-vazamento-de-caixa-diagnostico-operacional-restaurantes',
    title: 'Calculadora de Vazamento de Caixa: Como Identificar e Estancar Perdas Invisíveis no seu Restaurante',
    description: 'Saiba como pequenos desvios de CMV, faltas de estoque no rush e reajustes de fornecedores não repassados consomem até R$ 5.500/mês da margem do seu estabelecimento.',
    category: 'Gestão Financeira',
    publishedAt: '2026-09-03',
    readTime: '8 min de leitura',
    coverImage: '/blog-covers/calculadora-vazamento-cover.jpg',
    author: {
      name: 'Rafael Maldivas',
      role: 'Head de Engenharia e Arquitetura do MiseOn',
      avatar: '/icon-192.png',
    },
    tags: ['Vazamento de Caixa', 'Calculadora Interativa', 'CMV Real', 'Diagnóstico Operacional', 'Gestão Financeira'],
    seo: {
      title: 'Calculadora de Vazamento de Caixa & Diagnóstico Operacional — MiseOn',
      description: 'Descubra quanto dinheiro seu restaurante perde todo mês sem perceber. Use nossa calculadora interativa e aprenda a estancar vazamentos de caixa.',
      keywords: 'calculadora vazamento caixa restaurante, diagnostico operacional food service, perdas invisiveis restaurante, cmv real restaurante, gestão financeira restaurante',
      canonicalUrl: 'https://miseon.app.br/blog/calculadora-vazamento-de-caixa-diagnostico-operacional-restaurantes',
    },
    summary: 'A maioria dos donos de restaurantes sabe quanto faturou ontem, mas não consegue explicar exatamente quanto sobrou no bolso. Neste artigo, detalhamos a matemática por trás da Calculadora de Vazamento de Caixa do MiseOn e apresentamos o Diagnóstico Operacional de 4 passos para estancar perdas invisíveis.',
    content: `
# Calculadora de Vazamento de Caixa: Como Identificar e Estancar Perdas Invisíveis no seu Restaurante

Se você administra um restaurante, hamburgueria, pizzaria ou buffet por quilo no Brasil, provavelmente já viveu esta situação angustiante:

> *"As mesas estavam cheias, as entregas saíram sem parar e o faturamento do mês bateu R$ 60.000 ou R$ 100.000. Porém, ao fechar as contas no dia 5, sobrou quase nada no caixa."*

Para onde foi o dinheiro?

Na maioria das vezes, o dinheiro não sumiu em um grande roubo ou em um desastre isolado. Ele escapou aos poucos, em **vazamentos silenciosos e invisíveis na rotina diária**.

---

## Os 4 Vazamentos Silenciosos do Food Service

### 1. O Aumento Surpresa do Fornecedor
O preço da carne, do queijo prato ou do óleo de fritura subiu 8% no distribuidor. Como você não atualiza a ficha técnica dinamicamente a cada nota, você continua vendendo o prato pelo preço antigo durante 3 a 4 semanas. **Resultado**: sua margem de contribuição despenca de 60% para 38% sem ninguém perceber.

### 2. A Ilusão do Estoque no Olhômetro
A memória ou a planilha dizia que havia insumos suficientes para o fim de semana. No meio do pico de sábado às 21h30, o ingrediente principal acaba. A cozinha improvisa, compra no mercado de bairro pagando 40% mais caro ou perde o cliente.

### 3. O Caos no Pico e Comandas Reffeitas
Pedidos do iFood, WhatsApp e balcão se misturam. Comandas de papel rasuram, o ponto da carne sai errado e pratos inteiros vão para o lixo. Um prejuízo médio de R$ 35,00 por comanda errada repetido 4 vezes por semana resulta em **R$ 560,00/mês jogados fora**.

### 4. O Mistério do Fechamento de Caixa
O caixa bateu no final do turno, mas o DRE do mês não fecha porque as taxas de cartão de crédito, comissões de delivery e frete por km não foram abatidas pedido a pedido.

---

## Como Funciona a Calculadora Interativa MiseOn

Para ajudar empresários da gastronomia a enxergar esses números com clareza, desenvolvemos a **Calculadora Interativa de Vazamento de Caixa** na página principal do MiseOn.

Nela, você pode ajustar 4 sliders simples com a realidade da sua loja:
1. **Faturamento Mensal** (ex: R$ 50.000, R$ 100.000 ou R$ 150.000).
2. **Desperdício em Pré-Preparo e Validades** (médias entre 2% e 6%).
3. **Aumento de Insumos Não Repassado** (reajustes de fornecedores).
4. **Erros de Comanda por Semana** (pratos refeitos na cozinha).

O algoritmo calcula a sangria estimada do seu caixa por mês e por ano — e mostra como uma plataforma com **baixa por Ficha Técnica PEPS**, **KDS sem papel** e **entrada por NFC-e** se paga cerca de 10x a 30x todo mês ao estancar essas perdas.

---

## Como Estancar Esses Vazamentos em Menos de 24 Horas

1. **Faça o Diagnóstico Operacional** na Home do MiseOn marcando os gargalos do seu estabelecimento.
2. **Cadastre sua Loja Grátis por 30 Dias** sem necessidade de cartão de crédito.
3. **Escaneie a nota do mercado pelo celular (NFC-e)** e deixe o sistema atualizar seu estoque e o custo real dos pratos automaticamente.

Não deixe sua margem de lucro escorrer pelo ralo. Coloque a engenharia de dados do MiseOn para trabalhar a favor do seu restaurante!
`,
  },
  {
    slug: 'dark-kitchen-hamburgueria-gestao-multi-marcas-logistica-delivery',
    title: 'Dark Kitchens e Hamburguerias de Escala: Como Operar Multi-Marcas no Mesmo Estoque com KDS Centralizado',
    description: 'Guia de engenharia de delivery: o que o modelo multimarcas exige de um sistema, o que o MiseOn entrega hoje (estoque único por loja, KDS por estação e selo de canal) e o que ainda está no roadmap.',
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
      description: 'O modelo de dark kitchen multimarcas, o que ele exige de sistema e o que o MiseOn entrega hoje: estoque único por loja, KDS por estação e faturamento separado por canal de origem.',
      keywords: 'dark kitchen brasil, hamburgueria delivery kds, sistema multi marcas delivery, comanda digital hamburgueria, gestão de dark kitchen',
      canonicalUrl: 'https://miseon.app.br/blog/dark-kitchen-hamburgueria-gestao-multi-marcas-logistica-delivery',
    },
    summary: 'Operar uma Dark Kitchen ou hamburgueria de alto volume exige máxima eficiência por metro quadrado. Veja o que o modelo multimarcas cobra de um sistema, como o MiseOn trata insumo compartilhado, roteamento por praça de produção e tempo de expedição — e onde estão os limites do que ele faz hoje.',
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

**O que o MiseOn faz hoje — e o que ele ainda não faz.** Vale ser exato aqui, porque essa é a diferença entre um sistema que te ajuda e uma promessa que você descobre quebrada no primeiro sábado:

- O estoque de insumos (ex: *Lote de Blend de Carne 160g*) é **único e centralizado por loja**, e a baixa sai da ficha técnica pelo custo PEPS do lote que entrou.
- Se as suas linhas de produto convivem **no mesmo cardápio** — Smash, Artesanal e Porções como categorias da mesma loja —, tudo isso já funciona: mesmo saldo de carne, mesmo CMV, mesmo DRE.
- O que **não existe hoje** é cadastro de marcas virtuais separadas dentro de uma mesma loja: não há troca de marca no painel, logotipo por marca no pedido nem faturamento quebrado por marca no DRE. O corte que o MiseOn entrega é **por canal de origem** (iFood, cardápio próprio, WhatsApp, balcão), não por marca.
- Marca virtual como entidade própria está no roadmap. Enquanto não estiver no produto, não vamos dizer que está.

---

## 2. Roteamento Inteligente de Pedidos no KDS Central

Na chapa durante o pico das 21h de domingo, o chapeiro não pode ficar olhando para 3 celulares ou 4 impressoras térmicas diferentes cuspindo papel.

O **KDS do MiseOn** unifica todas as origens em um único painel central:

1. **Selo de origem no card**: cada pedido no KDS mostra de onde veio — iFood, cardápio próprio, WhatsApp ou balcão — para a cozinha saber a régua de tempo e o faturamento sair separado por canal. É selo de canal, não de marca.
2. **Agrupamento por Praça de Produção**:
   - **Chapa**: Recebe apenas as carnes que devem ir para a grelha/chapa com a gramatura e ponto indicados.
   - **Fritadeira**: Recebe as porções de batata, anéis de cebola e nugggets.
   - **Montagem & Embalagem**: exibe o pedido completo para o expedidor conferir antes de lacrar.

---

## 3. Gestão do Tempo de Despacho e Atribuição de Entregadores

Em uma Dark Kitchen, o cliente não está vendo a cozinha. A única experiência dele é a velocidade e a temperatura em que o lanche chega na casa dele.

O MiseOn integra a esteira de despacho:
- **Status em Tempo Real**: assim que a embalagem recebe o lacre, o operador toca no botão **"PRONTO PARA EXPEDIÇÃO"** e o pedido some da fila de produção.
- **Aviso no WhatsApp**: pedido que nasceu no WhatsApp recebe automaticamente a confirmação com o link de acompanhamento quando é aceito. Nos demais canais o aviso ao cliente e ao entregador é disparado pela tela de Entregas, com um toque — não é automático em toda mudança de status.
- **Controle de Tempo de Balcão**: a tela de expedição conta o tempo de cada ficha e acende **ATENÇÃO aos 10 minutos** e **ATRASADO aos 20**, para o gerente intervir antes do cliente reclamar.

Com o MiseOn, sua Dark Kitchen ganha controle de custo e de tempo sem trocar de sistema a cada canal novo.
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

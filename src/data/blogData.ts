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
  /**
   * Texto pronto esperando a capa fotográfica (ver scripts/gerar-capas-ia.mjs).
   *
   * Rascunho some do hub, do sitemap e do prerender — publicar artigo com capa
   * provisória enche o blog de cartão que destoa das fotos e estraga a página
   * inteira. Gerou a foto? apague esta linha do artigo e publique.
   */
  rascunho?: boolean;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'loja-lotada-divida-enorme-por-que-fila-na-porta-nao-e-lucro',
    rascunho: true,
    title: 'Fila na Porta, Dívida de R$ 3 Milhões: o Que a Doceria do Kléber Ensina',
    description: 'Duas docerias na mesma rua: uma vazia, a outra com fila dobrando a esquina. A que tem fila deve R$ 3 milhões. A história mostra, passo a passo, como se aprende a vender antes de aprender a administrar.',
    category: 'Gestão Financeira',
    publishedAt: '2026-09-16',
    readTime: '10 min de leitura',
    coverImage: '/blog-covers/doceria-kleber.jfif',
    author: {
      name: 'Rafael Maldivas',
      role: 'Head de Engenharia e Arquitetura do MiseOn',
      avatar: '/icon-192.png',
    },
    tags: ['Capital de Giro', 'Margem por Canal', 'Gestão Financeira', 'Delivery', 'Processos'],
    seo: {
      title: 'Fila na Porta e Dívida de R$ 3 Milhões: o Caso da Doceria — MiseOn',
      description: 'A doceria vive cheia e deve R$ 3 milhões. O que o caso do Kléber mostra sobre margem por canal, produto errado na loja certa e o dono que virou herói.',
      keywords: 'restaurante cheio sem lucro, divida restaurante, margem delivery aplicativo, capital de giro food service, gestao de doceria',
      canonicalUrl: 'https://miseon.app.br/blog/loja-lotada-divida-enorme-por-que-fila-na-porta-nao-e-lucro',
    },
    summary: 'Uma doceria com fila dobrando a esquina e R$ 3 milhões em dívida: o caso documentado pelo jornalista Marcelo Baccarini é o retrato mais honesto de um problema comum no food service brasileiro — a habilidade de vender chega antes da habilidade de administrar. Este artigo destrincha os quatro pontos em que a conta se perdeu e o que cada um deles ensina a quem tem loja cheia e caixa magro.',
    content: `
# Fila na Porta, Dívida de R$ 3 Milhões: o Que a Doceria do Kléber Ensina

Duas docerias, uma de frente para a outra. Uma vazia. A outra com uma fila que dobra a esquina e não para de crescer, porque fila atrai fila.

A cheia é do Kléber. E ela deve R$ 3 milhões.

O caso foi documentado numa reportagem do jornalista Marcelo Baccarini, e vale como estudo porque não é o roteiro de sempre — aquele em que o negócio vai mal porque não aparece cliente. Aqui o cliente aparece, o produto funciona, o mercado existe. O que não existe é a conta fechando.

A frase que resume está na própria reportagem: é a história de quem **aprendeu a vender antes de aprender a administrar**. Vale a pena percorrer os quatro pontos em que a coisa entortou, porque nenhum deles é exclusividade da doceria dele.

---

## Ponto 1: no delivery, o aplicativo virou o sócio majoritário

Antes da loja física, o Kléber vendia doces por aplicativo direto de casa. Chegou a R$ 150 mil por mês — número que faria qualquer um comemorar.

Só que, segundo o próprio, de cada R$ 1.000 vendidos, cerca de **R$ 600 ficavam com a plataforma e R$ 400 com ele**. E aí vem a parte que quase ninguém calcula: dos R$ 400 ainda saía o custo do doce, a embalagem, a mão de obra e o imposto.

Faturamento alto com margem invertida não é crescimento: é volume de trabalho crescendo mais rápido que o dinheiro. O nome disso é armadilha justamente porque o painel mostra um número que sobe.

**O que isso ensina:** faturamento por canal é dado bruto. O que decide é a margem **depois** da comissão, da embalagem e do imposto — e ela precisa ser calculada canal por canal, não no bolo do fim do mês.

---

## Ponto 2: loja certa, produto errado

Sem dinheiro, sem fiador e sem depósito, ele montou a loja física. E cometeu um erro que parece pequeno e custou caro: **levou para o balcão um produto que era de delivery**, o bolo de pote.

Bolo de pote funciona na moto. Na loja, ninguém fotografa, ninguém posta, ninguém leva a amiga para ver. O ponto físico cobra aluguel para vender experiência, e ele estava pagando aluguel para vender conveniência.

Resultado, nos números que ele mesmo dá: **despesa de R$ 80 mil para uma loja que vendia R$ 60 mil**. Dois meses assim já abrem um buraco que a operação não tapa sozinha. Veio o crédito. Depois o crédito para pagar o crédito.

**O que isso ensina:** cada canal pede um produto. O que vende no aplicativo não é automaticamente o que vende no balcão, e um cardápio único para canais diferentes costuma servir mal aos dois.

---

## Ponto 3: o produto mudou e o ticket mudou junto

A virada veio quando ele trocou o brigadeiro de R$ 10 pela fatia gigante de R$ 70 — a que tem pudim inteiro em cima, a que as pessoas filmam antes de comer.

Não foi só preço: foi outro produto, com outra proposta e outro motivo para sair de casa. O exagero virou o convite, e o convite virou fila.

Essa parte deu certo. E é importante dizer que deu certo, porque a lição do caso não é "cresça devagar". É que crescer em venda sem crescer em gestão só aumenta a escala do problema que já existia.

---

## Ponto 4: a empresa que depende de um herói

Com a fila na porta, apareceu a segunda conta. Nas palavras dele: passa a madrugada produzindo para o fim de semana, lava louça, atende cliente, ajuda na cozinha, tira lixo, faz a folha, contrata.

Há uma frase na reportagem que devia estar pregada na parede de toda cozinha: **empresa forte depende de processo; empresa frágil depende de herói.**

E o custo do herói aparece em lugares inesperados. Para reduzir falta de funcionário, a doceria paga **R$ 600 de bônus por mês para quem não faltar**. É uma solução honesta para um problema real — e também o sintoma de uma operação que não tem folga para absorver uma ausência.

---

## A conta da dívida, sem retórica

Os números da reportagem fecham o raciocínio:

- Faturamento da loja: **R$ 300 mil por mês**
- Sobra: **R$ 30 mil por mês**
- Dívida: **R$ 3 milhões**

Se cada centavo que sobra fosse para a dívida, e ele não tirasse um real para viver, seriam **mais de oito anos**. Sem contar juros. Com juros, a conta não fecha — e os credores sabem que empresa fechada não paga ninguém.

Não é um caso de má-fé nem de preguiça. É um caso de operação boa e engenharia financeira ausente, mantida por alguém que continua tentando: ele separa o necessário para 13º e férias e negocia o resto, dívida por dívida.

---

## O que um dono de restaurante tira daqui, hoje

- **Meça a margem por canal, não o faturamento por canal.** Comissão, embalagem, taxa e imposto saem do mesmo prato
- **Não leve para o balcão o produto que foi desenhado para a moto.** E vice-versa
- **Saiba o custo real do carro-chefe.** Ficha técnica com o preço da nota de compra, não com o preço que você lembra
- **Escreva o processo antes de precisar dele.** O que hoje só você sabe fazer é o que vai travar a loja no dia em que você não estiver
- **Separe o caixa do dia do dinheiro do mês.** Dívida não se paga com movimento: paga-se com margem
- **Antes de aumentar a produção, confirme que cada unidade a mais deixa dinheiro.** Se não deixar, vender mais é afundar mais rápido

---

## Onde o MiseOn entra nessa história

O MiseOn não renegocia dívida. Ele existe para que a conta que estourou nessa história seja visível **antes** de estourar:

- **Ficha técnica com custo real**, puxando o preço da nota de compra que entrou no estoque — o custo do doce de hoje, não o do semestre passado
- **Margem por produto e por canal**, porque o pedido do aplicativo carrega o preço com markup do canal e não pode ser misturado com a venda do balcão
- **Rendimento medido na sua cozinha** vencendo qualquer tabela de referência
- **Quando o dado não é confiável, o sistema diz o motivo** em vez de exibir um percentual bonito e falso

A fila do Kléber prova que o produto dele presta. O que falta é a segunda prova — e essa não aparece no salão, aparece na conta.

---

**Fonte:** caso documentado em reportagem de Marcelo Baccarini. Os números citados são os apresentados pelos entrevistados.
`,
  },
  {
    slug: 'delivery-da-dinheiro-a-conta-por-canal-que-quase-ninguem-faz',
    rascunho: true,
    title: 'R$ 31,49 na Tela, R$ 12 na Conta: a Matemática do Delivery que Ninguém Mostra',
    description: 'O cliente paga um preço, a loja recebe outro. Comissão, taxas, preço inflado para dar desconto, nota abaixo de 4.6 e o pedido que some por falta de entregador — o jogo do delivery com os números de quem vive dele.',
    category: 'Gestão Financeira',
    publishedAt: '2026-09-16',
    readTime: '12 min de leitura',
    coverImage: '/blog-covers/matemática-delivery.jpg',
    author: {
      name: 'Rafael Maldivas',
      role: 'Head de Engenharia e Arquitetura do MiseOn',
      avatar: '/icon-192.png',
    },
    tags: ['Delivery', 'iFood', 'Margem por Canal', 'Ficha Técnica', 'Canal Próprio'],
    seo: {
      title: 'Delivery: R$ 31,49 na Tela e R$ 12 na Conta — a Conta Real — MiseOn',
      description: 'Comissão de 26% a 40%, preço inflado para dar desconto, nota 4.6 e pedido perdido por falta de motoboy. A matemática do delivery com números de quem vive dele.',
      keywords: 'margem delivery ifood, comissao ifood quanto e, delivery da lucro, canal proprio restaurante, ficha tecnica marmita, cmv delivery',
      canonicalUrl: 'https://miseon.app.br/blog/delivery-da-dinheiro-a-conta-por-canal-que-quase-ninguem-faz',
    },
    summary: 'Numa reportagem sobre delivery, uma dona de loja mostra a conta na tela: o prato sai por R$ 31,49 e ela recebe R$ 12. Em outro item, R$ 44 viram R$ 22. Este artigo reúne o que a apuração mostrou — comissões, taxas, o truque do preço inflado, o algoritmo da nota e o pedido que evapora por falta de entregador — e traduz cada ponto em decisão para quem vende comida.',
    content: `
# R$ 31,49 na Tela, R$ 12 na Conta: a Matemática do Delivery que Ninguém Mostra

Numa reportagem do jornalista Marcelo Baccarini sobre o delivery brasileiro, uma cena vale mais que qualquer planilha: a empresária mostra o prato na tela do aplicativo, R$ 31,49, e diz quanto cai na conta dela. **R$ 12.**

Não é caso isolado. No mesmo material, o caldo verde sai por R$ 29,90 e retorna entre R$ 9 e R$ 12. A porção de batata sai por R$ 44 e devolve R$ 22 — exatamente metade.

Quem olha o extrato do aplicativo vê faturamento. Quem olha a conta bancária vê outra coisa. Entre um e outro existe uma engrenagem que vale a pena abrir peça por peça, porque cada uma delas tem uma decisão do outro lado.

---

## Peça 1: a comissão não vem sozinha

A comissão das plataformas citada na reportagem varia conforme o plano e a promoção: **26%, 30%, até 40%**.

Mas o desconto da plataforma raramente é uma linha só. Há taxa de entrega, custo logístico, taxa de pagamento, taxa de serviço. Cada uma parece pequena; juntas, explicam por que R$ 44 viram R$ 22.

E há um detalhe que muda a conta: a comissão incide sobre o valor cheio da venda — não sobre o que sobra para você.

**A decisão:** o preço no aplicativo não pode ser o preço do balcão. Se for, você está vendendo com markup de canal negativo — e quanto mais vender, pior.

---

## Peça 2: o preço que sobe para poder descer

A reportagem mostra o mesmo macarrão com dois preços: um no aplicativo, outro no canal próprio, onde sai por cerca de R$ 25.

O mecanismo é explicado sem rodeios por quem está dentro: para aparecer na plataforma é preciso dar desconto, e para dar desconto sem sangrar é preciso subir o preço antes. A plataforma subsidia parte — o entrevistado cita uma média a partir de R$ 5 por pedido.

Não é ilegal, e é o que quase todo varejo faz com a percepção de desconto. Mas é bom ter clareza do que está acontecendo: **quem não entra nesse jogo com preço calculado entra com margem emprestada.**

---

## Peça 3: a nota é o seu aluguel de vitrine

Outro ponto que a apuração deixa explícito: loja com avaliação **abaixo de 4.6 afunda no ranking** — e no delivery, quem não aparece não vende.

O que derruba a nota quase nunca é a comida em si. É o molho que vazou, o arroz que chegou empedrado, a batata que grudou no queijo, a comida fria. Ou seja: **embalagem e tempo**, dois itens que costumam ser tratados como detalhe operacional e são, na prática, o seu departamento de marketing.

**A decisão:** embalagem entra na ficha técnica e no teste de rota. Se ninguém na sua loja já fez o percurso de 20 minutos com o pedido pronto para ver como ele chega, esse teste vale mais que a próxima campanha.

---

## Peça 4: o pedido que some sem ser culpa sua

Há uma parte do jogo que o restaurante não controla. Na reportagem, uma loja aparece com os pedidos cancelados porque simplesmente **não apareceu entregador** — a plataforma fecha a loja, direciona os entregadores disponíveis para as grandes marcas, e o pequeno fica com comida pronta e sem aviso.

Do outro lado do balcão, o entregador também faz a conta dele: uma entrega que custa R$ 15 ao restaurante remunera o motoboy em torno de R$ 8 — e corrida mal paga é corrida recusada.

**A decisão:** não dependa de um único canal para escoar produção. Canal próprio não é vaidade, é seguro.

---

## Peça 5: o cliente que compra sem ver

A reportagem passeia por lojas onde metade dos itens em destaque **não tem foto nenhuma**, onde a descrição é "acompanha arroz, feijão, salada", onde o logotipo preto some no fundo branco da plataforma.

Na rua, o cliente encontra a loja pelo endereço. No delivery, encontra pelas palavras — quem escreve "coxinha de frango com requeijão, massa de batata" aparece em mais buscas do que quem escreve "coxinha".

**A decisão:** foto e nome de item são infraestrutura de venda, não enfeite. Comece pelos dez itens que mais saem.

---

## Peça 6: os centavos que definem o mês

A parte mais reveladora não está nas plataformas: está na cozinha.

Na mesma reportagem, uma operação pesa até o granulado que caiu no chão para lançar na planilha de desperdício. E aparece a conta que quase ninguém faz: **50 gramas de alho a mais por quilo dá cerca de R$ 600 por mês. R$ 7.200 no ano.** Em um insumo. Um só.

Há também a engenharia da marmita, dita em gramas: cerca de 150 g de arroz, 100 g de feijão, 150 g de proteína — e a orientação de manter a proporção com mais vegetal e menos carne, porque a proteína é o item caro do prato e é onde a mão pesada some com o lucro.

**A decisão:** ficha técnica com peso, não com "uma concha". A diferença entre 100 g e 140 g de proteína, repetida 200 vezes por dia, é o seu resultado.

---

## E quem ganha dinheiro, ganha como?

A reportagem também mostra o outro extremo: uma operação que vende cerca de **70 mil pedidos por mês**. A estrutura de resultado apresentada por ele é direta — em torno de **59% a 60% de custo**, **26% de comissão** e um lucro na casa de **14% a 15%**.

Duas coisas chamam atenção na estratégia dele:

- **Usar a plataforma como vitrine e migrar o cliente para o canal próprio.** Um cupom de 20% para quem pede direto custa menos que 26% a 40% de comissão — e a embalagem com QR Code faz esse convite sem custo de panfleto
- **Aceitar não lucrar nos primeiros seis meses de uma loja nova.** A meta declarada não é ganhar dinheiro no começo: é ganhar cliente

Vale registrar também o detalhe operacional que parece bobagem e mexe no algoritmo: separar os pedidos por número par e ímpar na prateleira economiza segundos na retirada; velocidade de despacho sinaliza à plataforma que a loja aguenta mais pedidos, e mais pedidos chegam.

---

## O roteiro para esta semana

- **Monte a margem por canal** dos dez itens que mais saem: preço praticado, comissão, embalagem, imposto
- **Defina preço por canal.** Não é truque, é reconhecer que o custo é diferente
- **Pese a proteína.** É o item caro; é onde o lucro vaza sem ninguém ver
- **Refaça o teste de rota** com a embalagem que você usa hoje
- **Coloque foto nos dez campeões** e escreva o nome do item como o cliente procura
- **Leve o cliente para o seu canal** com cupom na embalagem ou QR Code — mais barato que qualquer comissão

---

## Onde o MiseOn entra

- **O pedido do iFood entra com o preço COM markup do canal** — o sistema não reprecifica por cima, porque ali o preço praticado é aquele mesmo
- **Ficha técnica em gramas, com custo puxado da nota de compra**, para a conta do alho e a da proteína pararem de ser estimativa
- **Cardápio digital próprio por QR Code**, sem taxa por pedido, para a migração de canal ser um caminho e não um discurso
- **Cupom com regra decidida no servidor** — por janela de horário, por dia, por primeira compra

---

**Fonte:** casos e números apurados em reportagem de Marcelo Baccarini, conforme apresentados pelos entrevistados.
`,
  },
  {
    slug: 'restaurante-amador-na-internet-o-que-faz-perder-a-venda',
    rascunho: true,
    title: 'Na Internet, o Cliente Compra a Foto e Recebe o Produto',
    description: 'Um site de cupcakes que só mostrava caixas. Uma loja de joias que parecia planilha de estoque. Os erros que fazem um negócio bom parecer amador — e o que eles significam para quem vende comida.',
    category: 'Tecnologia & IA',
    publishedAt: '2026-09-16',
    readTime: '9 min de leitura',
    coverImage: '/blog-covers/expectativa-vs-realidade.jpg',
    author: {
      name: 'Rafael Maldivas',
      role: 'Head de Engenharia e Arquitetura do MiseOn',
      avatar: '/icon-192.png',
    },
    tags: ['Cardápio Digital', 'Presença Digital', 'Conversão', 'Fotografia de Alimentos', 'Experiência do Cliente'],
    seo: {
      title: 'Cliente Compra a Foto: Por Que seu Restaurante Parece Amador — MiseOn',
      description: 'Foto de embalagem em vez de comida, site lento, celular mal resolvido e caminho confuso até o pedido. O que derruba a venda antes do cardápio ser lido.',
      keywords: 'cardapio digital restaurante, foto de comida delivery, site de restaurante que vende, conversao cardapio online, presenca digital food service',
      canonicalUrl: 'https://miseon.app.br/blog/restaurante-amador-na-internet-o-que-faz-perder-a-venda',
    },
    summary: 'Numa análise de sites de pequenos negócios, o veredito se repetia: visual amador contamina a percepção do produto, e quem vende comida sem mostrar comida não vende. Este artigo traduz esses achados para a realidade de um restaurante — cardápio, foto, celular e o caminho até o pedido — na ordem em que vale a pena consertar.',
    content: `
# Na Internet, o Cliente Compra a Foto e Recebe o Produto

Existe uma frase dita numa análise de sites conduzida pelo jornalista Marcelo Baccarini que resume o assunto inteiro: na internet, **o cliente compra a foto e recebe o produto**.

A análise passava por negócios reais, e os diagnósticos se repetiam de um jeito quase cômico — não fosse o fato de que cada erro ali é uma venda que não aconteceu. Um site de cupcakes que mostrava **as caixas** em vez dos bolinhos. Uma loja de joias organizada como planilha de estoque, sem ninguém usando as peças. Um site com a mesma imagem de fundo repetida seis vezes. Outro que vendia aparelhos médicos com fotos amadoras e sem botão de compra — o pedido era por telefone e fax.

Nenhum desses donos acha que tem um negócio amador. E é esse o ponto: **o amadorismo aparece primeiro para quem está do lado de fora.**

---

## A ordem em que o cliente decide: ver, se interessar, ler

Essa é a espinha do problema. A pessoa não chega à sua página disposta a ler. Ela olha. Se o que vê despertar interesse, ela olha de novo. Só então lê alguma coisa.

Quem inverte essa ordem — parágrafos de texto antes de qualquer imagem que valha — perde a venda no primeiro segundo, não no último.

Para restaurante, isso tem uma tradução literal: **se a foto não dá vontade de comer, o resto do cardápio não importa.** É o teste mais barato que existe e quase ninguém aplica com honestidade nas próprias fotos.

---

## Mostrar a comida, não a embalagem

O caso dos cupcakes é o mais didático. A loja fotografou as caixas — bonitas, com a marca, bem produzidas. E não fotografou o que a pessoa quer comer.

No delivery brasileiro isso acontece o tempo todo: fotos de marmita fechada, de sacola, de logo. Ninguém tem desejo por embalagem. O apetite é visual e é específico: o queijo puxando, o molho brilhando, a borda dourada.

Um cardápio com boas fotos dos dez itens que mais saem vale mais que um cardápio completo com foto ruim em todos.

---

## Visual amador contamina o preço

Outro achado que se repetia: quando o site parece improvisado, o cliente conclui que o produto também é — e, pior, que o preço não se justifica.

Isso é especialmente cruel para quem cobra mais caro porque usa ingrediente melhor. O cliente não vê a sua compra: ele vê a sua vitrine. Fonte desalinhada, cores brigando, foto tremida e texto desencontrado são, para ele, informação sobre a sua cozinha.

---

## O caminho até o pedido tem que ser curto

A análise bate seguidamente na navegação: obrigar o cliente a caçar o que ele quer é o jeito mais eficiente de perdê-lo. Categorias claras, três caminhos principais, sugestão do que vai bem junto.

Para restaurante, isso é o combo e o adicional na hora certa — não como enfeite, mas porque o cliente decidido merece um caminho de dois toques até "quero este".

E vale a regra que o próprio material deixa clara em vários exemplos: se falta o botão de comprar, não existe venda. Um cardápio que termina em "chame no WhatsApp" às 21h de sábado, com ninguém do outro lado, termina do mesmo jeito.

---

## Celular e velocidade não são detalhes técnicos

Vários dos sites analisados eram sofríveis no celular — e é no celular que o cliente de restaurante decide, quase sempre em pé, quase sempre com pressa.

Lentidão tem o mesmo efeito de uma fila desorganizada na porta: quem não está muito decidido desiste. E página pesada, cheia de imagem grande demais e efeito desnecessário, é lentidão autoinfligida.

---

## O que fazer, na ordem

- **Fotografe os dez itens que mais saem.** Luz de janela, fundo limpo, o prato como ele realmente sai. Mesma moldura para todos
- **Troque foto de embalagem por foto de comida.** Sempre
- **Garanta que o cardápio abre no celular em segundos**, sem aplicativo e sem cadastro
- **Escreva o nome do item como o cliente procura**, com o recheio e o acompanhamento no nome
- **Deixe o caminho até o pedido com o menor número possível de passos**
- **Tenha resposta no canal onde o cliente fala** — automatizada para o repetitivo, humana para o resto
- **Só depois disso** invista em anúncio. Tráfego pago sobre vitrine ruim é pagar para mais gente ver o problema

---

## Onde o MiseOn entra

- **Cardápio digital por QR Code** que abre no navegador, sem aplicativo, sem cadastro e sem taxa por pedido
- **Um lugar só para preço e disponibilidade**: alterou, vale na hora na mesa, no balcão e no delivery
- **Item que acabou sai do cardápio automaticamente** quando o estoque zera, em vez de virar frustração no fim do pedido
- **Atendimento no WhatsApp pela API oficial da Meta**, para as cinco perguntas de sempre não dependerem de alguém livre no pico

---

**Ninguém escolhe um restaurante lendo. Escolhe olhando.** O cardápio é a sua vitrine — e vitrine suja fecha venda de comida boa.

---

**Fonte:** análises de sites comentadas em reportagem de Marcelo Baccarini.
`,
  },
  {
    slug: 'padaria-da-dinheiro-onde-exatamente-esta-o-lucro',
    rascunho: true,
    title: 'O Pão é Menos de 10% do Faturamento: Onde uma Padaria Ganha Dinheiro de Verdade',
    description: 'Uma padaria vende mais de um milhão de pães por ano — e o pão responde por menos de 10% do que ela fatura. O que está nos outros 90% e por que o balcão do caixa é o metro quadrado mais caro da loja.',
    category: 'Engenharia de Cardápio',
    publishedAt: '2026-09-16',
    readTime: '10 min de leitura',
    coverImage: '/blog-covers/padaria-sucesso.jfif',
    author: {
      name: 'Rafael Maldivas',
      role: 'Head de Engenharia e Arquitetura do MiseOn',
      avatar: '/icon-192.png',
    },
    tags: ['Padaria', 'Mix de Produtos', 'Margem', 'Compra por Impulso', 'Aproveitamento'],
    seo: {
      title: 'Padaria: o Pão é Menos de 10% do Faturamento — Onde Está o Lucro — MiseOn',
      description: 'Mais de um milhão de pães por ano e menos de 10% do faturamento. O que sustenta uma padaria: refeição, mix, impulso no caixa e aproveitamento de sobra.',
      keywords: 'padaria da lucro, margem padaria, mix de produtos padaria, compra por impulso caixa, aproveitamento de sobras padaria, buffet padaria',
      canonicalUrl: 'https://miseon.app.br/blog/padaria-da-dinheiro-onde-exatamente-esta-o-lucro',
    },
    summary: 'Uma padaria que vende mais de um milhão de pães por ano tira do pão menos de 10% do seu faturamento. Numa reportagem sobre o setor, o que apareceu foi outra coisa: refeição, mix de milhares de itens, aproveitamento de sobra e um balcão de caixa que funciona como o metro quadrado mais rentável da loja. Este artigo organiza esses achados em decisões.',
    content: `
# O Pão é Menos de 10% do Faturamento: Onde uma Padaria Ganha Dinheiro de Verdade

Uma padaria acompanhada em reportagem do jornalista Marcelo Baccarini vende mais de **1,17 milhão de pães por ano**. É um número que impressiona em qualquer conversa de balcão.

E aí vem o dado que reorganiza a cabeça: o pão responde por **menos de 10% do faturamento** dela.

Não é que o pão não importe. Ele é o ímã — o motivo pelo qual a cidade entra na loja todo dia, antes das nove. Só que o dinheiro está no que acontece depois que a pessoa entrou.

---

## Uma padaria são vários negócios empilhados

A loja da reportagem opera com cerca de **3.500 itens** e funciona 24 horas, com padeiro da noite produzindo para a manhã e o da manhã produzindo para a tarde.

Dentro dela convivem negócios com margens e ritmos completamente diferentes:

- **Panificação** — fluxo enorme, margem apertada, mão de obra em horário difícil
- **Refeição** — o buffet do almoço, que na reportagem recebe mais de 500 pessoas e trabalha com mais de 50 opções
- **Conveniência e revenda** — o que gira sem produção, com margem menor e capital parado na prateleira
- **Confeitaria e impulso** — o que sai no caminho do caixa

Somar tudo num caixa só é o que produz a frase "vende muito e não sobra". Sem separar, não existe decisão: existe palpite.

---

## O metro quadrado mais caro da loja fica na fila do caixa

Este é o achado mais prático da reportagem inteira. Os itens pequenos posicionados perto do caixa — o doce, a trufa, a bala, o chocolate — carregam margens que o entrevistado descreve como muito altas, **chegando a 300%** nas pequenas tentações.

E há a contraprova, que vale mais que a regra: quando esses itens foram mudados de lugar, a venda **caiu para menos da metade**.

Ou seja: não é o produto que vende, é a posição. O cliente parado na fila é um cliente com tempo e com desejo — e a maioria das padarias desperdiça esse tempo com um balcão neutro.

---

## Sobra bem trabalhada é margem, não caridade

Outro ponto: a cozinha funciona como laboratório do que sobrou. Baguete do dia anterior vira torrada ou bruschetta; frios que estão no limite viram recheio.

Isso não é economia de miséria. É reconhecer que o custo daquele insumo **já foi pago** — compra, produção, energia, mão de obra. Transformá-lo em um item novo recupera receita de algo que iria para o lixo, e o faz com custo marginal baixo.

A condição é uma só: precisa estar na ficha técnica e no controle, senão vira improviso e o que era margem vira risco.

---

## O clima é um parceiro comercial

Detalhe que parece folclore e é operação: frente fria chegando muda a venda de sopa, bolo e doce no mesmo dia.

Quem olha a previsão do tempo na segunda e ajusta a produção da semana ganha duas vezes: vende o que tem saída e não produz o que vai sobrar. É informação pública, de graça, e quase ninguém usa para planejar produção.

---

## O modelo pequeno que a reportagem mostra funcionar

Há ainda um contraponto interessante ao "quanto maior, melhor": a mini padaria de janela, com **menos de 8 metros quadrados**, duas pessoas na operação e **150 a 200 clientes por dia** — replicada em quatro unidades pelo mesmo dono.

Custo fixo baixo, cardápio curto, fila que cabe na calçada. Não é a padaria de 3.500 itens; é outro negócio, com outra conta, e que existe justamente porque a conta é outra.

**A lição:** antes de crescer em metro quadrado, vale perguntar se o que você quer é mais loja ou mais margem.

---

## O que fazer nesta semana

- **Separe seu faturamento em quatro blocos**: panificação, refeição, revenda e confeitaria/impulso. Depois separe a margem
- **Reorganize os 80 centímetros antes do caixa.** É o espaço com o maior retorno por metro da loja
- **Dê nome e ficha ao reaproveitamento.** Torrada e bruschetta são produtos, não sobra requentada
- **Olhe o vale entre 10h e 16h.** O custo fixo já foi pago pelos picos; tudo que sair ali é incremental
- **Refaça a ficha técnica quando a farinha subir.** Em padaria, reajuste não repassado corrói mais rápido que em qualquer outro segmento
- **Meça o rendimento no seu forno.** Massa ganha e perde peso, e é isso que define o custo do que você vende

---

## Onde o MiseOn entra

- **Ficha técnica com rendimento medido na sua loja** — o que a sua cozinha mediu vale mais que qualquer média de mercado
- **Custo puxado da nota de compra**, para o preço da farinha desta semana valer na conta desta semana
- **Margem por categoria**, separando o que você fabrica do que apenas revende
- **Quando o dado não é confiável, o sistema mostra o motivo** em vez de exibir uma margem inventada

---

**A padaria não vive de pão.** Vive do que o pão traz para dentro — e de estar preparada para aproveitar quem entrou.

---

**Fonte:** dados e casos apurados em reportagem de Marcelo Baccarini, conforme apresentados pelos entrevistados.
`,
  },
  {
    slug: 'voce-nunca-olhou-para-um-buffet-desse-jeito',
    rascunho: true,
    title: 'Você Nunca Olhou Para um Buffet Desse Jeito: o Prato Oval e Outras Engenharias do Balcão',
    description: 'Prato grande faz comer até 30% mais. Legume ganha peso no cozimento. A salada perde quase metade na limpeza. No self-service, cada decisão do balcão é uma decisão de margem.',
    category: 'Engenharia de Cardápio',
    publishedAt: '2026-09-16',
    readTime: '11 min de leitura',
    coverImage: '/blog-covers/buffet-estrategia.jpg',
    author: {
      name: 'Rafael Maldivas',
      role: 'Head de Engenharia e Arquitetura do MiseOn',
      avatar: '/icon-192.png',
    },
    tags: ['Buffet', 'Self-Service', 'Venda por Quilo', 'Rendimento', 'Rotatividade'],
    seo: {
      title: 'A Engenharia do Buffet: Prato Oval, Ordem das Cubas e Margem — MiseOn',
      description: 'Prato grande aumenta o consumo em até 30%, legume ganha 40% de peso cozido e a salada perde quase metade na limpeza. A engenharia por trás do self-service.',
      keywords: 'restaurante por quilo margem, engenharia buffet self service, rendimento de alimentos cozimento, rotatividade de mesa almoco, custo salada restaurante',
      canonicalUrl: 'https://miseon.app.br/blog/voce-nunca-olhou-para-um-buffet-desse-jeito',
    },
    summary: 'Numa reportagem dentro de um restaurante por quilo com 28 anos de casa, o que parecia rotina virou aula: o formato do prato muda o consumo, o cozimento muda o peso, a salada perde quase metade no preparo e a rotatividade de mesa decide o faturamento do dia. Este artigo reúne essas engenharias e mostra por que o balcão é o verdadeiro cardápio do self-service.',
    content: `
# Você Nunca Olhou Para um Buffet Desse Jeito: o Prato Oval e Outras Engenharias do Balcão

No restaurante à la carte, o cliente escolhe de uma lista que você escreveu. No self-service, ele monta o próprio prato — e a sensação é de que o dono perdeu o controle da margem.

Uma reportagem do jornalista Marcelo Baccarini dentro de um restaurante por quilo com quase três décadas de operação mostra o contrário: **o controle está todo lá, só que ele não está escrito no cardápio. Está montado em aço inox.**

---

## O prato decide antes do cliente decidir

O primeiro achado é o mais desconcertante: prato **grande e oval** faz o cliente servir mais — a estimativa apresentada na reportagem chega a **30% a mais de consumo**.

Nada foi dito ao cliente. Nenhuma placa, nenhum vendedor. Só a louça.

Isso deveria mudar a forma como um dono de self-service olha para o próprio enxoval. Prato é equipamento de faturamento, e a escolha dele é uma decisão econômica tomada uma vez e cobrada todos os dias.

---

## A ordem do balcão é o cardápio do self-service

A pessoa entra com o prato vazio e passa por todos os itens na ordem em que você os dispôs — e, diferente de um cardápio impresso, ela não pode pular a primeira página.

A prática descrita na reportagem é clara: **arroz, massas e legumes pesados no começo; proteína cara no fim.** Quando a carne aparece, o prato já tem volume, e o cliente serve o que cabe.

Há variações do mesmo princípio: pedaço maior nos itens baratos, pedaço menor nas carnes nobres; colocar proteínas de custo menor ao lado das caras, para o cliente misturar e o custo médio cair.

Não é engodo — a comida é a mesma, o preço por quilo é o mesmo. É arranjo. E arranjo é a única alavanca de margem que o self-service tem sem mexer no preço.

---

## O peso muda depois do fogo (e o custo muda junto)

Aqui está a parte que quase nenhuma planilha de restaurante brasileiro acerta.

Legume, segundo a reportagem, pode **ganhar até 40% de peso depois de cozido**. Caldo e umidade pesam. Carne, ao contrário, perde na limpeza e perde de novo na chapa — e a técnica mostrada para reduzir isso é específica: chapa grossa, bem quente, bife mais fino, para grelhar rápido e reter a água.

Ou seja: **o que você compra em quilos não é o que você serve em quilos.** Quem calcula custo pelo preço de compra está errando em todos os itens ao mesmo tempo — em alguns para mais, em outros para menos.

O número certo só existe medido na sua cozinha.

---

## A salada é o item mais mal-entendido do balcão

Parece barata. É uma das mais caras.

Na reportagem, o desfolhamento e a limpeza consomem de **30% a 40% do peso** do buquê — com a perda acumulada chegando perto da metade. E há um custo que ninguém lança na ficha: **a água**. A operação mostrada gasta cerca de 60 litros para higienizar a quantidade de salada exposta, e a conta de água mensal citada pelo dono é de **R$ 6.500**.

Folha que vai para a lixeira é folha comprada, transportada, lavada e paga. Sem contabilizar essa perda, o custo por quilo servido vira ficção.

---

## Onde o faturamento aparece sem passar pelo balcão

Três acréscimos aparecem com estimativas do próprio dono:

- **Suco**: cerca de 10% a mais de receita quando o cliente aceita
- **Sobremesa**: cerca de outros 10%
- **Balcão e caixa** (salgado, doce, item de viagem): cerca de **12% do faturamento**

São três perguntas feitas no momento certo. Nenhuma delas exige cozinha nova, equipe nova ou investimento.

---

## A mesa que gira é o produto invisível

O restaurante da reportagem atende o pico entre **meio-dia e 13h40** e gira a mesa de **4 a 5 vezes** por almoço — contra uma rotação típica de uma vez só no jantar à la carte.

Isso reposiciona o que é produtividade no almoço: não é só cozinhar mais rápido. É limpar e arrumar a mesa rápido, porque cada minuto de mesa suja no pico é uma cadeira que não fatura.

E há a outra ponta: desconto fora do pico, para puxar quem tem flexibilidade de horário e aliviar a fila do miolo. Sobre promoções de fidelidade agressivas, a leitura do dono é cética — atraem quem vem pelo preço, não quem volta pela comida.

---

## O que fazer nesta semana

- **Olhe para a sua louça.** Formato e tamanho do prato mudam o consumo antes de qualquer outra ação
- **Reorganize a ordem do balcão** pensando no prato vazio que passa por ele
- **Meça o rendimento dos cinco itens mais caros**, ganho e perda. Comprado não é servido
- **Some água, limpeza e desfolha no custo da salada**
- **Pese a sobra de cada cuba no fim do serviço por duas semanas.** Esse número costuma reorganizar a produção inteira
- **Treine a arrumação da mesa no pico.** Rotatividade é faturamento
- **Faça as três perguntas**: suco, sobremesa, algo para viagem

---

## Onde o MiseOn entra

- **Rendimento medido pela loja vence a tabela de referência** — e aceita ganho, não só perda: arroz cozido pesa mais, carne pesa menos
- **Custo por item com a nota de compra por trás**, para o preço do quilo acompanhar a realidade da semana
- **Venda por peso conserva o preço praticado do quilo**, sem reprecificar por fora o que a balança já resolveu
- **Quando o custo não é confiável, o sistema mostra o motivo** em vez de fingir precisão

---

**No self-service, o cardápio não é escrito: é montado em aço inox, todo dia, por quem repõe.** Quem enxerga o balcão como engenharia decide a margem antes de o primeiro cliente pegar o prato.

---

**Fonte:** casos, técnicas e estimativas apurados em reportagem de Marcelo Baccarini, conforme apresentados pelos entrevistados.
`,
  },
  {
    slug: 'calculadora-vazamento-de-caixa-diagnostico-operacional-restaurantes',
    rascunho: true,
    title: 'Calculadora de Vazamento de Caixa: Como Identificar e Estancar Perdas Invisíveis no seu Restaurante',
    description: 'Saiba como pequenos desvios de CMV, faltas de estoque no rush e reajustes de fornecedores não repassados consomem até R$ 5.500/mês da margem do seu estabelecimento.',
    category: 'Gestão Financeira',
    publishedAt: '2026-09-03',
    readTime: '8 min de leitura',
    coverImage: '/blog-covers/cmv-peps-cover.jpg',
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
    rascunho: true,
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
    rascunho: true,
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
    rascunho: true,
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
    rascunho: true,
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
    rascunho: true,
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
    rascunho: true,
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
    rascunho: true,
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
    title: 'Como o MiseOn Forma o Custo: Lote, Embalagem, Rendimento e Confiança',
    description: 'Entenda as regras implementadas no MiseOn para formar o custo de insumos e preparos sem transformar dado incompleto em margem aparentemente precisa.',
    category: 'Gestão Financeira',
    publishedAt: '2026-07-28',
    readTime: '8 min de leitura',
    coverImage: '/blog-covers/evolucao-cmv-cover.jpg',
    author: {
      name: 'Rafael Maldivas',
      role: 'Head de Engenharia e Arquitetura do MiseOn',
      avatar: '/icon-192.png',
    },
    tags: ['Custo', 'Ficha Técnica', 'Custeio PEPS', 'Rendimento', 'Estoque'],
    seo: {
      title: 'Como o MiseOn Forma o Custo de Insumos e Preparos',
      description: 'Veja como lote PEPS, quantidade por embalagem, rendimento, ficha técnica e confiança do dado participam do custo calculado pelo MiseOn.',
      keywords: 'cmv restaurante, custeio peps restaurante, ficha técnica alimentos, perda de coccao comida, calculo cmv hamburgueria',
      canonicalUrl: 'https://miseon.app.br/blog/evolucao-do-cmv-do-caderno-ao-custeio-peps-3d',
    },
    summary: 'O custo só é útil quando sua origem pode ser explicada. Este guia descreve o fluxo que o MiseOn implementa e também os casos em que o sistema deve admitir que ainda não há base confiável.',
    content: `
# Como o MiseOn Forma o Custo: Lote, Embalagem, Rendimento e Confiança

Um custo exibido com duas casas decimais pode parecer preciso e ainda estar errado. No MiseOn, a formação do custo parte de uma regra simples: **a origem do dado precisa acompanhar o número**.

Este texto descreve o comportamento implementado no produto. Ele não é uma promessa de DRE pronta nem uma estimativa de economia.

---

## 1. A entrada define o lote e o valor disponível

Compras e entradas criam a base física e financeira do estoque. Quando há lotes com preços diferentes, o custeio PEPS consome primeiro o lote mais antigo disponível. Assim, o valor usado na baixa vem de uma entrada identificável, e não apenas de um preço médio digitado em outro momento.

## 2. Quantidade por embalagem decide a unidade de custo

Comprar uma caixa e consumir unidades exige saber quantas unidades a caixa contém. O mesmo vale para pacote, fardo, garrafa, quilo ou litro.

No MiseOn, a quantidade por embalagem registra também sua origem. Uma correção feita pelo usuário tem prioridade sobre leituras automáticas. Sem uma conversão confiável, o sistema não deveria tratar o custo unitário como confirmado.

## 3. Rendimento pode representar perda ou ganho

O preparo pode perder peso, como ocorre em algumas cocções, ou ganhar volume, como em alimentos hidratados. Por isso, rendimento não é limitado a perda.

A medição da própria loja tem prioridade sobre referências genéricas. O objetivo é preservar o que foi efetivamente observado na cozinha, sem confundir uma referência com uma medição.

## 4. Preparos participam da ficha técnica

Molhos, massas, blends e outros preparos podem ser usados dentro da ficha de um produto. O MiseOn calcula o custo do preparo a partir de seus insumos e permite que esse custo suba para a ficha que o consome, com um limite de segurança para relações recursivas.

Gás e mão de obra não são misturados automaticamente ao custo do lote: pertencem à ordem de serviço e exigem tratamento próprio.

## 5. Custo incerto não vira margem bonita

A função de custo devolve o valor e um veredito de confiança. Se faltam embalagem, conversão, rendimento ou outra base necessária, quem consome esse dado deve respeitar o estado de incerteza.

Nessa situação, a margem pode ficar sem valor e apresentar o motivo. É melhor admitir a informação ausente do que publicar um percentual convincente e incorreto.

## 6. Venda por peso preserva o preço praticado

Em operações por quilo, o item vendido preserva o preço praticado na pesagem. Ele não deve ser reprecificado depois com um valor genérico do cadastro do produto.

---

## O que este fluxo não significa

Estoque, ficha e custo implementados não tornam automaticamente a DRE gerencial operacional. A tela de DRE do MiseOn permanece identificada como demonstrativa enquanto não estiver reconciliada com vendas, impostos, despesas e demais autoridades financeiras reais.

Essa separação é intencional: **produto confiável começa pelo limite claro entre o que foi calculado e o que ainda precisa ser configurado ou medido**.
`,
  },
  {
    slug: 'o-fim-do-papel-na-cozinha-kds-kanban-operacional',
    rascunho: true,
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
    rascunho: true,
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
    rascunho: true,
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

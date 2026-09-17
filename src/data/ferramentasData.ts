/**
 * Conteúdo das ferramentas gratuitas (/ferramentas).
 *
 * Fonte única, lida em dois lugares — igual a pageMeta.ts:
 *  1. pelas telas, em src/pages/ferramentas/;
 *  2. por scripts/prerender.mjs, que gera o HTML estático com H1, texto, FAQ e
 *     JSON-LD para quem não executa JavaScript.
 *
 * O texto é bilíngue AQUI, no próprio dado ({ pt, en }), em vez de passar pelo
 * tDynamic: frase de SEO longa não pode cair na tradução palavra a palavra.
 *
 * Regra da casa: nenhum número de mercado sem fonte e nenhuma promessa de
 * resultado do MiseOn. Taxa de canal aparece como referência pública datada,
 * editável, com o aviso de conferir o contrato.
 */

export interface Txt {
  pt: string;
  en: string;
}

export type SlugFerramenta = 'calculadora-cmv' | 'preco-ifood' | 'markup-preco-de-venda';

export interface Ferramenta {
  slug: SlugFerramenta;
  path: string;
  seo: { title: string; description: string; keywords: string };
  /** Nome curto, para cartão do hub e breadcrumb. */
  nome: Txt;
  h1: Txt;
  resumo: Txt;
  /** Parágrafos explicativos abaixo da calculadora. */
  explicacao: { titulo: Txt; paragrafos: Txt[] }[];
  faqs: { pergunta: Txt; resposta: Txt }[];
  /** Mensagem pronta do botão de WhatsApp desta ferramenta. */
  whatsapp: string;
}

const BASE = 'https://miseon.app.br';

export const HUB_FERRAMENTAS = {
  path: '/ferramentas',
  seo: {
    title: 'Ferramentas Grátis para Restaurantes | Calculadora de CMV, iFood e Markup',
    description:
      'Calculadoras gratuitas para donos de restaurante, hamburgueria e pizzaria: CMV, preço de venda no iFood e markup. Sem cadastro, direto no navegador.',
    keywords: 'ferramentas para restaurante, calculadora cmv, calculadora ifood, calculadora markup, preço de venda restaurante',
    canonicalUrl: `${BASE}/ferramentas`,
  },
  h1: { pt: 'Ferramentas grátis para quem vive de comida', en: 'Free tools for food businesses' } as Txt,
  resumo: {
    pt: 'Calculadoras para responder as perguntas que decidem o lucro da sua loja. Sem cadastro, sem login: você digita os seus números e vê o resultado na hora.',
    en: 'Calculators that answer the questions that decide your profit. No sign-up, no login: type your own numbers and see the result right away.',
  } as Txt,
};

export const FERRAMENTAS: Ferramenta[] = [
  {
    slug: 'calculadora-cmv',
    path: '/ferramentas/calculadora-cmv',
    seo: {
      title: 'Calculadora de CMV para Restaurante Grátis | Do mês e do prato',
      description:
        'Calcule o CMV do seu restaurante em segundos: do mês (estoque inicial + compras − estoque final) e de cada prato. Grátis, sem cadastro.',
      keywords: 'calculadora cmv, como calcular cmv restaurante, cmv prato, custo da mercadoria vendida, cmv hamburgueria, cmv pizzaria',
    },
    nome: { pt: 'Calculadora de CMV', en: 'COGS calculator' },
    h1: { pt: 'Calculadora de CMV para restaurante', en: 'Restaurant COGS calculator' },
    resumo: {
      pt: 'Descubra quanto do seu faturamento vai embora em mercadoria — no mês inteiro ou em um prato só.',
      en: 'Find out how much of your revenue goes into ingredients — for the whole month or for a single dish.',
    },
    explicacao: [
      {
        titulo: { pt: 'O que é CMV', en: 'What COGS means' },
        paragrafos: [
          {
            pt: 'CMV é o Custo da Mercadoria Vendida: o valor dos ingredientes e embalagens que saíram do estoque para virar venda. É o maior custo variável de quase todo restaurante, e por isso é o primeiro número que um dono precisa conhecer.',
            en: 'COGS (Cost of Goods Sold) is the value of the ingredients and packaging that left your stock to become sales. It is the largest variable cost in almost every restaurant, which is why it is the first number an owner needs to know.',
          },
          {
            pt: 'A conta do mês é: estoque inicial + compras do período − estoque final. Dividindo pelo faturamento, você tem o CMV em percentual.',
            en: 'The monthly formula is: opening stock + purchases − closing stock. Divide it by revenue to get COGS as a percentage.',
          },
        ],
      },
      {
        titulo: { pt: 'Onde a conta costuma errar', en: 'Where the math usually goes wrong' },
        paragrafos: [
          {
            pt: 'Contagem de estoque feita “de olho”, compra paga no mês mas recebida no outro, e perda de preparo que ninguém anota. O rendimento também engana: 1 kg de carne crua não vira 1 kg de hambúrguer pronto, e o arroz cozido rende mais do que o peso cru.',
            en: 'Stock counts done by eye, purchases paid in one month but received in another, and prep losses nobody records. Yield also misleads: 1 kg of raw beef does not become 1 kg of cooked burgers, and cooked rice weighs more than raw.',
          },
          {
            pt: 'Por isso o CMV do mês e o CMV dos pratos precisam conversar. Se a soma dos pratos vendidos dá um número e o estoque dá outro, a diferença é desperdício, desvio ou ficha técnica desatualizada.',
            en: 'That is why monthly COGS and per-dish COGS must match. If the dishes sold add up to one number and the stock says another, the gap is waste, theft or an outdated recipe card.',
          },
        ],
      },
    ],
    faqs: [
      {
        pergunta: { pt: 'Qual é o CMV ideal para restaurante?', en: 'What is the ideal COGS for a restaurant?' },
        resposta: {
          pt: 'Não existe um número que sirva para todos: depende do tipo de operação, do preço praticado e do peso das outras despesas. O caminho seguro é partir das suas despesas e do lucro que você quer — é exatamente o que a calculadora de markup faz — e usar o CMV que sai dali como meta.',
          en: 'There is no single number for everyone: it depends on the type of operation, your prices and the weight of your other expenses. The safe path is to start from your expenses and the profit you want — exactly what the markup calculator does — and use the resulting COGS as your target.',
        },
      },
      {
        pergunta: { pt: 'Embalagem entra no CMV?', en: 'Does packaging count as COGS?' },
        resposta: {
          pt: 'Entra, quando ela sai junto com o produto (caixa de pizza, embalagem de delivery, copo). Taxa de maquininha, comissão de aplicativo e gás não entram: são despesas variáveis ou fixas, e vão no markup.',
          en: 'Yes, when it leaves with the product (pizza box, delivery container, cup). Card fees, app commissions and gas do not: they are variable or fixed expenses and belong in the markup.',
        },
      },
      {
        pergunta: { pt: 'Com que frequência devo calcular?', en: 'How often should I calculate it?' },
        resposta: {
          pt: 'No mínimo uma vez por mês, com contagem de estoque no mesmo dia. Quem calcula por semana percebe aumento de insumo antes de ele comer o mês inteiro.',
          en: 'At least once a month, counting stock on the same day. Weekly calculation catches ingredient price increases before they eat the whole month.',
        },
      },
    ],
    whatsapp: 'Olá! Usei a calculadora de CMV do site e quero ver o CMV calculado automático com as minhas notas.',
  },
  {
    slug: 'preco-ifood',
    path: '/ferramentas/preco-ifood',
    seo: {
      title: 'Calculadora de Preço no iFood | Quanto cobrar sem perder margem',
      description:
        'Descubra quanto você recebe de verdade no iFood e qual preço cobrar no app para receber o mesmo que no balcão. Comissão, taxa de pagamento e taxa fixa. Grátis.',
      keywords: 'calculadora ifood, preço no ifood, taxa ifood 2026, quanto cobrar no ifood, comissão ifood restaurante',
    },
    nome: { pt: 'Preço no iFood', en: 'Delivery app pricing' },
    h1: { pt: 'Calculadora de preço no iFood', en: 'Delivery app price calculator' },
    resumo: {
      pt: 'Quanto sobra de cada venda no aplicativo — e qual preço cobrar lá para receber o mesmo que no seu balcão.',
      en: 'How much you keep from each app sale — and what to charge there to receive the same as at your counter.',
    },
    explicacao: [
      {
        titulo: { pt: 'Por que o mesmo preço não é o mesmo dinheiro', en: 'Why the same price is not the same money' },
        paragrafos: [
          {
            pt: 'No aplicativo, a comissão e a taxa de pagamento online saem do valor do pedido. Um lanche de R$ 30 no balcão não vira R$ 30 no seu caixa quando é vendido pelo app.',
            en: 'On the app, the commission and online payment fee come out of the order value. A R$ 30 sandwich at the counter does not become R$ 30 in your till when sold through the app.',
          },
          {
            pt: 'O erro mais comum é somar a taxa por fora: pegar o preço e acrescentar a porcentagem. Como a comissão incide sobre o preço já aumentado, o certo é dividir — preço no app = (preço do balcão + taxa fixa) ÷ (1 − taxas). É a conta que esta calculadora faz.',
            en: 'The most common mistake is adding the fee on top: taking the price and adding the percentage. Since the commission applies to the already-increased price, the right way is to divide — app price = (counter price + fixed fee) ÷ (1 − fees). That is what this calculator does.',
          },
        ],
      },
      {
        titulo: { pt: 'Sobre as taxas pré-preenchidas', en: 'About the pre-filled rates' },
        paragrafos: [
          {
            pt: 'Os botões de plano trazem valores divulgados publicamente em 2026 (Plano Básico: 12% de comissão + 3,2% de pagamento online; Plano Entrega: 23% + 3,5%). Taxas mudam e cada contrato tem suas condições: confira o seu no portal do parceiro e ajuste os campos. A mensalidade do plano não entra aqui porque não é cobrada por pedido.',
            en: 'The plan buttons use rates published in 2026 (Basic Plan: 12% commission + 3.2% online payment; Delivery Plan: 23% + 3.5%). Rates change and each contract has its own terms: check yours in the partner portal and adjust the fields. The monthly plan fee is not included because it is not charged per order.',
          },
        ],
      },
    ],
    faqs: [
      {
        pergunta: { pt: 'Posso cobrar mais caro no iFood do que no balcão?', en: 'Can I charge more on the app than at the counter?' },
        resposta: {
          pt: 'Muitos restaurantes fazem isso justamente para cobrir a comissão. Antes de decidir, confira as regras do seu contrato e compare o preço final com o de concorrentes próximos no próprio aplicativo.',
          en: 'Many restaurants do exactly that to cover the commission. Before deciding, check your contract rules and compare the final price with nearby competitors on the app itself.',
        },
      },
      {
        pergunta: { pt: 'Cupom e promoção entram na conta?', en: 'Do coupons and promotions count?' },
        resposta: {
          pt: 'Se o desconto é bancado pela loja, sim: subtraia o valor do desconto do preço antes de calcular quanto você recebe. Se é bancado pelo aplicativo, não muda o seu repasse.',
          en: 'If the store pays for the discount, yes: subtract it from the price before calculating what you receive. If the app pays for it, your payout does not change.',
        },
      },
      {
        pergunta: { pt: 'Serve para outros aplicativos?', en: 'Does it work for other apps?' },
        resposta: {
          pt: 'Serve. Troque a comissão, a taxa de pagamento e a taxa fixa pelos valores do contrato do outro canal.',
          en: 'Yes. Replace the commission, payment fee and fixed fee with the values from the other channel’s contract.',
        },
      },
    ],
    whatsapp: 'Olá! Usei a calculadora de preço no iFood do site e quero ver o preço por canal calculado automático no meu cardápio.',
  },
  {
    slug: 'markup-preco-de-venda',
    path: '/ferramentas/markup-preco-de-venda',
    seo: {
      title: 'Calculadora de Markup para Restaurante | Preço de venda certo',
      description:
        'Calcule o preço de venda do seu prato pelo markup: custo, despesas fixas, despesas variáveis e o lucro que você quer. Grátis e sem cadastro.',
      keywords: 'calculadora markup, como calcular preço de venda restaurante, markup divisor, precificação cardápio, preço de venda lanche',
    },
    nome: { pt: 'Markup e preço de venda', en: 'Markup & selling price' },
    h1: { pt: 'Calculadora de markup e preço de venda', en: 'Markup and selling price calculator' },
    resumo: {
      pt: 'Parta do custo do prato e das despesas da loja para chegar ao preço que deixa o lucro que você quer.',
      en: 'Start from the dish cost and your store expenses to reach the price that leaves the profit you want.',
    },
    explicacao: [
      {
        titulo: { pt: 'Como o markup funciona', en: 'How markup works' },
        paragrafos: [
          {
            pt: 'O preço de venda precisa pagar quatro coisas: o custo do produto, as despesas variáveis da venda (impostos, maquininha, comissão), as despesas fixas da loja (aluguel, salários, contas) e ainda sobrar lucro.',
            en: 'The selling price must pay for four things: the product cost, variable sales expenses (taxes, card fees, commissions), fixed store expenses (rent, wages, bills) and still leave profit.',
          },
          {
            pt: 'O markup divisor transforma isso numa conta só: preço = custo ÷ (1 − (despesas fixas % + despesas variáveis % + lucro %)). Se as despesas e o lucro somam 50%, o preço é o custo dividido por 0,5 — ou seja, o dobro.',
            en: 'The divisor markup turns this into a single formula: price = cost ÷ (1 − (fixed % + variable % + profit %)). If expenses and profit add up to 50%, the price is the cost divided by 0.5 — that is, double.',
          },
        ],
      },
      {
        titulo: { pt: 'De onde tirar as despesas fixas em %', en: 'Where to get fixed expenses as a %' },
        paragrafos: [
          {
            pt: 'Some as contas fixas de um mês e divida pelo faturamento do mesmo mês. Se as fixas dão R$ 12.000 e você fatura R$ 60.000, suas despesas fixas são 20%. Use os seus números: percentual copiado de outra loja dá preço de outra loja.',
            en: 'Add up one month of fixed bills and divide by that month’s revenue. If fixed costs are R$ 12,000 and revenue is R$ 60,000, fixed expenses are 20%. Use your own numbers: a percentage copied from another store gives another store’s price.',
          },
        ],
      },
    ],
    faqs: [
      {
        pergunta: { pt: 'Qual a diferença entre markup e margem?', en: 'What is the difference between markup and margin?' },
        resposta: {
          pt: 'Markup é o multiplicador aplicado sobre o custo para chegar ao preço. Margem é quanto do preço sobra como lucro. Um markup de 2 não significa 100% de lucro: parte do que foi somado paga despesas.',
          en: 'Markup is the multiplier applied to cost to reach the price. Margin is how much of the price remains as profit. A markup of 2 does not mean 100% profit: part of what was added pays expenses.',
        },
      },
      {
        pergunta: { pt: 'E se o preço calculado ficar acima do mercado?', en: 'What if the calculated price is above the market?' },
        resposta: {
          pt: 'Então a conta está avisando algo: o custo do prato está alto (reveja porção, fornecedor e ficha técnica), as despesas fixas estão pesadas para o volume que você vende, ou o lucro desejado não cabe naquele produto. Baixar o preço sem mexer nisso só troca lucro por movimento.',
          en: 'Then the math is warning you: the dish cost is high (review portion, supplier and recipe card), fixed expenses are heavy for your volume, or the desired profit does not fit that product. Lowering the price without fixing that only trades profit for volume.',
        },
      },
      {
        pergunta: { pt: 'Preciso de um markup por prato?', en: 'Do I need a markup per dish?' },
        resposta: {
          pt: 'As despesas da loja são as mesmas, mas o custo muda de prato para prato — então o preço de cada um sai diferente. O que costuma variar por item é o lucro desejado: carro-chefe pode ter margem menor, adicional e bebida podem ter maior.',
          en: 'Store expenses are the same, but the cost changes from dish to dish — so each price comes out different. What usually varies per item is the target profit: flagship items can carry less, add-ons and drinks more.',
        },
      },
    ],
    whatsapp: 'Olá! Usei a calculadora de markup do site e quero precificar o meu cardápio inteiro com ficha técnica.',
  },
];

export const ferramentaPorSlug = (slug: string) => FERRAMENTAS.find((f) => f.slug === slug);

/** Rótulos de interface das ferramentas (bilíngues pelo mesmo motivo acima). */
export const ROTULOS = {
  inicio: { pt: 'Início', en: 'Home' },
  ferramentas: { pt: 'Ferramentas', en: 'Tools' },
  abrir: { pt: 'Abrir ferramenta', en: 'Open tool' },
  gratis: { pt: 'Grátis · sem cadastro', en: 'Free · no sign-up' },
  resultado: { pt: 'Resultado', en: 'Result' },
  preenchaParaVer: { pt: 'Preencha os campos para ver o resultado.', en: 'Fill in the fields to see the result.' },
  perguntas: { pt: 'Perguntas frequentes', en: 'Frequently asked questions' },
  outrasFerramentas: { pt: 'Outras ferramentas', en: 'Other tools' },
  enviarResultado: { pt: 'Enviar resultado no WhatsApp', en: 'Send result on WhatsApp' },
  ctaTitulo: { pt: 'Quer esse número calculado sozinho, todo dia?', en: 'Want this number calculated for you, every day?' },
  ctaTexto: {
    pt: 'No MiseOn, a nota fiscal de compra alimenta o estoque, a ficha técnica calcula o custo de cada prato e o preço por canal sai pronto. Mostramos na sua loja, com os seus produtos.',
    en: 'In MiseOn, purchase invoices feed the stock, recipe cards calculate each dish cost and per-channel prices come out ready. We show it in your store, with your products.',
  },
  ctaWhatsapp: { pt: 'Ver na minha loja pelo WhatsApp', en: 'See it in my store via WhatsApp' },
  ctaTeste: { pt: 'Testar 30 dias grátis', en: 'Try free for 30 days' },
  avisoCalculo: {
    pt: 'Cálculo feito no seu navegador. Nada do que você digita é enviado para a MiseOn.',
    en: 'Calculated in your browser. Nothing you type is sent to MiseOn.',
  },

  // Leituras visuais
  composicao: { pt: 'De onde vem cada parte', en: 'Where each part comes from' },
  custoParte: { pt: 'Custo do produto', en: 'Product cost' },
  fixasParte: { pt: 'Despesas fixas', en: 'Fixed expenses' },
  variaveisParte: { pt: 'Despesas variáveis', en: 'Variable expenses' },
  lucroParte: { pt: 'Lucro', en: 'Profit' },
  ficaComVoce: { pt: 'Fica com você', en: 'You keep' },
  pontoDeCmv: { pt: 'Cada 1% de CMV no mês', en: 'Each 1% of COGS per month' },
  restanteFaturamento: { pt: 'Sobra para despesas e lucro', en: 'Left for expenses and profit' },
  marcadorMeta: { pt: 'A linha preta é a sua meta', en: 'The black line is your target' },
  pedidosMes: { pt: 'Pedidos por mês nesse canal', en: 'Orders per month on this channel' },
  cenarios: { pt: 'Seus três caminhos', en: 'Your three options' },
  cenarioManter: { pt: 'Manter o preço do balcão', en: 'Keep the counter price' },
  cenarioMeio: { pt: 'Repassar metade da taxa', en: 'Pass on half the fee' },
  cenarioRepassar: { pt: 'Repassar a taxa inteira', en: 'Pass on the whole fee' },
  colPreco: { pt: 'Preço no app', en: 'App price' },
  colPedido: { pt: 'Por pedido', en: 'Per order' },
  colMes: { pt: 'No mês', en: 'Per month' },
  leituraCmv: { pt: 'Leitura', en: 'Reading' },

  // CMV
  abaMes: { pt: 'CMV do mês', en: 'Monthly COGS' },
  abaPrato: { pt: 'CMV de um prato', en: 'Dish COGS' },
  estoqueInicial: { pt: 'Estoque inicial (R$)', en: 'Opening stock (R$)' },
  compras: { pt: 'Compras do período (R$)', en: 'Purchases in the period (R$)' },
  estoqueFinal: { pt: 'Estoque final (R$)', en: 'Closing stock (R$)' },
  faturamento: { pt: 'Faturamento do período (R$)', en: 'Revenue in the period (R$)' },
  metaCmv: { pt: 'Sua meta de CMV (%) — opcional', en: 'Your COGS target (%) — optional' },
  cmvReais: { pt: 'CMV do período', en: 'COGS for the period' },
  cmvPct: { pt: 'CMV sobre o faturamento', en: 'COGS over revenue' },
  margemBruta: { pt: 'Sobra antes das despesas', en: 'Left before expenses' },
  acimaMeta: { pt: 'acima da sua meta', en: 'above your target' },
  dentroMeta: { pt: 'dentro da sua meta', en: 'within your target' },
  custoIngredientes: { pt: 'Custo dos ingredientes do prato (R$)', en: 'Ingredient cost of the dish (R$)' },
  precoVenda: { pt: 'Preço de venda (R$)', en: 'Selling price (R$)' },
  sobraUnidade: { pt: 'Sobra por unidade', en: 'Left per unit' },

  // iFood
  planoBasico: { pt: 'Plano Básico', en: 'Basic Plan' },
  planoEntrega: { pt: 'Plano Entrega', en: 'Delivery Plan' },
  precoBalcao: { pt: 'Preço no balcão (R$)', en: 'Counter price (R$)' },
  comissao: { pt: 'Comissão do plano (%)', en: 'Plan commission (%)' },
  taxaPagamento: { pt: 'Taxa de pagamento online (%)', en: 'Online payment fee (%)' },
  taxaFixa: { pt: 'Taxa fixa por pedido (R$)', en: 'Fixed fee per order (R$)' },
  confiraContrato: {
    pt: 'Referência pública de 2026. Confira o seu contrato e ajuste.',
    en: 'Public 2026 reference. Check your contract and adjust.',
  },
  recebeMesmoPreco: { pt: 'Você recebe cobrando o mesmo preço', en: 'You receive charging the same price' },
  ficaNoCanal: { pt: 'Fica com o aplicativo', en: 'Kept by the app' },
  precoSugerido: { pt: 'Preço para receber o mesmo que no balcão', en: 'Price to receive the same as at the counter' },
  aumento: { pt: 'de aumento no app', en: 'increase on the app' },

  // Markup
  custoProduto: { pt: 'Custo do produto (R$)', en: 'Product cost (R$)' },
  despesasFixas: { pt: 'Despesas fixas (% do faturamento)', en: 'Fixed expenses (% of revenue)' },
  despesasVariaveis: { pt: 'Despesas variáveis (% da venda)', en: 'Variable expenses (% of sale)' },
  lucroDesejado: { pt: 'Lucro desejado (%)', en: 'Target profit (%)' },
  dicaVariaveis: {
    pt: 'Impostos + maquininha + comissões que saem de cada venda.',
    en: 'Taxes + card fees + commissions taken from each sale.',
  },
  precoCalculado: { pt: 'Preço de venda', en: 'Selling price' },
  markupMultiplicador: { pt: 'Markup (multiplicador)', en: 'Markup (multiplier)' },
  cmvResultante: { pt: 'CMV desse preço', en: 'COGS at this price' },
  lucroUnidade: { pt: 'Lucro por unidade', en: 'Profit per unit' },
} satisfies Record<string, Txt>;

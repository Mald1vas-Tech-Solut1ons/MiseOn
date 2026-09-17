/**
 * Contas das ferramentas gratuitas de /ferramentas.
 *
 * Tudo aqui é função pura: roda no navegador, sem banco e sem login — a
 * ferramenta funciona mesmo com o Supabase fora. Nenhuma função supõe número
 * do lojista (CMV "médio", ticket "médio"): quem não informou, não recebe
 * resultado. Entrada inválida devolve `null` com o motivo, nunca um percentual
 * inventado.
 */

export type Resultado<T> = { ok: true; valor: T } | { ok: false; motivo: string };

const finito = (n: number) => Number.isFinite(n);

// ─────────────────────────────── CMV ────────────────────────────────

export interface EntradaCmvPeriodo {
  estoqueInicial: number;
  compras: number;
  estoqueFinal: number;
  faturamento: number;
}

export interface SaidaCmvPeriodo {
  /** Custo da mercadoria vendida no período, em R$. */
  cmv: number;
  /** CMV sobre o faturamento, em % (0–100+). */
  cmvPct: number;
  /** O que sobra do faturamento depois do CMV, antes das demais despesas. */
  margemBruta: number;
}

/** CMV = Estoque inicial + Compras − Estoque final. */
export function calcularCmvPeriodo(e: EntradaCmvPeriodo): Resultado<SaidaCmvPeriodo> {
  const { estoqueInicial, compras, estoqueFinal, faturamento } = e;
  if (![estoqueInicial, compras, estoqueFinal, faturamento].every(finito)) {
    return { ok: false, motivo: 'Preencha todos os campos com números.' };
  }
  if (estoqueInicial < 0 || compras < 0 || estoqueFinal < 0) {
    return { ok: false, motivo: 'Estoque e compras não podem ser negativos.' };
  }
  if (faturamento <= 0) {
    return { ok: false, motivo: 'Informe o faturamento do período (maior que zero).' };
  }
  const cmv = estoqueInicial + compras - estoqueFinal;
  if (cmv < 0) {
    return {
      ok: false,
      motivo: 'O estoque final ficou maior que o inicial somado às compras. Confira a contagem ou se faltou lançar alguma compra.',
    };
  }
  return { ok: true, valor: { cmv, cmvPct: (cmv / faturamento) * 100, margemBruta: faturamento - cmv } };
}

export interface SaidaCmvPrato {
  cmvPct: number;
  /** Quanto sobra por unidade depois do custo dos ingredientes. */
  sobraPorUnidade: number;
}

/** CMV de um prato: custo dos ingredientes ÷ preço de venda. */
export function calcularCmvPrato(custoIngredientes: number, precoVenda: number): Resultado<SaidaCmvPrato> {
  if (!finito(custoIngredientes) || !finito(precoVenda)) {
    return { ok: false, motivo: 'Preencha custo e preço com números.' };
  }
  if (custoIngredientes < 0) return { ok: false, motivo: 'O custo não pode ser negativo.' };
  if (precoVenda <= 0) return { ok: false, motivo: 'Informe o preço de venda (maior que zero).' };
  return {
    ok: true,
    valor: { cmvPct: (custoIngredientes / precoVenda) * 100, sobraPorUnidade: precoVenda - custoIngredientes },
  };
}

// ───────────────────────────── iFood ────────────────────────────────

export interface EntradaPrecoCanal {
  /** Preço que você pratica no balcão / delivery próprio. */
  precoBalcao: number;
  /** Comissão do plano, em %. */
  comissaoPct: number;
  /** Taxa de pagamento online, em %. */
  taxaPagamentoPct: number;
  /** Taxa fixa por pedido, em R$ (0 se não houver). */
  taxaFixa: number;
}

export interface SaidaPrecoCanal {
  /** Quanto você recebe se cobrar no app o mesmo preço do balcão. */
  recebeMesmoPreco: number;
  /** O que o canal fica, nesse caso. */
  perdaMesmoPreco: number;
  /** Preço a cobrar no app para receber o mesmo que no balcão. */
  precoSugerido: number;
  /** Aumento necessário sobre o preço do balcão, em %. */
  aumentoPct: number;
}

/**
 * Mesma fórmula do painel do iFood no MiseOn (src/pages/admin/Ifood.tsx): o
 * percentual incide sobre o total cobrado, taxa fixa inclusive, então as duas
 * entram antes de dividir — cobrado = (preço + fixa) / (1 − %).
 */
export function calcularPrecoCanal(e: EntradaPrecoCanal): Resultado<SaidaPrecoCanal> {
  const { precoBalcao, comissaoPct, taxaPagamentoPct, taxaFixa } = e;
  if (![precoBalcao, comissaoPct, taxaPagamentoPct, taxaFixa].every(finito)) {
    return { ok: false, motivo: 'Preencha todos os campos com números.' };
  }
  if (precoBalcao <= 0) return { ok: false, motivo: 'Informe o preço do produto (maior que zero).' };
  if (comissaoPct < 0 || taxaPagamentoPct < 0 || taxaFixa < 0) {
    return { ok: false, motivo: 'Taxas não podem ser negativas.' };
  }
  const pct = (comissaoPct + taxaPagamentoPct) / 100;
  if (pct >= 1) return { ok: false, motivo: 'A soma das taxas precisa ser menor que 100%.' };

  const recebeMesmoPreco = precoBalcao * (1 - pct) - taxaFixa;
  const precoSugerido = (precoBalcao + taxaFixa) / (1 - pct);
  return {
    ok: true,
    valor: {
      recebeMesmoPreco,
      perdaMesmoPreco: precoBalcao - recebeMesmoPreco,
      precoSugerido,
      aumentoPct: (precoSugerido / precoBalcao - 1) * 100,
    },
  };
}

// ──────────────────────────── Markup ────────────────────────────────

export interface EntradaMarkup {
  /** Custo unitário do produto (ingredientes + embalagem), em R$. */
  custo: number;
  /** Despesas fixas sobre o faturamento (aluguel, salários…), em %. */
  despesasFixasPct: number;
  /** Despesas variáveis sobre a venda (impostos, maquininha, comissão), em %. */
  despesasVariaveisPct: number;
  /** Lucro que você quer que sobre, em %. */
  lucroPct: number;
}

export interface SaidaMarkup {
  precoVenda: number;
  /** Multiplicador: preço = custo × markup. */
  markup: number;
  /** Quanto do preço é custo do produto, em %. */
  cmvPct: number;
  lucroPorUnidade: number;
}

/** Markup divisor: preço = custo ÷ (1 − (fixas + variáveis + lucro)). */
export function calcularMarkup(e: EntradaMarkup): Resultado<SaidaMarkup> {
  const { custo, despesasFixasPct, despesasVariaveisPct, lucroPct } = e;
  if (![custo, despesasFixasPct, despesasVariaveisPct, lucroPct].every(finito)) {
    return { ok: false, motivo: 'Preencha todos os campos com números.' };
  }
  if (custo <= 0) return { ok: false, motivo: 'Informe o custo do produto (maior que zero).' };
  if (despesasFixasPct < 0 || despesasVariaveisPct < 0 || lucroPct < 0) {
    return { ok: false, motivo: 'Percentuais não podem ser negativos.' };
  }
  const soma = (despesasFixasPct + despesasVariaveisPct + lucroPct) / 100;
  if (soma >= 1) {
    return {
      ok: false,
      motivo: 'Despesas + lucro chegaram a 100% ou mais: não existe preço que feche essa conta. Reduza algum percentual.',
    };
  }
  const precoVenda = custo / (1 - soma);
  return {
    ok: true,
    valor: {
      precoVenda,
      markup: 1 / (1 - soma),
      cmvPct: (custo / precoVenda) * 100,
      lucroPorUnidade: precoVenda * (lucroPct / 100),
    },
  };
}

// ───────────────── Leituras que o dono usa de verdade ─────────────────

/**
 * Quanto vale UM ponto percentual de CMV, em reais do mês.
 * É o número que transforma "meu CMV é 38%" em "cada ponto que eu baixar
 * devolve R$ X ao caixa" — sem prometer que o sistema baixa esse ponto.
 */
export function pontoDeCmv(faturamento: number): number {
  return faturamento / 100;
}

export interface Cenario {
  /** Nome curto do cenário. */
  chave: 'manter' | 'repassar' | 'meio';
  /** Preço cobrado no aplicativo. */
  precoApp: number;
  /** Quanto sobra por pedido depois das taxas. */
  recebePorPedido: number;
  /** Diferença por pedido contra o preço do balcão. */
  diferencaPorPedido: number;
  /** Diferença no mês, dado o volume informado. */
  diferencaNoMes: number;
}

/**
 * Três caminhos que o lojista realmente tem no canal: manter o preço do
 * balcão, repassar a taxa inteira, ou repassar metade. O volume mensal é o
 * que tira a conta do abstrato — R$ 7,95 por pedido não assusta ninguém;
 * 400 pedidos por mês, sim.
 */
export function cenariosDoCanal(e: EntradaPrecoCanal, pedidosMes: number): Resultado<Cenario[]> {
  const base = calcularPrecoCanal(e);
  if (!base.ok) return base;
  if (!finito(pedidosMes) || pedidosMes < 0) {
    return { ok: false, motivo: 'Informe quantos pedidos por mês você faz nesse canal.' };
  }

  const pct = (e.comissaoPct + e.taxaPagamentoPct) / 100;
  const recebe = (precoApp: number) => precoApp * (1 - pct) - e.taxaFixa;
  const precoMeio = (e.precoBalcao + base.valor.precoSugerido) / 2;

  const monta = (chave: Cenario['chave'], precoApp: number): Cenario => {
    const recebePorPedido = recebe(precoApp);
    const diferencaPorPedido = recebePorPedido - e.precoBalcao;
    return {
      chave,
      precoApp,
      recebePorPedido,
      diferencaPorPedido,
      diferencaNoMes: diferencaPorPedido * pedidosMes,
    };
  };

  return {
    ok: true,
    valor: [
      monta('manter', e.precoBalcao),
      monta('meio', precoMeio),
      monta('repassar', base.valor.precoSugerido),
    ],
  };
}

export interface FatiaPreco {
  chave: 'custo' | 'fixas' | 'variaveis' | 'lucro';
  valor: number;
  pctDoPreco: number;
}

/** Abre o preço calculado em quatro fatias, para desenhar a barra. */
export function composicaoDoPreco(e: EntradaMarkup, precoVenda: number): FatiaPreco[] {
  const fatia = (chave: FatiaPreco['chave'], valor: number): FatiaPreco => ({
    chave,
    valor,
    pctDoPreco: precoVenda > 0 ? (valor / precoVenda) * 100 : 0,
  });
  return [
    fatia('custo', e.custo),
    fatia('fixas', precoVenda * (e.despesasFixasPct / 100)),
    fatia('variaveis', precoVenda * (e.despesasVariaveisPct / 100)),
    fatia('lucro', precoVenda * (e.lucroPct / 100)),
  ];
}

// ─────────────────────────── Formatação ─────────────────────────────

/** Lê número digitado em português: "1.234,56", "1234,56" ou "1234.56". */
export function lerNumero(texto: string): number {
  const t = texto.trim().replace(/\s|R\$|%/g, '');
  if (!t) return Number.NaN;
  const normalizado = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  return Number(normalizado);
}

export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const pct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

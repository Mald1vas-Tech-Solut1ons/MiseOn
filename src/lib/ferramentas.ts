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

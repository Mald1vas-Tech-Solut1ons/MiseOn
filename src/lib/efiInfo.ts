// ── Efí Bank: taxas e referências usadas nas telas ─────────────────────────
// Fonte única de verdade: usada na aba Pagamentos (admin/Loja), na Central de
// Ajuda (admin/Ajuda) e na landing page (Home). Valores da tabela PÚBLICA da
// Efí — negociáveis por volume e sujeitos a alteração pelo banco.
// Ao atualizar, mude aqui e todas as telas acompanham.

export const EFI_TARIFAS = {
  pix: '1,19%',
  boleto: 'R$ 3,45',
  creditoAVista: '3,49%',
  creditoParcelado2a6: '3,99%',
  creditoParcelado7a12: '4,39%',
  antecipacaoPorParcela: '1,29%',
  referencia: 'julho/2026',
} as const;

export const SAAS_PRICING = {
  mensal: {
    bruto: 169.90,
    descontoPixPct: 0.05,
    pix: 161.40, // 169.90 com 5% de desconto à vista
  },
  anual: {
    mensalEquivalente: 149.90,
    totalBruto: 1798.80, // 12 x 149.90
    economiaMensal: 20.00,
    pix: 1708.86, // 1798.80 com 5% de desconto à vista (Economia de R$ 329.94/ano)
    // ── Parcelamento do plano anual: ÚNICA fonte de verdade ────────────────
    // O seletor da tela de Assinatura é montado a partir desta lista, e as
    // páginas comerciais (Home, Pricing, ComoFuncionaPreco, NicheLanding)
    // escrevem a frase da oferta a partir dela.
    //
    // Até 15/09/2026 seis telas anunciavam "em até 12x" enquanto o checkout
    // só aceitava 3x: a oferta e a cobrança eram textos escritos à mão, livres
    // para divergir. Quem clicasse encontrava uma condição diferente da
    // anunciada. Não volte a escrever parcela à mão em nenhuma tela.
    //
    // Para passar a oferecer 6x, 8x ou 12x, acrescente as entradas AQUI — o
    // site inteiro passa a anunciar exatamente o que o checkout cobra. Antes
    // de acrescentar, lembre do custo: a Efí cobra 3,99% de 2 a 6 parcelas e
    // 4,39% de 7 a 12 (ver EFI_TARIFAS), e o dinheiro entra parcelado.
    cartao: [
      { qtd: 1, valorParcela: 1798.80, total: 1798.80 },
      { qtd: 2, valorParcela: 899.40, total: 1798.80 },
      { qtd: 3, valorParcela: 599.60, total: 1798.80 }
    ]
  },
  trialDias: 30,
  toleranciaDias: 7,
} as const;

const emBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Maior parcelamento que o checkout realmente aceita hoje. */
export const maxParcelasAnual = (): number =>
  Math.max(...SAAS_PRICING.anual.cartao.map((p) => p.qtd));

/** "em até 3x" / "à vista" — para completar frases de oferta. */
export const parcelamentoAnualCurto = (): string => {
  const max = maxParcelasAnual();
  return max > 1 ? `em até ${max}x no cartão` : 'à vista no cartão';
};

/** Rótulo de uma opção do seletor: "3x de R$ 599,60 (total R$ 1.798,80)". */
export const rotuloParcelaAnual = (p: { qtd: number; valorParcela: number; total: number }): string =>
  p.qtd === 1
    ? `1x de ${emBRL(p.valorParcela)} à vista`
    : `${p.qtd}x de ${emBRL(p.valorParcela)} (total ${emBRL(p.total)})`;

/**
 * Frase completa da oferta anual, montada a partir das parcelas que existem:
 * "Total anual de R$ 1.798,80: 1x, 2x de R$ 899,40 ou 3x de R$ 599,60 no
 * cartão. No Pix: R$ 1.708,86 à vista (5% OFF)."
 */
export const fraseOfertaAnual = (): string => {
  const partes = SAAS_PRICING.anual.cartao
    .map((p) => (p.qtd === 1 ? 'à vista' : `${p.qtd}x de ${emBRL(p.valorParcela)}`));
  const lista = partes.length > 1
    ? `${partes.slice(0, -1).join(', ')} ou ${partes[partes.length - 1]}`
    : partes[0];
  return `Total anual de ${emBRL(SAAS_PRICING.anual.totalBruto)}: ${lista} no cartão. `
    + `No Pix: ${emBRL(SAAS_PRICING.anual.pix)} à vista (5% OFF).`;
};

export const EFI_LINKS = {
  site: 'https://sejaefi.com.br',
  tarifas: 'https://sejaefi.com.br/tarifas',
  abrirConta: 'https://sejaefi.com.br/efi-bank/efi-empresas',
} as const;

export interface ConferenciaLeitura {
  coerente: boolean;
  motivo?: string;
  total_esperado?: number;
}

export interface ValoresItemNota {
  qtd: number;
  valor_unitario: number;
  valor_total: number;
  conferencia?: ConferenciaLeitura;
}

/** A mesma tolerância usada na leitura do cupom: preserva arredondamentos por peso. */
export function conferirValoresNota(item: ValoresItemNota): ConferenciaLeitura {
  const { qtd, valor_unitario: unitario, valor_total: total } = item;
  if (![qtd, unitario, total].every(n => Number.isFinite(n) && n > 0)) {
    return { coerente: false, motivo: 'Preencha quantidade, valor unitário e total com números maiores que zero.' };
  }
  const esperado = Number((qtd * unitario).toFixed(2));
  if (!Number.isFinite(esperado)) {
    return { coerente: false, motivo: 'Os valores informados são inválidos.' };
  }
  if (Math.abs(esperado - total) > Math.max(0.02, total * 0.005)) {
    return {
      coerente: false,
      total_esperado: esperado,
      motivo: 'Quantidade × valor unitário não coincide com o total. Confira os três valores no cupom, incluindo descontos da linha.',
    };
  }
  return { coerente: true };
}

export function avaliarConferenciaNota(item: ValoresItemNota, origem?: string) {
  const porFoto = origem === 'OCR_FOTO' || item.conferencia !== undefined;
  const calculo = conferirValoresNota(item);
  const valoresInvalidos = ![item.qtd, item.valor_unitario, item.valor_total]
    .every(n => Number.isFinite(n) && n > 0);
  // Um aviso adicional do extrator continua visível mesmo se os números fecharem.
  const conferencia = !calculo.coerente ? calculo : item.conferencia ?? calculo;
  return {
    porFoto,
    valoresInvalidos: porFoto && valoresInvalidos,
    precisaConfirmacao: porFoto && !conferencia.coerente,
    motivo: conferencia.motivo ?? 'A leitura por foto pediu conferência deste item.',
  };
}

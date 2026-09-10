/**
 * MiseOn — autoridade única da conferência de caixa.
 *
 * POR QUE ISTO EXISTE COMO MÓDULO: a conta de "quanto tem que ter na gaveta"
 * morava dentro de um `useCallback` do PDV, misturada com a consulta ao banco.
 * Não dava pra testar sem subir React nem sem banco, e o resultado dessa conta
 * é o número que o lojista usa pra decidir se falta ou sobra dinheiro no fim do
 * turno. Regra de dinheiro sem teste é dívida crítica.
 *
 * A GAVETA:
 *
 *   fundo de troco
 *   + recebido em DINHEIRO durante o turno (balcão e salão)
 *   + reforços (dinheiro que entrou na gaveta)
 *   - sangrias (dinheiro que saiu da gaveta)
 *   = o que tem que estar lá quando o lojista contar
 *
 * O QUE NÃO ENTRA: delivery pago em dinheiro fica com o entregador e nunca
 * passa por esta gaveta; cartão, Pix e iFood não são cédula. Só dinheiro vivo
 * que fisicamente entrou na gaveta conta aqui.
 *
 * A REGRA CORRIGIDA EM 10/09/2026: a versão anterior somava o `valor_total` do
 * PEDIDO sempre que existisse ALGUM pagamento em dinheiro nele, e recortava o
 * turno pela data de CRIAÇÃO do pedido. Isso errava dinheiro de verdade em três
 * situações que o salão produz todo dia — todas travadas em teste aqui ao lado:
 *
 *   1. conta dividida: mesa de R$ 200 paga com R$ 50 em dinheiro e R$ 150 no
 *      cartão fazia o sistema esperar R$ 200 na gaveta (sobra fantasma de 150);
 *   2. mesa aberta ANTES do turno e paga durante ele: o dinheiro entrava na
 *      gaveta e a conferência não sabia (falta fantasma);
 *   3. pedido criado no turno e pago DEPOIS do fechamento: contado adiantado.
 *
 * Por isso a fonte da verdade aqui é o PAGAMENTO — valor efetivamente pago, na
 * data em que foi pago —, nunca o total do pedido.
 */

/** Uma linha de `pagamentos` já filtrada por método DINHEIRO e status PAGO. */
export type RecebimentoEmDinheiro = {
  valor_pago: number | string | null;
};

export type MovimentacaoDeCaixa = {
  tipo: string;
  valor: number | string | null;
};

/** Converte numeric do Postgres (que chega como string) sem virar NaN. */
function numero(v: number | string | null | undefined): number {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Soma o que entrou de cédula na gaveta no turno.
 *
 * Recebe LINHAS DE PAGAMENTO, não pedidos: um pedido pode ter vários
 * pagamentos (conta dividida entre os clientes da mesa, ou pagamento parcial
 * agora e o resto depois) e só a parte em dinheiro entra na gaveta.
 */
export function somarRecebidoEmDinheiro(pagamentos: RecebimentoEmDinheiro[]): number {
  return (pagamentos ?? []).reduce((soma, p) => soma + numero(p.valor_pago), 0);
}

/** Separa reforços (entrada) de sangrias (saída) das movimentações do turno. */
export function somarMovimentacoes(movs: MovimentacaoDeCaixa[]): {
  reforcos: number;
  sangrias: number;
} {
  let reforcos = 0;
  let sangrias = 0;
  for (const m of movs ?? []) {
    if (m.tipo === 'REFORCO') reforcos += numero(m.valor);
    else if (m.tipo === 'SANGRIA') sangrias += numero(m.valor);
  }
  return { reforcos, sangrias };
}

/** Quanto tem que estar na gaveta agora. */
export function calcularDinheiroGaveta(params: {
  fundoTroco: number | string | null | undefined;
  recebidoEmDinheiro: number;
  reforcos: number;
  sangrias: number;
}): number {
  return (
    numero(params.fundoTroco) +
    params.recebidoEmDinheiro +
    params.reforcos -
    params.sangrias
  );
}

/**
 * Diferença do fechamento: positivo = sobrou na gaveta, negativo = faltou.
 * Zero (dentro de meio centavo) é o fechamento certo — comparação direta de
 * float aqui produziria "diferença de R$ 0,00" pintada de vermelho.
 */
export function diferencaDeFechamento(contado: number, esperado: number): number {
  const d = contado - esperado;
  return Math.abs(d) < 0.005 ? 0 : d;
}

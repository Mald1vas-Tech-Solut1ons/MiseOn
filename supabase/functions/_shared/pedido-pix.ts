// Confirmação de pagamento Pix de PEDIDO (cliente pagando a loja).
//
// Mesma ideia do _shared/assinatura-pix.ts: a regra mora fora da function
// porque tem dois caminhos legítimos para a mesma verdade —
//   - `pix-webhook`, quando a Efí avisa;
//   - `pix-criar-cobranca` (ação 'status'), quando a tela do cliente pergunta
//     enquanto o QR está aberto.
// Depender só do aviso já custou caro: entre 17/08 e 21/08/2026 o webhook
// recusou tudo por falta de segredo e não havia segundo caminho — pedido pago
// ficaria eternamente "aguardando".
//
// A fonte da verdade é SEMPRE a resposta da Efí (GET /v2/cob/{txid}), nunca o
// corpo do webhook e nunca o cliente.

import { valorPagoDaCobranca } from './assinatura-pix.ts';

export type ResultadoPedido = {
  pago: boolean;
  pedido_id?: string;
  motivo?: 'sem_pagamento' | 'nao_concluida' | 'valor_menor' | 'ja_processado';
};

type Log = { info: (m: string, c?: unknown) => void; warn: (m: string, c?: unknown) => void; error: (m: string, e?: unknown, c?: unknown) => void };
const semLog: Log = { info: () => {}, warn: () => {}, error: () => {} };

/**
 * Aplica o pagamento de uma cobrança Pix de pedido já consultada na Efí.
 * Idempotente: a virada PENDENTE -> PAGO é condicional, então webhook repetido
 * e consulta da tela em paralelo não duplicam ledger nem status.
 */
export async function confirmarPagamentoPedido(
  supabase: any,
  txid: string,
  cob: any,
  log: Log = semLog,
): Promise<ResultadoPedido> {
  const { data: pgto } = await supabase
    .from('pagamentos')
    .select('pedido_id, status, pedidos(loja_id, numero, valor_total, status)')
    .eq('gateway_txid', txid)
    .eq('status', 'PENDENTE')
    .maybeSingle();

  if (!pgto?.pedido_id) {
    // Ou não existe, ou já foi pago numa passada anterior.
    const { data: jaPago } = await supabase
      .from('pagamentos')
      .select('pedido_id')
      .eq('gateway_txid', txid)
      .eq('status', 'PAGO')
      .maybeSingle();
    return jaPago?.pedido_id
      ? { pago: true, pedido_id: jaPago.pedido_id, motivo: 'ja_processado' }
      : { pago: false, motivo: 'sem_pagamento' };
  }

  if (String(cob?.status) !== 'CONCLUIDA') return { pago: false, motivo: 'nao_concluida' };

  const totalPedido = Number((pgto.pedidos as any)?.valor_total ?? 0);
  const pago = valorPagoDaCobranca(cob);
  if (pago + 0.01 < totalPedido) {
    log.warn('Pix do pedido: pago menor que o total; não confirma.', { txid, pago, totalPedido });
    return { pago: false, motivo: 'valor_menor' };
  }

  // Trava de idempotência: só segue quem virou a linha.
  const { data: pagoRow } = await supabase
    .from('pagamentos')
    .update({ status: 'PAGO', data_pagamento: new Date().toISOString() })
    .eq('gateway_txid', txid)
    .eq('status', 'PENDENTE')
    .select('pedido_id')
    .maybeSingle();
  if (!pagoRow?.pedido_id) return { pago: true, pedido_id: pgto.pedido_id, motivo: 'ja_processado' };

  // NOTA LEDGER (2026-09-05, Sprint 1 — receita única):
  // A confirmação do Pix NÃO lança mais receita no ledger. A ÚNICA origem de
  // lançamento de receita de pedido é fn_lancar_receita_pedido, no FINALIZADO
  // (trigger fn_trg_status_pedido) — a mesma regra para Pix, cartão e dinheiro.
  // Lançar aqui também fazia o DRE contar pedido Pix em dobro (crédito em
  // conta RECEITA no pagamento + de novo na finalização) e o estorno nunca
  // revertia esta entrada. Aqui ficam só os fatos operacionais: pagamento PAGO
  // e pedido ACEITO.

  // Só depois de confirmado o pedido entra na operação.
  await supabase
    .from('pedidos')
    .update({ status: 'ACEITO' })
    .eq('id', pagoRow.pedido_id)
    .eq('status', 'NOVO');

  log.info('Pagamento Pix confirmado (receita lança no FINALIZADO)', { txid, pedido_id: pagoRow.pedido_id });
  return { pago: true, pedido_id: pagoRow.pedido_id };
}

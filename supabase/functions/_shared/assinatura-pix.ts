// Confirmação de pagamento Pix da ASSINATURA (loja pagando a MiseOn).
//
// Mora aqui porque tem dois caminhos legítimos para a mesma verdade:
//   - `pix-webhook`, quando a Efí avisa;
//   - `saas-pix` (ação 'status'), quando a tela pergunta enquanto o QR está
//     aberto — o webhook pode falhar, atrasar ou nem estar configurado, e o
//     lojista que já pagou não pode ficar preso na tela.
// Os dois passam pela MESMA função, então a regra de ativação existe uma vez
// só e o efeito é idempotente: quem chega depois não estende nada de novo.

/** Soma o que realmente entrou na cobrança (a Efí manda a lista de pix). */
export function valorPagoDaCobranca(cob: any): number {
  const lista = Array.isArray(cob?.pix) ? cob.pix : [];
  const somaPix = lista.reduce((s: number, p: any) => s + Number(p?.valor ?? 0), 0);
  if (somaPix > 0) return somaPix;
  return Number(cob?.valor?.original ?? 0);
}

export type ResultadoConfirmacao = {
  confirmado: boolean;
  /** Só preenchido quando ESTA chamada foi a que ativou (idempotência). */
  vencimento?: string;
  motivo?: 'sem_fatura' | 'nao_concluida' | 'valor_menor' | 'ja_processada' | 'falha_ativacao';
};

type Log = { info: (m: string, c?: unknown) => void; warn: (m: string, c?: unknown) => void; error: (m: string, e?: unknown, c?: unknown) => void };

const semLog: Log = { info: () => {}, warn: () => {}, error: () => {} };

/**
 * Aplica o pagamento de uma cobrança Pix de assinatura já consultada na Efí.
 * `cob` é a resposta de GET /v2/cob/{txid} — a fonte da verdade é sempre a
 * Efí, nunca o cliente.
 */
export async function aplicarPagamentoAssinatura(
  supabase: any,
  txid: string,
  cob: any,
  log: Log = semLog,
): Promise<ResultadoConfirmacao> {
  const { data: fatura } = await supabase
    .from('faturas_assinatura')
    .select('id, loja_id, ciclo, valor_cobrado, status_cobranca')
    .eq('efi_charge_id', txid)
    .maybeSingle();
  if (!fatura) return { confirmado: false, motivo: 'sem_fatura' };

  // Já confirmada antes (pelo webhook ou por outra consulta da tela).
  if (fatura.status_cobranca === 'pago') return { confirmado: true, motivo: 'ja_processada' };

  if (String(cob?.status) !== 'CONCLUIDA') return { confirmado: false, motivo: 'nao_concluida' };

  const pago = valorPagoDaCobranca(cob);
  const devido = Number(fatura.valor_cobrado ?? 0);
  if (pago + 0.01 < devido) {
    log.warn('Pix da assinatura: valor pago menor que a fatura; não ativa.', { txid, pago, devido });
    return { confirmado: false, motivo: 'valor_menor' };
  }

  // Idempotência: webhook repete e a tela consulta em paralelo. Só segue quem
  // conseguiu virar a linha de 'pendente' para 'pago'.
  const { data: faturaPaga } = await supabase
    .from('faturas_assinatura')
    .update({ status_cobranca: 'pago', data_pagamento: new Date().toISOString() })
    .eq('id', fatura.id)
    .eq('status_cobranca', 'pendente')
    .select('id')
    .maybeSingle();
  if (!faturaPaga?.id) return { confirmado: true, motivo: 'ja_processada' };

  // Mesma regra da saas-assinar: renovar adiantado não pode queimar os dias
  // que a loja ainda tem pagos.
  const ehAnual = fatura.ciclo === 'anual';
  const { data: lojaAtual } = await supabase
    .from('lojas').select('status_assinatura, trial_termina_em').eq('id', fatura.loja_id).maybeSingle();
  // Loja vitalícia não pode virar 'ativa': seria rebaixar acesso permanente
  // para um acesso que passa a depender de data.
  const vitalicia = String(lojaAtual?.status_assinatura ?? '').toLowerCase() === 'vitalicio';
  const vigente = lojaAtual?.trial_termina_em ? new Date(lojaAtual.trial_termina_em) : null;
  const agora = new Date();
  const base = vigente && vigente > agora ? vigente : agora;
  const novoVencimento = new Date(base);
  novoVencimento.setMonth(novoVencimento.getMonth() + (ehAnual ? 12 : 1));

  const { error: updErr } = await supabase.from('lojas').update({
    ...(vitalicia ? {} : { status_assinatura: 'ativa' }),
    trial_termina_em: novoVencimento.toISOString(),
  }).eq('id', fatura.loja_id);
  if (updErr) {
    log.error('Pix da assinatura confirmado, mas falha ao ativar a loja', updErr, { txid, loja_id: fatura.loja_id });
    return { confirmado: true, motivo: 'falha_ativacao' };
  }

  supabase.functions.invoke('fiscal-emitir-nfse', { body: { fatura_id: fatura.id } })
    .catch((e: unknown) => log.error('Falha ao acionar NFS-e da assinatura (não bloqueia o pagamento)', e));

  log.info('Assinatura confirmada por Pix', {
    txid, loja_id: fatura.loja_id, ciclo: fatura.ciclo, vencimento: novoVencimento.toISOString(),
  });
  return { confirmado: true, vencimento: novoVencimento.toISOString() };
}

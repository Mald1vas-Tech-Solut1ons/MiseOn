// ============================================================
// Fonte única de verdade da assinatura SaaS da loja.
// ------------------------------------------------------------
// O banco (e o painel superadmin) usam o vocabulário EM MINÚSCULO:
//   trial | ativa | atrasada | cancelada | vitalicio
// e a data-limite fica em `trial_termina_em` (serve tanto para o
// fim do teste quanto para o próximo vencimento da assinatura paga).
//
// Historicamente o painel admin lia um `vencimento_assinatura`
// (coluna que NÃO existe em produção) e comparava com 'ATIVO'/'VITALICIO'
// em MAIÚSCULO — nada casava, o select quebrava e a loja caía em
// lockdown indevido. Toda decisão de "loja em dia" passa a vir daqui.
// ============================================================

export type StatusAssinatura =
  | 'trial'
  | 'ativa'
  | 'atrasada'
  | 'cancelada'
  | 'vitalicio';

export interface AssinaturaLoja {
  status_assinatura?: string | null;
  trial_termina_em?: string | null;
  criado_em?: string | null;
}

export interface AssinaturaInfo {
  status: string; // normalizado, minúsculo
  emDia: boolean;
  diasAtraso: number; // 0 quando em dia
  validaAte: Date | null;
}

const DIA_MS = 1000 * 60 * 60 * 24;

/**
 * Avalia a assinatura da loja de forma tolerante a falhas.
 * Regra de ouro pós-incidente: NUNCA bloquear por falta de dado —
 * um falso lockdown derruba loja pagante; um falso "em dia" só
 * atrasa a cobrança e é pego no gate server-side.
 */
export function avaliarAssinatura(loja: AssinaturaLoja | null | undefined): AssinaturaInfo {
  const status = (loja?.status_assinatura ?? '').trim().toLowerCase();

  // Vitalícia e ativa (paga): em dia sempre. Assinatura paga que
  // lapsar é remarcada para 'atrasada' pelo webhook/superadmin —
  // não bloqueamos por data aqui para não derrubar quem pagou.
  if (status === 'vitalicio' || status === 'ativa') {
    return { status, emDia: true, diasAtraso: 0, validaAte: parseData(loja?.trial_termina_em) };
  }

  // Cancelamento interrompe a renovação, não apaga o período já pago.
  // Atraso/cancelamento seguem a mesma régua de 7 dias usada pelo layout.
  if (status === 'cancelada' || status === 'atrasada') {
    const validaAte = parseData(loja?.trial_termina_em);
    if (!validaAte) return { status, emDia: false, diasAtraso: 9999, validaAte: null };
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const venc = new Date(validaAte); venc.setHours(0, 0, 0, 0);
    const diff = Math.floor((hoje.getTime() - venc.getTime()) / DIA_MS);
    return { status, emDia: diff <= 0, diasAtraso: Math.max(0, diff), validaAte };
  }

  // Trial (ou status desconhecido): vale enquanto dentro de trial_termina_em.
  const validaAte = parseData(loja?.trial_termina_em);
  if (!validaAte) {
    // Sem data-limite e sem status terminal: fail-open.
    return { status: status || 'trial', emDia: true, diasAtraso: 0, validaAte: null };
  }

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const venc = new Date(validaAte); venc.setHours(0, 0, 0, 0);
  const diff = Math.floor((hoje.getTime() - venc.getTime()) / DIA_MS);
  const diasAtraso = diff > 0 ? diff : 0;

  return { status: status || 'trial', emDia: diasAtraso === 0, diasAtraso, validaAte };
}

function parseData(v?: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

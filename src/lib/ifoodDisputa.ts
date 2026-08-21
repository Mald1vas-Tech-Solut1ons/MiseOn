import { supabase } from './supabase';

/**
 * Negociações pós-entrega do iFood.
 *
 * O cliente reclama depois de receber e o iFood abre uma negociação com PRAZO
 * — `expira_em`, na casa de minutos. Sem resposta até lá, o iFood executa
 * `acao_no_prazo` sozinho, e em cancelamento pós-entrega isso costuma ser
 * aceitar o cancelamento. O silêncio da loja custa o valor do pedido.
 *
 * Por isso a tela não pode tratar isto como notificação: é uma pendência com
 * relógio, e ela precisa continuar visível até alguém responder.
 */

export interface DisputaIfood {
  id: string;
  pedido_id: string | null;
  dispute_id: string;
  ifood_order_id: string;
  acao: string | null;
  tipo: string | null;
  mensagem: string | null;
  expira_em: string | null;
  acao_no_prazo: string | null;
  alternativas: AlternativaIfood[] | null;
  metadados: Record<string, unknown> | null;
  situacao: 'ABERTA' | 'ACEITA' | 'REJEITADA' | 'ALTERNATIVA' | 'EXPIRADA';
  resposta_erro: string | null;
  criado_em: string;
  pedidos?: { numero: number; valor_total: number } | null;
}

export interface AlternativaIfood {
  id?: string;
  type?: 'REFUND' | 'BENEFIT' | 'ADDITIONAL_TIME';
  metadata?: {
    maxAmount?: { value?: string; currency?: string };
    allowedsAdditionalTimeInMinutes?: number[];
    allowedsAdditionalTimeReasons?: string[];
  };
}

/** Só as abertas: as encerradas viram histórico, não pendência. */
export async function negociacoesAbertas(lojaId: string): Promise<DisputaIfood[]> {
  const { data } = await supabase
    .from('ifood_disputas')
    .select('*, pedidos(numero, valor_total)')
    .eq('loja_id', lojaId)
    .eq('situacao', 'ABERTA')
    .order('expira_em', { ascending: true });
  return (data as DisputaIfood[]) ?? [];
}

type Resposta = { ok: boolean; erro?: string; tecnico?: string; expirada?: boolean; jaRespondida?: boolean };

async function responder(body: Record<string, unknown>): Promise<Resposta> {
  const { data, error } = await supabase.functions.invoke('ifood-disputa', { body });
  if (error) {
    return { ok: false, erro: 'Não deu para falar com o iFood agora. Tente de novo — o prazo continua correndo.', tecnico: error.message };
  }
  if (!data?.ok) return { ok: false, ...data, erro: data?.erro ?? data?.error ?? 'O iFood recusou a resposta.' };
  return { ok: true };
}

/**
 * Aceitar = abrir mão do valor. `motivo` vem de
 * `metadata.acceptCancellationReasons` — a lista que o iFood aceita para ESTA
 * negociação, não texto livre.
 */
export function aceitarNegociacao(disputaId: string, motivo: string, detalhe?: string) {
  return responder({ disputa_id: disputaId, acao: 'aceitar', motivo, detalhe });
}

export function rejeitarNegociacao(disputaId: string, motivo: string) {
  return responder({ disputa_id: disputaId, acao: 'rejeitar', motivo });
}

/**
 * Contraproposta. `valor` vai em reais e a Edge Function converte para
 * centavos (o iFood usa ISO 4217, valor sem decimais).
 */
export function contrapropostaNegociacao(
  disputaId: string,
  tipo: 'REFUND' | 'BENEFIT' | 'ADDITIONAL_TIME',
  dados: { valor?: number; minutos?: number; motivo?: string },
) {
  return responder({ disputa_id: disputaId, acao: 'alternativa', tipo, ...dados });
}

/**
 * Motivos de rejeição do catálogo do iFood (`negotiationReasons`).
 *
 * Ficam aqui e não no banco porque são constantes da API deles, não
 * configuração da loja — e porque a lista de ACEITE vem por negociação, dentro
 * do próprio evento. Misturar as duas na mesma origem daria a impressão errada
 * de que dá para escolher qualquer uma nos dois casos.
 */
export const MOTIVOS_REJEICAO: { codigo: string; descricao: string }[] = [
  { codigo: 'INVENTORY_CHECK', descricao: 'Conferi o estoque e o pedido saiu completo' },
  { codigo: 'PRODUCT_QUALITY', descricao: 'O produto saiu dentro do padrão' },
  { codigo: 'WRONG_ORDER', descricao: 'O pedido entregue confere com o que foi feito' },
  { codigo: 'CUSTOMER_REQUEST', descricao: 'A solicitação do cliente não procede' },
  { codigo: 'UNKNOWN_ISSUE', descricao: 'Não identifiquei o problema relatado' },
];

/** Rótulos legíveis para o que o iFood manda em código. */
export const ROTULO_ACAO: Record<string, string> = {
  CANCELLATION: 'Cancelamento total',
  PARTIAL_CANCELLATION: 'Cancelamento parcial',
  PROPOSED_AMOUNT_REFUND: 'Reembolso proposto',
  PROPOSED_ADDITIONAL_TIME: 'Mais tempo de preparo',
  VOID: 'Sem ação',
};

export const ROTULO_TIPO: Record<string, string> = {
  AFTER_DELIVERY: 'depois de receber o pedido',
  AFTER_DELIVERY_PARTIALLY: 'depois de receber, sobre parte do pedido',
  DELAY: 'por atraso na entrega',
  PREPARATION_TIME: 'durante o preparo',
};

/**
 * O que acontece se ninguém responder.
 *
 * É a informação mais importante da tela e a que o iFood entrega em código.
 * "ACCEPT_CANCELLATION" quer dizer: o silêncio da loja vale como aceite.
 */
export function consequenciaDoSilencio(acaoNoPrazo: string | null): string {
  if (acaoNoPrazo === 'ACCEPT_CANCELLATION') return 'Sem resposta, o iFood cancela o pedido e você perde o valor.';
  if (acaoNoPrazo === 'REJECT_CANCELLATION') return 'Sem resposta, o iFood rejeita o cancelamento automaticamente.';
  return 'Sem resposta, o iFood encerra a negociação sem ação.';
}

import type { StatusPedido } from '../../types';

/**
 * Paleta de status do pedido — UMA fonte para as duas formas de mostrar.
 *
 * Antes havia dois vocabulários de cor concorrentes: o cabeçalho do cartão
 * (`FLUXO`, com rgba fixo pensado só para fundo escuro) e as listagens, que
 * pintavam TUDO de cinza. Na aba iFood, um pedido cancelado ficava visualmente
 * igual a um que acabou de entrar — a etiqueta "CANCELADO" sumia no fundo.
 *
 * A cor segue o que a situação PEDE de quem está olhando:
 *   laranja = chegou agora, alguém precisa agir
 *   azul    = aceito, na fila
 *   âmbar   = na cozinha, é onde o relógio pesa
 *   violeta = pronto, esperando sair
 *   verde   = a caminho / entregue
 *   cinza   = encerrado
 *   vermelho= cancelado
 *
 * `tag` funciona nos dois temas (as classes têm variante dark); `hex`/`bg`
 * atendem o cabeçalho do cartão, que é sempre azul-escuro e usa estilo inline.
 */
type CorStatus = {
  /** Cor do texto no cabeçalho escuro do cartão. */
  hex: string;
  /** Fundo do selo no cabeçalho escuro do cartão. */
  bg: string;
  /** Classes da etiqueta em listagens (claro e escuro). */
  tag: string;
};

export const STATUS_COR: Record<string, CorStatus> = {
  NOVO: {
    hex: '#FC5B24',
    bg: 'rgba(252,91,36,.18)',
    tag:
      'bg-orange-100 text-orange-800 ring-1 ring-orange-600/25 ' +
      'dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-400/30',
  },
  ACEITO: {
    hex: '#6B9EFF',
    bg: 'rgba(10,92,196,.18)',
    tag:
      'bg-blue-100 text-blue-800 ring-1 ring-blue-600/20 ' +
      'dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-400/30',
  },
  PREPARANDO: {
    hex: '#FBBF24',
    bg: 'rgba(251,191,36,.16)',
    tag:
      'bg-amber-100 text-amber-900 ring-1 ring-amber-600/25 ' +
      'dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/30',
  },
  PRONTO: {
    hex: '#A78BFA',
    bg: 'rgba(124,58,237,.18)',
    tag:
      'bg-violet-100 text-violet-800 ring-1 ring-violet-600/20 ' +
      'dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-400/30',
  },
  EM_ROTA: {
    hex: '#34D399',
    bg: 'rgba(16,185,129,.18)',
    tag:
      'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-600/20 ' +
      'dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30',
  },
  FINALIZADO: {
    hex: '#34D399',
    bg: 'rgba(16,185,129,.14)',
    tag:
      'bg-gray-100 text-gray-700 ring-1 ring-gray-500/20 ' +
      'dark:bg-white/10 dark:text-gray-300 dark:ring-white/15',
  },
  CANCELADO: {
    hex: '#F87171',
    bg: 'rgba(239,68,68,.14)',
    tag:
      'bg-red-100 text-red-800 ring-1 ring-red-600/25 ' +
      'dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/30',
  },
};

export const FLUXO: Record<string, { prox?: StatusPedido; label?: string; bg: string; color: string }> = {
  NOVO:       { prox: 'ACEITO',     label: 'Aceitar pedido',  ...cor('NOVO') },
  ACEITO:     { ...cor('ACEITO') },
  PREPARANDO: { ...cor('PREPARANDO') },
  PRONTO:     { prox: 'EM_ROTA',    label: 'Saiu p/ entrega', ...cor('PRONTO') },
  EM_ROTA:    { prox: 'FINALIZADO', label: 'Finalizar',       ...cor('EM_ROTA') },
  FINALIZADO: { ...cor('FINALIZADO') },
  CANCELADO:  { ...cor('CANCELADO') },
};

function cor(status: keyof typeof STATUS_COR) {
  return { bg: STATUS_COR[status].bg, color: STATUS_COR[status].hex };
}

export const STATUS_LABEL: Record<string, string> = {
  NOVO: 'NOVO', ACEITO: 'ACEITO', PREPARANDO: 'PREP.', PRONTO: 'PRONTO',
  EM_ROTA: 'EM ROTA', FINALIZADO: 'FINALIZADO', CANCELADO: 'CANCELADO',
};

/** Classe da etiqueta; cai no cinza de "encerrado" se o status for desconhecido. */
export function classeDoStatus(status: string) {
  return (STATUS_COR[status] ?? STATUS_COR.FINALIZADO).tag;
}

/**
 * Quem cancelou e por quê, em uma linha pronta para a tela.
 *
 * A origem sai da coluna `ifood_cancelamento_origem`; pedidos cancelados antes
 * dessa coluna existir carregavam a origem num prefixo "[iFood]" no texto do
 * motivo (a migração fez o backfill, mas cache de tela antigo ainda pode trazer
 * o formato velho — por isso o fallback).
 */
export function resumoCancelamento(p: {
  origem?: string;
  motivo_cancelamento?: string | null;
  ifood_cancelamento_origem?: 'LOJA' | 'IFOOD' | null;
  ifood_cancelamento_erro?: string | null;
}): { quem: string; motivo: string | null; recusa: string | null } {
  const texto = p.motivo_cancelamento ?? null;
  const veioDoIfood =
    p.ifood_cancelamento_origem === 'IFOOD' || (texto ?? '').startsWith('[iFood]');

  return {
    quem: veioDoIfood ? 'Cancelado pelo iFood' : 'Cancelado pela loja',
    motivo: texto ? texto.replace('[iFood]', '').trim() || null : null,
    // O iFood confirma o cancelamento por evento, depois. Quando ele recusa,
    // esta é a única coisa na tela que separa "resolvido" de "cliente ainda
    // esperando" — por isso sobe junto com o resumo, não escondida num detalhe.
    recusa: p.ifood_cancelamento_erro ?? null,
  };
}

/**
 * KDS — regras de qual etapa aparece em cada visão do quadro.
 *
 * O pipeline do pedido é ÚNICO (pedidos.etapa_kds_atual anda no array
 * completo de etapas da loja). A estação de uma etapa
 * (lojas.kds_etapas[].estacao — 20260905150000) só decide QUAIS COLUNAS
 * cada visão do KDS mostra:
 *
 *   TODAS    → todas as etapas;
 *   COZINHA  → globais + estacao 'COZINHA';
 *   BAR      → globais + estacao 'BAR'.
 *
 * Invariante deste módulo: a lista devolvida carrega o ÍNDICE REAL de cada
 * etapa no array completo. Nenhuma regra do KDS (fila na primeira coluna,
 * PRONTO na última etapa REAL, drag-and-drop) pode usar índice da lista
 * visível — filtrar a visão não pode mudar o fluxo de status.
 */

import type { EtapaKDS, EtapaKdsWorkflow, KdsTicket, KdsWorkflow } from '../types';

export type FiltroEstacaoKDS = 'TODAS' | 'COZINHA' | 'BAR';

export interface EtapaVisivel {
  etapa: EtapaKDS;
  /** Posição da etapa no array COMPLETO — é ela que alimenta o pipeline. */
  indiceReal: number;
}

/**
 * Etapas que a visão pedida mostra, na ordem do pipeline, cada uma com seu
 * índice real. Etapas sem `estacao` (null/ausente) são globais: aparecem em
 * toda visão — é o contrato legado, e é por isso que loja configurada antes
 * deste campo continua funcionando sem migrar nada.
 */
export function etapasVisiveisDaEstacao(
  etapas: EtapaKDS[],
  filtro: FiltroEstacaoKDS,
): EtapaVisivel[] {
  return etapas
    .map((etapa, indiceReal) => ({ etapa, indiceReal }))
    .filter(({ etapa }) => filtro === 'TODAS' || !etapa.estacao || etapa.estacao === filtro);
}

/**
 * Status ao mover um pedido para a etapa na posição `alvoIndex` do array
 * COMPLETO. Extraída 1:1 de KDS.tsx (regra pré-existente, intocada):
 * a ÚLTIMA ETAPA REAL do pipeline conclui o pedido; qualquer outra deixa
 * em preparo. Repare: a última etapa de uma visão FILTRADA não conclui —
 * concluir é propriedade do pipeline, não da tela.
 */
export function statusAoAvancar(
  etapas: EtapaKDS[],
  alvoIndex: number,
): 'PRONTO' | 'PREPARANDO' {
  return alvoIndex >= etapas.length - 1 ? 'PRONTO' : 'PREPARANDO';
}

// ── Sprint 5: KDS Enterprise — tickets por estação (20260908) ────────────
// Aqui não existe "etapa global" nem visão filtrada: o ticket já nasce
// escopado a UMA estação, e etapa_atual_idx anda sozinho no workflow dela.

export interface EtapaAtualDoTicket {
  /** Etapa em que o ticket está agora (undefined se o workflow está vazio). */
  atual?: EtapaKdsWorkflow;
  /** Próxima etapa, ou null se já é a última (avançar marca PRONTO). */
  proxima: EtapaKdsWorkflow | null;
  totalEtapas: number;
}

export function etapaAtualDoTicket(ticket: KdsTicket, workflow: KdsWorkflow): EtapaAtualDoTicket {
  const etapas = [...workflow.etapas].sort((a, b) => a.ordem - b.ordem);
  const atual = etapas[ticket.etapa_atual_idx];
  const proxima = ticket.etapa_atual_idx + 1 < etapas.length ? etapas[ticket.etapa_atual_idx + 1] : null;
  return { atual, proxima, totalEtapas: etapas.length };
}
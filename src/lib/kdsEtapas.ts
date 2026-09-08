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

import type { EtapaKDS } from '../types';

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
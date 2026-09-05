/**
 * KDS — nível 1 de workflow por estação (20260905150000).
 *
 * Trava as 8 provas exigidas pelo sprint sobre as regras puras de
 * src/lib/kdsEtapas.ts — a visão de cada estação do quadro:
 *
 *   1. etapa GLOBAL aparece em TODAS;
 *   2. etapa GLOBAL aparece em BAR;
 *   3. etapa GLOBAL aparece em COZINHA;
 *   4. etapa BAR não aparece em COZINHA;
 *   5. etapa COZINHA não aparece em BAR;
 *   6. loja sem configuração (só etapas globais) continua funcionando;
 *   7. a lista visível preserva o ÍNDICE REAL do pipeline — o KDS continua
 *      carregando/movendo pedidos pelo array completo, não pela visão;
 *   8. nenhuma regra de status mudou: só a última etapa REAL conclui o
 *      pedido; a última coluna de uma visão FILTRADA não conclui.
 */

import { describe, it, expect } from 'vitest';
import { etapasVisiveisDaEstacao, statusAoAvancar } from '../src/lib/kdsEtapas';
import type { EtapaKDS } from '../src/types';

const etapa = (id: string, nome: string, estacao?: EtapaKDS['estacao']): EtapaKDS => ({
  id,
  nome,
  cor: '#FC5B24',
  ordem: 0,
  ...(estacao ? { estacao } : {}),
});

/** Pipeline do critério de sucesso do sprint: global + cozinha + bar. */
const PIPELINE: EtapaKDS[] = [
  etapa('recebido', 'Recebido'),                       // global
  etapa('chapa', 'Chapa', 'COZINHA'),
  etapa('montagem', 'Montagem', 'COZINHA'),
  etapa('preparar_bebida', 'Preparar bebida', 'BAR'),
  etapa('finalizar_bebida', 'Finalizar bebida', 'BAR'),
  etapa('pronto', 'Pronto'),                           // global
];

/** Pipeline legado: etapas padrão do KDS, sem estação nenhuma. */
const PIPELINE_LEGADO: EtapaKDS[] = [
  etapa('etapa_fila', 'Fila de Entrada'),
  etapa('etapa_preparo', 'Em Preparo / Montagem'),
  etapa('etapa_pronto', 'Expedição / Pronto'),
];

const ids = (visiveis: ReturnType<typeof etapasVisiveisDaEstacao>) =>
  visiveis.map(({ etapa: e }) => e.id);

describe('KDS — visão por estação (nível 1)', () => {
  it('1. etapa global aparece em TODAS', () => {
    expect(ids(etapasVisiveisDaEstacao(PIPELINE, 'TODAS'))).toContain('recebido');
    expect(ids(etapasVisiveisDaEstacao(PIPELINE, 'TODAS'))).toContain('pronto');
  });

  it('2. etapa global aparece em BAR', () => {
    const bar = ids(etapasVisiveisDaEstacao(PIPELINE, 'BAR'));
    expect(bar).toContain('recebido');
    expect(bar).toContain('pronto');
  });

  it('3. etapa global aparece em COZINHA', () => {
    const cozinha = ids(etapasVisiveisDaEstacao(PIPELINE, 'COZINHA'));
    expect(cozinha).toContain('recebido');
    expect(cozinha).toContain('pronto');
  });

  it('4. etapa BAR não aparece em COZINHA', () => {
    const cozinha = ids(etapasVisiveisDaEstacao(PIPELINE, 'COZINHA'));
    expect(cozinha).not.toContain('preparar_bebida');
    expect(cozinha).not.toContain('finalizar_bebida');
  });

  it('5. etapa COZINHA não aparece em BAR', () => {
    const bar = ids(etapasVisiveisDaEstacao(PIPELINE, 'BAR'));
    expect(bar).not.toContain('chapa');
    expect(bar).not.toContain('montagem');
  });

  it('6. loja sem configuração (só etapas globais) continua funcionando em qualquer visão', () => {
    // Nenhuma etapa tem estacao: toda visão vê o pipeline inteiro, na ordem.
    for (const filtro of ['TODAS', 'COZINHA', 'BAR'] as const) {
      expect(ids(etapasVisiveisDaEstacao(PIPELINE_LEGADO, filtro)))
        .toEqual(['etapa_fila', 'etapa_preparo', 'etapa_pronto']);
    }
    // Etapas salvas ANTES do campo existir (sem a chave) também são globais.
    const semChave = PIPELINE_LEGADO.map(({ ...e }) => e) as EtapaKDS[];
    expect(ids(etapasVisiveisDaEstacao(semChave, 'BAR'))).toHaveLength(3);
  });

  it('7. a lista visível preserva o ÍNDICE REAL do pipeline (KDS continua movendo pelo array completo)', () => {
    const visaoBar = etapasVisiveisDaEstacao(PIPELINE, 'BAR');
    // Na visão BAR, "Finalizar bebida" é a 3ª coluna VISTA (índice 2)…
    expect(visaoBar.findIndex((v) => v.etapa.id === 'finalizar_bebida')).toBe(2);
    // …mas sua posição REAL no pipeline é 4 — é ela que grava etapa_kds_atual.
    expect(visaoBar.find((v) => v.etapa.id === 'finalizar_bebida')!.indiceReal).toBe(4);

    // A ordem exibida segue a ordem do pipeline, não da lista filtrada.
    const reais = visaoBar.map((v) => v.indiceReal);
    expect(reais).toEqual([...reais].sort((a, b) => a - b));

    // E o quadro completo não perde nada ao alternar de visão.
    expect(ids(etapasVisiveisDaEstacao(PIPELINE, 'TODAS'))).toEqual(
      PIPELINE.map((e) => e.id),
    );
  });

  it('8. nenhuma regra de status foi alterada: só a última etapa REAL conclui', () => {
    // A última coluna VISTA na visão BAR NÃO conclui o pedido.
    const visaoBar = etapasVisiveisDaEstacao(PIPELINE, 'BAR');
    const ultimoVisivelIdx = visaoBar.findIndex((v) => v.etapa.id === 'finalizar_bebida');
    const indiceRealUltimoVisivel = visaoBar[ultimoVisivelIdx].indiceReal;
    expect(statusAoAvancar(PIPELINE, indiceRealUltimoVisivel)).toBe('PREPARANDO');

    // A última etapa REAL conclui — de qualquer visão.
    expect(statusAoAvancar(PIPELINE, PIPELINE.length - 1)).toBe('PRONTO');

    // Pipeline legado de 3 etapas globais: comportamento idêntico ao de antes.
    expect(statusAoAvancar(PIPELINE_LEGADO, 0)).toBe('PREPARANDO');
    expect(statusAoAvancar(PIPELINE_LEGADO, 1)).toBe('PREPARANDO');
    expect(statusAoAvancar(PIPELINE_LEGADO, 2)).toBe('PRONTO');
  });
});
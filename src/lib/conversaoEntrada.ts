/**
 * Conversão de quantidades na entrada de estoque.
 *
 * Vive fora do componente de propósito: recebimento de compra, inventário e
 * transformação precisam converter do MESMO jeito, e lógica de conversão
 * escondida dentro de um `.tsx` é lógica que a próxima tela vai reimplementar
 * de um jeito ligeiramente diferente.
 */

import { opcoesDeEntrada, validarConversao } from './unidades';
import type { InsumoRendimentoJSON } from '../types';

/** Qualquer coisa que tenha unidade-base e cadeia de rendimento. */
export interface AlvoConversao {
  unidade_medida: string;
  detalhes_rendimento?: InsumoRendimentoJSON | null;
}

/** Estado mínimo que uma tela guarda por linha de quantidade. */
export interface ValorQuantidade {
  qtd: string;
  unidade: string;
  /** Rendimento declarado quando a unidade não está no cadastro do insumo. */
  fatorNovo: string;
}

export function opcoesDe(alvo: AlvoConversao) {
  return opcoesDeEntrada(
    alvo.unidade_medida,
    alvo.detalhes_rendimento?.regras,
    alvo.detalhes_rendimento?.equivalencias,
  );
}

/** Unidade de compra do insumo — o topo da cadeia de rendimento. */
export function unidadePadrao(alvo: AlvoConversao): string {
  return opcoesDe(alvo)[0]?.codigo ?? alvo.unidade_medida;
}

export function valorInicial(alvo: AlvoConversao, qtd = ''): ValorQuantidade {
  return { qtd, unidade: unidadePadrao(alvo), fatorNovo: '' };
}

/**
 * Quantas unidades-base valem 1 unidade escolhida. Zero quando a conversão
 * ainda não é conhecida — o chamador usa isso para travar o salvamento em vez
 * de gravar um saldo inventado.
 */
export function fatorDe(alvo: AlvoConversao, valor: ValorQuantidade): number {
  const opcao = opcoesDe(alvo).find(o => o.codigo === valor.unidade);
  if (opcao) return opcao.fatorParaBase;
  const declarado = Number(valor.fatorNovo) || 0;
  if (declarado <= 0) return 0;
  return validarConversao(valor.unidade, alvo.unidade_medida, 1, declarado).ok ? declarado : 0;
}

/** Quantidade convertida para a unidade-base do insumo. */
export function qtdBase(alvo: AlvoConversao, valor: ValorQuantidade): number {
  return (Number(valor.qtd) || 0) * fatorDe(alvo, valor);
}

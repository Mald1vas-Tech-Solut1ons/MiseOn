import { fatorPara, type ItemDaNota } from './catalogoInsumos';

export interface FatorImportacaoResolvido {
  fator: number;
  origem: 'CONVERSAO_NOTA' | 'HISTORICO' | 'CONFIRMACAO';
  requerConfirmacao: boolean;
  explicacao: string;
}

/**
 * Resolve quanto uma unidade comercial da nota representa na unidade-base do
 * insumo já cadastrado.
 *
 * A conversão física/documental vence quando é conhecida (kg → g, L → ml,
 * "20UN" → un). O histórico só entra quando a nota não contém evidência
 * suficiente. Sem nenhuma das duas fontes, retorna zero para bloquear a
 * importação: fator 1 inventado transforma preço de embalagem em custo
 * unitário e contamina lote, CMV e margem.
 */
export function resolverFatorImportacao(
  item: ItemDaNota,
  unidadeDestino: string,
  fatorHistorico?: number | null,
): FatorImportacaoResolvido {
  const calculado = fatorPara(item, unidadeDestino);
  if (calculado.certo && Number.isFinite(calculado.fator) && calculado.fator > 0) {
    return {
      fator: calculado.fator,
      origem: 'CONVERSAO_NOTA',
      requerConfirmacao: false,
      explicacao: calculado.explicacao,
    };
  }

  const historico = Number(fatorHistorico);
  if (Number.isFinite(historico) && historico > 0) {
    return {
      fator: historico,
      origem: 'HISTORICO',
      requerConfirmacao: false,
      explicacao: 'Conversão reaproveitada do de-para já confirmado para este fornecedor.',
    };
  }

  return {
    fator: 0,
    origem: 'CONFIRMACAO',
    requerConfirmacao: true,
    explicacao: calculado.explicacao,
  };
}

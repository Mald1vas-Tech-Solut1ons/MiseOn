import { converter, getUnidade } from './unidades';
import { fatorPara, type ItemDaNota } from './catalogoInsumos';
import { normalizarUnidadeFiscal, extrairConteudos } from './unidadesFiscais';

/**
 * A AUTORIDADE ÚNICA de "quanto 1 unidade da nota vira no estoque".
 *
 * Toda linha de nota passa por aqui — vínculo com insumo existente, insumo
 * novo, troca de unidade, sugestão da IA. O resultado sempre diz DE ONDE veio
 * o número, porque o servidor (`fn_importar_nfce`) decide com base nisso:
 *
 *   NOTA_FISCAL  fato do XML: `qTrib`/`uTrib` (10 CX com 120 UN tributáveis
 *                = 12 un por caixa). Assinado pela SEFAZ.
 *   REGRA        conversão determinística: mesma unidade, física (kg → g),
 *                ou conteúdo escrito na descrição ("PVC 20UN", "5KG").
 *   HISTORICO    de-para que o lojista já confirmou para este fornecedor.
 *   IA           conteúdo lido pela IA na embalagem. SUGERE, não decide:
 *                exige confirmação, e o servidor recusa sem ela.
 *   USUARIO      o lojista digitou ou confirmou.
 *   NENHUMA      ninguém sabe. Fator 0 = pare. Nunca 1 inventado.
 *
 * A ordem é a da confiança: fato fiscal > regra > histórico > IA > nada. A
 * conversão física vence o histórico de propósito — um de-para antigo com
 * fator 1 para nota em kg foi o que fez cenoura custar R$ 5,48 por grama.
 */
export type OrigemFator = 'NOTA_FISCAL' | 'REGRA' | 'HISTORICO' | 'IA' | 'USUARIO' | 'NENHUMA';

export interface FatorResolvido {
  fator: number;
  origem: OrigemFator;
  requerConfirmacao: boolean;
  explicacao: string;
}

/** Item com os campos tributáveis que só o XML traz. */
export interface ItemComTributavel extends ItemDaNota {
  unidade_tributavel?: string | null;
  qtd_tributavel?: number | null;
}

/** Conteúdo que a IA leu na embalagem (nunca vira fato sozinho). */
export interface ConteudoLidoIA {
  qtd: number;
  unidade: string;
}

const fmt = (n: number) => Number(n.toFixed(4)).toLocaleString('pt-BR');

/**
 * O fato tributável do XML: quantas unidades tributáveis vêm em cada unidade
 * comercial. Só vale quando as siglas diferem (CX × UN) e a conta dá número
 * positivo; aí converte da unidade tributável para a do estoque pela tabela
 * física (UN → un, KG → g).
 */
export function fatorDaUnidadeTributavel(item: ItemComTributavel, unidadeDestino: string): FatorResolvido | null {
  const qCom = Number(item.qtd);
  const qTrib = Number(item.qtd_tributavel);
  const uCom = normalizarUnidadeFiscal((item.unidade ?? '').trim())?.codigo ?? null;
  const uTrib = normalizarUnidadeFiscal((item.unidade_tributavel ?? '').trim())?.codigo ?? null;
  if (!uTrib || !(qCom > 0) || !(qTrib > 0)) return null;
  if (uCom && uCom === uTrib) return null; // nada a acrescentar: mesma unidade

  // Tributável é unidade física/contagem conhecida; sigla sem grandeza não prova nada.
  if (!getUnidade(uTrib)) return null;

  const tribPorCom = qTrib / qCom;
  const direto = uTrib === unidadeDestino ? tribPorCom : converter(tribPorCom, uTrib, unidadeDestino);
  if (direto != null && Number.isFinite(direto) && direto > 0) {
    return {
      fator: Number(direto.toFixed(6)),
      origem: 'NOTA_FISCAL',
      requerConfirmacao: false,
      explicacao: `A nota informa ${fmt(qTrib)} ${item.unidade_tributavel} em ${fmt(qCom)} ${item.unidade}: ` +
        `1 ${item.unidade} = ${fmt(direto)} ${unidadeDestino}.`,
    };
  }

  // Tributável em contagem e estoque em medida: o XML diz quantas unidades há
  // na caixa, a descrição diz quanto tem em cada uma. "2 CX, 24 UN, ÁGUA
  // SANITÁRIA 2L" = 12 frascos × 2 L = 24 L por caixa.
  if (getUnidade(uTrib)?.grandeza === 'contagem') {
    for (const c of extrairConteudos(item.descricao)) {
      const porUnidade = c.unidade === unidadeDestino ? c.qtd : converter(c.qtd, c.unidade, unidadeDestino);
      if (porUnidade != null && Number.isFinite(porUnidade) && porUnidade > 0) {
        const fator = tribPorCom * porUnidade;
        return {
          fator: Number(fator.toFixed(6)),
          origem: 'NOTA_FISCAL',
          requerConfirmacao: false,
          explicacao: `A nota informa ${fmt(tribPorCom)} ${item.unidade_tributavel} por ${item.unidade}, ` +
            `e a descrição diz "${c.trecho}" em cada: 1 ${item.unidade} = ${fmt(fator)} ${unidadeDestino}.`,
        };
      }
    }
  }
  return null;
}

/** Caixa e fardo agrupam UNIDADES: conteúdo em peso/volume na descrição é de cada uma, não da caixa. */
const AGRUPADORES_DE_UNIDADES = new Set(['cx', 'fardo']);

export function resolverFatorLinha(
  item: ItemComTributavel,
  unidadeDestino: string,
  opcoes: { fatorHistorico?: number | null; conteudoIA?: ConteudoLidoIA | null } = {},
): FatorResolvido {
  // 1. Fato fiscal.
  const fiscal = fatorDaUnidadeTributavel(item, unidadeDestino);
  if (fiscal) return fiscal;

  // 2. Regra determinística (mesma unidade, conversão física, descrição).
  const regra = fatorPara(item, unidadeDestino);
  if (regra.certo && Number.isFinite(regra.fator) && regra.fator > 0) {
    // "ÁGUA SANITÁRIA 2L" vendida por CX: o 2 L é de cada frasco, e a caixa
    // pode ter 12. Sem o XML dizer quantos, é ambíguo ("CX LEITE 1L" pode ser
    // a caixinha): sugere, mas pede confirmação. Contagem ("CX 12UN") é da
    // caixa e passa direto.
    const uCom = normalizarUnidadeFiscal((item.unidade ?? '').trim())?.codigo ?? '';
    const conteudoEmMedida = regra.conteudo
      && getUnidade(regra.conteudo.unidade)?.grandeza !== 'contagem'
      && !/\d\s*[xX]\s*\d/.test(regra.conteudo.trecho);
    if (AGRUPADORES_DE_UNIDADES.has(uCom) && conteudoEmMedida) {
      const jaConfirmado = Number(opcoes.fatorHistorico);
      if (Number.isFinite(jaConfirmado) && jaConfirmado > 0) {
        return {
          fator: jaConfirmado,
          origem: 'HISTORICO',
          requerConfirmacao: false,
          explicacao: `Você já confirmou para este fornecedor: 1 ${item.unidade} = ${fmt(jaConfirmado)} ${unidadeDestino}.`,
        };
      }
      return {
        fator: regra.fator,
        origem: 'REGRA',
        requerConfirmacao: true,
        explicacao: `A descrição diz "${regra.conteudo!.trecho}", mas a nota vende por ${item.unidade}: ` +
          `confirme quanto vem em 1 ${item.unidade} (${fmt(regra.fator)} ${unidadeDestino} se a caixa tiver um só).`,
      };
    }
    return { fator: regra.fator, origem: 'REGRA', requerConfirmacao: false, explicacao: regra.explicacao };
  }

  // 3. De-para já confirmado pelo lojista.
  const historico = Number(opcoes.fatorHistorico);
  if (Number.isFinite(historico) && historico > 0) {
    return {
      fator: historico,
      origem: 'HISTORICO',
      requerConfirmacao: false,
      explicacao: 'Conversão reaproveitada do de-para já confirmado para este fornecedor.',
    };
  }

  // 4. IA: sugestão com número, mas quem assina é o lojista.
  const ia = opcoes.conteudoIA;
  if (ia && ia.qtd > 0 && ia.unidade) {
    const naDestino = ia.unidade === unidadeDestino ? ia.qtd : converter(ia.qtd, ia.unidade, unidadeDestino);
    if (naDestino != null && Number.isFinite(naDestino) && naDestino > 0) {
      return {
        fator: naDestino,
        origem: 'IA',
        requerConfirmacao: true,
        explicacao: `A IA leu "${fmt(ia.qtd)} ${ia.unidade}" na embalagem: 1 ${item.unidade || 'unidade'} ` +
          `renderia ${fmt(naDestino)} ${unidadeDestino}. Confirme antes de importar.`,
      };
    }
  }

  // 5. Ninguém sabe: pare.
  return { fator: 0, origem: 'NENHUMA', requerConfirmacao: true, explicacao: regra.explicacao };
}

/**
 * Contrato anterior, mantido para quem ainda chama por ele. As origens novas
 * se reduzem às antigas: fato fiscal e regra eram "CONVERSAO_NOTA".
 */
export interface FatorImportacaoResolvido {
  fator: number;
  origem: 'CONVERSAO_NOTA' | 'HISTORICO' | 'CONFIRMACAO';
  requerConfirmacao: boolean;
  explicacao: string;
}

export function resolverFatorImportacao(
  item: ItemComTributavel,
  unidadeDestino: string,
  fatorHistorico?: number | null,
): FatorImportacaoResolvido {
  const r = resolverFatorLinha(item, unidadeDestino, { fatorHistorico });
  return {
    fator: r.fator,
    origem: r.origem === 'HISTORICO' ? 'HISTORICO'
      : r.origem === 'NOTA_FISCAL' || r.origem === 'REGRA' ? 'CONVERSAO_NOTA' : 'CONFIRMACAO',
    requerConfirmacao: r.requerConfirmacao,
    explicacao: r.explicacao,
  };
}

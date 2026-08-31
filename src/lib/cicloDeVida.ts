/**
 * Ciclo de vida do que entra no estoque: validade, fabricação e lote.
 *
 * ─── OS CENÁRIOS QUE ISTO ATENDE ──────────────────────────────────────────
 *
 * 1. COMPRA DO DIA. Sacola na bancada, 53 itens. Ninguém vai digitar 53
 *    validades — e é por isso que hoje ninguém cadastra nenhuma, e o controle
 *    de vencimento do sistema fica sendo uma tela que nunca avisa nada. Aqui o
 *    sistema propõe a data provável de cada gênero (frango resfriado 4 dias,
 *    arroz um ano) e o lojista confirma ou corrige o que importa.
 *
 * 2. NOTA ANTIGA. Cupom de três semanas atrás achado na gaveta. Parte daquilo
 *    já virou prato vendido; somar ao saldo criaria estoque que não existe. Mas
 *    o preço daquela compra é história que vale — é ela que denuncia o aumento
 *    do fornecedor. Daí os dois modos de entrada.
 *
 * 3. MIGRAÇÃO PARA O SISTEMA. O cliente novo tem prateleira cheia e um maço de
 *    notas. O caminho rápido é: lançar as notas recentes (que ainda estão na
 *    prateleira) e contar o resto no inventário. O que arruína a migração é
 *    lançar seis meses de nota e terminar com um estoque três vezes maior que
 *    a realidade — erro que só aparece semanas depois, quando o CMV não fecha.
 *
 * 4. PERECÍVEL QUE CHEGA PERTO DO VENCIMENTO. Acontece em atacado e em
 *    promoção. O aviso tem que ser na conferência, não no dia em que estragou.
 */

import { itemPorSlug } from './catalogoInsumos';

/** Quanto tempo, em dias, antes de considerar a compra "antiga". */
const DIAS_PARA_NOTA_ANTIGA = 7;
/** Vencimento dentro desta janela já merece aviso na entrada. */
const DIAS_ALERTA_VENCIMENTO = 7;

export type ModoEntrada = 'SOMAR' | 'HISTORICO';

export interface SugestaoValidade {
  /** Data provável de vencimento (ISO, só data), contada da compra. */
  vence_em: string;
  /** Dias de vida útil típicos do gênero. */
  dias: number;
  /** Frase para a tela, no tom de quem sugere e não impõe. */
  texto: string;
}

const soData = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Propõe a validade de um item a partir do gênero reconhecido e da data da
 * compra. `null` quando o gênero não perece de forma relevante ou quando não
 * foi reconhecido — chutar validade de item desconhecido seria pior que nada.
 */
export function sugerirValidade(
  slugGenero: string | null | undefined,
  dataCompra: string | null | undefined,
): SugestaoValidade | null {
  const item = itemPorSlug(slugGenero);
  const dias = item?.validadeDias;
  if (!item || !dias || dias <= 0) return null;

  const base = dataCompra ? new Date(dataCompra) : new Date();
  if (Number.isNaN(base.getTime())) return null;

  const vence = new Date(base);
  vence.setDate(vence.getDate() + dias);

  const texto =
    dias <= 7
      ? `${item.nome} costuma durar ${dias} dias. Confira a data na embalagem.`
      : dias <= 60
        ? `${item.nome} costuma vencer em cerca de ${dias} dias.`
        : `${item.nome} é de longa duração (~${Math.round(dias / 30)} meses).`;

  return { vence_em: soData(vence), dias, texto };
}

/** O gênero é perecível o bastante para que faltar validade seja um problema? */
export function ehPerecivel(slugGenero: string | null | undefined): boolean {
  const dias = itemPorSlug(slugGenero)?.validadeDias;
  return !!dias && dias <= 30;
}

export type SituacaoValidade = 'vencido' | 'vence_logo' | 'ok' | 'sem_validade';

export interface AlertaValidade {
  situacao: SituacaoValidade;
  dias: number | null;
  texto: string;
  /** Merece destaque visual na conferência. */
  critico: boolean;
}

/**
 * Avalia a validade informada contra a data em que o item vai ser usado.
 *
 * O alerta vive na conferência da nota porque é ali que ainda dá para agir:
 * devolver ao fornecedor, negociar desconto, ou pelo menos priorizar o consumo.
 * Descobrir no dia em que estragou é só contabilizar a perda.
 */
export function avaliarValidade(
  vence: string | null | undefined,
  perecivel: boolean,
  hoje = new Date(),
): AlertaValidade {
  if (!vence) {
    return {
      situacao: 'sem_validade',
      dias: null,
      critico: perecivel,
      texto: perecivel
        ? 'Perecível sem validade: o sistema não vai conseguir avisar antes de estragar.'
        : 'Sem validade informada.',
    };
  }

  const d = new Date(`${vence}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return { situacao: 'sem_validade', dias: null, critico: perecivel, texto: 'Data de validade inválida.' };
  }

  // Validade é DIA civil, não instante. Subtrair timestamps faz a contagem
  // mudar com o fuso e com a hora em que a tela foi aberta: o mesmo item
  // apareceria "vence em 3 dias" de manhã e "em 4" à noite. Zerar a hora dos
  // dois lados deixa a conta ser a que o lojista faz olhando o calendário.
  const meiaNoite = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((meiaNoite(d) - meiaNoite(hoje)) / 86_400_000);
  const formatada = d.toLocaleDateString('pt-BR');

  if (dias < 0) {
    return {
      situacao: 'vencido',
      dias,
      critico: true,
      texto: `Já venceu em ${formatada} — confira antes de dar entrada.`,
    };
  }
  if (dias <= DIAS_ALERTA_VENCIMENTO) {
    return {
      situacao: 'vence_logo',
      dias,
      critico: true,
      texto: dias === 0
        ? `Vence hoje (${formatada}). Use primeiro.`
        : `Vence em ${dias} ${dias === 1 ? 'dia' : 'dias'} (${formatada}). Use primeiro.`,
    };
  }
  return { situacao: 'ok', dias, critico: false, texto: `Válido até ${formatada}.` };
}

export interface RecomendacaoEntrada {
  modo: ModoEntrada;
  /** `true` quando a decisão merece ser mostrada como escolha, não como default. */
  perguntar: boolean;
  titulo: string;
  explicacao: string;
}

/**
 * Recomenda como a nota deve entrar, pela idade dela.
 *
 * Compra recente é saldo: a mercadoria está na prateleira. Nota velha é
 * decisão do lojista, e o sistema não pode escolher por ele — só ele sabe se
 * aquele arroz de três semanas atrás ainda está lá ou já virou marmita.
 */
export function recomendarModo(diasDaNota: number | null): RecomendacaoEntrada {
  if (diasDaNota == null || diasDaNota <= DIAS_PARA_NOTA_ANTIGA) {
    return {
      modo: 'SOMAR',
      perguntar: false,
      titulo: 'Somar ao estoque',
      explicacao: 'Compra recente: os itens entram no saldo e ficam disponíveis para uso.',
    };
  }

  return {
    modo: 'SOMAR',
    perguntar: true,
    titulo: 'Esta compra ainda está na prateleira?',
    explicacao:
      `A nota é de ${diasDaNota} dias atrás. Se o que veio nela já foi usado, somar ao saldo ` +
      'cria estoque que não existe — e o CMV para de fechar. Nesse caso, registre só o preço: ' +
      'o histórico de custo é mantido e o saldo fica como está.',
  };
}

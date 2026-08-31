/**
 * Comparação do preço desta nota com o da última compra do mesmo insumo.
 *
 * ─── POR QUE NA IMPORTAÇÃO, E NÃO NUM RELATÓRIO ───────────────────────────
 * Fornecedor que aumenta 15% raramente avisa, e o aumento só aparece no
 * relatório de custo semanas depois — quando a mercadoria já foi consumida, o
 * preço de venda já foi praticado no prejuízo e não há mais nada a fazer.
 *
 * O único instante em que o lojista pode agir é este: o cupom na mão, a compra
 * fresca, o fornecedor ainda ao alcance de um telefonema. É aqui que o número
 * tem valor — depois é só constatação.
 *
 * ─── O QUE CONTA COMO ALERTA ──────────────────────────────────────────────
 * Preço de hortifrúti oscila todo dia; avisar de 2% seria ruído que ensina o
 * lojista a ignorar o aviso. O corte fica em 8%, e a alta é destacada mais que
 * a baixa — a queda é boa notícia, não exige decisão.
 */

/** Última entrada conhecida de um insumo (vem de `vw_ultimo_custo_insumo`). */
export interface UltimoCusto {
  insumo_id: string;
  custo_unitario: number;
  comprado_em: string;
}

export type DirecaoVariacao = 'alta' | 'baixa' | 'estavel';

export interface Variacao {
  direcao: DirecaoVariacao;
  /** Variação relativa: 0.14 = 14% acima da última compra. */
  percentual: number;
  custoAnterior: number;
  custoAtual: number;
  compradoEm: string;
  /** Passou do corte e merece destaque na tela. */
  relevante: boolean;
  /** Frase pronta, no tom de quem está conferindo a compra. */
  texto: string;
}

/** Abaixo disto é oscilação normal de mercado, não notícia. */
const CORTE = 0.08;

const fmtMoeda = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

const fmtData = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
};

/**
 * Compara o custo unitário desta nota com o da última entrada.
 *
 * `null` quando não há com o que comparar — insumo novo, ou entrada anterior
 * sem custo. Inventar uma variação nesse caso seria pior que não mostrar nada.
 */
export function compararPreco(
  custoAtual: number,
  anterior: UltimoCusto | undefined | null,
  unidade: string,
): Variacao | null {
  if (!anterior || !(anterior.custo_unitario > 0) || !(custoAtual > 0)) return null;

  const percentual = (custoAtual - anterior.custo_unitario) / anterior.custo_unitario;
  const absoluto = Math.abs(percentual);
  const direcao: DirecaoVariacao = absoluto < CORTE ? 'estavel' : percentual > 0 ? 'alta' : 'baixa';
  const quando = fmtData(anterior.comprado_em);
  const pct = `${Math.round(absoluto * 100)}%`;

  const texto =
    direcao === 'estavel'
      ? `Mesmo preço da última compra (${fmtMoeda(anterior.custo_unitario)}/${unidade}${quando ? `, ${quando}` : ''}).`
      : direcao === 'alta'
        ? `Subiu ${pct}: ${fmtMoeda(anterior.custo_unitario)} → ${fmtMoeda(custoAtual)} por ${unidade}` +
          `${quando ? ` desde ${quando}` : ''}.`
        : `Caiu ${pct}: ${fmtMoeda(anterior.custo_unitario)} → ${fmtMoeda(custoAtual)} por ${unidade}` +
          `${quando ? ` desde ${quando}` : ''}.`;

  return {
    direcao,
    percentual,
    custoAnterior: anterior.custo_unitario,
    custoAtual,
    compradoEm: anterior.comprado_em,
    relevante: direcao !== 'estavel',
    texto,
  };
}

/**
 * Há quanto tempo a nota foi emitida.
 *
 * Cupom guardado na gaveta e lançado semanas depois entra no estoque com a
 * data certa (a RPC recebe a emissão), mas o lojista precisa saber que está
 * lançando compra velha — senão confere o saldo de hoje contra uma prateleira
 * que já mudou.
 */
export function idadeDaNota(dataEmissao: string | null | undefined, agora = new Date()): {
  dias: number;
  antiga: boolean;
  texto: string;
} | null {
  if (!dataEmissao) return null;
  const d = new Date(dataEmissao);
  if (Number.isNaN(d.getTime())) return null;

  const dias = Math.floor((agora.getTime() - d.getTime()) / 86_400_000);
  if (dias < 0) return { dias, antiga: false, texto: `Nota datada de ${fmtData(dataEmissao)}.` };

  const quando = fmtData(dataEmissao);
  if (dias === 0) return { dias, antiga: false, texto: `Compra de hoje (${quando}).` };
  if (dias === 1) return { dias, antiga: false, texto: `Compra de ontem (${quando}).` };
  if (dias <= 7) return { dias, antiga: false, texto: `Compra de ${quando}, há ${dias} dias.` };

  return {
    dias,
    antiga: true,
    texto: `Esta nota é de ${quando} — ${dias} dias atrás. A entrada será registrada nessa data.`,
  };
}

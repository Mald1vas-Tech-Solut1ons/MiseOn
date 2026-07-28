/**
 * Registro canônico de unidades e grandezas do MiseOn.
 *
 * Fonte única de verdade para: (a) que unidades existem, (b) a que grandeza
 * física cada uma pertence, (c) qual o fator fixo para a unidade-base daquela
 * grandeza, e (d) quais conversões são LEGAIS.
 *
 * ─── O PRINCÍPIO ──────────────────────────────────────────────────────────
 * Grandezas físicas (Massa, Volume) têm fatores IMUTÁVEIS. 1 kg é 1000 g por
 * definição — não por opinião do lojista. Portanto, dentro da mesma grandeza,
 * o rendimento não é entrada humana: ele é calculado. E vale a desigualdade
 *
 *     Q_destino · F_destino  ≤  Q_origem · F_origem
 *
 * (Q = quantidade informada, F = fator para a unidade-base da grandeza.)
 *
 * O "≤" e não "=" é intencional: fracionar e limpar insumos (tirar semente,
 * osso, casca) só pode CONSERVAR ou PERDER massa. Nunca criar. Um insumo que
 * "rende mais massa do que entrou" é sempre erro de digitação ou fraude.
 *
 * Agrupadores (Caixa, Fardo, Pacote) são abstrações comerciais, não grandezas:
 * não têm fator fixo, porque "1 caixa" não tem massa universal. O conteúdo de
 * uma caixa é declarado por entrada humana — e aí sim o lojista é a autoridade.
 */

export type Grandeza = 'massa' | 'volume' | 'contagem' | 'semantico' | 'agrupador';

export interface Unidade {
  /** Código persistido no banco (insumos.unidade_medida). */
  codigo: string;
  rotulo: string;
  grandeza: Grandeza;
  /**
   * Fator para a unidade-base da grandeza (kg para massa, L para volume,
   * un para contagem). `null` para grandezas sem fator universal — agrupadores
   * e unidades semânticas, cujo conteúdo depende de declaração humana.
   */
  fatorBase: number | null;
}

/** Unidade-base de cada grandeza dimensional. */
export const BASE_POR_GRANDEZA: Record<Grandeza, string | null> = {
  massa: 'kg',
  volume: 'L',
  contagem: null, // sem base universal — ver nota em 'un'
  semantico: null,
  agrupador: null,
};

export const UNIDADES: readonly Unidade[] = [
  // ── Massa (base: kg) — fatores imutáveis ──────────────────────────────
  { codigo: 'kg', rotulo: 'Quilograma (kg)', grandeza: 'massa', fatorBase: 1 },
  { codigo: 'g', rotulo: 'Grama (g)', grandeza: 'massa', fatorBase: 0.001 },

  // ── Volume (base: L) — fatores imutáveis ──────────────────────────────
  { codigo: 'L', rotulo: 'Litro (L)', grandeza: 'volume', fatorBase: 1 },
  { codigo: 'ml', rotulo: 'Mililitro (ml)', grandeza: 'volume', fatorBase: 0.001 },

  // ── Contagem ──────────────────────────────────────────────────────────
  // fatorBase null de propósito: contar NÃO é uma grandeza física conversível.
  // Uma "unidade" de tomate não tem massa universal — quantas unidades saem de
  // 10 kg depende do calibre da fruta, logo é declaração humana, não física.
  { codigo: 'un', rotulo: 'Unidade (un)', grandeza: 'contagem', fatorBase: null },

  // ── Quebras semânticas — sem massa universal, rendimento é humano ─────
  // NOTA: os códigos abaixo preservam exatamente as strings já gravadas em
  // insumos.unidade_medida pela UI anterior. Renomear exigiria data migration.
  { codigo: 'fatias', rotulo: 'Fatias', grandeza: 'semantico', fatorBase: null },
  { codigo: 'porção', rotulo: 'Porções', grandeza: 'semantico', fatorBase: null },
  { codigo: 'peça', rotulo: 'Peças', grandeza: 'semantico', fatorBase: null },
  { codigo: 'dente', rotulo: 'Dente (ex: alho)', grandeza: 'semantico', fatorBase: null },
  { codigo: 'maço', rotulo: 'Maço (ex: couve, cebolinha)', grandeza: 'semantico', fatorBase: null },
  { codigo: 'cabeça', rotulo: 'Cabeça (ex: alho, cebola)', grandeza: 'semantico', fatorBase: null },
  { codigo: 'folha', rotulo: 'Folha (ex: alface, louro)', grandeza: 'semantico', fatorBase: null },
  { codigo: 'rodela', rotulo: 'Rodela (ex: tomate, cebola)', grandeza: 'semantico', fatorBase: null },

  // ── Agrupadores abstratos — conteúdo declarado pelo lojista ───────────
  { codigo: 'cx', rotulo: 'Caixa (cx)', grandeza: 'agrupador', fatorBase: null },
  { codigo: 'pct', rotulo: 'Pacote (pct)', grandeza: 'agrupador', fatorBase: null },
  { codigo: 'fardo', rotulo: 'Fardo', grandeza: 'agrupador', fatorBase: null },
  { codigo: 'lata', rotulo: 'Lata', grandeza: 'agrupador', fatorBase: null },
  { codigo: 'gf', rotulo: 'Garrafa (gf)', grandeza: 'agrupador', fatorBase: null },
];

const POR_CODIGO = new Map(UNIDADES.map((u) => [u.codigo, u]));

export function getUnidade(codigo: string): Unidade | undefined {
  return POR_CODIGO.get(codigo);
}

/** Unidade dimensional = tem fator fixo, logo a física manda no rendimento. */
export function ehDimensional(u: Unidade): boolean {
  return u.fatorBase != null;
}

// ---------------------------------------------------------------------------
// A trava: validação de uma conversão origem → destino
// ---------------------------------------------------------------------------

export type MotivoRejeicao =
  | 'unidade-desconhecida'
  | 'identidade' // kg → kg: conversão que não converte nada
  | 'grandeza-incompativel' // massa → volume: não há fator universal
  | 'multiplicacao-espontanea'; // 1 kg → 10 kg: viola conservação

export interface ResultadoValidacao {
  ok: boolean;
  motivo?: MotivoRejeicao;
  mensagem?: string;
  /**
   * Para conversões dimensionais, o único rendimento fisicamente válido
   * (ex.: kg → g ⇒ 1000). A UI deve usá-lo como valor fixo/máximo em vez de
   * deixar o campo livre.
   */
  rendimentoCanonico?: number;
}

/**
 * Valida se `quantidadeDestino` unidades de `destino` podem ser produzidas a
 * partir de `quantidadeOrigem` unidades de `origem`.
 *
 * Aplica Q_d·F_d ≤ Q_o·F_o quando ambas as unidades pertencem à mesma grandeza
 * dimensional. Fora disso (agrupador → massa, massa → semântico, massa → un),
 * não existe fator universal e o rendimento é entrada humana legítima.
 */
export function validarConversao(
  codigoOrigem: string,
  codigoDestino: string,
  quantidadeOrigem = 1,
  quantidadeDestino = 1,
): ResultadoValidacao {
  const origem = getUnidade(codigoOrigem);
  const destino = getUnidade(codigoDestino);

  if (!origem || !destino) {
    return {
      ok: false,
      motivo: 'unidade-desconhecida',
      mensagem: `Unidade desconhecida: "${!origem ? codigoOrigem : codigoDestino}".`,
    };
  }

  // Identidade: converter kg em kg não é conversão, é ruído — e é a porta de
  // entrada do "1 kg rende 10 kg". Bloqueado na origem.
  if (origem.codigo === destino.codigo) {
    return {
      ok: false,
      motivo: 'identidade',
      mensagem: `"${origem.rotulo}" não se converte em si mesmo. Escolha um submúltiplo (ex.: Grama) ou uma quebra semântica (ex.: Fatia).`,
    };
  }

  const ambasDimensionais = ehDimensional(origem) && ehDimensional(destino);

  // Duas grandezas dimensionais DIFERENTES (massa → volume): sem densidade,
  // não há conversão possível. Rejeita em vez de inventar um fator.
  if (ambasDimensionais && origem.grandeza !== destino.grandeza) {
    return {
      ok: false,
      motivo: 'grandeza-incompativel',
      mensagem: `Não é possível converter ${origem.grandeza} (${origem.rotulo}) em ${destino.grandeza} (${destino.rotulo}).`,
    };
  }

  // Mesma grandeza dimensional: a física define o rendimento. Só se permite
  // conservação ou perda — nunca multiplicação.
  if (ambasDimensionais && origem.grandeza === destino.grandeza) {
    const baseOrigem = quantidadeOrigem * origem.fatorBase!;
    const baseDestino = quantidadeDestino * destino.fatorBase!;
    const rendimentoCanonico = origem.fatorBase! / destino.fatorBase!;

    // Tolerância relativa para ruído de ponto flutuante (0.0001 = 0,01%).
    if (baseDestino > baseOrigem * (1 + 1e-4)) {
      const base = BASE_POR_GRANDEZA[origem.grandeza];
      // Arredonda para exibição: multiplicar por 0.001 gera ruído binário
      // (1001×0.001 = 1.0010000000000001) e o lojista não pode ver isso.
      const fmt = (n: number) =>
        n.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
      return {
        ok: false,
        motivo: 'multiplicacao-espontanea',
        mensagem:
          `${fmt(quantidadeOrigem)} ${origem.codigo} = ${fmt(baseOrigem)} ${base}, mas ` +
          `${fmt(quantidadeDestino)} ${destino.codigo} = ${fmt(baseDestino)} ${base}. ` +
          `Fracionar não cria ${origem.grandeza}: o rendimento máximo é ` +
          `${(quantidadeOrigem * rendimentoCanonico).toLocaleString('pt-BR')} ${destino.codigo}.`,
        rendimentoCanonico,
      };
    }
    return { ok: true, rendimentoCanonico };
  }

  // Agrupador → qualquer coisa, ou dimensional → semântico/contagem:
  // não há fator universal, o lojista é a autoridade sobre o rendimento.
  return { ok: true };
}

/**
 * Destinos legais para uma unidade de compra — alimenta o dropdown do Passo 1.
 * A UX previne o erro em vez de puni-lo depois: o que é inválido nem aparece.
 */
export function destinosPermitidos(codigoOrigem: string): Unidade[] {
  return UNIDADES.filter((d) => validarConversao(codigoOrigem, d.codigo).ok);
}

/**
 * Converte uma quantidade entre unidades da MESMA grandeza dimensional.
 * Retorna null quando não há fator universal (agrupadores/semânticas).
 */
export function converter(
  quantidade: number,
  codigoOrigem: string,
  codigoDestino: string,
): number | null {
  const origem = getUnidade(codigoOrigem);
  const destino = getUnidade(codigoDestino);
  if (!origem?.fatorBase || !destino?.fatorBase) return null;
  if (origem.grandeza !== destino.grandeza) return null;
  return (quantidade * origem.fatorBase) / destino.fatorBase;
}

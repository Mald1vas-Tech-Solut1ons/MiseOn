/**
 * Tradução entre o vocabulário do documento fiscal e o catálogo do MiseOn.
 *
 * ─── O PROBLEMA ───────────────────────────────────────────────────────────
 * A NFC-e escreve a unidade comercial em campo livre de até 6 caracteres. Cada
 * mercado abrevia do seu jeito: "BD", "BDJ", "BAND" para a mesma bandeja; "GR"
 * e "G" para grama; "PC" ora peça, ora pacote. Nada disso é código do nosso
 * catálogo (`unidades_medida`), e `insumos.unidade_medida` tem chave
 * estrangeira para ele — logo uma sigla crua não é só feia, ela DERRUBA a
 * importação inteira com "violates foreign key constraint".
 *
 * Foi exatamente o que aconteceu com "APP1 OVOS EXTRA BRANCO PVC 20UN" em
 * bandeja ("bd"): 53 itens perdidos por causa de duas letras.
 *
 * ─── A REGRA ──────────────────────────────────────────────────────────────
 * Nada vindo da nota entra no cadastro sem passar por aqui. Quando a sigla é
 * reconhecida, vira código canônico; quando não é, vira `null` e o chamador
 * decide o destino — nunca se repassa a sigla adiante.
 *
 * Algumas siglas são genuinamente ambíguas no varejo brasileiro ("LT" é litro
 * na bebida e lata na conserva). Elas são traduzidas pela leitura mais comum e
 * marcadas como ambíguas, para a tela pedir conferência em vez de fingir
 * certeza — mas jamais ficam sem tradução, porque sigla solta quebra o banco.
 */

import { getUnidade, converter } from './unidades';

export interface UnidadeFiscal {
  /** Código do catálogo (`unidades_medida.codigo`). */
  codigo: string;
  /** Sigla ambígua no varejo: a tela deve pedir conferência. */
  ambigua: boolean;
}

/**
 * Sigla da nota → código canônico. Chaves já normalizadas (minúsculas, sem
 * acento e sem pontuação) — `normalizarUnidadeFiscal` faz esse preparo.
 */
const SIGLAS: Record<string, string> = {
  // ── Massa ───────────────────────────────────────────────────────────────
  kg: 'kg', kgs: 'kg', kgr: 'kg', quilo: 'kg', quilos: 'kg', quilograma: 'kg', k: 'kg',
  g: 'g', gr: 'g', grs: 'g', gra: 'g', grama: 'g', gramas: 'g',

  // ── Volume ──────────────────────────────────────────────────────────────
  l: 'L', lts: 'L', li: 'L', lit: 'L', litro: 'L', litros: 'L',
  ml: 'ml', mls: 'ml', mililitro: 'ml',

  // ── Contagem ────────────────────────────────────────────────────────────
  un: 'un', und: 'un', uni: 'un', unid: 'un', und1: 'un', unidade: 'un', unidades: 'un',
  pca: 'un', peca: 'un', pecas: 'un', pec: 'un',

  // ── Agrupadores ─────────────────────────────────────────────────────────
  cx: 'cx', cxa: 'cx', caixa: 'cx', cax: 'cx',
  pct: 'pct', pac: 'pct', pack: 'pct', pacote: 'pct', pk: 'pct', pcte: 'pct',
  dz: 'dz', dza: 'dz', duz: 'dz', duzia: 'dz',
  fd: 'fardo', frd: 'fardo', fardo: 'fardo',
  sc: 'sc', sac: 'sc', saco: 'sc', saca: 'sc', sco: 'sc',
  bd: 'bdj', bdj: 'bdj', bj: 'bdj', band: 'bdj', bandeja: 'bdj', bdja: 'bdj',
  gf: 'gf', gfa: 'gf', garrafa: 'gf', grf: 'gf',
  lata: 'lata', lat: 'lata', ltn: 'lata',
  gl: 'gl', gal: 'gl', galao: 'gl',
  bld: 'balde', balde: 'balde',
  pote: 'pote', pot: 'pote', vd: 'pote', vidro: 'pote', fr: 'pote', frasco: 'pote',
  eng: 'engradado', engr: 'engradado', engradado: 'engradado',
  bom: 'bombona', bombona: 'bombona',
};

/**
 * Siglas que a nota usa para mais de uma coisa. Traduzimos pela leitura mais
 * frequente, mas a tela avisa — errar calado aqui vira estoque mentindo.
 */
const AMBIGUAS: Record<string, string> = {
  // "LT" é litro em bebida e óleo, lata em conserva. Litro é o uso dominante.
  lt: 'L',
  // "PC" é peça (contável) na maioria dos açougues e hortifrútis, pacote em
  // alguns mercados. Peça mantém o item contável, que é o caso mais comum.
  pc: 'un', pcs: 'un',
  // "PT" alterna entre pacote e pote conforme o emitente.
  pt: 'pct',
  // "CT" aparece como cartela e como caixeta.
  ct: 'cx', crt: 'cx',
};

/** Tira acento, pontuação e caixa — "Pç." e "PC" são a mesma sigla. */
function limparSigla(bruta: string): string {
  return bruta
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Traduz a unidade impressa na nota para o catálogo. `null` quando a sigla não
 * é reconhecida — o chamador nunca deve cair de volta na sigla crua.
 */
export function normalizarUnidadeFiscal(bruta: string | null | undefined): UnidadeFiscal | null {
  const sigla = limparSigla(bruta ?? '');
  if (!sigla) return null;

  if (SIGLAS[sigla]) return { codigo: SIGLAS[sigla], ambigua: false };
  if (AMBIGUAS[sigla]) return { codigo: AMBIGUAS[sigla], ambigua: true };

  // A sigla pode já ser um código nosso escrito com outra caixa ("KG", "Ml").
  const direto = getUnidade(sigla);
  if (direto) return { codigo: direto.codigo, ambigua: false };

  return null;
}

// ---------------------------------------------------------------------------
// O conteúdo declarado na descrição
// ---------------------------------------------------------------------------

export interface ConteudoEmbalagem {
  /** Quanto vem dentro de UMA unidade comercial da nota. */
  qtd: number;
  /** Código canônico da medida desse conteúdo. */
  unidade: string;
  /** Trecho da descrição que gerou a leitura — a tela mostra para conferência. */
  trecho: string;
}

// "2L", "500 G", "1,5 LT", "20UN", "900ML"
const MEDIDA_SIMPLES = /(\d+(?:[.,]\d+)?)\s*(kgs?|kg|gr?s?|mls?|lts?|l|un[di]?d?|und|dz)\b/gi;
// "12X1L", "6 x 350ML", "C/12" (cartela com 12)
const MEDIDA_MULTIPLA = /(\d+)\s*[x*]\s*(\d+(?:[.,]\d+)?)\s*(kgs?|kg|gr?s?|mls?|lts?|l|un[di]?d?|und)\b/gi;
const CARTELA = /\bc\/\s*(\d+)\b/gi;

const numero = (texto: string) => parseFloat(texto.replace(',', '.')) || 0;

/**
 * Lê no nome do produto quanto vem dentro da embalagem.
 *
 * O mercado já escreve isso: "AGUA SANIT SELECT 2L", "OVOS ... PVC 20UN",
 * "ACUCAR UNIAO 5KG". É a informação que transforma "2 bandejas" em "40 ovos"
 * sem o lojista digitar nada — e é justamente o que ele mais erra digitando.
 *
 * Devolve TODOS os candidatos porque a descrição às vezes traz dois ("COCA 2L
 * PET 6UN"): quem escolhe é `sugerirDaNota`, comparando com a unidade em que o
 * item será controlado.
 */
export function extrairConteudos(descricao: string): ConteudoEmbalagem[] {
  const texto = (descricao ?? '').replace(/\s+/g, ' ');
  const achados: ConteudoEmbalagem[] = [];

  for (const m of texto.matchAll(MEDIDA_MULTIPLA)) {
    const u = normalizarUnidadeFiscal(m[3]);
    const total = Number(m[1]) * numero(m[2]);
    if (u && total > 0) achados.push({ qtd: total, unidade: u.codigo, trecho: m[0].trim() });
  }

  for (const m of texto.matchAll(MEDIDA_SIMPLES)) {
    // Já contabilizado como parte de um "12X1L".
    if (achados.some((a) => a.trecho.toLowerCase().includes(m[0].trim().toLowerCase()))) continue;
    const u = normalizarUnidadeFiscal(m[2]);
    const qtd = numero(m[1]);
    if (!u || qtd <= 0) continue;
    // Dúzia na descrição é conteúdo contável, não agrupador: "OVO DZ" = 12 un.
    if (u.codigo === 'dz') achados.push({ qtd: qtd * 12, unidade: 'un', trecho: m[0].trim() });
    else achados.push({ qtd, unidade: u.codigo, trecho: m[0].trim() });
  }

  for (const m of texto.matchAll(CARTELA)) {
    const qtd = Number(m[1]);
    if (qtd > 0) achados.push({ qtd, unidade: 'un', trecho: m[0].trim() });
  }

  return achados;
}

/**
 * Entre os conteúdos lidos, o que serve para uma unidade de estoque — direto
 * ou por conversão dimensional (declara 500 g, controla em kg ⇒ 0,5).
 */
export function conteudoPara(
  conteudos: ConteudoEmbalagem[],
  unidadeEstoque: string,
): ConteudoEmbalagem | null {
  for (const c of conteudos) {
    if (c.unidade === unidadeEstoque) return c;
    const convertido = converter(c.qtd, c.unidade, unidadeEstoque);
    if (convertido != null && convertido > 0) {
      return { qtd: convertido, unidade: unidadeEstoque, trecho: c.trecho };
    }
  }
  return null;
}

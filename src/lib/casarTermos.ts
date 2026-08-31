/**
 * Casamento de descrição de cupom com o léxico do catálogo.
 *
 * ─── POR QUE ISTO EXISTE ──────────────────────────────────────────────────
 * A primeira versão casava termo literal: para entender "DETERG LIQ MINUANO"
 * era preciso cadastrar "deterg" à mão. Aí aparece "DETERGT", "DET LIQ",
 * "DETERGENTE LIQ" — e o cadastro vira uma lista infinita mantida a cada nota
 * que dá errado. Isso não é catálogo, é remendo: cada mercado abrevia do seu
 * jeito e a lista nunca fecha.
 *
 * ─── A REGRA GERAL ────────────────────────────────────────────────────────
 * Cupom fiscal tem 30 a 40 caracteres por linha, então o varejo abrevia — e
 * abrevia quase sempre do mesmo modo: TRUNCANDO A PALAVRA. "DETERG" é o começo
 * de "detergente", "REQ" de "requeijão", "MUC" de "mussarela", "CALAB" de
 * "calabresa", "MARG" de "margarina". Isso não é uma lista de exceções: é uma
 * REGRA morfológica, e uma regra se implementa uma vez.
 *
 * Sobre ela vêm mais três, todas gerais:
 *   • flexão — "TOMATES" é "tomate" com plural;
 *   • ruído de impressão — "MUCARELA" por "mussarela", letra trocada em papel
 *     térmico ou digitação do mercado;
 *   • estrutura da linha — o produto vem primeiro, marca e embalagem depois.
 *
 * ─── O QUE ESTE MÓDULO NÃO FAZ ────────────────────────────────────────────
 * Não adivinha gênero que não está no catálogo. "PILHA DURACELL" não vira
 * nada aqui, e está certo: para isso existe a classificação por IA. Este
 * módulo resolve barato e na hora o que é reconhecível por morfologia; o que
 * exige entender o mundo é problema de outra camada.
 */

/** Distância de edição, limitada — só interessa saber se é perto. */
function distancia(a: string, b: string, teto: number): number {
  if (Math.abs(a.length - b.length) > teto) return teto + 1;
  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    let menor = i;
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      atual[j] = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + custo);
      menor = Math.min(menor, atual[j]);
    }
    if (menor > teto) return teto + 1; // linha inteira já passou do teto
    anterior = atual;
  }
  return anterior[b.length];
}

/**
 * Tokens que não dizem o que o produto é.
 *
 * Sigla de embalagem, código interno do mercado e medida ocupam metade da
 * linha do cupom e só atrapalham o casamento — "APP1 CX MOLHO SHOYU 5L" fala
 * de shoyu, não de caixa.
 */
const RUIDO = new Set([
  'cx', 'cxa', 'pct', 'pc', 'pcte', 'pt', 'fd', 'frd', 'sc', 'bd', 'bdj', 'pv', 'pvc',
  'cp', 'fr', 'gf', 'un', 'und', 'unid', 'kg', 'kgs', 'g', 'gr', 'ml', 'lt', 'l', 'dz',
  'emb', 'ref', 'tp', 'tipo', 'com', 'sem', 'de', 'da', 'do', 'das', 'dos', 'e', 'c',
  'p', 'a', 'o', 'em', 'na', 'no', 'por', 'para',
]);

/** Código interno impresso antes do nome: "APP1", "PRD2", "A1". */
const CODIGO_INTERNO = /^[a-z]{1,4}\d{1,3}$/;
/** Medida colada: "500g", "2l", "20un", "1kg". */
const MEDIDA = /^\d+(?:[.,]\d+)?(?:kg|kgs|g|gr|grs|ml|mls|l|lt|lts|un|und|unid|dz)?$/;

/**
 * Reduz o plural português ao singular.
 *
 * "LIMOES TAITI" não casava com "limão" por nenhuma das regras anteriores:
 * ões↔ão não é truncamento nem letra trocada. Plural é morfologia, e a do
 * português tem quatro formas irregulares que cobrem o caso inteiro.
 */
export function singularizar(palavra: string): string {
  if (palavra.length <= 3) return palavra;
  if (palavra.endsWith('oes')) return palavra.slice(0, -3) + 'ao';   // limões → limao
  if (palavra.endsWith('aes')) return palavra.slice(0, -3) + 'ao';   // pães   → pao
  if (palavra.endsWith('ais')) return palavra.slice(0, -3) + 'al';   // sais   → sal
  if (palavra.endsWith('eis')) return palavra.slice(0, -3) + 'el';   // papéis → papel
  if (palavra.endsWith('ois')) return palavra.slice(0, -3) + 'ol';   // lençóis→ lencol
  if (palavra.endsWith('is') && palavra.length > 4) return palavra.slice(0, -2) + 'il';
  if (palavra.endsWith('ns')) return palavra.slice(0, -2) + 'm';     // bons   → bom
  if (palavra.endsWith('res') || palavra.endsWith('zes') || palavra.endsWith('ses')) {
    return palavra.slice(0, -2);
  }
  if (palavra.endsWith('s')) return palavra.slice(0, -1);
  return palavra;
}

/**
 * Palavras da descrição que valem para identificar o produto.
 *
 * Devolve a forma escrita, não a singularizada: "PRES" (presunto) terminava em
 * "s" e virava "pre" ao ser tratada como plural, perdendo o truncamento. Quem
 * decide entre plural e abreviação é o casamento, que testa as duas formas.
 */
export function tokensUteis(textoNormalizado: string): string[] {
  return textoNormalizado
    .split(/\s+/)
    .filter((t) => t && !RUIDO.has(t) && !CODIGO_INTERNO.test(t) && !MEDIDA.test(t));
}

/**
 * Qualidade do casamento entre uma palavra da descrição e uma do léxico.
 * Zero quando não casam; 1 quando são a mesma palavra.
 */
export function qualidadeToken(daNota: string, doTermo: string): number {
  const melhor = Math.max(
    bruto(daNota, doTermo),
    // Plural é morfologia à parte: "LIMOES" só alcança "limao" pela redução, e
    // "PRES" só alcança "presunto" sem ela. Testar as duas não escolhe errado.
    daNota !== singularizar(daNota) ? bruto(singularizar(daNota), doTermo) : 0,
  );
  return melhor;
}

function bruto(daNota: string, doTermo: string): number {
  if (daNota === doTermo) return 1;

  // Flexão: "tomates" para "tomate". Diferença curta, senão "sal" viraria
  // "salada" e o lojista veria sal chegando no lugar de alface.
  if (daNota.startsWith(doTermo) && daNota.length - doTermo.length <= 2) return 0.95;

  // Abreviação por truncamento — a forma como o cupom encurta. Exige 3 letras
  // para não deixar duas iniciais casarem com meio catálogo.
  if (doTermo.startsWith(daNota) && daNota.length >= 3) {
    // Quanto mais da palavra foi escrito, mais confiança: "deterg" (6 de 10)
    // vale mais que "det" (3 de 10).
    return 0.7 + 0.28 * (daNota.length / doTermo.length);
  }

  // Abreviação por corte de vogais, a outra forma de encurtar do varejo:
  // "FGO" para frango, "QJO" para queijo, "CX" para caixa. Vale quando as
  // consoantes escritas aparecem, na ordem, dentro da palavra completa.
  if (daNota.length >= 3 && doTermo.length > daNota.length && daNota[0] === doTermo[0]) {
    let i = 0;
    for (const letra of doTermo) if (letra === daNota[i]) i++;
    if (i === daNota.length) return 0.76;
  }

  // Erro de impressão ou grafia do mercado: "mucarela" por "mussarela".
  if (daNota.length >= 5 && doTermo.length >= 5) {
    const teto = daNota.length >= 8 ? 2 : 1;
    if (distancia(daNota, doTermo, teto) <= teto) return 0.78;
  }

  return 0;
}

export interface Alinhamento {
  /** Média da qualidade das palavras do termo. */
  qualidade: number;
  /** Posição, em tokens, onde o termo começa na descrição. */
  posicao: number;
}

/**
 * Procura o termo (uma ou mais palavras) dentro dos tokens da descrição.
 *
 * Exige as palavras do termo em sequência: "molho tomate" não pode casar com
 * "molho de pimenta e extrato de tomate". `null` quando não há alinhamento
 * aceitável.
 */
export function alinharTermo(
  tokensDescricao: string[],
  tokensTermo: string[],
  minimoPorToken = 0.7,
): Alinhamento | null {
  if (tokensTermo.length === 0 || tokensDescricao.length < tokensTermo.length) return null;

  let melhor: Alinhamento | null = null;

  for (let i = 0; i <= tokensDescricao.length - tokensTermo.length; i++) {
    let soma = 0;
    let ok = true;
    for (let j = 0; j < tokensTermo.length; j++) {
      const q = qualidadeToken(tokensDescricao[i + j], tokensTermo[j]);
      if (q < minimoPorToken) { ok = false; break; }
      soma += q;
    }
    if (!ok) continue;

    const candidato = { qualidade: soma / tokensTermo.length, posicao: i };
    // Empate de qualidade: vence quem aparece antes, porque o cupom escreve o
    // produto primeiro e a marca depois.
    if (!melhor || candidato.qualidade > melhor.qualidade) melhor = candidato;
  }

  return melhor;
}

/**
 * Nota final de um termo contra uma descrição.
 *
 * Combina as três coisas que decidem qual gênero é o certo:
 *   qualidade   quão fielmente as palavras casaram;
 *   tamanho     termo de duas palavras é mais específico que o de uma
 *               ("molho tomate" ganha de "tomate");
 *   posição     o que vem antes na linha é o produto; o que vem depois é
 *               marca, sabor ou embalagem.
 */
export function pontuar(a: Alinhamento, tokensTermo: number): number {
  return a.qualidade * (1 + 0.35 * (tokensTermo - 1)) - 0.12 * a.posicao;
}

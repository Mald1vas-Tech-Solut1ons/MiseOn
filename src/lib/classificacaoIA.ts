/**
 * Como a classificação da IA entra no cadastro — e onde ela não manda.
 *
 * ─── A HIERARQUIA ─────────────────────────────────────────────────────────
 * A IA lê a cauda longa que nenhuma lista fixa cobre ("REQ CREM TIROLEZ CP
 * 200G" é requeijão cremoso da Tirolez). Mas ela é um leitor, não a fonte da
 * verdade sobre como o estoque funciona. Quando ela reconhece um gênero que já
 * está no catálogo, quem decide a unidade é o CATÁLOGO.
 *
 * Isso não é preciosismo. Medido na prática, com o modelo respondendo bem no
 * resto: "MUC FAT TIROLEZ 500G" voltou com o gênero certo (queijo-mussarela) e
 * unidade "un", porque a embalagem é um pacote. Aceitar "un" colocaria queijo
 * em unidades num estoque que controla queijo em quilo — e aí a ficha técnica
 * que consome 0,2 kg de mussarela não fecha com nada. Mesmo caso do azeite, que
 * voltou "un" tendo o catálogo em litro.
 *
 * ─── O NOME ───────────────────────────────────────────────────────────────
 * A IA devolve nome e variedade separados, mas às vezes repete a variedade
 * dentro do nome ("Requeijão cremoso" + variedade "Cremoso"). Somar os dois às
 * cegas produziria "Requeijão cremoso Cremoso Tirolez". Aqui a repetição é
 * detectada e descartada antes de montar o nome final.
 *
 * ─── O QUE A IA NUNCA TOCA ────────────────────────────────────────────────
 * Quantidade, preço e valor vêm da nota fiscal. São dado assinado; palpite não
 * substitui documento. O fator de rendimento continua saindo da mesma função
 * determinística que a importação já usava, com o conteúdo lido pela IA
 * servindo só como pista quando o texto da descrição não bastou.
 */

import { converter, getUnidade } from './unidades';
import {
  itemPorSlug,
  fatorPara,
  unidadeSegura,
  normalizarTexto,
  montarNomeInsumo,
  type ItemDaNota,
  type SugestaoImportacao,
} from './catalogoInsumos';

/** O que a Edge Function `nfe-classificar-itens` devolve por item. */
export interface ClassificacaoIA {
  indice: number;
  genero_slug: string | null;
  nome: string;
  unidade: string;
  variedade: string | null;
  marca: string | null;
  categoria: string;
  conteudo_qtd: number | null;
  conteudo_unidade: string | null;
  confianca: 'alta' | 'media' | 'baixa';
}

/** Variedade que já está dita no nome não precisa ser repetida no nome. */
function variedadeUtil(base: string, variedade: string | null | undefined): string | null {
  const v = (variedade ?? '').trim();
  if (!v) return null;
  const nomeNorm = ` ${normalizarTexto(base)} `;
  const vNorm = normalizarTexto(v);
  if (!vNorm) return null;
  return nomeNorm.includes(` ${vNorm} `) ? null : v;
}

export interface SugestaoIA extends SugestaoImportacao {
  variedade: string | null;
  marca: string | null;
  /** Nome completo pronto para gravar: gênero + variedade + marca. */
  nomeCompleto: string;
  /** `true` quando a decisão veio da IA e a tela deve marcar como sugestão. */
  daIA: true;
}

/**
 * Converte a resposta da IA na mesma sugestão que o resto da importação usa.
 *
 * O resultado é intencionalmente do mesmo formato de `sugerirDaNota`: a tela
 * não precisa saber se aquela linha foi resolvida pelo catálogo ou pela IA.
 */
export function aplicarClassificacao(item: ItemDaNota, c: ClassificacaoIA): SugestaoIA {
  const doCatalogo = itemPorSlug(c.genero_slug);

  // O catálogo vence no que é dele: nome canônico e unidade de compra.
  const base = doCatalogo?.nome ?? (c.nome || '').trim();
  const unidade = doCatalogo ? unidadeSegura(doCatalogo.unidade) : unidadeSegura(c.unidade);
  const categoria = doCatalogo?.categoria ?? c.categoria ?? null;

  const variedade = variedadeUtil(base, c.variedade);
  const marca = (c.marca ?? '').trim() || null;

  // O rendimento sai da mesma conta determinística de sempre; o conteúdo lido
  // pela IA só entra quando o texto da descrição não disse nada por si só.
  const calculado = fatorPara(item, unidade);
  let fator = calculado.fator;
  let explicacao = calculado.explicacao;

  if (!calculado.certo && c.conteudo_qtd && c.conteudo_unidade) {
    const naUnidade = c.conteudo_unidade === unidade
      ? c.conteudo_qtd
      : converter(c.conteudo_qtd, unidadeSegura(c.conteudo_unidade), unidade);
    if (naUnidade != null && naUnidade > 0) {
      fator = naUnidade;
      explicacao = `A IA leu "${c.conteudo_qtd} ${c.conteudo_unidade}" na embalagem: ` +
        `1 ${item.unidade || 'unidade'} rende ${Number(naUnidade.toFixed(4)).toLocaleString('pt-BR')} ${unidade}.`;
    }
  }

  const unidadeNota = getUnidade(unidadeSegura(item.unidade))?.codigo ?? null;

  return {
    nome: base,
    nomeCompleto: montarNomeInsumo({ base, variedade, marca }),
    unidade,
    fator: Number.isFinite(fator) && fator > 0 ? fator : 1,
    unidadeNota,
    siglaNota: (item.unidade ?? '').trim(),
    categoria,
    slug: doCatalogo ? (c.genero_slug ?? null) : null,
    confianca: c.confianca,
    explicacao,
    conteudo: null,
    variedade,
    marca,
    daIA: true,
  };
}

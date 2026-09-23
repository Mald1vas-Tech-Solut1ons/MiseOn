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
  /** Conteúdo da embalagem lido pela IA: pista para confirmar, nunca fato. */
  conteudoIA: { qtd: number; unidade: string } | null;
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
  // O fator é da regra determinística. O que a IA leu na embalagem vai como
  // DADO (`conteudoIA`) para a autoridade (`resolverFatorLinha`), que o marca
  // como origem IA e exige confirmação — o servidor recusa sem ela. Antes o
  // número da IA virava fator direto, e na falta dele inventava-se 1.
  const calculado = fatorPara(item, unidade);
  const fator = calculado.certo && Number.isFinite(calculado.fator) && calculado.fator > 0 ? calculado.fator : 0;
  let explicacao = calculado.explicacao;

  const conteudoIA = c.conteudo_qtd && c.conteudo_qtd > 0 && c.conteudo_unidade
    ? { qtd: Number(c.conteudo_qtd), unidade: unidadeSegura(c.conteudo_unidade) }
    : null;
  if (!calculado.certo && conteudoIA) {
    const naUnidade = conteudoIA.unidade === unidade
      ? conteudoIA.qtd
      : converter(conteudoIA.qtd, conteudoIA.unidade, unidade);
    if (naUnidade != null && naUnidade > 0) {
      explicacao = `A IA leu "${c.conteudo_qtd} ${c.conteudo_unidade}" na embalagem: ` +
        `1 ${item.unidade || 'unidade'} renderia ${Number(naUnidade.toFixed(4)).toLocaleString('pt-BR')} ${unidade}. Confirme.`;
    }
  }

  const unidadeNota = getUnidade(unidadeSegura(item.unidade))?.codigo ?? null;

  return {
    nome: base,
    nomeCompleto: montarNomeInsumo({ base, variedade, marca }),
    unidade,
    fator,
    conteudoIA,
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

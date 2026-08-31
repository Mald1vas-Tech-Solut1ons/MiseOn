/**
 * Catálogo universal de insumos — "tomate é tomate, e tomate se compra em kg".
 *
 * ─── O PRINCÍPIO ──────────────────────────────────────────────────────────
 * Existe uma unidade em que cada gênero alimentício É COMPRADO no Brasil, e
 * ela não é opinião: tomate, cebola e carne vêm em quilo; leite e óleo em
 * litro; ovo e pão em unidade. Essa é a unidade em que o insumo deve nascer no
 * estoque.
 *
 * "Rodela", "fatia", "cubo" NÃO são unidades de compra — são o resultado de um
 * preparo. Ninguém compra rodela de tomate: compra-se o quilo e alguém fatia.
 * Cadastrar o insumo em rodela engessa o item, impede a entrada da nota (que
 * vem em kg) e quebra o custeio, porque não existe fator universal entre quilo
 * e rodela. Por isso a importação só oferece unidades de compra, e o que é
 * quebra semântica fica para a ficha de preparo, onde é o lugar dela.
 *
 * ─── O QUE ISSO RESOLVE NA IMPORTAÇÃO ─────────────────────────────────────
 * O mercado escreve "TOMATE SALADA KG", "TOM ITAL GRANEL", "TOMATE ITALIANO".
 * Sem catálogo, cada nota cria um insumo novo e o estoque vira uma lista de
 * sinônimos sem saldo confiável. Com catálogo, os três casam com "Tomate" (kg)
 * — e a segunda nota reconhece o insumo que a primeira criou.
 *
 * O catálogo é sugestão, nunca imposição: a tela mostra o que ele propôs e o
 * lojista corrige em um toque. Ele é o palpite bem-informado que evita 53
 * decisões manuais, não uma regra que sequestra o cadastro.
 */

import { getUnidade, converter, UNIDADES, type Unidade } from './unidades';
import { tokensUteis, alinharTermo, pontuar } from './casarTermos';
import {
  normalizarUnidadeFiscal,
  extrairConteudos,
  conteudoPara,
  type ConteudoEmbalagem,
} from './unidadesFiscais';

export interface ItemCatalogo {
  /** Nome canônico com que o insumo nasce no estoque. */
  nome: string;
  /** Unidade em que este gênero é comprado e controlado. */
  unidade: string;
  categoria: string;
  /** Termos que aparecem na descrição da nota, sem acento e em minúsculas. */
  termos: string[];
  /**
   * Palavras que DESQUALIFICAM este gênero, mesmo com o termo casando.
   *
   * "MILHO VERDE STELLA D ORO LATA" casa com o termo "milho verde", mas é
   * conserva, não espiga: entraria em quilo, no hortifrúti, quando são latas
   * contadas na despensa. A palavra que denuncia isso ("lata") está na
   * descrição, longe do termo — nenhum casamento por sequência a alcança.
   *
   * Erro assim é pior que não reconhecer: o item entra com confiança e a
   * unidade errada, e ninguém confere o que o sistema disse ter certeza.
   */
  exceto?: string[];
  /**
   * Palavras que este gênero EXIGE na descrição para poder casar.
   *
   * O par simétrico do `exceto`, para quando o gênero divide o nome com outro e
   * só uma palavra distante decide qual é: "MILHO VERDE STELLA D ORO LATA" é
   * milho em conserva justamente por causa do "LATA" no fim. Sem isso, ou a
   * lata rouba a espiga, ou as duas ficam sem dono.
   */
  requer?: string[];
  /**
   * Vida útil típica do gênero, em dias a partir da compra.
   *
   * Não substitui a data impressa na embalagem — sugere. O lojista que acabou
   * de descarregar a sacola não vai digitar 53 validades, mas confirma um
   * palpite plausível em um toque, e aí o alerta de vencimento passa a existir.
   * Sem nenhuma validade cadastrada, o controle sanitário do estoque é uma
   * tela bonita que não avisa nada.
   *
   * Ausente = não perece de forma relevante (limpeza, descartável, gelo).
   */
  validadeDias?: number;
  /**
   * Variedades, tipos e cortes com que o gênero chega na cozinha.
   *
   * "Tomate" é o gênero — o que se compra em quilo e o que aparece no relatório
   * de gasto. Italiano, Débora e Cereja são o MESMO gênero comprado diferente:
   * preços distintos, fornecedores distintos, receitas distintas. Cada um vira
   * um insumo próprio (saldo e custo separados), mas todos apontam para o mesmo
   * `slug` — então o dono continua enxergando "quanto gastei de tomate no mês"
   * sem ter que somar três linhas na mão.
   *
   * A lista é sugestão, não menu fechado: o campo aceita o que o lojista
   * digitar. Um mercado regional sempre terá uma variedade que a lista não tem.
   */
  variedades?: string[];
}

/**
 * Unidades em que um insumo pode NASCER pela importação: as dimensionais, a
 * contagem e os agrupadores. Semânticas ficam de fora de propósito (ver topo).
 */
export const UNIDADES_DE_COMPRA = ['kg', 'g', 'L', 'ml', 'un'] as const;

/**
 * Unidades oferecidas ao dar entrada de uma compra, agrupadas por natureza.
 *
 * Fatia, rodela e cubo não estão aqui. Ninguém compra rodela de tomate:
 * compra-se o quilo, e a rodela nasce de um preparo. Deixar a nota cadastrar o
 * insumo em rodela engessa o item — a próxima compra vem em quilo e não tem
 * como entrar, porque entre quilo e rodela não existe fator universal. A quebra
 * semântica continua disponível onde ela pertence: na ficha de preparo.
 */
export const GRUPOS_UNIDADE_COMPRA: { rotulo: string; unidades: Unidade[] }[] = [
  {
    rotulo: 'Medida de compra (recomendado)',
    unidades: UNIDADES.filter((u) => (UNIDADES_DE_COMPRA as readonly string[]).includes(u.codigo)),
  },
  {
    rotulo: 'Embalagem fechada — sem medida universal',
    unidades: UNIDADES.filter((u) => u.grandeza === 'agrupador'),
  },
];

/**
 * Reduz qualquer palpite a um código que o banco aceita.
 *
 * `insumos.unidade_medida` tem chave estrangeira para `unidades_medida`: uma
 * sigla de nota que escape até o INSERT não erra um item, derruba a nota
 * inteira. Contagem é o destino quando não se sabe: "3 caixas" pelo menos é
 * verdade, "3 kg" seria invenção.
 */
export function unidadeSegura(codigo: string | null | undefined): string {
  return getUnidade((codigo ?? '').trim())?.codigo ?? 'un';
}

/**
 * Genéricos do dia a dia de cozinha brasileira. A lista não precisa ser
 * completa — o que ela não conhece cai na leitura da própria nota, que
 * continua funcionando. Ela precisa acertar o que aparece toda semana.
 */
export const CATALOGO: readonly ItemCatalogo[] = [
  // ── Hortifrúti — quase tudo em quilo ───────────────────────────────────
  { nome: 'Tomate', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 6, termos: ['tomate', 'tom italiano', 'tomate italiano', 'tomate salada'], variedades: ['Italiano', 'Débora', 'Salada', 'Carmen', 'Cereja', 'Sweet Grape', 'Caqui'] },
  { nome: 'Cebola', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 30, termos: ['cebola', 'ceb branca', 'cebola roxa'], variedades: ['Branca', 'Roxa', 'Pera', 'Nacional', 'Importada'] },
  { nome: 'Alho', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 60, termos: ['alho'], variedades: ['Nacional', 'Importado', 'Descascado', 'Triturado', 'Roxo'] },
  { nome: 'Batata', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 20, termos: ['batata', 'batata inglesa', 'batata lavada'], variedades: ['Inglesa (Ágata)', 'Asterix', 'Monalisa', 'Bintje', 'Lavada', 'Escovada'] },
  { nome: 'Batata doce', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 7, termos: ['batata doce'] },
  { nome: 'Cenoura', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 7, termos: ['cenoura'], variedades: ['Nacional', 'Baby', 'Orgânica'] },
  { nome: 'Beterraba', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 7, termos: ['beterraba'] },
  { nome: 'Pimentão', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 7, termos: ['pimentao', 'pimentao verde', 'pimentao amarelo'], variedades: ['Verde', 'Vermelho', 'Amarelo'] },
  { nome: 'Abobrinha', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 7, termos: ['abobrinha'] },
  { nome: 'Abóbora', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 20, termos: ['abobora', 'moranga'], variedades: ['Cabotiá / Japonesa', 'Moranga', 'Paulista', 'Menina'] },
  { nome: 'Chuchu', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 7, termos: ['chuchu'] },
  { nome: 'Pepino', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 7, termos: ['pepino'] },
  { nome: 'Berinjela', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 7, termos: ['berinjela'] },
  { nome: 'Mandioca', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 3, termos: ['mandioca', 'aipim', 'macaxeira'], variedades: ['Amarela', 'Branca', 'Congelada', 'Descascada'] },
  { nome: 'Brócolis', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 7, termos: ['brocolis'] },
  { nome: 'Couve-flor', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 7, termos: ['couve flor', 'couve-flor'] },
  { nome: 'Repolho', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 7, termos: ['repolho'] },
  { nome: 'Vagem', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 7, termos: ['vagem'] },
  { nome: 'Gengibre', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 7, termos: ['gengibre'] },
  { nome: 'Milho verde', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 7, termos: ['milho verde', 'espiga'], exceto: ['lata', 'conserva', 'sache', 'enlatado'] },
  // Folhosas e temperos frescos vão por pé/maço: contagem é o que o lojista vê.
  { nome: 'Alface', unidade: 'un', categoria: 'Hortifrúti', validadeDias: 4, termos: ['alface'], variedades: ['Crespa', 'Americana', 'Lisa', 'Roxa', 'Mimosa'] },
  { nome: 'Couve', unidade: 'un', categoria: 'Hortifrúti', validadeDias: 5, termos: ['couve', 'couve manteiga'], variedades: ['Manteiga', 'Picada', 'Orgânica'] },
  { nome: 'Rúcula', unidade: 'un', categoria: 'Hortifrúti', validadeDias: 4, termos: ['rucula'] },
  { nome: 'Agrião', unidade: 'un', categoria: 'Hortifrúti', validadeDias: 4, termos: ['agriao'] },
  { nome: 'Espinafre', unidade: 'un', categoria: 'Hortifrúti', validadeDias: 4, termos: ['espinafre'] },
  { nome: 'Cheiro-verde', unidade: 'un', categoria: 'Hortifrúti', validadeDias: 5, termos: ['cheiro verde', 'salsa', 'cebolinha', 'coentro', 'salsinha'] },
  { nome: 'Manjericão', unidade: 'un', categoria: 'Hortifrúti', validadeDias: 4, termos: ['manjericao'] },
  { nome: 'Hortelã', unidade: 'un', categoria: 'Hortifrúti', validadeDias: 4, termos: ['hortela'] },
  // Frutas
  { nome: 'Limão', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 7, termos: ['limao'], variedades: ['Taiti', 'Siciliano', 'Galego', 'Cravo'] },
  { nome: 'Laranja', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 7, termos: ['laranja'], variedades: ['Pera', 'Lima', 'Bahia', 'Seleta', 'Valência'] },
  { nome: 'Banana', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 5, termos: ['banana'], variedades: ['Nanica', 'Prata', 'Maçã', 'Terra', 'Ouro'] },
  { nome: 'Maçã', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 7, termos: ['maca', 'maca gala', 'maca fuji'], variedades: ['Gala', 'Fuji', 'Verde (Granny Smith)', 'Argentina'] },
  { nome: 'Mamão', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 7, termos: ['mamao'], variedades: ['Formosa', 'Papaia', 'Havaí'] },
  { nome: 'Melancia', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 7, termos: ['melancia'] },
  { nome: 'Melão', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 7, termos: ['melao'], variedades: ['Amarelo', 'Cantaloupe', 'Orange', 'Pele de sapo'] },
  { nome: 'Manga', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 7, termos: ['manga'], variedades: ['Palmer', 'Tommy', 'Espada', 'Rosa'] },
  { nome: 'Uva', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 7, termos: ['uva'], variedades: ['Itália', 'Niágara', 'Thompson', 'Rubi', 'Vitória'] },
  { nome: 'Morango', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 3, termos: ['morango'] },
  { nome: 'Abacaxi', unidade: 'un', categoria: 'Hortifrúti', validadeDias: 7, termos: ['abacaxi'] },
  { nome: 'Abacate', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 7, termos: ['abacate'] },
  { nome: 'Maracujá', unidade: 'kg', categoria: 'Hortifrúti', validadeDias: 7, termos: ['maracuja'] },

  // ── Carnes e frios — quilo, sempre ─────────────────────────────────────
  { nome: 'Carne moída', unidade: 'kg', categoria: 'Carnes', validadeDias: 4, termos: ['carne moida', 'moida'], variedades: ['Patinho', 'Acém', 'Coxão mole', 'Músculo'] },
  { nome: 'Patinho', unidade: 'kg', categoria: 'Carnes', validadeDias: 4, termos: ['patinho'] },
  { nome: 'Alcatra', unidade: 'kg', categoria: 'Carnes', validadeDias: 4, termos: ['alcatra'] },
  { nome: 'Coxão mole', unidade: 'kg', categoria: 'Carnes', validadeDias: 4, termos: ['coxao mole'] },
  { nome: 'Coxão duro', unidade: 'kg', categoria: 'Carnes', validadeDias: 4, termos: ['coxao duro'] },
  { nome: 'Acém', unidade: 'kg', categoria: 'Carnes', validadeDias: 4, termos: ['acem'] },
  { nome: 'Músculo', unidade: 'kg', categoria: 'Carnes', validadeDias: 4, termos: ['musculo'] },
  { nome: 'Picanha', unidade: 'kg', categoria: 'Carnes', validadeDias: 4, termos: ['picanha'] },
  { nome: 'Contrafilé', unidade: 'kg', categoria: 'Carnes', validadeDias: 4, termos: ['contra file', 'contrafile'] },
  { nome: 'Filé mignon', unidade: 'kg', categoria: 'Carnes', validadeDias: 4, termos: ['file mignon', 'mignon', 'mig bov'] },
  { nome: 'Fraldinha', unidade: 'kg', categoria: 'Carnes', validadeDias: 4, termos: ['fraldinha'] },
  { nome: 'Maminha', unidade: 'kg', categoria: 'Carnes', validadeDias: 4, termos: ['maminha'] },
  { nome: 'Cupim', unidade: 'kg', categoria: 'Carnes', validadeDias: 4, termos: ['cupim'] },
  { nome: 'Costela bovina', unidade: 'kg', categoria: 'Carnes', validadeDias: 4, termos: ['costela'] },
  { nome: 'Filé de frango', unidade: 'kg', categoria: 'Carnes', validadeDias: 4, termos: ['file de frango', 'peito de frango', 'file frango', 'peito frango'], variedades: ['Sassami', 'Peito inteiro', 'Em cubos', 'Em tiras'] },
  { nome: 'Coxa e sobrecoxa', unidade: 'kg', categoria: 'Carnes', validadeDias: 4, termos: ['sobrecoxa', 'coxa de frango', 'coxa frango'] },
  { nome: 'Asa de frango', unidade: 'kg', categoria: 'Carnes', validadeDias: 4, termos: ['asa de frango', 'asinha', 'tulipa'] },
  { nome: 'Frango inteiro', unidade: 'kg', categoria: 'Carnes', validadeDias: 4, termos: ['frango inteiro', 'frango'] },
  { nome: 'Lombo suíno', unidade: 'kg', categoria: 'Carnes', validadeDias: 4, termos: ['lombo'] },
  { nome: 'Pernil', unidade: 'kg', categoria: 'Carnes', validadeDias: 4, termos: ['pernil'] },
  { nome: 'Bisteca', unidade: 'kg', categoria: 'Carnes', validadeDias: 4, termos: ['bisteca'] },
  { nome: 'Costelinha suína', unidade: 'kg', categoria: 'Carnes', validadeDias: 4, termos: ['costelinha'] },
  { nome: 'Bacon', unidade: 'kg', categoria: 'Carnes', validadeDias: 45, termos: ['bacon'], variedades: ['Em manta', 'Fatiado', 'Em cubos', 'Defumado'] },
  { nome: 'Linguiça calabresa', unidade: 'kg', categoria: 'Carnes', validadeDias: 4, termos: ['linguica calabresa', 'calabresa'], variedades: ['Defumada', 'Fatiada', 'Em gomos', 'Apimentada'] },
  { nome: 'Linguiça toscana', unidade: 'kg', categoria: 'Carnes', validadeDias: 4, termos: ['linguica toscana', 'toscana', 'linguica'], variedades: ['Gomo', 'Fina', 'Apimentada'] },
  { nome: 'Salsicha', unidade: 'kg', categoria: 'Carnes', validadeDias: 30, termos: ['salsicha'], variedades: ['Hot dog', 'Viena', 'Toscana'] },
  { nome: 'Presunto', unidade: 'kg', categoria: 'Frios', validadeDias: 25, termos: ['presunto'], variedades: ['Cozido', 'Defumado', 'Sem capa de gordura', 'Parma'] },
  { nome: 'Mortadela', unidade: 'kg', categoria: 'Frios', validadeDias: 45, termos: ['mortadela'], variedades: ['Tradicional', 'Com azeitona', 'Defumada', 'Bologna'] },
  { nome: 'Peito de peru', unidade: 'kg', categoria: 'Frios', validadeDias: 20, termos: ['peito de peru', 'blanquet'] },
  { nome: 'Salame', unidade: 'kg', categoria: 'Frios', validadeDias: 20, termos: ['salame'] },
  { nome: 'Hambúrguer', unidade: 'un', categoria: 'Carnes', validadeDias: 120, termos: ['hamburguer', 'burguer', 'blend'], variedades: ['Bovino', 'Blend', 'Artesanal', 'Frango', 'Vegetariano'] },
  { nome: 'Tilápia', unidade: 'kg', categoria: 'Pescados', validadeDias: 3, termos: ['tilapia'], variedades: ['Filé', 'Inteira', 'Congelada', 'Fresca'] },
  { nome: 'Salmão', unidade: 'kg', categoria: 'Pescados', validadeDias: 3, termos: ['salmao'] },
  { nome: 'Merluza', unidade: 'kg', categoria: 'Pescados', validadeDias: 3, termos: ['merluza'] },
  { nome: 'Bacalhau', unidade: 'kg', categoria: 'Pescados', validadeDias: 3, termos: ['bacalhau'] },
  { nome: 'Camarão', unidade: 'kg', categoria: 'Pescados', validadeDias: 2, termos: ['camarao'], variedades: ['Cinza', 'Rosa', 'Sete barbas', 'Limpo congelado'] },

  // ── Laticínios ─────────────────────────────────────────────────────────
  { nome: 'Leite', unidade: 'L', categoria: 'Laticínios', validadeDias: 90, termos: ['leite', 'leite integral', 'leite desnatado'], variedades: ['Integral', 'Desnatado', 'Semidesnatado', 'Sem lactose', 'UHT', 'Pasteurizado'] },
  { nome: 'Creme de leite', unidade: 'un', categoria: 'Laticínios', validadeDias: 15, termos: ['creme de leite'] },
  { nome: 'Leite condensado', unidade: 'un', categoria: 'Laticínios', validadeDias: 365, termos: ['leite condensado', 'condensado'] },
  { nome: 'Leite em pó', unidade: 'kg', categoria: 'Laticínios', validadeDias: 365, termos: ['leite em po'] },
  { nome: 'Queijo mussarela', unidade: 'kg', categoria: 'Laticínios', validadeDias: 15, termos: ['mussarela', 'mucarela', 'muçarela'], variedades: ['Peça', 'Fatiada', 'Ralada', 'Búfala', 'Bolinha'] },
  { nome: 'Queijo prato', unidade: 'kg', categoria: 'Laticínios', validadeDias: 15, termos: ['queijo prato'], variedades: ['Peça', 'Fatiado', 'Lanche', 'Cobocó'] },
  { nome: 'Queijo parmesão', unidade: 'kg', categoria: 'Laticínios', validadeDias: 120, termos: ['parmesao', 'queijo ralado'], variedades: ['Peça', 'Ralado', 'Grana Padano'] },
  { nome: 'Queijo coalho', unidade: 'kg', categoria: 'Laticínios', validadeDias: 15, termos: ['queijo coalho', 'coalho'] },
  { nome: 'Queijo minas', unidade: 'kg', categoria: 'Laticínios', validadeDias: 15, termos: ['queijo minas', 'minas frescal'] },
  { nome: 'Cream cheese', unidade: 'kg', categoria: 'Laticínios', validadeDias: 15, termos: ['cream cheese'] },
  { nome: 'Catupiry', unidade: 'kg', categoria: 'Laticínios', validadeDias: 15, termos: ['catupiry'] },
  { nome: 'Requeijão', unidade: 'un', categoria: 'Laticínios', validadeDias: 60, termos: ['requeijao'], variedades: ['Tradicional', 'Cremoso', 'Light', 'Culinário'] },
  { nome: 'Ricota', unidade: 'kg', categoria: 'Laticínios', validadeDias: 15, termos: ['ricota'] },
  { nome: 'Manteiga', unidade: 'kg', categoria: 'Laticínios', validadeDias: 90, termos: ['manteiga'], variedades: ['Com sal', 'Sem sal', 'Extra', 'Ghee'] },
  { nome: 'Margarina', unidade: 'kg', categoria: 'Laticínios', validadeDias: 15, termos: ['margarina'] },
  { nome: 'Iogurte', unidade: 'un', categoria: 'Laticínios', validadeDias: 30, termos: ['iogurte'], variedades: ['Natural', 'Grego', 'Desnatado', 'Com frutas'] },
  { nome: 'Ovos', unidade: 'un', categoria: 'Laticínios', validadeDias: 21, termos: ['ovo', 'ovos', 'ovo branco', 'ovo vermelho'], variedades: ['Branco', 'Vermelho', 'Caipira', 'Codorna', 'Orgânico'] },

  // ── Mercearia ──────────────────────────────────────────────────────────
  { nome: 'Arroz', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['arroz'], variedades: ['Branco tipo 1', 'Parboilizado', 'Integral', 'Arbóreo', 'Cateto', 'Japonês'] },
  { nome: 'Feijão', unidade: 'kg', categoria: 'Mercearia', validadeDias: 300, termos: ['feijao'], variedades: ['Carioca', 'Preto', 'Fradinho', 'Branco', 'Jalo'] },
  { nome: 'Macarrão', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['macarrao', 'espaguete', 'penne', 'parafuso', 'talharim'], variedades: ['Espaguete', 'Penne', 'Parafuso', 'Talharim', 'Ninho', 'Lasanha', 'Grano duro'] },
  { nome: 'Farinha de trigo', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['farinha de trigo', 'trigo'], variedades: ['Comum', 'Especial', 'Tipo 00', 'Integral', 'Com fermento'] },
  { nome: 'Farinha de mandioca', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['farinha de mandioca', 'farofa'], variedades: ['Torrada', 'Crua', 'Biju', 'Fina', 'Grossa'] },
  { nome: 'Farinha de rosca', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['farinha de rosca', 'rosca'] },
  { nome: 'Fubá', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['fuba'] },
  { nome: 'Polvilho', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['polvilho'] },
  { nome: 'Amido de milho', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['amido de milho', 'maizena'] },
  { nome: 'Aveia', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['aveia'] },
  { nome: 'Açúcar', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['acucar'], variedades: ['Refinado', 'Cristal', 'Demerara', 'Mascavo', 'De confeiteiro'] },
  { nome: 'Adoçante', unidade: 'un', categoria: 'Mercearia', validadeDias: 365, termos: ['adocante'] },
  { nome: 'Sal', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['sal', 'sal refinado', 'sal grosso'], variedades: ['Refinado', 'Grosso', 'Marinho', 'Light', 'Rosa do Himalaia'] },
  { nome: 'Óleo de soja', unidade: 'L', categoria: 'Mercearia', validadeDias: 270, termos: ['oleo de soja', 'oleo'], variedades: ['Soja', 'Girassol', 'Canola', 'Milho', 'Algodão'] },
  { nome: 'Azeite', unidade: 'L', categoria: 'Mercearia', validadeDias: 540, termos: ['azeite', 'azeite oliva'], variedades: ['Extra virgem', 'Virgem', 'Composto', 'Português', 'Espanhol'] },
  { nome: 'Vinagre', unidade: 'L', categoria: 'Mercearia', validadeDias: 365, termos: ['vinagre'], variedades: ['Álcool', 'Vinho tinto', 'Vinho branco', 'Maçã', 'Balsâmico'] },
  { nome: 'Molho de tomate', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['molho de tomate', 'molho tomate', 'polpa de tomate'], variedades: ['Tradicional', 'Refogado', 'Manjericão', 'Sugo', 'Pelati'] },
  { nome: 'Extrato de tomate', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['extrato de tomate', 'extrato tomate'] },
  { nome: 'Maionese', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['maionese'] },
  { nome: 'Ketchup', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['ketchup', 'catchup'] },
  { nome: 'Mostarda', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['mostarda'] },
  { nome: 'Shoyu', unidade: 'L', categoria: 'Mercearia', validadeDias: 365, termos: ['shoyu'] },
  { nome: 'Molho inglês', unidade: 'L', categoria: 'Mercearia', validadeDias: 365, termos: ['molho ingles'] },
  { nome: 'Pimenta', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['pimenta', 'pimenta do reino'], variedades: ['Do reino', 'Calabresa', 'Branca', 'Dedo de moça', 'Síria'] },
  { nome: 'Orégano', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['oregano'] },
  { nome: 'Colorau', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['colorau', 'coloral'] },
  { nome: 'Tempero pronto', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['tempero', 'tempero pronto', 'caldo de galinha', 'caldo knorr'] },
  { nome: 'Café', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['cafe'], variedades: ['Torrado e moído', 'Em grãos', 'Solúvel', 'Extraforte', 'Gourmet'] },
  { nome: 'Achocolatado', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['achocolatado', 'nescau', 'toddy'] },
  { nome: 'Chocolate', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['chocolate', 'cobertura'], variedades: ['Ao leite', 'Meio amargo', 'Branco', 'Em pó', 'Granulado'] },
  { nome: 'Fermento', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['fermento'] },
  { nome: 'Mel', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['mel'] },
  { nome: 'Azeitona', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['azeitona'] },
  { nome: 'Palmito', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['palmito'] },
  { nome: 'Milho em conserva', unidade: 'un', categoria: 'Mercearia', validadeDias: 365, termos: ['milho verde lata', 'milho conserva', 'milho em conserva', 'milho lata', 'milho verde', 'milho'], requer: ['lata', 'conserva', 'enlatado', 'sache'] },
  { nome: 'Ervilha em conserva', unidade: 'un', categoria: 'Mercearia', validadeDias: 365, termos: ['ervilha'] },
  { nome: 'Atum', unidade: 'un', categoria: 'Mercearia', validadeDias: 365, termos: ['atum'] },
  { nome: 'Sardinha', unidade: 'un', categoria: 'Mercearia', validadeDias: 365, termos: ['sardinha'] },
  { nome: 'Leite de coco', unidade: 'L', categoria: 'Mercearia', validadeDias: 365, termos: ['leite de coco'] },
  { nome: 'Coco ralado', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['coco ralado'] },
  { nome: 'Batata palha', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['batata palha'] },
  { nome: 'Biscoito', unidade: 'kg', categoria: 'Mercearia', validadeDias: 365, termos: ['biscoito', 'bolacha'] },
  { nome: 'Batata congelada', unidade: 'kg', categoria: 'Congelados', validadeDias: 180, termos: ['batata congelada', 'batata frita', 'batata pre frita'], variedades: ['Palito fino', 'Palito tradicional', 'Rústica', 'Noisette'] },

  // ── Padaria ────────────────────────────────────────────────────────────
  { nome: 'Pão francês', unidade: 'kg', categoria: 'Padaria', validadeDias: 1, termos: ['pao frances', 'pao sal'] },
  { nome: 'Pão de forma', unidade: 'un', categoria: 'Padaria', validadeDias: 7, termos: ['pao de forma', 'pao forma'], variedades: ['Tradicional', 'Integral', 'Sem casca', 'Australiano'] },
  { nome: 'Pão de hambúrguer', unidade: 'un', categoria: 'Padaria', validadeDias: 7, termos: ['pao de hamburguer', 'pao hamburguer', 'pao brioche'], variedades: ['Brioche', 'Tradicional', 'Australiano', 'Gergelim'] },
  { nome: 'Pão de hot dog', unidade: 'un', categoria: 'Padaria', validadeDias: 7, termos: ['pao de hot dog', 'pao hot dog', 'pao viena'] },

  // ── Bebidas ────────────────────────────────────────────────────────────
  { nome: 'Refrigerante', unidade: 'un', categoria: 'Bebidas', validadeDias: 365, termos: ['refrigerante', 'refri', 'coca cola', 'guarana', 'fanta', 'sprite', 'pepsi'], variedades: ['Cola', 'Guaraná', 'Laranja', 'Limão', 'Uva', 'Zero'] },
  { nome: 'Cerveja', unidade: 'un', categoria: 'Bebidas', validadeDias: 180, termos: ['cerveja', 'chopp', 'brahma', 'skol', 'heineken', 'budweiser'], variedades: ['Pilsen', 'Lager', 'IPA', 'Puro malte', 'Sem álcool'] },
  { nome: 'Água mineral', unidade: 'un', categoria: 'Bebidas', validadeDias: 365, termos: ['agua mineral', 'agua sem gas', 'agua com gas'], variedades: ['Sem gás', 'Com gás'] },
  { nome: 'Suco', unidade: 'L', categoria: 'Bebidas', validadeDias: 365, termos: ['suco', 'nectar'], variedades: ['Laranja', 'Uva', 'Maracujá', 'Abacaxi', 'Manga', 'Integral', 'Néctar'] },
  { nome: 'Água de coco', unidade: 'L', categoria: 'Bebidas', validadeDias: 365, termos: ['agua de coco'] },
  { nome: 'Energético', unidade: 'un', categoria: 'Bebidas', validadeDias: 365, termos: ['energetico', 'red bull', 'monster'] },
  { nome: 'Cachaça', unidade: 'L', categoria: 'Bebidas', validadeDias: 365, termos: ['cachaca', 'pinga', 'aguardente'] },
  { nome: 'Vodka', unidade: 'L', categoria: 'Bebidas', validadeDias: 365, termos: ['vodka'] },
  { nome: 'Whisky', unidade: 'L', categoria: 'Bebidas', validadeDias: 365, termos: ['whisky', 'uisque'] },
  { nome: 'Vinho', unidade: 'un', categoria: 'Bebidas', validadeDias: 1095, termos: ['vinho'], variedades: ['Tinto seco', 'Branco seco', 'Rosé', 'Suave', 'Espumante'] },
  { nome: 'Gelo', unidade: 'kg', categoria: 'Bebidas', termos: ['gelo'], variedades: ['Cubo', 'Escama', 'Triturado'] },

  // ── Limpeza e descartáveis ─────────────────────────────────────────────
  { nome: 'Água sanitária', unidade: 'L', categoria: 'Limpeza', termos: ['agua sanitaria', 'agua sanit', 'candida'], variedades: ['Comum', 'Perfumada', 'Concentrada'] },
  { nome: 'Limpador multiuso', unidade: 'un', categoria: 'Limpeza', termos: ['multiuso', 'limpador multiuso'], variedades: ['Original', 'Lavanda', 'Cloro ativo'] },
  { nome: 'Limpa vidros', unidade: 'un', categoria: 'Limpeza', termos: ['limpa vidro', 'limpa vidros'] },
  { nome: 'Amaciante', unidade: 'L', categoria: 'Limpeza', termos: ['amaciante'] },
  { nome: 'Lã de aço', unidade: 'un', categoria: 'Limpeza', termos: ['bombril'] },
  { nome: 'Vassoura', unidade: 'un', categoria: 'Limpeza', termos: ['vassoura', 'rodo'] },
  { nome: 'Detergente', unidade: 'un', categoria: 'Limpeza', termos: ['detergente'], variedades: ['Neutro', 'Limão', 'Coco', 'Maçã'] },
  { nome: 'Desinfetante', unidade: 'L', categoria: 'Limpeza', termos: ['desinfetante'], variedades: ['Pinho', 'Lavanda', 'Eucalipto', 'Floral'] },
  { nome: 'Sabão em pó', unidade: 'kg', categoria: 'Limpeza', termos: ['sabao em po', 'sabao po'] },
  { nome: 'Álcool', unidade: 'L', categoria: 'Limpeza', termos: ['alcool'] },
  { nome: 'Esponja', unidade: 'un', categoria: 'Limpeza', termos: ['esponja'] },
  { nome: 'Saco de lixo', unidade: 'un', categoria: 'Limpeza', termos: ['saco de lixo', 'saco lixo'] },
  { nome: 'Papel toalha', unidade: 'un', categoria: 'Limpeza', termos: ['papel toalha'] },
  { nome: 'Papel higiênico', unidade: 'un', categoria: 'Limpeza', termos: ['papel higienico'] },
  { nome: 'Guardanapo', unidade: 'un', categoria: 'Descartáveis', termos: ['guardanapo'] },
  { nome: 'Copo descartável', unidade: 'un', categoria: 'Descartáveis', termos: ['copo descartavel', 'copo plastico'], variedades: ['180 ml', '200 ml', '300 ml', '400 ml', '500 ml'] },
  { nome: 'Marmitex', unidade: 'un', categoria: 'Descartáveis', termos: ['marmitex', 'marmita', 'embalagem'], variedades: ['Alumínio nº 8', 'Alumínio nº 9', 'Isopor', 'Papelão', 'Plástico'] },
  { nome: 'Papel alumínio', unidade: 'un', categoria: 'Descartáveis', termos: ['papel aluminio', 'aluminio'] },
  { nome: 'Filme plástico', unidade: 'un', categoria: 'Descartáveis', termos: ['filme pvc', 'filme plastico', 'rolopac'] },
  { nome: 'Sacola', unidade: 'un', categoria: 'Descartáveis', termos: ['sacola'], variedades: ['Pequena', 'Média', 'Grande', 'Reforçada'] },
  { nome: 'Luva descartável', unidade: 'un', categoria: 'Descartáveis', termos: ['luva'], variedades: ['Látex P', 'Látex M', 'Látex G', 'Nitrílica', 'Plástica'] },
  { nome: 'Touca descartável', unidade: 'un', categoria: 'Descartáveis', termos: ['touca'] },
  { nome: 'Canudo', unidade: 'un', categoria: 'Descartáveis', termos: ['canudo'] },
];

/**
 * Categorias que o catálogo usa, na ordem em que aparecem.
 *
 * Alimentam o seletor de categoria do cadastro: quem trabalha com comida pensa
 * em "Hortifrúti" e "Laticínios", não em "Ingrediente".
 */
export const CATEGORIAS_CATALOGO: string[] = Array.from(
  new Set(CATALOGO.map((i) => i.categoria)),
);

/** Minúsculas, sem acento, com fronteira de palavra — base de todo o casamento. */
export function normalizarTexto(texto: string): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Léxico pré-tokenizado: o casamento roda por palavra, não por substring. */
const TERMOS_INDEXADOS = CATALOGO.flatMap((item) =>
  item.termos.map((t) => ({ item, tokens: tokensUteis(normalizarTexto(t)) })),
).filter((t) => t.tokens.length > 0);

/**
 * Encontra o gênero por trás da descrição do cupom.
 *
 * ─── COMO ELE DECIDE ──────────────────────────────────────────────────────
 * Não procura texto dentro de texto: compara PALAVRA com PALAVRA, e cada par
 * de palavras é julgado por regra morfológica — igual, flexionada, truncada
 * (que é como o cupom abrevia) ou com uma letra trocada. É por isso que
 * "DETERG LIQ MINUANO" acha detergente sem que "deterg" esteja cadastrado em
 * lugar nenhum: a regra vale para qualquer truncamento, de qualquer palavra.
 *
 * Entre os candidatos, vence o de maior nota, que pesa três coisas: quão fiel
 * foi o casamento, quão específico é o termo ("molho tomate" ganha de
 * "tomate") e onde ele aparece na linha — porque o cupom escreve o produto
 * primeiro e a marca depois, e era assim que "TODDY" sequestrava um biscoito.
 *
 * ─── ONDE ELE PARA ────────────────────────────────────────────────────────
 * Abaixo do limiar, devolve null em vez de chutar. Gênero errado com ar de
 * certeza é pior que gênero nenhum: ninguém confere o que o sistema afirmou
 * saber, e o item entra no estoque na unidade errada. O que não passa aqui
 * segue para a classificação por IA, que é a camada feita para isso.
 */
const NOTA_MINIMA = 0.74;

export function casarCatalogo(descricao: string): ItemCatalogo | null {
  const normalizada = normalizarTexto(descricao);
  const tokens = tokensUteis(normalizada);
  if (tokens.length === 0) return null;

  const comEspaco = ` ${normalizada} `;
  let melhor: { item: ItemCatalogo; nota: number } | null = null;

  for (const { item, tokens: tokensTermo } of TERMOS_INDEXADOS) {
    // Qualificadores do gênero: o que o separa de um vizinho de mesmo nome.
    // "MILHO VERDE ... LATA" é conserva, não espiga — e a palavra que decide
    // isso está longe do termo, fora do alcance de qualquer alinhamento.
    if (item.exceto?.some((x) => comEspaco.includes(` ${normalizarTexto(x)} `))) continue;
    if (item.requer && !item.requer.some((x) => comEspaco.includes(` ${normalizarTexto(x)} `))) continue;

    const alinhado = alinharTermo(tokens, tokensTermo);
    if (!alinhado) continue;

    const nota = pontuar(alinhado, tokensTermo.length);
    if (nota < NOTA_MINIMA) continue;
    if (!melhor || nota > melhor.nota) melhor = { item, nota };
  }

  return melhor?.item ?? null;
}

// ---------------------------------------------------------------------------
// Identidade do item: gênero universal + variedade + marca
// ---------------------------------------------------------------------------

/**
 * Identificador estável do gênero, gravado em `insumos.catalogo_ref`.
 *
 * Derivado do nome canônico ('Queijo mussarela' → 'queijo-mussarela') em vez de
 * escrito à mão em cada linha: uma lista de 170 itens com slug manual acumula
 * erro de digitação, e um slug errado só aparece muito depois, no relatório que
 * não soma. Em troca, renomear um item do catálogo muda o slug — por isso o
 * nome canônico é para acrescentar, não para reescrever.
 */
export function slugDoItem(item: ItemCatalogo): string {
  return normalizarTexto(item.nome).replace(/\s+/g, '-');
}

const POR_SLUG = new Map(CATALOGO.map((item) => [slugDoItem(item), item]));

export function itemPorSlug(slug: string | null | undefined): ItemCatalogo | null {
  return POR_SLUG.get((slug ?? '').trim()) ?? null;
}

export interface ResultadoBusca {
  item: ItemCatalogo;
  slug: string;
  /** Casou pelo começo do nome — vale mais que casar no meio de um termo. */
  prefixo: boolean;
}

/**
 * Busca do seletor de item universal, enquanto o lojista digita.
 *
 * Procura no nome canônico E nos termos de mercado, porque quem digita "muda"
 * está pensando em mandioca e quem digita "aipim" também. Ordena colocando o
 * que começa com o texto na frente: digitar "tom" tem que trazer Tomate antes
 * de Molho de tomate, senão a lista parece aleatória.
 */
export function buscarCatalogo(texto: string, limite = 8): ResultadoBusca[] {
  const alvo = normalizarTexto(texto);
  if (alvo.length < 2) return [];

  const achados: ResultadoBusca[] = [];
  for (const item of CATALOGO) {
    const nome = normalizarTexto(item.nome);
    const campos = [nome, ...item.termos.map(normalizarTexto)];
    const prefixo = campos.some((c) => c.startsWith(alvo));
    if (!prefixo && !campos.some((c) => c.includes(alvo))) continue;
    achados.push({ item, slug: slugDoItem(item), prefixo });
  }

  return achados
    .sort((a, b) => {
      if (a.prefixo !== b.prefixo) return a.prefixo ? -1 : 1;
      return a.item.nome.localeCompare(b.item.nome, 'pt-BR');
    })
    .slice(0, limite);
}

export interface IdentidadeInsumo {
  /** Gênero: 'Tomate'. Do catálogo ou digitado livremente. */
  base: string;
  /** Variedade, tipo ou corte: 'Italiano'. */
  variedade?: string | null;
  /** Marca ou fabricante: 'Tio João'. */
  marca?: string | null;
}

/**
 * Monta o nome que vai para `insumos.nome`.
 *
 * A marca entra no nome, e isso é decisão de projeto, não descuido: a tabela
 * tem unicidade por (loja, nome), e o mesmo arroz de duas marcas tem preço,
 * fornecedor e rendimento diferentes — precisa ser dois insumos. Deixar a marca
 * só numa coluna à parte faria o segundo cadastro esbarrar em "já existe um
 * insumo com esse nome" sem que o lojista entendesse por quê.
 *
 * A ordem é a que se fala na cozinha: "tomate italiano", "arroz branco Tio
 * João" — gênero primeiro, porque é assim que a lista fica alfabeticamente
 * agrupada por aquilo que o item É.
 */
export function montarNomeInsumo(id: IdentidadeInsumo): string {
  return [id.base, id.variedade, id.marca]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Separa um nome já gravado de volta em gênero e resto.
 *
 * Serve para abrir a edição de um insumo cadastrado antes deste campo existir:
 * "Tomate Italiano" reabre com gênero Tomate e variedade Italiano, em vez de
 * jogar a string inteira num campo de texto e perder o vínculo com o catálogo.
 */
export function separarIdentidade(nome: string): IdentidadeInsumo & { slug: string | null } {
  const item = casarCatalogo(nome);
  if (!item) return { base: (nome ?? '').trim(), variedade: null, marca: null, slug: null };

  // Remove do nome o termo que casou, preservando a grafia do que sobrou —
  // "TOM ITALIANO" tem que devolver "ITALIANO", não uma versão normalizada.
  //
  // O nome canônico vem primeiro na fila, e não é detalhe: vários termos de
  // busca já embutem a variedade ('tomate italiano', 'cebola roxa') porque
  // servem para reconhecer a descrição do mercado. Casar por eles aqui comeria
  // justamente o pedaço que se quer separar — "Tomate Italiano" voltaria como
  // Tomate sem variedade nenhuma.
  const alvo = ` ${normalizarTexto(nome)} `;
  const casa = (t: string) => alvo.includes(` ${t} `) || alvo.includes(` ${t}s `);
  const canonico = normalizarTexto(item.nome);
  const termo = casa(canonico)
    ? canonico
    : item.termos.map(normalizarTexto).filter(casa).sort((a, b) => b.length - a.length)[0];

  const palavras = (nome ?? '').trim().split(/\s+/);
  const quantas = termo ? termo.split(' ').length : 1;
  const inicio = palavras.findIndex((_, i) =>
    normalizarTexto(palavras.slice(i, i + quantas).join(' ')).replace(/s$/, '') ===
    (termo ?? '').replace(/s$/, ''),
  );
  const resto = inicio >= 0
    ? [...palavras.slice(0, inicio), ...palavras.slice(inicio + quantas)].join(' ').trim()
    : '';

  return { base: item.nome, variedade: resto || null, marca: null, slug: slugDoItem(item) };
}

// ---------------------------------------------------------------------------
// A sugestão que a tela de importação consome
// ---------------------------------------------------------------------------

export interface ItemDaNota {
  descricao: string;
  /** Unidade como veio impressa na nota ("bd", "KG", "PC"). */
  unidade: string;
  qtd: number;
}

export interface SugestaoImportacao {
  /** Nome canônico quando o catálogo reconheceu; senão a descrição da nota. */
  nome: string;
  /** Unidade em que o insumo deve ser controlado — sempre código do catálogo. */
  unidade: string;
  /** Quantas `unidade` valem 1 unidade comercial da nota. */
  fator: number;
  /** Unidade da nota já traduzida; `null` quando a sigla não foi reconhecida. */
  unidadeNota: string | null;
  /** Sigla crua, para a tela mostrar de onde veio. */
  siglaNota: string;
  categoria: string | null;
  /** Gênero reconhecido, gravado em `insumos.catalogo_ref` para agrupar. */
  slug: string | null;
  confianca: 'alta' | 'media' | 'baixa';
  /** Frase curta explicando a decisão — a tela mostra abaixo do item. */
  explicacao: string;
  /** Conteúdo lido da descrição ("20UN"), quando foi usado. */
  conteudo: ConteudoEmbalagem | null;
}

/**
 * Traduz uma linha do cupom para a decisão de estoque, no lugar do lojista.
 *
 * A ordem de autoridade é deliberada:
 *   1. o catálogo — porque "tomate se compra em quilo" não muda de mercado
 *      para mercado, e é o que faz a nota de hoje casar com o insumo de ontem;
 *   2. o conteúdo escrito na embalagem ("PVC 20UN") — o mercado já disse
 *      quantos ovos vêm na bandeja, não faz sentido perguntar;
 *   3. a unidade da nota, se ela for uma medida de verdade (kg, L, un);
 *   4. unidade, como último recurso — nunca a sigla crua, que quebra o banco.
 */
export function sugerirDaNota(item: ItemDaNota): SugestaoImportacao {
  const siglaNota = (item.unidade ?? '').trim();
  const fiscal = normalizarUnidadeFiscal(siglaNota);
  const unidadeNota = fiscal?.codigo ?? null;
  const catalogo = casarCatalogo(item.descricao);
  const conteudos = extrairConteudos(item.descricao);

  // Passo 1 — em que unidade o item vai viver no estoque.
  let unidade: string;
  let confianca: SugestaoImportacao['confianca'];
  if (catalogo) {
    unidade = catalogo.unidade;
    confianca = 'alta';
  } else if (conteudos.length > 0) {
    unidade = conteudos[0].unidade;
    confianca = 'media';
  } else if (unidadeNota && ehUnidadeDeCompra(unidadeNota)) {
    unidade = unidadeNota;
    confianca = fiscal?.ambigua ? 'baixa' : 'media';
  } else {
    // Agrupador puro (caixa, fardo) ou sigla ilegível: contagem é o único
    // saldo honesto — "3 caixas" pelo menos é verdade, "3 kg" seria invenção.
    unidade = 'un';
    confianca = 'baixa';
  }

  // A nota pesada manda no catálogo. Se a compra veio em kg ou L e o gênero é
  // catalogado noutra grandeza (hambúrguer em un, comprado a peso), converter
  // seria inventar: guardar em quilo mantém o saldo verdadeiro, e a quebra em
  // unidades é assunto do preparo, não da entrada.
  if (
    catalogo &&
    unidadeNota &&
    ehDimensional(unidadeNota) &&
    converter(1, unidadeNota, unidade) == null &&
    !conteudoPara(conteudos, unidade)
  ) {
    unidade = unidadeNota;
    confianca = 'media';
  }

  // Passo 2 — quanto disso entra por unidade comprada.
  const rendimento = calcularRendimento(unidadeNota, siglaNota, unidade, conteudos);
  const { fator, conteudo } = rendimento;
  let explicacao = rendimento.explicacao;
  if (rendimento.certo === false) confianca = 'baixa';
  else if (conteudo && confianca === 'baixa') confianca = 'media';

  if (fiscal?.ambigua) {
    explicacao += ` A sigla "${siglaNota}" tem mais de um significado no varejo — confira.`;
    if (confianca === 'alta') confianca = 'media';
  }

  return {
    nome: catalogo?.nome ?? limparDescricao(item.descricao),
    unidade,
    fator: Number.isFinite(fator) && fator > 0 ? fator : 1,
    unidadeNota,
    siglaNota,
    categoria: catalogo?.categoria ?? null,
    slug: catalogo ? slugDoItem(catalogo) : null,
    confianca,
    explicacao,
    conteudo,
  };
}

export interface Rendimento {
  /** Quantas unidades de estoque valem 1 unidade comercial da nota. */
  fator: number;
  explicacao: string;
  conteudo: ConteudoEmbalagem | null;
  /** `false` quando o fator é chute de 1 — a tela precisa pedir conferência. */
  certo: boolean;
}

/**
 * Quanto entra no estoque por unidade comprada, em ordem de autoridade:
 * a nota que já vem na unidade certa, a conversão física, o conteúdo escrito
 * na embalagem e — só então — o 1 declarado como desconhecido.
 */
function calcularRendimento(
  unidadeNota: string | null,
  siglaNota: string,
  unidadeEstoque: string,
  conteudos: ConteudoEmbalagem[],
): Rendimento {
  if (unidadeNota === unidadeEstoque) {
    return { fator: 1, explicacao: `A nota já vem em ${unidadeEstoque}.`, conteudo: null, certo: true };
  }

  // Granel: a nota traz a medida real, a conversão é física e dispensa palpite.
  const fisico = unidadeNota && ehDimensionalOuContagem(unidadeNota)
    ? converter(1, unidadeNota, unidadeEstoque)
    : null;
  if (fisico != null && fisico > 0) {
    return {
      fator: fisico,
      explicacao: `1 ${unidadeNota} = ${fmtNum(fisico)} ${unidadeEstoque} (conversão fixa).`,
      conteudo: null,
      certo: true,
    };
  }

  const conteudo = conteudoPara(conteudos, unidadeEstoque);
  if (conteudo) {
    return {
      fator: conteudo.qtd,
      explicacao: `A embalagem diz "${conteudo.trecho}": 1 ${siglaNota || 'unidade'} rende ${fmtNum(conteudo.qtd)} ${unidadeEstoque}.`,
      conteudo,
      certo: true,
    };
  }

  return {
    fator: 1,
    explicacao: unidadeNota
      ? `Não dá para saber quanto tem em 1 ${siglaNota || unidadeNota}. Confira o rendimento.`
      : `"${siglaNota}" não é uma unidade conhecida. Confira o rendimento.`,
    conteudo: null,
    certo: false,
  };
}

/**
 * Recalcula o rendimento quando o lojista troca a unidade na tela.
 *
 * Sem isso, trocar de "un" para "kg" mantinha o fator 20 lido da bandeja de
 * ovos e o estoque ganhava 40 kg de ovo — o tipo de erro silencioso que só
 * aparece semanas depois, no CMV.
 */
export function fatorPara(item: ItemDaNota, unidadeDestino: string): Rendimento {
  const sigla = (item.unidade ?? '').trim();
  return calcularRendimento(
    normalizarUnidadeFiscal(sigla)?.codigo ?? null,
    sigla,
    unidadeDestino,
    extrairConteudos(item.descricao),
  );
}

function ehUnidadeDeCompra(codigo: string): boolean {
  return (UNIDADES_DE_COMPRA as readonly string[]).includes(codigo);
}

function ehDimensional(codigo: string): boolean {
  const u = getUnidade(codigo);
  return !!u && u.fatorBase != null;
}

function ehDimensionalOuContagem(codigo: string): boolean {
  const u = getUnidade(codigo);
  return !!u && (u.grandeza === 'massa' || u.grandeza === 'volume' || u.grandeza === 'contagem');
}

function fmtNum(n: number): string {
  return Number(n.toFixed(4)).toLocaleString('pt-BR');
}

/**
 * Quando o catálogo não reconhece, ao menos devolve um nome legível: tira o
 * ruído de código interno e a medida colada no fim ("APP1 ... PVC 20UN").
 */
export function limparDescricao(descricao: string): string {
  const limpo = (descricao ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^[A-Z]{2,4}\d+\s+/i, '') // prefixo de código do mercado
    .replace(/\b\d+(?:[.,]\d+)?\s*(kgs?|gr?s?|mls?|lts?|l|un[di]?d?|und)\b/gi, '')
    .replace(/\bc\/\s*\d+\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return limpo || (descricao ?? '').trim();
}

/**
 * Corpus de descrições de cupom fiscal, com o gênero que cada uma deve casar.
 *
 * ─── PARA QUE SERVE ───────────────────────────────────────────────────────
 * Sem um corpus, "melhorar o reconhecimento" vira conserto de item avulso: uma
 * nota dá errado, alguém adiciona a abreviação daquela linha, e a mesma classe
 * de erro reaparece no mercado seguinte com outra sigla. Com corpus existe
 * NÚMERO: mexer na regra sobe ou desce a taxa, e a queda aparece na hora.
 *
 * ─── O QUE ELE COBRE ──────────────────────────────────────────────────────
 * Descrições no formato real do varejo brasileiro — truncamento ("DETERG",
 * "REQ CREM"), marca no meio da linha, código interno na frente ("APP1"),
 * medida colada ("500G", "2L"), grafia do mercado ("MUCARELA"), plural, e os
 * pares que só uma palavra distante separa (espiga × lata).
 *
 * `null` significa "o catálogo NÃO deve reconhecer": é a cauda longa, que
 * pertence à classificação por IA. Chutar um gênero nesses casos é pior que
 * devolver nada — o item entraria com ar de certeza na unidade errada.
 */
export const CORPUS_CUPOM: readonly [descricao: string, generoEsperado: string | null][] = [
  // ── Truncamento: a forma como o cupom abrevia ─────────────────────────
  ['DETERG LIQ MINUANO NEUTRO', 'Detergente'],
  ['DET LIQ YPE CLEAR 500ML', 'Detergente'],
  ['REQ CREM TIROLEZ CP 200G', 'Requeijão'],
  ['MUC FATIADA TIROLEZ 500G', 'Queijo mussarela'],
  ['MUSSAR FAT SADIA KG', 'Queijo mussarela'],
  ['MARG QUALY CREMOSA 500G', 'Margarina'],
  ['MANT AVIACAO C SAL 200G', 'Manteiga'],
  ['PRES COZIDO SADIA KG', 'Presunto'],
  ['MORT DEFUMADA PERDIGAO KG', 'Mortadela'],
  ['LING CALABRESA APIM RESF BRAGANCA Kg', 'Linguiça calabresa'],
  ['LING TOSCANA SEARA KG', 'Linguiça toscana'],
  ['ACUC REFINADO UNIAO 1KG', 'Açúcar'],
  ['ACUCAR CRISTAL CARAVELAS 5KG', 'Açúcar'],
  ['BISC REC TODDY CHOC 130g', 'Biscoito'],
  ['BOLACH AGUA E SAL VITARELLA', 'Biscoito'],
  ['CEB BCA NAC SC 20KG', 'Cebola'],
  ['CEBOLA ROXA KG', 'Cebola'],
  ['TOM ITAL GRANEL', 'Tomate'],
  ['TOMATE SALADA kg', 'Tomate'],
  ['CEN NACIONAL KG', 'Cenoura'],
  ['PIM VERDE KG', 'Pimentão'],
  ['ALF CRESPA UN', 'Alface'],
  ['REFRIG COCA COLA PET 2L', 'Refrigerante'],
  ['AMAC DOWNY CONCENTRADO 1L', 'Amaciante'],
  ['DESINF PINHO SOL 500ML', 'Desinfetante'],
  ['MAION HELLMANNS 500G', 'Maionese'],
  ['VINAG ALCOOL CASTELO 750ML', 'Vinagre'],
  ['SALSICH HOT DOG PERDIGAO KG', 'Salsicha'],
  ['PARM RALADO FAIXA AZUL 100G', 'Queijo parmesão'],
  ['GUARD FOLHA DUPLA SANTEPEL', 'Guardanapo'],
  ['MARMIT ALUM N8 C/100', 'Marmitex'],
  ['ATUM CELLIER RALADO OLEO POU', 'Atum'],

  // ── Código interno na frente e marca no meio ──────────────────────────
  ['APP1 PEITO FGO CONG C OSSO Kg', 'Filé de frango'],
  ['APP1 OVOS EXTRA BRANCO PVC 20UN', 'Ovos'],
  ['APP1 CX MOLHO SHOYU SAKURA 5L', 'Shoyu'],
  ['PRD2 ARROZ TIO JOAO T1 5KG', 'Arroz'],
  ['AGUA SANIT SELECT 2L', 'Água sanitária'],
  ['LIMP MULTI USO UAU ACAO CLAREA', 'Limpador multiuso'],
  ['OLEO SOJA LIZA 900ML', 'Óleo de soja'],
  ['AZEITE PORT GALLO EXT VIRG 500ML', 'Azeite'],
  ['LEITE ITALAC INTEGRAL 1L', 'Leite'],
  ['CAFE PILAO TORRADO MOIDO 500G', 'Café'],
  ['FILE MIGNON BOV RESF SWIFT KG', 'Filé mignon'],
  ['BATATA PRE FRITA MCCAIN 2,5KG', 'Batata congelada'],
  ['PAPEL TOALHA SNOB FL DUPLA 2R', 'Papel toalha'],
  ['COPO DESCARTAVEL COPOBRAS 200ML', 'Copo descartável'],
  ['AGUA MIN CRYSTAL S GAS 500ML', 'Água mineral'],

  // ── Grafia do mercado e erro de impressão ─────────────────────────────
  ['MUCARELA FATIADA 500G', 'Queijo mussarela'],
  ['MUÇARELA PECA KG', 'Queijo mussarela'],
  ['LINGUICA CALABRESA DEFUMADA', 'Linguiça calabresa'],
  ['ABOBORA CABOTIA KG', 'Abóbora'],
  ['MACARRAO PARAFUSO ADRIA 500G', 'Macarrão'],

  // ── Plural e flexão ───────────────────────────────────────────────────
  ['TOMATES ITALIANOS KG', 'Tomate'],
  ['OVOS CAIPIRAS DZ', 'Ovos'],
  ['BANANAS PRATA KG', 'Banana'],
  ['LIMOES TAITI KG', 'Limão'],

  // ── O termo específico tem que ganhar do genérico ─────────────────────
  ['MOLHO DE TOMATE POMAROLA 340G', 'Molho de tomate'],
  ['EXTRATO DE TOMATE ELEFANTE 350G', 'Extrato de tomate'],
  ['BATATA DOCE KG', 'Batata doce'],
  ['BATATA LAVADA KG', 'Batata'],
  ['LEITE CONDENSADO MOCA 395G', 'Leite condensado'],
  ['LEITE DE COCO SOCOCO 200ML', 'Leite de coco'],
  ['CREME DE LEITE ITALAC 200G', 'Creme de leite'],
  ['LEITE EM PO NINHO 400G', 'Leite em pó'],
  ['FARINHA DE MANDIOCA TORRADA KG', 'Farinha de mandioca'],
  ['FARINHA DE TRIGO DONA BENTA 1KG', 'Farinha de trigo'],
  ['QUEIJO PARMESAO RALADO 50G', 'Queijo parmesão'],
  ['COCO RALADO SOCOCO 100G', 'Coco ralado'],

  // ── Palavra distante decide o gênero ──────────────────────────────────
  ['MILHO VERDE STELLA D ORO LATA', 'Milho em conserva'],
  ['MILHO VERDE ESPIGA KG', 'Milho verde'],
  ['MILHO VERDE EM CONSERVA PREDILECTA', 'Milho em conserva'],

  // ── Palavra curta não pode virar outra ────────────────────────────────
  ['SAL REFINADO CISNE 1KG', 'Sal'],
  ['SAL GROSSO CHURRASCO 1KG', 'Sal'],
  ['ALFACE AMERICANA UN', 'Alface'],
  ['SALSICHA VIENA 500G', 'Salsicha'],
  ['SALSA FRESCA MACO', 'Cheiro-verde'],
  ['PAO FRANCES KG', 'Pão francês'],
  ['PAO DE FORMA PULLMAN 500G', 'Pão de forma'],
  ['PAO DE HAMBURGUER BRIOCHE 6UN', 'Pão de hambúrguer'],

  // ── Carnes e cortes ───────────────────────────────────────────────────
  ['CARNE MOIDA SUINA CONG PAMPLONA 500g', 'Carne moída'],
  ['PATINHO BOV RESF KG', 'Patinho'],
  ['ALCATRA MAMINHA FRIBOI KG', 'Alcatra'],
  ['COXAO MOLE BOV KG', 'Coxão mole'],
  ['SOBRECOXA FRANGO CONG KG', 'Coxa e sobrecoxa'],
  ['BACON EM MANTA SADIA KG', 'Bacon'],
  ['COSTELINHA SUINA KG', 'Costelinha suína'],
  ['TILAPIA FILE CONG KG', 'Tilápia'],
  ['CAMARAO CINZA LIMPO KG', 'Camarão'],

  // ── Hortifrúti no vocabulário do box ──────────────────────────────────
  ['ALHO NACIONAL DESCASCADO KG', 'Alho'],
  ['BATATA INGLESA LAVADA KG', 'Batata'],
  ['MANDIOCA DESCASCADA CONG KG', 'Mandioca'],
  ['ABACAXI PEROLA UN', 'Abacaxi'],
  ['MAMAO FORMOSA KG', 'Mamão'],
  ['COUVE MANTEIGA MACO', 'Couve'],
  ['CHEIRO VERDE MACO', 'Cheiro-verde'],
  ['GENGIBRE KG', 'Gengibre'],
  ['BROCOLIS NINJA UN', 'Brócolis'],

  // ── Bebidas ───────────────────────────────────────────────────────────
  ['CERVEJA BRAHMA LATA 350ML', 'Cerveja'],
  ['SUCO DEL VALLE UVA 1L', 'Suco'],
  ['ENERGETICO RED BULL 250ML', 'Energético'],
  ['AGUA DE COCO KERO COCO 1L', 'Água de coco'],
  ['GELO EM CUBO 5KG', 'Gelo'],

  // ── Cauda longa: o catálogo tem que dizer que não sabe ────────────────
  ['PILHA DURACELL AA C/4', null],
  ['ISQUEIRO BIC UN', null],
  ['REVISTA VEJA EDICAO 2900', null],
  ['CARVAO VEGETAL 5KG', null],
  ['FOSFORO FIAT LUX C/10', null],
  ['ESCOVA DENTAL ORAL B', null],
  ['CADERNO UNIVERSITARIO 10M', null],
];

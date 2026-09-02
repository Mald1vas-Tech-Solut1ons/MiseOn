/**
 * Domínio nutricional do lado do cliente.
 *
 * Aqui não se calcula nutrição — isso é do motor no banco (ADR-01 do
 * PLANO-NUTRICIONAL). O que existe aqui é o que a tela precisa para *mostrar*
 * o resultado: somar os adicionais que o cliente escolheu, formatar número na
 * regra de rótulo, traduzir código em palavra e explicar critério.
 *
 * Ver docs/PLANO-NUTRICIONAL-VITRINE.md, Fatia 4.
 */

/** Uma linha de fn_nutricao_cardapio. */
export interface NutricaoProduto {
  produto_id: string;
  publicavel: boolean;
  status: 'COMPLETO' | 'PARCIAL' | 'SEM_DADOS';
  parcial: boolean;
  por_porcao: Record<string, number>;
  por_100g: Record<string, number>;
  peso_porcao_g: number | null;
  porcoes: number;
  massa_servida_g: number;
  cobertura_pct: number;
  itens_total: number;
  itens_com_dado: number;
  alergenos_contem: string[];
  alergenos_pode_conter: string[];
  atributos: string[];
  composicao_fontes: Record<string, number>;
  atualizado_em: string;
}

/** Uma linha de fn_nutricao_opcoes_cardapio: o que cada adicional acrescenta. */
export interface NutricaoOpcao {
  opcao_id: string;
  produto_id: string;
  nutrientes: Record<string, number>;
  massa_g: number;
  completo: boolean;
  alergenos_contem: string[];
  alergenos_pode_conter: string[];
}

/** Catálogo oficial de nutrientes (tabela `nutrientes`, leitura pública). */
export interface NutrienteCatalogo {
  codigo: string;
  rotulo: string;
  abreviacao: string | null;
  unidade: string;
  ordem: number;
  indentacao: number;
  obrigatorio_anvisa: boolean;
  vdr: number | null;
  ativo: boolean;
}

/**
 * Arredondamento no espírito da IN 75/2020: o cliente lê "23 g", não
 * "23,4127 g". Abaixo de 10 vale uma casa, porque 0,4 g de gordura trans e
 * 0 g de gordura trans não são a mesma informação.
 */
export function formatarValor(valor: number, unidade: string): string {
  if (!Number.isFinite(valor)) return '—';
  if (unidade === 'kcal') return String(Math.round(valor));
  if (unidade === 'mg') return String(Math.round(valor));
  if (valor === 0) return '0';
  if (valor < 10) return valor.toFixed(1).replace('.', ',');
  return String(Math.round(valor));
}

/** %VD só existe quando a ANVISA publica valor de referência para o nutriente. */
export function percentualVD(valor: number, vdr: number | null): number | null {
  if (!vdr || !Number.isFinite(valor)) return null;
  return Math.round((valor / vdr) * 100);
}

/** Soma os adicionais escolhidos ao prato base. */
export function somarNutrientes(
  base: Record<string, number>,
  extras: Array<Record<string, number>>,
): Record<string, number> {
  const total = { ...base };
  for (const extra of extras) {
    for (const [codigo, valor] of Object.entries(extra)) {
      total[codigo] = (total[codigo] ?? 0) + valor;
    }
  }
  return total;
}

/** União de alérgenos. "Contém" sempre vence "pode conter". */
export function unirAlergenos(
  listas: Array<{ contem: string[]; pode: string[] }>,
): { contem: string[]; pode: string[] } {
  const contem = new Set<string>();
  const pode = new Set<string>();
  for (const l of listas) {
    l.contem.forEach((a) => contem.add(a));
    l.pode.forEach((a) => pode.add(a));
  }
  contem.forEach((a) => pode.delete(a));
  return { contem: [...contem].sort(), pode: [...pode].sort() };
}

/**
 * Selos de atributo. O critério fica junto do nome porque um selo que não pode
 * ser conferido é adesivo de vitrine — a mesma regra que vale para o selo da
 * loja vale para o do prato.
 */
export const ATRIBUTOS: Record<string, { rotulo: string; criterio: string; tom: 'forte' | 'leve' }> = {
  ALTO_PROTEINA:          { rotulo: 'Alto em proteína',           criterio: 'A partir de 12 g de proteína por 100 g (RDC 54/2012).', tom: 'forte' },
  FONTE_PROTEINA:         { rotulo: 'Fonte de proteína',          criterio: 'A partir de 6 g de proteína por 100 g (RDC 54/2012).',  tom: 'leve' },
  ALTO_FIBRAS:            { rotulo: 'Alto em fibras',             criterio: 'A partir de 6 g de fibras por 100 g (RDC 54/2012).',    tom: 'forte' },
  FONTE_FIBRAS:           { rotulo: 'Fonte de fibras',            criterio: 'A partir de 3 g de fibras por 100 g (RDC 54/2012).',    tom: 'leve' },
  BAIXO_SODIO:            { rotulo: 'Baixo em sódio',             criterio: 'Até 120 mg de sódio por 100 g (RDC 54/2012).',          tom: 'leve' },
  BAIXO_GORDURA_SATURADA: { rotulo: 'Baixo em gordura saturada',  criterio: 'Até 1,5 g de gordura saturada por 100 g (RDC 54/2012).', tom: 'leve' },
  BAIXO_CALORIAS:         { rotulo: 'Baixo em calorias',          criterio: 'Até 40 kcal por 100 g (RDC 54/2012).',                  tom: 'leve' },
  SEM_ACUCAR_ADICIONADO:  { rotulo: 'Sem açúcar adicionado',      criterio: 'Nenhum ingrediente da ficha traz açúcar adicionado.',   tom: 'leve' },
};

/** De onde veio o número — o que sustenta o selo de transparência. */
export const FONTES: Record<string, string> = {
  ROTULO:          'rótulo do fabricante',
  BASE_CIENTIFICA: 'base científica (USDA FoodData Central)',
  ESTIMADO:        'estimativa',
  DECLARADO:       'declarado pela loja',
};

export function descreverFontes(composicao: Record<string, number>): string {
  const partes = Object.entries(composicao)
    .filter(([, pct]) => pct > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([classe, pct]) => `${Math.round(pct)}% ${FONTES[classe] ?? classe.toLowerCase()}`);
  return partes.join(' · ');
}

/** §16.1 do PLANO-NUTRICIONAL — o texto curto, o que vai junto do número. */
export const DISCLAIMER_CURTO =
  'Valores calculados a partir da ficha técnica declarada pelo estabelecimento, usando bases de composição de alimentos. Não substitui laudo de análise laboratorial.';

/** §16.2 — o texto longo, com a parte de alérgenos que é a mais importante. */
export const DISCLAIMER_LONGO = [
  'Como calculamos. A informação nutricional deste prato não vem de laudo de laboratório: é calculada a partir da receita declarada pelo estabelecimento, pelo método de cálculo por tabela de composição de alimentos — reconhecido pela ANVISA como via válida para obter a informação nutricional. Cada ingrediente carrega sua origem: rótulo do fabricante, base científica pública ou estimativa.',
  'O que isto não é. Não é laudo de análise físico-química nem parecer de nutricionista. A precisão é a da receita informada — troca de fornecedor, safra ou modo de preparo podem mudar o valor real sem mudar o valor calculado até a próxima revisão.',
  'Alergênicos. A lista reflete o que foi avaliado pelo estabelecimento. A ausência de um alergênico significa que ele NÃO FOI AVALIADO, nunca que o prato não o contém. Em caso de restrição alimentar severa, confirme diretamente com o estabelecimento antes de consumir.',
];

/** Como o prato é servido — espelha produtos_nutricao_config. */
export interface ConfigNutricaoPrato {
  exibir: boolean;
  porcoes: number;
  peso_porcao_g: number | null;
  fator_coccao: number;
  metodo_coccao: string | null;
  insumo_id: string | null;
  quantidade_insumo: number | null;
}

export const CONFIG_NUTRICAO_PADRAO: ConfigNutricaoPrato = {
  exibir: true,
  porcoes: 1,
  peso_porcao_g: null,
  fator_coccao: 1,
  metodo_coccao: null,
  insumo_id: null,
  quantidade_insumo: null,
};

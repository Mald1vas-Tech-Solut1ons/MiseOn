/**
 * Setores físicos de armazenamento — geladeira, armário, dispensa.
 *
 * O banco NÃO tem coluna de setor para insumos (conferido nas migrations: o
 * único `setor` existente é o de mesas do salão). Enquanto não vira campo de
 * cadastro, o setor é DERIVADO aqui por regras transparentes:
 *
 *   1. Categoria não-comestível (Limpeza, Embalagem) → Armário.
 *   2. Nome com palavra perecível (queijo, carne, leite, tomate…) → Geladeira.
 *   3. Demais alimentos secos/embalados → Dispensa.
 *
 * A lista PERECIVEIS é propositalmente visível e fácil de estender — é a
 * heurística que o lojista reconhece da própria cozinha.
 *
 * Cada setor tem uma identidade de cor vibrante usada em TODA a UI (chips,
 * faixa da linha 3D, bordas dos cartões): o usuário aprende o mapa de cores
 * uma vez e localiza o item pelo olhar, sem ler.
 */

export type SetorId = 'geladeira' | 'armario' | 'dispensa';

export interface Setor {
  id: SetorId;
  rotulo: string;
  /** Cor principal vibrante (hex CSS). */
  cor: string;
  /** Cor numérica para materiais Three.js. */
  corHex: number;
  /** Faixa de fundo da linha na cena (hex CSS, translúcida). */
  faixa: string;
}

export const SETORES: Record<SetorId, Setor> = {
  geladeira: {
    id: 'geladeira',
    rotulo: 'Geladeira',
    cor: '#22d3ee',
    corHex: 0x22d3ee,
    faixa: 'rgba(34, 211, 238, 0.10)',
  },
  armario: {
    id: 'armario',
    rotulo: 'Armário',
    cor: '#fbbf24',
    corHex: 0xfbbf24,
    faixa: 'rgba(251, 191, 36, 0.10)',
  },
  dispensa: {
    id: 'dispensa',
    rotulo: 'Dispensa',
    cor: '#a3e635',
    corHex: 0xa3e635,
    faixa: 'rgba(163, 230, 53, 0.10)',
  },
};

export const ORDEM_SETORES: SetorId[] = ['geladeira', 'armario', 'dispensa'];

/** Palavras que denunciam perecível de geladeira (minúsculas, sem acento). */
const PERECIVEIS = [
  'queijo', 'mussarela', 'mucarela', 'presunto', 'mortadela', 'peperoni',
  'carne', 'frango', 'bacon', 'salsicha', 'linguica', 'hamburguer', 'peixe',
  'atum fresco', 'leite', 'ovo', 'manteiga', 'requeijao', 'catupiry',
  'cheddar', 'cream', 'iogurte', 'maionese', 'nata', 'ricota', 'parmesao',
  'tomate', 'alface', 'cebola', 'batata', 'cenoura', 'pimentao', 'rucula',
  'brocolis', 'verdura', 'legume', 'fruta', 'banana', 'limao', 'milho verde',
];

/** Normaliza para casar keywords: minúsculas e sem acento. */
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Categorias de cadastro que NÃO são alimento: vão direto para o armário. */
const CATEGORIAS_ARMARIO = ['limpeza', 'embalagem'];

/**
 * Deduz o setor físico do insumo. A categoria de cadastro manda primeiro;
 * na dúvida, a palavra-chave do nome; o default seguro é a dispensa.
 */
export function derivarSetor(nome: string, categoriaInsumo: string | null | undefined): SetorId {
  const cat = norm(categoriaInsumo ?? '');
  if (CATEGORIAS_ARMARIO.some((c) => cat.includes(c))) return 'armario';

  const n = norm(nome);
  if (PERECIVEIS.some((p) => n.includes(p))) return 'geladeira';

  return 'dispensa';
}

/** Aceita só ids válidos de setor (campo do cadastro); o resto vira null. */
export function validarSetor(valor: string | null | undefined): SetorId | null {
  return valor === 'geladeira' || valor === 'armario' || valor === 'dispensa' ? valor : null;
}

/** Opções do select de cadastro — vazio = automático (derivação). */
export const OPCOES_SETOR: Array<{ valor: SetorId | ''; rotulo: string }> = [
  { valor: '', rotulo: 'Automático (pelo tipo de item)' },
  { valor: 'geladeira', rotulo: 'Geladeira' },
  { valor: 'armario', rotulo: 'Armário' },
  { valor: 'dispensa', rotulo: 'Dispensa' },
];

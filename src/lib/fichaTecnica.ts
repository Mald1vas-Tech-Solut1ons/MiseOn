import { Insumo } from '../types';

/**
 * Quem pode ser consumido em uma ficha/manipulação, por tipo de item — a
 * taxonomia é `tipos_item` no banco, não uma lista de nomes. Material de
 * limpeza, higiene, escritório, EPI, manutenção e imobilizado JAMAIS entram
 * numa ficha: não é filtro cosmético, é segurança alimentar.
 */
export const GRUPOS_FICHA: { chave: string; rotulo: string; tipos: string[] }[] = [
  { chave: 'ALIMENTO', rotulo: 'Alimentos e bebidas', tipos: ['INGREDIENTE', 'REVENDA'] },
  { chave: 'PREPARO', rotulo: 'Preparos da casa', tipos: ['PREPARO'] },
  { chave: 'EMBALAGEM', rotulo: 'Embalagens e descartáveis', tipos: ['EMBALAGEM', 'DESCARTAVEL'] },
];

const TIPOS_PERMITIDOS = new Set(GRUPOS_FICHA.flatMap(g => g.tipos));

/**
 * Itens antigos, anteriores à taxonomia, não têm `tipo_item`. Nesse caso o
 * `is_preparo` decide, e o restante entra como alimento — é o comportamento
 * que a loja já tinha, sem reprovar dado legado por omissão.
 */
export const tipoDoInsumo = (i: Insumo): string =>
  i.tipo_item || (i.is_preparo ? 'PREPARO' : 'INGREDIENTE');

export const podeEntrarNaFicha = (i: Insumo): boolean => TIPOS_PERMITIDOS.has(tipoDoInsumo(i));

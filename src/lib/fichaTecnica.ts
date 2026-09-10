import { Insumo } from '../types';

/**
 * Quem pode ser consumido em uma ficha/manipulação, por tipo de item — a
 * taxonomia é `tipos_item` no banco, não uma lista de nomes. Material de
 * limpeza, higiene, escritório, EPI, manutenção e imobilizado JAMAIS entram
 * numa ficha: não é filtro cosmético, é segurança alimentar.
 */
export const GRUPOS_FICHA: { chave: string; rotulo: string; tipos: string[]; ajuda: string }[] = [
  {
    chave: 'ALIMENTO',
    rotulo: 'Matéria-prima',
    tipos: ['INGREDIENTE'],
    ajuda: 'Você compra cru e transforma aqui dentro.',
  },
  {
    chave: 'PREPARO',
    rotulo: 'Preparos da casa',
    tipos: ['PREPARO'],
    ajuda: 'Já passou por uma ficha sua: carrega o custo real da produção e a rastreabilidade do lote.',
  },
  {
    chave: 'REVENDA',
    rotulo: 'Comprado pronto',
    tipos: ['REVENDA'],
    ajuda: 'Chega pronto do fornecedor. O custo é o da nota e não há pré-preparo a medir.',
  },
  {
    chave: 'EMBALAGEM',
    rotulo: 'Embalagens e descartáveis',
    tipos: ['EMBALAGEM', 'DESCARTAVEL'],
    ajuda: 'Entram no custo do lote, não na nutrição do prato.',
  },
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

/** O grupo a que um insumo pertence na ficha — a história que a tela conta. */
export const grupoDoInsumo = (i: Insumo) =>
  GRUPOS_FICHA.find(g => g.tipos.includes(tipoDoInsumo(i)));

/**
 * Item comprado pronto não tem pré-preparo a medir: o queijo ralado do saquinho
 * chega ralado. Quem rala o parmesão da geladeira faz isso numa ficha própria,
 * e aí vira PREPARO — com custo de produção e rastreabilidade de lote.
 */
export const compradoPronto = (i: Insumo): boolean =>
  tipoDoInsumo(i) === 'REVENDA';

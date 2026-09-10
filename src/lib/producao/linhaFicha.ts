import { Insumo } from '../../types';
import { opcoesDeEntrada } from '../unidades';
import { OrigemRendimento } from './tecnicas';

export interface LinhaFicha {
  insumo_id: string;
  /** Quantidade BRUTA, na `unidade` que o usuário escolheu. */
  quantidade: string;
  /** Unidade em que o usuário digitou — pode não ser a do estoque. */
  unidade: string;
  tecnica_codigo: string;
  /** Sobrescrita manual do fator de correção, em % (vazio = usa o do sistema). */
  rendimento_pct: string;
  rendimento_origem: OrigemRendimento | null;
  /**
   * Rendimento que o BANCO resolveu para este par insumo×técnica. Preenchido
   * pelo componente, nunca digitado — é o que o salvamento congela quando o
   * usuário não sobrescreve.
   */
  rendimento_sistema_pct: number | null;
}

export const linhaVazia = (): LinhaFicha => ({
  insumo_id: '', quantidade: '', unidade: '', tecnica_codigo: '',
  rendimento_pct: '', rendimento_origem: null, rendimento_sistema_pct: null,
});

/**
 * Fator da unidade informada para a unidade de estoque do insumo. `null` quando
 * o insumo não declarou a conversão — nesse caso a única unidade aceita é a do
 * próprio estoque, e a UI não oferece outra.
 */
export function fatorParaEstoque(insumo: Insumo | undefined, unidade: string): number | null {
  if (!insumo) return null;
  if (!unidade || unidade === insumo.unidade_medida) return 1;
  const opcao = opcoesDeEntrada(
    insumo.unidade_medida,
    insumo.detalhes_rendimento?.regras,
    insumo.detalhes_rendimento?.equivalencias,
  ).find(o => o.codigo === unidade);
  return opcao ? opcao.fatorParaBase : null;
}


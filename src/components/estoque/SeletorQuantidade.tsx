/**
 * Entrada de quantidade em QUALQUER unidade.
 *
 * O saldo de um insumo mora numa única unidade (a de uso), mas ninguém compra,
 * conta ou desmonta nessa unidade o tempo todo: compra-se o quilo, conta-se a
 * cabeça, desossa-se a peça. Este componente é o rosto único desse atrito —
 * usado no recebimento de compra, no inventário e na transformação, para que as
 * três telas convertam do mesmo jeito. A matemática mora em lib/conversaoEntrada.
 *
 * Unidade fora do cadastro do insumo? O lojista declara o rendimento na hora,
 * validado pela mesma conservação dimensional do resto do sistema.
 */

import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { UNIDADES, validarConversao } from '../../lib/unidades';
import { AlvoConversao, ValorQuantidade, fatorDe, opcoesDe } from '../../lib/conversaoEntrada';

interface Props {
  alvo: AlvoConversao;
  valor: ValorQuantidade;
  onChange: (v: ValorQuantidade) => void;
  autoFocus?: boolean;
  placeholder?: string;
  /** Esconde a linha de conversão — útil em tabelas densas. */
  compacto?: boolean;
}

export default function SeletorQuantidade({
  alvo, valor, onChange, autoFocus, placeholder = '0', compacto,
}: Props) {
  const opcoes = useMemo(() => opcoesDe(alvo), [alvo]);
  const opcao = opcoes.find(o => o.codigo === valor.unidade);
  const avulsa = !opcao;
  const fator = fatorDe(alvo, valor);
  const base = (Number(valor.qtd) || 0) * fator;

  const validacao = avulsa && Number(valor.fatorNovo) > 0
    ? validarConversao(valor.unidade, alvo.unidade_medida, 1, Number(valor.fatorNovo))
    : null;

  return (
    <div className="w-full">
      <div className="flex gap-2">
        <input
          type="number" min="0" step="any" autoFocus={autoFocus} placeholder={placeholder}
          className="w-full min-w-0 rounded-lg border border-gray-300 p-2 text-sm focus:border-[var(--cor-primaria)] focus:outline-none dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100"
          value={valor.qtd}
          onChange={e => onChange({ ...valor, qtd: e.target.value })}
        />
        <select
          className="shrink-0 rounded-lg border border-gray-300 p-2 text-sm focus:border-[var(--cor-primaria)] focus:outline-none dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100"
          value={valor.unidade}
          onChange={e => onChange({ ...valor, unidade: e.target.value, fatorNovo: '' })}
        >
          <optgroup label="Do cadastro">
            {opcoes.map(o => <option key={o.codigo} value={o.codigo}>{o.codigo}</option>)}
          </optgroup>
          <optgroup label="Outra unidade">
            {UNIDADES.filter(u => !opcoes.some(o => o.codigo === u.codigo))
              .map(u => <option key={u.codigo} value={u.codigo}>{u.codigo}</option>)}
          </optgroup>
        </select>
      </div>

      {avulsa && (
        <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50/60 p-2 dark:border-blue-900/40 dark:bg-blue-900/10">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-blue-800 dark:text-blue-300">1 {valor.unidade} =</span>
            <input
              type="number" min="0" step="any" placeholder="0"
              className="w-20 rounded border border-blue-200 p-1 text-xs focus:outline-none dark:bg-gray-950 dark:border-blue-800/50 dark:text-gray-100"
              value={valor.fatorNovo}
              onChange={e => onChange({ ...valor, fatorNovo: e.target.value })}
            />
            <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{alvo.unidade_medida}</span>
          </div>
          {validacao && !validacao.ok && (
            <p className="mt-1.5 flex items-start gap-1 text-[10px] font-medium text-red-600 dark:text-red-400">
              <AlertTriangle size={11} className="shrink-0 mt-px" />
              <span>{validacao.mensagem}</span>
            </p>
          )}
        </div>
      )}

      {!compacto && fator !== 1 && base > 0 && (
        <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
          = <b className="text-green-700 dark:text-green-400">
            {base.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {alvo.unidade_medida}
          </b>
        </p>
      )}
    </div>
  );
}

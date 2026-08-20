import React, { useState } from 'react';
import { Users, Check, X, Divide, Sparkles } from 'lucide-react';
import { fmt, type Produto } from '../../types';

import { useI18n } from '../../contexts/I18nContext';
interface ModalDivisaoItemGarcomProps {
  produto: Produto;
  capacidadeMesa: number;
  assentosComConsumo?: number[];
  onConfirmar: (assentosSelecionados: number[]) => void;
  onCancelar: () => void;
}

export function ModalDivisaoItemGarcom({
  produto,
  capacidadeMesa,
  assentosComConsumo = [],
  onConfirmar,
  onCancelar,
}: ModalDivisaoItemGarcomProps) {
  const { tDynamic } = useI18n();
  // Lista total de assentos baseada na capacidade da mesa (1..N)
  const totalAssentos = Array.from({ length: capacidadeMesa }, (_, i) => i + 1);

  // Por padrão, seleciona assentos que já têm consumo ou os 2 primeiros
  const [selecionados, setSelecionados] = useState<number[]>(
    assentosComConsumo.length > 0 ? assentosComConsumo : [1, 2]
  );

  const toggleAssento = (num: number) => {
    if (selecionados.includes(num)) {
      if (selecionados.length === 1) return; // precisa ter pelo menos 1 participante
      setSelecionados(selecionados.filter((a) => a !== num));
    } else {
      setSelecionados([...selecionados, num].sort((a, b) => a - b));
    }
  };

  const selecionarTodos = () => setSelecionados(totalAssentos);

  const fracao = selecionados.length > 0 ? 1 / selecionados.length : 1;
  const valorPorPessoa = (produto.preco * fracao);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-orange-500/10 p-2 text-orange-400 border border-orange-500/20">
              <Divide size={22} />
            </div>
            <div>
              <h3 className="font-bold text-slate-100">{tDynamic('Método 1: Rachar no Lançamento')}</h3>
              <p className="text-xs text-slate-400">{tDynamic('Garçom fraciona o item entre participantes')}</p>
            </div>
          </div>
          <button
            onClick={onCancelar}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Resumo do Produto */}
        <div className="rounded-xl bg-slate-950 p-4 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="font-semibold text-slate-200">{produto.nome}</div>
            <div className="text-xs text-slate-400">Preço Total: {fmt(produto.preco)}</div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-3 py-1 text-xs font-bold text-orange-400 border border-orange-500/30">
            <Sparkles size={13} /> {fmt(valorPorPessoa)} / pessoa
          </span>
        </div>

        {/* Seletor de Assentos/Subcomandas */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-300 flex items-center gap-1.5">
              <Users size={14} className="text-amber-400" />
              Selecione as pessoas que estão bebendo ({selecionados.length} participantes):
            </span>
            <button
              onClick={selecionarTodos}
              className="text-orange-400 hover:underline font-semibold"
            >
              Todos da mesa
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2.5">
            {totalAssentos.map((num) => {
              const ativo = selecionados.includes(num);
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => toggleAssento(num)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-sm font-semibold transition ${
                    ativo
                      ? 'bg-orange-500/20 border-orange-500 text-orange-300 shadow-lg shadow-orange-500/10 scale-[1.02]'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-xs opacity-75 font-normal">Assento</span>
                  <span className="text-base font-bold">#{num}</span>
                  {ativo && <Check size={14} className="mt-1 text-orange-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cálculo de Fração Automático */}
        <div className="rounded-xl bg-slate-800/40 p-3.5 border border-slate-700/40 text-xs text-slate-300 space-y-1 font-mono">
          <div>• Fração calculada: 1/{selecionados.length} = {fracao.toFixed(3)} un por participante</div>
          <div>• Assentos vinculados: Assentos [{selecionados.join(', ')}]</div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onCancelar}
            className="w-1/3 rounded-xl bg-slate-800 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirmar(selecionados)}
            className="w-2/3 flex items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-sm font-bold text-slate-950 hover:bg-orange-400 shadow-lg transition"
          >
            <Check size={18} /> {tDynamic('Confirmar Divisão')}
          </button>
        </div>
      </div>
    </div>
  );
}

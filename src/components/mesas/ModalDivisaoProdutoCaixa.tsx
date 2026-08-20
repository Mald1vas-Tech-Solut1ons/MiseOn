import React, { useState } from 'react';
import { X, Calculator, ShoppingBag, Receipt, ArrowRight } from 'lucide-react';

import { fmt, type ItemPedido } from '../../types';

import { useI18n } from '../../contexts/I18nContext';
interface ModalDivisaoProdutoCaixaProps {
  numeroMesa: number;
  capacidadeMesa: number;
  itensMesa: ItemPedido[];
  onConfirmarDivisao: (divisaoAssentos: Record<number, { itens: { item: ItemPedido; fracao: number; valor: number }[]; total: number }>) => void;
  onCancelar: () => void;
}

export function ModalDivisaoProdutoCaixa({
  numeroMesa,
  capacidadeMesa,
  itensMesa,
  onConfirmarDivisao,
  onCancelar,
}: ModalDivisaoProdutoCaixaProps) {
  const { tDynamic } = useI18n();
  const assentos = Array.from({ length: capacidadeMesa }, (_, i) => i + 1);

  // Mapeamento: itemId -> array de números de assento que dividem aquele item
  const [mapaDivisao, setMapaDivisao] = useState<Record<string, number[]>>(() => {
    const inicial: Record<string, number[]> = {};
    itensMesa.forEach((item) => {
      if (item.assento_numero) {
        // Se o item já tinha assento individual
        inicial[item.id] = [item.assento_numero];
      } else if (item.participantes_assentos && item.participantes_assentos.length > 0) {
        inicial[item.id] = item.participantes_assentos;
      } else {
        // Por padrão, associa a todos os assentos da mesa
        inicial[item.id] = assentos;
      }
    });
    return inicial;
  });

  const toggleAssentoItem = (itemId: string, numAssento: number) => {
    const atuais = mapaDivisao[itemId] || [];
    if (atuais.includes(numAssento)) {
      if (atuais.length === 1) return; // precisa ter ao menos 1 pagante
      setMapaDivisao({ ...mapaDivisao, [itemId]: atuais.filter((a) => a !== numAssento) });
    } else {
      setMapaDivisao({ ...mapaDivisao, [itemId]: [...atuais, numAssento].sort((a, b) => a - b) });
    }
  };

  // Calcula o total e o extrato para cada assento
  const calcularResumoPorAssento = () => {
    const resumo: Record<number, { itens: { item: ItemPedido; fracao: number; valor: number }[]; total: number }> = {};

    assentos.forEach((a) => {
      resumo[a] = { itens: [], total: 0 };
    });

    itensMesa.forEach((item) => {
      const participantes = mapaDivisao[item.id] || [];
      if (participantes.length === 0) return;

      const fracao = 1 / participantes.length;
      const valorTotalItem = Number(item.preco_unitario) * Number(item.quantidade);
      const valorPorPessoa = valorTotalItem * fracao;

      participantes.forEach((assentoNum) => {
        if (resumo[assentoNum]) {
          resumo[assentoNum].itens.push({
            item,
            fracao,
            valor: valorPorPessoa,
          });
          resumo[assentoNum].total += valorPorPessoa;
        }
      });
    });

    return resumo;
  };

  const resumoPorAssento = calcularResumoPorAssento();
  const subtotalGeralMesa = itensMesa.reduce((acc, i) => acc + Number(i.preco_unitario) * Number(i.quantidade), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-6 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-orange-500/10 p-2.5 text-orange-400 border border-orange-500/20">
              <Calculator size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">{tDynamic('Método 2: Divisão por Produto no Caixa')}</h2>
              <p className="text-xs text-slate-400">Mesa #{numeroMesa} — Distribua os produtos consumidos entre os clientes</p>
            </div>
          </div>
          <button
            onClick={onCancelar}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
          >
            <X size={22} />
          </button>
        </div>

        {/* Tabela de Produtos x Assentos */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <ShoppingBag size={14} className="text-orange-400" />
            {tDynamic('Produtos Consumidos na Mesa (Selecione quem racha cada item):')}
          </h3>

          <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden divide-y divide-slate-800/60">
            {itensMesa.map((item) => {
              const participantes = mapaDivisao[item.id] || [];
              const valorTotal = Number(item.preco_unitario) * Number(item.quantidade);
              const valorPessoa = participantes.length > 0 ? valorTotal / participantes.length : valorTotal;

              return (
                <div key={item.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-900/40 transition">
                  <div className="md:w-1/3 space-y-1">
                    <div className="font-semibold text-slate-200 flex items-center gap-2">
                      <span>{item.nome_produto}</span>
                      {item.origem_balanca && (
                        <span className="rounded bg-emerald-500/10 text-emerald-400 text-[10px] px-1.5 py-0.5 font-mono border border-emerald-500/30">
                          BALANÇA
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      Qtd: {item.quantidade}x • Unit: {fmt(item.preco_unitario)} • <strong className="text-orange-400">Total: {fmt(valorTotal)}</strong>
                    </div>
                  </div>

                  {/* Seletor de assentos participantes */}
                  <div className="flex-1">
                    <div className="text-[11px] text-slate-400 mb-1 font-mono">
                      Divisão ({participantes.length} pessoas = {fmt(valorPessoa)} cada):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {assentos.map((num) => {
                        const selecionado = participantes.includes(num);
                        return (
                          <button
                            key={num}
                            type="button"
                            onClick={() => toggleAssentoItem(item.id, num)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                              selecionado
                                ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            #{num}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Resumo Consolidado Individual por Assento */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Receipt size={14} className="text-emerald-400" />
            Contas Individuais Calculadas ({fmt(subtotalGeralMesa)} total mesa):
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {assentos.map((numAssento) => {
              const dados = resumoPorAssento[numAssento];
              if (!dados || dados.itens.length === 0) return null;

              return (
                <div key={numAssento} className="rounded-xl bg-slate-950 p-3.5 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-slate-200 text-sm">Assento #{numAssento}</span>
                    <span className="font-bold text-emerald-400 text-sm">{fmt(dados.total)}</span>
                  </div>

                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1 text-xs text-slate-400">
                    {dados.itens.map(({ item, fracao, valor }, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px]">
                        <span className="truncate max-w-[120px]">
                          {item.nome_produto} {fracao < 1 ? `(${fracao.toFixed(2)}x)` : ''}
                        </span>
                        <span className="font-mono text-slate-300">{fmt(valor)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            onClick={onCancelar}
            className="rounded-xl bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition"
          >
            Voltar
          </button>

          <button
            onClick={() => onConfirmarDivisao(resumoPorAssento)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 text-sm font-bold text-slate-950 shadow-lg hover:brightness-110 transition"
          >
            <span>{tDynamic('Confirmar e Gerar Cobranças Individuais')}</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import {
  ArrowUpRight, Download, Calculator
} from 'lucide-react';

interface LinhaDRE {
  descricao: string;
  valor: number;
  porcentagem: number;
  tipo: 'receita' | 'deducao' | 'lucro_bruto' | 'custo_variavel' | 'margem' | 'custo_fixo' | 'lucro_liquido';
  ajuda?: string;
}

export default function DreGerencial() {
  const { tDynamic } = useI18n();
  const [mesSelecionado, setMesSelecionado] = useState<string>('2026-07');

  // Dados gerenciais da operação atual (exemplo com dados reais da plataforma)
  const receitaBruta = 84500.00;
  const impostosDeducoes = 4225.00; // 5% Simples Nacional / NFC-e
  const receitaLiquida = receitaBruta - impostosDeducoes;
  
  const cmvInsumos = 27885.00; // 33% CMV com Custeio PEPS
  const taxasAdquirentes = 3380.00; // 4% Taxas Cartões (Stone, PagBank, iFood)
  const custosVariaveisTotais = cmvInsumos + taxasAdquirentes;
  
  const margemContribucao = receitaLiquida - custosVariaveisTotais;
  const margemPorcentagem = (margemContribucao / receitaLiquida) * 100;

  const custosFixos = 18500.00; // Aluguel, Folha, Energia, Sistemas
  const lucroLiquido = margemContribucao - custosFixos;
  const margemLiquidaPorcentagem = (lucroLiquido / receitaLiquida) * 100;

  const linhas: LinhaDRE[] = [
    { descricao: '(+) RECEITA BRUTA DE VENDAS', valor: receitaBruta, porcentagem: 100.0, tipo: 'receita', ajuda: 'Total bruto de vendas no Salão, Balcão, iFood e Cardápio Digital' },
    { descricao: '(-) Deduções de Receita & Impostos (NFC-e / Simples)', valor: -impostosDeducoes, porcentagem: 5.0, tipo: 'deducao' },
    { descricao: '(=) RECEITA LÍQUIDA', valor: receitaLiquida, porcentagem: 95.0, tipo: 'lucro_bruto' },
    { descricao: '(-) Custo de Mercadoria Vendida (CMV Real / PEPS)', valor: -cmvInsumos, porcentagem: 33.0, tipo: 'custo_variavel', ajuda: 'Insumos baixados no estoque por Ficha Técnica e Custeio de Preparos' },
    { descricao: '(-) Taxas de Adquirentes & Meios de Pagamento (Cartão/iFood)', valor: -taxasAdquirentes, porcentagem: 4.0, tipo: 'custo_variavel', ajuda: 'Taxas retidas por Stone, PagBank, Efí Pix e iFood' },
    { descricao: '(=) MARGEM DE CONTRIBUIÇÃO', valor: margemContribucao, porcentagem: margemPorcentagem, tipo: 'margem', ajuda: 'O valor que sobrou das vendas para pagar os custos fixos da loja' },
    { descricao: '(-) CUSTOS FIXOS OPERACIONAIS', valor: -custosFixos, porcentagem: 21.9, tipo: 'custo_fixo', ajuda: 'Aluguel, Folha de Pagamento, Pró-Labore, Energia, Água e Softwares' },
    { descricao: '(=) RESULTADO LÍQUIDO DO EXERCÍCIO (LUCRO LÍQUIDO / EBITDA)', valor: lucroLiquido, porcentagem: margemLiquidaPorcentagem, tipo: 'lucro_liquido' },
  ];

  return (
    <div className="space-y-6">
      {/* ══════════ 1. HEADER & SELETOR DE MÊS ══════════ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-['Sora'] text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Calculator className="text-[#FC5B24]" size={22} />
            Demonstrativo do Resultado do Exercício (DRE Gerencial)
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {tDynamic('Visão contábil e gerencial completa da lucratividade da sua cozinha em tempo real.')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="month"
            value={mesSelecionado}
            onChange={(e) => setMesSelecionado(e.target.value)}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-900 outline-none dark:border-white/10 dark:bg-[#070C18] dark:text-white"
          />
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200 dark:bg-white/10 dark:text-white"
          >
            <Download size={14} /> Imprimir DRE
          </button>
        </div>
      </div>

      {/* ══════════ 2. CARDS DE RESUMO FINANCEIRO ══════════ */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <span className="text-[11px] font-bold text-gray-400">Receita Bruta Total</span>
          <p className="mt-1 font-['Sora'] text-xl font-bold text-gray-900 dark:text-white">
            R$ {receitaBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-emerald-500 font-semibold mt-1 flex items-center gap-0.5">
            <ArrowUpRight size={12} /> +8.5% vs mês anterior
          </span>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <span className="text-[11px] font-bold text-gray-400">CMV Real (Insumos)</span>
          <p className="mt-1 font-['Sora'] text-xl font-bold text-orange-500">
            R$ {cmvInsumos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">33.0% da Receita Líquida</span>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <span className="text-[11px] font-bold text-gray-400">Margem de Contribuição</span>
          <p className="mt-1 font-['Sora'] text-xl font-bold text-blue-500">
            R$ {margemContribucao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-blue-400 font-semibold mt-1 block">
            {margemPorcentagem.toFixed(1)}% de Margem Bruta
          </span>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 shadow-sm">
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Lucro Líquido (EBITDA)</span>
          <p className="mt-1 font-['Sora'] text-xl font-bold text-emerald-600 dark:text-emerald-400">
            R$ {lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-emerald-500 font-bold mt-1 block">
            {margemLiquidaPorcentagem.toFixed(1)}% Margem Líquida Real
          </span>
        </div>
      </div>

      {/* ══════════ 3. ESTRUTURA DETALHADA DA DRE ══════════ */}
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
        <h3 className="font-['Sora'] text-base font-bold text-gray-900 dark:text-white mb-4">
          Demonstrativo Estruturado do Período ({mesSelecionado})
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-gray-200 text-[11px] uppercase tracking-wider text-slate-400 dark:border-white/10">
              <tr>
                <th className="py-3 px-4">Conta DRE</th>
                <th className="py-3 px-4 text-right">Valor R$</th>
                <th className="py-3 px-4 text-right">% Receita</th>
                <th className="py-3 px-4 text-center">Detalhamento / Ajuda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-medium">
              {linhas.map((linha, idx) => {
                const isDestaque = linha.tipo === 'receita' || linha.tipo === 'lucro_bruto' || linha.tipo === 'margem' || linha.tipo === 'lucro_liquido';
                return (
                  <tr
                    key={idx}
                    className={`transition-colors ${
                      linha.tipo === 'lucro_liquido'
                        ? 'bg-emerald-500/10 font-bold text-emerald-600 dark:text-emerald-400'
                        : isDestaque
                        ? 'bg-gray-50/80 dark:bg-white/5 font-bold text-gray-900 dark:text-white'
                        : 'hover:bg-gray-50/50 dark:hover:bg-white/5 text-gray-700 dark:text-slate-300'
                    }`}
                  >
                    <td className="py-3 px-4 flex items-center gap-2">
                      {linha.descricao}
                    </td>
                    <td className={`py-3 px-4 text-right font-mono ${
                      linha.valor < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-900 dark:text-white'
                    }`}>
                      R$ {Math.abs(linha.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      {linha.porcentagem.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-center text-slate-400 text-[11px]">
                      {linha.ajuda || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

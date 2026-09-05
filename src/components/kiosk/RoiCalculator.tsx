import { useState } from 'react';
import { TrendingUp, Clock, ArrowRight, Info, Sparkles } from 'lucide-react';
import { KioskLeadModal } from '../landing/KioskLeadModal';
import { useI18n } from '../../contexts/I18nContext';

export function RoiCalculator() {
  const { tDynamic } = useI18n();
  const [pedidosDia, setPedidosDia] = useState<number>(300);
  const [ticketMedio, setTicketMedio] = useState<number>(35);
  const [pedidosPico, setPedidosPico] = useState<number>(80);
  const [caixasBalcao, setCaixasBalcao] = useState<number>(2);
  const [totensDesejados, setTotensDesejados] = useState<number>(2);

  const [modalOpen, setModalOpen] = useState(false);

  // Cálculos de Estimativa Diagnóstica
  // 1. Aumento do Ticket Médio por Upsell Automático (estimado em +15% no Kiosk)
  const ticketComKiosk = ticketMedio * 1.15;
  const incrementoTicketPorPedido = ticketComKiosk - ticketMedio;

  // 2. Pedidos Adicionais por Mês devido à redução de fila e abandono (-35% de abandono de fila no pico)
  const pedidosAdicionaisMes = Math.round(pedidosDia * 30 * 0.14 * (totensDesejados / Math.max(caixasBalcao, 1)));

  // 3. Faturamento Adicional Estimado por Mês
  const faturamentoAdicionalMes = Math.round(
    pedidosDia * 30 * incrementoTicketPorPedido + pedidosAdicionaisMes * ticketComKiosk
  );

  // 4. Redução da fila no pico (%)
  const reducaoFilaPico = Math.min(Math.round(20 + totensDesejados * 12), 65);

  const formatarMoeda = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="rounded-3xl border border-gray-800 bg-gradient-to-b from-[#0B1120] to-[#070C18] p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
      <div className="mb-8 text-center md:text-left">
        <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3.5 py-1 text-xs font-bold text-orange-400 mb-3">
          <Sparkles size={14} /> {tDynamic('DIAGNÓSTICO E ROI OPERACIONAL')}
        </div>
        <h3 className="font-['Sora'] text-2xl sm:text-3xl font-bold text-white leading-tight">
          Quanto o autoatendimento pode <span className="text-[#FC5B24]">impactar sua operação?</span>
        </h3>
        <p className="mt-2 text-sm text-gray-400 max-w-2xl">
          {tDynamic('Simule o potencial de crescimento de vendas, redução de filas e aumento de ticket médio com o MiseOn Kiosk.')}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12 items-start">
        {/* Painel de Inputs (Sliders & Controls) */}
        <div className="lg:col-span-6 space-y-6 bg-white/5 rounded-2xl p-5 sm:p-7 border border-white/10">
          
          {/* Input 1: Pedidos por dia */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-gray-200">{tDynamic('Pedidos por dia (total)')}</label>
              <span className="text-sm font-extrabold text-[#FC5B24]">{pedidosDia} pedidos</span>
            </div>
            <input
              type="range"
              min="50"
              max="1500"
              step="10"
              value={pedidosDia}
              onChange={(e) => setPedidosDia(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#FC5B24]"
            />
            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
              <span>50</span>
              <span>750</span>
              <span>1500+</span>
            </div>
          </div>

          {/* Input 2: Ticket médio R$ */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-gray-200">{tDynamic('Ticket médio atual (R$)')}</label>
              <span className="text-sm font-extrabold text-emerald-400">R$ {ticketMedio},00</span>
            </div>
            <input
              type="range"
              min="15"
              max="250"
              step="5"
              value={ticketMedio}
              onChange={(e) => setTicketMedio(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
              <span>R$ 15</span>
              <span>R$ 130</span>
              <span>R$ 250+</span>
            </div>
          </div>

          {/* Input 3: Pedidos no horário de pico por hora */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-gray-200">{tDynamic('Pedidos no horário de pico (por hora)')}</label>
              <span className="text-sm font-extrabold text-blue-400">{pedidosPico} pedidos/h</span>
            </div>
            <input
              type="range"
              min="20"
              max="400"
              step="5"
              value={pedidosPico}
              onChange={(e) => setPedidosPico(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {/* Grid 2 colunas para Caixas e Totens */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5">{tDynamic('Caixas no balcão')}</label>
              <select
                value={caixasBalcao}
                onChange={(e) => setCaixasBalcao(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-700 bg-[#070C18] p-2.5 text-xs text-white outline-none focus:border-[#FC5B24]"
              >
                <option value={1}>1 caixa</option>
                <option value={2}>2 caixas</option>
                <option value={3}>3 caixas</option>
                <option value={4}>4+ caixas</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5">Totens desejados</label>
              <select
                value={totensDesejados}
                onChange={(e) => setTotensDesejados(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-700 bg-[#070C18] p-2.5 text-xs text-white outline-none focus:border-[#FC5B24]"
              >
                <option value={1}>1 totem Bravus</option>
                <option value={2}>2 totens Bravus</option>
                <option value={3}>3 totens Bravus</option>
                <option value={4}>4+ totens Bravus</option>
              </select>
            </div>
          </div>
        </div>

        {/* Painel de Resultados (Output de Estimativa Diagnóstica) */}
        <div className="lg:col-span-6 flex flex-col justify-between h-full bg-gradient-to-br from-[#0E172A] to-[#0B1120] rounded-2xl p-6 sm:p-8 border border-orange-500/20 shadow-xl">
          <div>
            <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-5">
              <span className="text-xs uppercase font-bold tracking-wider text-gray-400">
                Impacto Potencial (Estimativa)
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
                <TrendingUp size={14} /> +15% no Ticket Médio
              </span>
            </div>

            {/* Métrica 1: Pedidos adicionais */}
            <div className="mb-5">
              <div className="text-xs text-gray-400 mb-1">{tDynamic('Pedidos adicionais capturados/mês')}</div>
              <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-baseline gap-2">
                <span className="text-emerald-400">+ {pedidosAdicionaisMes.toLocaleString('pt-BR')}</span>
                <span className="text-xs text-gray-400 font-normal">pedidos/mês</span>
              </div>
            </div>

            {/* Métrica 2: Faturamento Potencial Adicional */}
            <div className="mb-5 p-4 rounded-xl bg-orange-500/10 border border-orange-500/30">
              <div className="text-xs font-bold uppercase tracking-wider text-orange-400 mb-1">
                Faturamento Potencial Adicional
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold text-[#FC5B24] tracking-tight">
                + {formatarMoeda(faturamentoAdicionalMes)}
                <span className="text-xs text-gray-400 font-normal ml-2">/mês estimativa</span>
              </div>
              <p className="mt-1 text-[11px] text-gray-300">
                {tDynamic('Calculado com base na conversão de adicionais + absorção de fluxo no pico.')}
              </p>
            </div>

            {/* Métrica 3: Redução de fila no pico */}
            <div className="mb-6 flex items-center gap-4 bg-white/5 p-3.5 rounded-xl border border-white/5">
              <div className="rounded-lg bg-blue-500/20 p-2 text-blue-400 shrink-0">
                <Clock size={20} />
              </div>
              <div>
                <div className="text-xs font-bold text-white">
                  - {reducaoFilaPico}% no tempo de espera da fila no pico
                </div>
                <div className="text-xs text-gray-400">
                  {tDynamic('Desafoga o caixa físico e reduz desistências no balcão.')}
                </div>
              </div>
            </div>
          </div>

          <div>
            <button
              onClick={() => setModalOpen(true)}
              className="w-full rounded-2xl bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] py-4 px-6 font-['Sora'] text-sm font-bold text-white shadow-xl shadow-[#FC5B24]/25 transition hover:scale-[1.02] hover:brightness-110 flex items-center justify-center gap-2"
            >
              <span>{tDynamic('Quero analisar minha operação')}</span>
              <ArrowRight size={18} />
            </button>
            <p className="mt-2 text-center text-[10px] text-gray-500 flex items-center justify-center gap-1">
              <Info size={12} /> *Valores estimativos baseados em estudos de mercado para food service. Não constituem garantia comercial.
            </p>
          </div>
        </div>
      </div>

      {/* Modal de Lead conectado ao cálculo */}
      <KioskLeadModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Análise Operacional do MiseOn Kiosk"
        subtitle={`Receba um diagnóstico detalhado para sua operação (Simulado: ${pedidosDia} pedidos/dia, Ticket R$ ${ticketMedio}).`}
        origem="kiosk_roi_calculator"
        defaultPedidosDia={pedidosDia}
      />
    </div>
  );
}

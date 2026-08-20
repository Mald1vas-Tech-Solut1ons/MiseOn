import { ArrowRight, Layers, Box, BarChart3 } from 'lucide-react';

import { useI18n } from '../../contexts/I18nContext';
const WHATSAPP_VENDAS = '5511919889233';
const zap = (msg: string) => `https://wa.me/${WHATSAPP_VENDAS}?text=${encodeURIComponent(msg)}`;

export default function PainPoints() {
  const { tDynamic } = useI18n();
  return (
    <section style={{ borderTop: '1px solid rgba(10,92,196,0.15)', background: 'rgba(10,92,196,0.02)' }} className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '.3em', color: '#0A5CC4', textTransform: 'uppercase', marginBottom: 18 }}>
          {tDynamic('O Desafio do Crescimento')}
        </div>
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <div>
            <h2 style={{ fontFamily: "'Sora', sans-serif" }} className="text-3xl font-black leading-tight sm:text-5xl text-white">
              {tDynamic('Vender em múltiplos canais não deveria significar')} <span style={{ color: '#FC5B24' }}>caos na cozinha.</span>
            </h2>
            <div className="mt-8 space-y-6">
              <div className="flex gap-4 items-start">
                <Layers className="text-blue-500 shrink-0 mt-1" size={24} />
                <p style={{ color: '#AEB9CE' }} className="text-lg leading-relaxed">
                  <b className="text-white">{tDynamic('Fragmentação de Pedidos:')}</b> iFood apitando de um lado, WhatsApp de outro, balcão lotado. Sem um KDS centralizado, pedidos se perdem, atrasam e a equipe entra em colapso nos dias de pico.
                </p>
              </div>
              <div className="flex gap-4 items-start">
                <Box className="text-orange-500 shrink-0 mt-1" size={24} />
                <p style={{ color: '#AEB9CE' }} className="text-lg leading-relaxed">
                  <b className="text-white">{tDynamic('Furo de Estoque e Margem:')}</b> Vender sem baixa automática de insumos (Ficha Técnica) é pilotar no escuro. Você descobre que faltou embalagem no meio do rush e não sabe o custo real de cada prato.
                </p>
              </div>
              <div className="flex gap-4 items-start">
                <BarChart3 className="text-green-500 shrink-0 mt-1" size={24} />
                <p style={{ color: '#AEB9CE' }} className="text-lg leading-relaxed">
                  <b className="text-white">{tDynamic('Falta de Dados Consolidados:')}</b> {tDynamic('Conciliar o financeiro do salão, do app de delivery e do site próprio leva horas preciosas. Você precisa de um DRE claro, não de planilhas complexas.')}
                </p>
              </div>
            </div>
            
            <p className="mt-8 text-xl font-bold text-white">
              {tDynamic('O MiseOn resolve tudo isso. Sincronizamos seus canais de venda (incluindo o iFood) em um único ecossistema fluido.')}
            </p>

            <a
              href={zap('Olá! Quero entender como o MiseOn centraliza a minha operação e o meu iFood.')}
              style={{ background: '#0A5CC4', fontFamily: "'Sora', sans-serif" }}
              className="mt-8 inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-bold text-white transition hover:bg-blue-600 shadow-[0_0_20px_rgba(10,92,196,0.3)]"
            >
              {tDynamic('Falar com um consultor especialista')} <ArrowRight size={18} />
            </a>
          </div>

          {/* Gráfico Visual de Centralização */}
          <div style={{ border: '1px solid rgba(10,92,196,0.2)', background: '#0B1120', borderRadius: 24 }} className="p-8 shadow-2xl relative">
            <p style={{ fontFamily: "'Sora', sans-serif" }} className="mb-8 text-xl font-bold text-center text-white">
              {tDynamic('A Sinergia do Ecossistema MiseOn')}
            </p>
            
            <div className="flex flex-col items-center gap-4">
              {/* Canais */}
              <div className="flex w-full justify-around">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-14 h-14 bg-red-600 rounded-xl flex items-center justify-center font-bold text-white shadow-lg">iFood</div>
                  <span className="text-xs text-gray-400 font-semibold">Parceiro</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-14 h-14 bg-orange-500 rounded-xl flex items-center justify-center font-bold text-white shadow-lg">Site</div>
                  <span className="text-xs text-gray-400 font-semibold">Próprio</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-14 h-14 bg-gray-700 rounded-xl flex items-center justify-center font-bold text-white shadow-lg">PDV</div>
                  <span className="text-xs text-gray-400 font-semibold">Balcão</span>
                </div>
              </div>
              
              {/* Fluxo */}
              <div className="w-full flex justify-center py-4">
                <div className="h-10 w-px bg-gradient-to-b from-gray-600 to-blue-500"></div>
              </div>
              
              {/* Core */}
              <div className="w-full rounded-2xl bg-gradient-to-r from-blue-900/40 to-blue-600/20 border border-blue-500/30 p-6 text-center shadow-[0_0_30px_rgba(10,92,196,0.2)]">
                <h3 style={{ fontFamily: "'Sora', sans-serif" }} className="text-2xl font-black text-white mb-2">MiseOn O.S.</h3>
                <p className="text-sm text-blue-200 font-medium">{tDynamic('Gestão unificada de KDS, Ficha Técnica e Financeiro')}</p>
              </div>
            </div>
            
            <div style={{ background: 'rgba(10,92,196,0.1)', border: '1px solid rgba(10,92,196,0.2)' }} className="mt-8 rounded-2xl p-6 text-center">
              <p className="text-sm font-bold text-blue-400">{tDynamic('O resultado da orquestração:')}</p>
              <p style={{ fontFamily: "'Sora', sans-serif" }} className="mt-2 text-lg font-medium text-white leading-relaxed">
                {tDynamic('Você para de gerenciar telas e volta a focar no que importa:')} <b>{tDynamic('A qualidade do seu produto e a expansão da sua marca.')}</b>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import { useState } from 'react';
import { Check, ShieldCheck } from 'lucide-react';
import { SAAS_PRICING } from '../../lib/efiInfo';

import { useI18n } from '../../contexts/I18nContext';
const CHECKLIST = [
  'Gestão Unificada de Pedidos (Balcão, Salão e iFood)',
  'Integração Oficial com iFood Sem Taxas Extras',
  'Monitor KDS da Cozinha Integrado',
  'Gestão Logística e Rotas para Entregadores',
  'Cardápio Digital Premium e QR Code na Mesa',
  'Estoque com Baixa Automática por Ficha Técnica',
  'Emissor NFC-e (Cupom Fiscal) Incluso',
  'Conciliação de Pix e Cartões (Efí Bank)',
  'Suporte Especializado e Consultivo B2B',
];

export default function Pricing() {
  const { tDynamic } = useI18n();
  const [anual, setAnual] = useState(true);

  const precoMensalStr = SAAS_PRICING.mensal.bruto.toFixed(2).replace('.', ',');
  const precoAnualStr = SAAS_PRICING.anual.mensalEquivalente.toFixed(2).replace('.', ',');
  const totalAnualStr = SAAS_PRICING.anual.totalBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const economiaAnoStr = (SAAS_PRICING.anual.economiaMensal * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  return (
    <section className="py-28" style={{ background: '#070C18' }}>
      <div className="mx-auto max-w-4xl px-6 text-center">
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '.3em', color: '#0A5CC4', textTransform: 'uppercase', marginBottom: 18 }}>
          {tDynamic('Sem Taxas Escondidas')}
        </div>
        <h2 style={{ fontFamily: "'Sora', sans-serif" }} className="text-3xl font-black sm:text-6xl text-white leading-tight">
          {tDynamic('Você sabe quanto vai pagar:')}<br />mais lucro <span className="text-[#0A5CC4]">no seu bolso</span>.
        </h2>
        <p style={{ color: 'rgba(234,241,251,0.6)' }} className="mx-auto mt-6 max-w-2xl text-xl font-medium">
          {tDynamic('Zero porcentagem sobre sua venda. Todos os recursos liberados para a sua equipe desde o primeiro dia, sem pegadinhas.')}
        </p>

        {/* Toggle mensal/anual */}
        <div className="mt-12 inline-flex items-center gap-1 rounded-full border border-gray-700 bg-[#0B1120] p-1 shadow-2xl">
          <button
            onClick={() => setAnual(false)}
            style={{ fontFamily: "'Sora', sans-serif" }}
            className={`rounded-full px-8 py-3 text-sm font-bold transition ${!anual ? 'bg-[#FC5B24] text-white' : 'text-gray-400 hover:text-white'}`}
          >
            {tDynamic('Mensal (Sem Fidelidade)')}
          </button>
          <button
            onClick={() => setAnual(true)}
            style={{ fontFamily: "'Sora', sans-serif" }}
            className={`flex items-center gap-2 rounded-full px-8 py-3 text-sm font-bold transition ${anual ? 'bg-[#0A5CC4] text-white shadow-[0_0_20px_rgba(10,92,196,0.5)]' : 'text-gray-400 hover:text-white'}`}
          >
            Anual <span className={`rounded-full px-2 py-0.5 text-xs opacity-90 font-black ${anual ? 'bg-white text-[#0A5CC4]' : 'bg-blue-900/40 text-blue-400'}`}>-12% OFF</span>
          </button>
        </div>

        <div
          style={{ border: '1px solid rgba(10,92,196,0.4)', background: 'linear-gradient(180deg, rgba(10,92,196,0.08) 0%, rgba(10,92,196,0.02) 100%)', borderRadius: 40, position: 'relative', overflow: 'hidden' }}
          className="mx-auto mt-12 max-w-lg shadow-[0_0_60px_rgba(10,92,196,0.1)]"
        >
          <div className="p-10">
            <p style={{ color: '#0A5CC4', fontFamily: "'Sora', sans-serif" }} className="text-sm font-black uppercase tracking-widest bg-blue-500/10 inline-block px-4 py-2 rounded-full border border-blue-500/20">
              Plano MiseOn Enterprise
            </p>
            <div style={{ fontFamily: "'Sora', sans-serif" }} className="mt-8 flex items-center justify-center text-7xl font-black tracking-tight text-white">
              <span style={{ color: 'rgba(234,241,251,0.5)' }} className="mr-3 text-3xl">R$</span>
              <span>{anual ? precoAnualStr : precoMensalStr}</span>
              <span style={{ color: 'rgba(234,241,251,0.5)' }} className="text-xl font-medium mt-auto mb-2 ml-2">/mês</span>
            </div>
            <div className="mt-4 flex flex-col items-center justify-center text-sm font-medium h-12">
              {anual ? (
                <>
                  <span className="text-gray-400">{tDynamic(`Faturamento anual em até 12x no cartão (R$ ${totalAnualStr}) ou Pix 5% OFF.`)}</span>
                  <span className="text-blue-400 font-bold mt-1">{tDynamic(`Sua economia: R$ ${economiaAnoStr}/ano`)}</span>
                </>
              ) : (
                <span className="text-gray-400">{tDynamic('Assinatura mensal flexível com cancelamento online.')}</span>
              )}
            </div>

            <div className="mt-10 h-[1px] w-full bg-gradient-to-r from-transparent via-gray-700 to-transparent"></div>

            <ul className="mt-10 space-y-4 text-left px-4">
              {CHECKLIST.map((item, i) => (
                <li key={i} className="flex items-center gap-4 text-base">
                  <div className="bg-blue-500/20 p-1 rounded-full"><Check size={16} className="text-blue-400" /></div>
                  <span className="text-gray-200 font-medium">{item}</span>
                </li>
              ))}
            </ul>

            <a
              href="/cadastre-se"
              style={{ background: '#0A5CC4', fontFamily: "'Sora', sans-serif", boxShadow: '0 8px 32px rgba(10,92,196,0.4)' }}
              className="mt-12 block w-full rounded-2xl py-5 text-center text-xl font-black text-white transition hover:scale-105 hover:bg-blue-600 hover:shadow-[0_8px_40px_rgba(10,92,196,0.6)]"
            >
              {tDynamic(`Criar Conta (${SAAS_PRICING.trialDias} Dias Grátis)`)}
            </a>
            <div className="mt-6 flex items-center justify-center gap-2 text-xs font-bold text-gray-500">
              <ShieldCheck size={14} className="text-gray-400" /> {tDynamic('Cancele quando quiser. Cartão não exigido no teste.')}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

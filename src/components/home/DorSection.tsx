import { ArrowRight } from 'lucide-react';
import { RotuloSecao, zap } from './shared';

import { useI18n } from '../../contexts/I18nContext';
export function DorSection() {
  const { tDynamic } = useI18n();
  return (
    <section style={{ borderTop: '1px solid rgba(252,91,36,0.2)', background: 'rgba(252,91,36,0.04)' }} className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <RotuloSecao numero="01" texto="A conta que dói" />
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div>
            <h2 style={{ fontFamily: "'Sora', sans-serif" }} className="text-3xl font-extrabold leading-tight sm:text-4xl">
              {tDynamic('Quanto você pagou de comissão')}<br />mês passado? <span style={{ color: '#FC5B24' }}>Você sabe?</span>
            </h2>
            <p style={{ color: '#AEB9CE' }} className="mt-5 max-w-xl text-base leading-relaxed">
              {tDynamic('Marketplace cobra até')} <b style={{ color: '#EAF1FB' }}>27%</b> por pedido. Numa loja que vende
              R$ 15 mil por mês no app, isso é mais de <b style={{ color: '#FC5B24' }}>R$ 4.000 saindo do
              seu bolso todo mês</b> — dá para pagar o aluguel do ponto com esse dinheiro.
            </p>
            <p style={{ color: '#AEB9CE' }} className="mt-4 max-w-xl text-base leading-relaxed">
              {tDynamic('Com o MiseOn, o pedido do seu site é')} <b style={{ color: '#EAF1FB' }}>100% seu</b>. E o pedido
              que continuar vindo do iFood entra no mesmo painel, com a taxa calculada na sua frente —
              você sabe exatamente quanto cada canal te custa.
            </p>
            <a
              href={zap('Olá! Quero uma conta de quanto eu economizaria saindo da comissão do marketplace.')}
              style={{ border: '1px solid rgba(252,91,36,0.5)', color: '#FC5B24', fontFamily: "'Sora', sans-serif" }}
              className="mt-7 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition hover:bg-orange-500 hover:text-white"
            >
              {tDynamic('Calcular minha economia no WhatsApp')} <ArrowRight size={15} />
            </a>
          </div>

          {/* Simulação */}
          <div style={{ border: '1px solid rgba(255,255,255,.09)', background: '#0B1120', borderRadius: 24 }} className="p-6 sm:p-8">
            <p style={{ fontFamily: "'Sora', sans-serif" }} className="mb-5 text-sm font-extrabold text-white">
              {tDynamic('Uma venda de R$ 100,00 — quem fica com o quê')}
            </p>
            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-gray-400">{tDynamic('No marketplace (até 27%)')}</span>
                  <span className="font-bold text-red-400">- R$ 27,00</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-gray-800">
                  <div className="h-full w-[27%] rounded-full bg-red-500" />
                </div>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-gray-400">{tDynamic('No seu site MiseOn')}</span>
                  <span className="font-bold text-green-400">{tDynamic('R$ 0,00 de comissão')}</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-gray-800">
                  <div className="h-full w-full rounded-full bg-green-500" />
                </div>
              </div>
            </div>
            <div style={{ background: 'rgba(252,91,36,0.08)', border: '1px solid rgba(252,91,36,0.25)' }} className="mt-6 rounded-xl p-4 text-center">
              <p className="text-xs uppercase tracking-widest text-gray-400">{tDynamic('Economia em R$ 15 mil/mês de vendas próprias')}</p>
              <p style={{ fontFamily: "'Sora', sans-serif" }} className="mt-1 text-3xl font-extrabold text-[#FC5B24]">
                R$ 4.050<span className="text-base text-gray-400">/mês</span>
              </p>
              <p className="mt-1 text-xs text-gray-500">= R$ 48.600 por ano de volta para o seu caixa</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import { Check, X, Minus } from 'lucide-react';
import MiseOnLogo from '../MiseOnLogo';

import { useI18n } from '../../contexts/I18nContext';
export default function ComparativoSection() {
  const { tDynamic } = useI18n();
  return (
    <section style={{ borderTop: '1px solid rgba(10,92,196,0.15)', background: '#0B1120' }} className="py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center mb-16">
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '.3em', color: '#0A5CC4', textTransform: 'uppercase', marginBottom: 18 }}>
            O Verdadeiro All-in-One
          </div>
          <h2 style={{ fontFamily: "'Sora', sans-serif" }} className="text-3xl font-black text-white sm:text-5xl">
            {tDynamic('Como o MiseOn esmaga a concorrência')}
          </h2>
          <p className="mt-6 text-xl text-gray-400 max-w-2xl mx-auto">
            {tDynamic('Compare nossa tecnologia contra os líderes de mercado e descubra por que os restaurantes que mais crescem estão migrando para o MiseOn.')}
          </p>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-gray-800 shadow-[0_0_50px_rgba(10,92,196,0.1)]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="bg-gray-900 p-6 border-b border-gray-800 min-w-[200px]">
                  <span className="text-gray-400 font-bold uppercase tracking-wider text-xs">Recursos Essenciais</span>
                </th>
                <th className="bg-gray-900/50 p-6 border-b border-gray-800 text-center min-w-[150px]">
                  <span className="text-gray-300 font-black text-xl font-sans">Anota.ai</span>
                </th>
                <th className="bg-gray-900/50 p-6 border-b border-gray-800 text-center min-w-[150px]">
                  <span className="text-gray-300 font-black text-xl font-sans">GrandChef</span>
                </th>
                <th className="bg-[#0A5CC4]/10 p-6 border-b border-[#0A5CC4]/30 text-center min-w-[150px] relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-transparent"></div>
                  <div className="relative z-10 flex justify-center scale-75 transform origin-center">
                    <MiseOnLogo size={120} />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium">
              {[
                { r: 'Mensalidade Inicial (Média)', a: 'R$ 149,00', g: 'R$ 159,00', m: 'R$ 99,90', highlight: false },
                { r: 'Integração Oficial iFood', a: true, g: true, m: true, highlight: false },
                { r: 'KDS (Monitor de Cozinha)', a: <span title="Básico/Faltam recursos" className="block mx-auto w-max"><Minus size={18} className="text-gray-600" /></span>, g: true, m: true, highlight: true },
                { r: 'Gestão de Ficha Técnica em Gramas', a: false, g: true, m: true, highlight: false },
                { r: 'Emissor NFC-e Nativo', a: false, g: 'Módulo Pago', m: 'Incluso no Plano', highlight: true },
                { r: 'Split Bancário Automático (Pix)', a: false, g: false, m: true, highlight: true },
                { r: 'Robô de IA para Descrições', a: true, g: false, m: true, highlight: false },
                { r: 'Taxas Adicionais por Módulos', a: 'Sim', g: 'Sim', m: 'Zero', highlight: true },
              ].map((row, i) => (
                <tr key={i} className="transition-colors hover:bg-white/[0.02]">
                  <td className="p-5 border-b border-gray-800/50 bg-gray-900/20">
                    <span className="text-gray-300">{row.r}</span>
                  </td>
                  
                  {/* Anota AI */}
                  <td className="p-5 border-b border-gray-800/50 text-center">
                    {typeof row.a === 'boolean' ? (
                      row.a ? <Check size={20} className="text-gray-600 mx-auto" /> : <X size={20} className="text-gray-600 mx-auto" />
                    ) : (
                      <span className="text-gray-500">{row.a}</span>
                    )}
                  </td>
                  
                  {/* GrandChef */}
                  <td className="p-5 border-b border-gray-800/50 text-center">
                    {typeof row.g === 'boolean' ? (
                      row.g ? <Check size={20} className="text-gray-600 mx-auto" /> : <X size={20} className="text-gray-600 mx-auto" />
                    ) : (
                      <span className="text-gray-500">{row.g}</span>
                    )}
                  </td>

                  {/* MiseOn */}
                  <td className={`p-5 border-b border-[#0A5CC4]/20 text-center font-bold ${row.highlight ? 'bg-[#0A5CC4]/5' : 'bg-transparent'}`}>
                    {typeof row.m === 'boolean' ? (
                      row.m ? <Check size={22} className="text-blue-500 mx-auto drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]" /> : <X size={22} className="text-blue-500 mx-auto" />
                    ) : (
                      <span className="text-blue-400">{row.m}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-400 text-sm mb-6">
            {tDynamic('A concorrência te vende partes do sistema. O MiseOn te entrega a máquina inteira.')}
          </p>
          <a
            href="/cadastre-se"
            style={{ background: '#FC5B24', fontFamily: "'Sora', sans-serif" }}
            className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-lg font-bold text-white transition-all hover:scale-105 shadow-[0_0_30px_rgba(252,91,36,0.3)]"
          >
            {tDynamic('Migrar para o MiseOn')}
          </a>
        </div>
      </div>
    </section>
  );
}

import { Calculator, Percent, TrendingUp, ArrowRight } from 'lucide-react';
import { RotuloSecao } from './shared';

import { useI18n } from '../../contexts/I18nContext';
/**
 * Motor de taxas iFood — as regras que JÁ existem no sistema:
 *  - taxa percentual do contrato (ex.: 27%) + taxa fixa por pedido (ex.: R$ 0,99)
 *  - líquido real calculado por pedido (bruto − taxa retida)
 *  - markup sugerido de cardápio para preservar a margem
 *  - DRE separando Receita iFood × Taxa iFood Retida
 */
export function TaxasSection() {
  const { tDynamic } = useI18n();
  return (
    <section id="taxas" style={{ borderTop: '1px solid rgba(255,255,255,.08)' }} className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <RotuloSecao numero="04" texto="Motor de taxas — transparência contábil" />
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div>
            <h2 style={{ fontFamily: "'Sora', sans-serif" }} className="text-3xl font-extrabold leading-tight sm:text-4xl">
              {tDynamic('Você sabe quanto o iFood')} <span style={{ color: '#FC5B24' }}>realmente</span> te paga por pedido?
            </h2>
            <p style={{ color: '#AEB9CE' }} className="mt-5 max-w-xl text-base leading-relaxed">
              A maioria dos lojistas olha o valor bruto do pedido e acha que aquele dinheiro é dele.
              Não é. O MiseOn registra o seu contrato — <b style={{ color: '#EAF1FB' }}>percentual da comissão
              e taxa fixa por pedido</b> — e calcula o líquido de cada venda automaticamente:
            </p>

            <div className="mt-7 space-y-4">
              {[
                {
                  icon: <Percent size={18} />,
                  titulo: 'Taxa retida calculada por pedido',
                  texto: 'Bruto × sua comissão + taxa fixa. O valor exato que o marketplace fica aparece no pedido, no financeiro e no DRE.',
                },
                {
                  icon: <TrendingUp size={18} />,
                  titulo: 'Markup de cardápio que protege sua margem',
                  texto: 'Com a sua taxa cadastrada, o sistema mostra o preço que cada produto precisa ter no iFood para você não vender no prejuízo.',
                },
                {
                  icon: <Calculator size={18} />,
                  titulo: 'DRE separando os canais',
                  texto: 'Receita própria, receita iFood e taxa retida em linhas separadas do seu demonstrativo. Na hora do fechamento, não tem surpresa.',
                },
              ].map((item) => (
                <div key={item.titulo} className="flex items-start gap-4">
                  <div style={{ background: 'rgba(10,92,196,0.12)', color: '#6B9EFF', border: '1px solid rgba(10,92,196,0.35)' }} className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                    {item.icon}
                  </div>
                  <div>
                    <p style={{ fontFamily: "'Sora', sans-serif", color: '#EAF1FB' }} className="font-bold">{item.titulo}</p>
                    <p style={{ color: '#AEB9CE' }} className="mt-1 text-sm leading-relaxed">{item.texto}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Simulação do motor */}
          <div style={{ border: '1px solid rgba(255,255,255,.09)', background: '#0B1120', borderRadius: 24 }} className="p-6 sm:p-8">
            <p style={{ fontFamily: "'Sora', sans-serif" }} className="mb-1 text-sm font-extrabold text-white">
              O motor trabalhando num pedido real
            </p>
            <p className="mb-6 text-xs text-gray-500">{tDynamic('Contrato do exemplo: comissão 27% + R$ 0,99 por pedido')}</p>

            <div className="space-y-3">
              {[
                { label: 'Pedido iFood #5821 (bruto)', valor: 'R$ 67,00', cor: '#EAF1FB' },
                { label: 'Comissão 27%', valor: '- R$ 18,09', cor: '#F87171' },
                { label: 'Taxa fixa por pedido', valor: '- R$ 0,99', cor: '#F87171' },
              ].map((l) => (
                <div key={l.label} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-4 py-3">
                  <span className="text-sm text-gray-400">{l.label}</span>
                  <span style={{ color: l.cor, fontFamily: "'JetBrains Mono', monospace" }} className="text-sm font-bold">{l.valor}</span>
                </div>
              ))}
              <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }} className="flex items-center justify-between rounded-xl px-4 py-3.5">
                <span className="text-sm font-bold text-green-400">{tDynamic('Líquido que entra no seu caixa')}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace" }} className="text-base font-black text-green-400">R$ 47,92</span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,.07)' }} className="mt-6 pt-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">{tDynamic('E o markup te mostra o preço certo no app')}</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">{tDynamic('Produto no seu cardápio')}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace" }} className="font-bold text-white">R$ 25,00</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-gray-400">{tDynamic('Preço sugerido no iFood')} <ArrowRight size={13} /></span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace" }} className="font-bold text-[#FC5B24]">R$ 35,24</span>
              </div>
              <p className="mt-3 text-xs opacity-95 leading-relaxed text-gray-500">
                Mesma margem, dois canais. Sem essa conta, cada promoção que você faz no marketplace
                pode estar saindo do seu bolso sem você perceber.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

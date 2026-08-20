import { ChevronDown } from 'lucide-react';
import { LeadForm } from './LeadForm';

import { useI18n } from '../../contexts/I18nContext';
const PERGUNTAS = [
  {
    q: 'Preciso comprar algum equipamento?',
    a: 'Não. A MiseOn roda no navegador e é um PWA instalável: vira app no celular ou tablet que você já tem. O KDS funciona em qualquer tela com internet.',
  },
  {
    q: 'Como eu recebo o dinheiro das vendas online?',
    a: 'Pix e cartão são processados pelo Efí Bank e caem direto na conta da sua loja, sem intermediário segurando seu dinheiro. Você só paga as tarifas públicas do banco.',
  },
  {
    q: 'Tem taxa por pedido ou comissão sobre vendas?',
    a: 'Não. Você paga apenas a mensalidade fixa de R$ 150 e fica com 100% do que vende, independente do volume de pedidos.',
  },
  {
    q: 'Minha operação é uma cozinha industrial. A MiseOn serve para mim?',
    a: 'Sim. Além do cardápio e dos pedidos, você tem ficha técnica com rendimento, produção de preparos com lotes e validade, e central de compras baseada no estoque real.',
  },
  {
    q: 'Quanto tempo leva para começar?',
    a: 'No mesmo dia. Você cadastra a loja em minutos e, se preferir, nosso time monta o cardápio com você pelo WhatsApp.',
  },
  {
    q: 'Posso cancelar quando quiser?',
    a: 'Sim. Não há fidelidade nem multa. E os 14 primeiros dias são grátis, sem pedir cartão de crédito.',
  },
];

export function FaqCta() {
  const { tDynamic } = useI18n();
  return (
    <>
      {/* ── FAQ ── */}
      <section style={{ borderTop: '1px solid rgba(10,92,196,0.15)', background: 'rgba(10,92,196,0.03)' }} className="py-24">
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-12 text-center">
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '.3em', color: '#FC5B24', textTransform: 'uppercase', marginBottom: 14 }}>
              {tDynamic('Dúvidas frequentes')}
            </div>
            <h2 style={{ fontFamily: "'Sora', sans-serif" }} className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {tDynamic('Perguntas de quem está decidindo')}
            </h2>
          </div>

          <div className="space-y-3">
            {PERGUNTAS.map((p) => (
              <details key={p.q} className="group rounded-2xl border border-gray-800 bg-[#0B1120]/60 px-6 py-4 open:border-[rgba(252,91,36,0.35)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold text-white marker:hidden [&::-webkit-details-marker]:hidden">
                  {p.q}
                  <ChevronDown size={18} className="shrink-0 text-gray-500 transition-transform group-open:rotate-180 group-open:text-[#FC5B24]" />
                </summary>
                <p style={{ color: 'rgba(234,241,251,0.6)' }} className="mt-3 text-sm leading-relaxed">
                  {p.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final + formulário compacto ── */}
      <section className="relative overflow-hidden py-24">
        <div
          style={{ background: 'radial-gradient(circle, rgba(252,91,36,0.15) 0%, transparent 70%)', width: 600, height: 600, borderRadius: '50%', position: 'absolute', bottom: -250, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}
        />
        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <h2 style={{ fontFamily: "'Sora', sans-serif", lineHeight: 1.15 }} className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Sua concorrência já pede pelo celular.{' '}
              <span style={{ color: '#FC5B24' }}>{tDynamic('Sua cozinha merece o mesmo.')}</span>
            </h2>
            <p style={{ color: 'rgba(234,241,251,0.55)' }} className="mt-5 max-w-md text-base leading-relaxed max-lg:mx-auto">
              {tDynamic('Deixe seu contato e a gente te mostra a MiseOn funcionando com o cardápio do seu negócio — sem compromisso.')}
            </p>
          </div>
          <div className="rounded-3xl border border-[rgba(10,92,196,0.3)] bg-[#0B1120]/70 p-7 shadow-[0_0_40px_rgba(10,92,196,0.12)] backdrop-blur sm:p-8">
            <LeadForm compact origem="landing_cta_final" />
          </div>
        </div>
      </section>
    </>
  );
}

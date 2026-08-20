import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

import { useI18n } from '../../contexts/I18nContext';
const WHATSAPP_VENDAS = '5511919889233';
const zap = (msg: string) => `https://wa.me/${WHATSAPP_VENDAS}?text=${encodeURIComponent(msg)}`;

const FAQ = [
  {
    p: 'O MiseOn substitui o iFood ou concorre com ele?',
    r: 'De forma alguma. O iFood é um canal vital de aquisição de clientes. O MiseOn entra como o seu "sistema operacional", recebendo os pedidos do iFood na mesma tela dos seus pedidos próprios (site/balcão), sincronizando estoques e gerando relatórios unificados. Nós potencializamos a sua operação.',
  },
  {
    p: 'Como funciona o KDS (Monitor de Cozinha)?',
    r: 'O KDS substitui a impressora de comandas. Assim que um pedido é feito (no balcão, site ou iFood), ele aparece na tela da cozinha com um cronômetro. Se o tempo estourar, ele sinaliza em vermelho, garantindo que nenhum prato seja esquecido ou atrase.',
  },
  {
    p: 'Preciso pagar a mais para emitir Nota Fiscal (NFC-e)?',
    r: 'Não. Diferente do mercado que cobra a NFC-e como um módulo adicional, no MiseOn o emissor fiscal já é nativo e está incluso no plano único. Você pode emitir cupons com apenas 1 clique direto no PDV.',
  },
  {
    p: 'O fluxo de caixa e o Pix são seguros?',
    r: 'Sim. Nós integramos diretamente com o Efí Bank. O dinheiro dos pagamentos via Pix ou Cartão online cai direto na sua conta digital, sem passar pela nossa mão. É split bancário transparente e seguro.',
  },
  {
    p: 'Posso cancelar a qualquer momento?',
    r: 'Sim. Se optar pelo plano Mensal, não há fidelidade nem multas. Você assina enquanto fizer sentido para a sua operação. No plano Anual, você se compromete com 12 meses em troca de um desconto agressivo no valor total.',
  },
];

export default function FaqSection() {
  const { tDynamic } = useI18n();
  const [faqAberto, setFaqAberto] = useState<number | null>(0);

  return (
    <section style={{ borderTop: '1px solid rgba(255,255,255,.08)', background: '#070C18' }} className="py-24">
      <div className="mx-auto max-w-3xl px-6">
        <h2 style={{ fontFamily: "'Sora', sans-serif" }} className="text-center text-3xl font-black text-white sm:text-4xl">
          {tDynamic('Dúvidas sobre o')} <span style={{ color: '#0A5CC4' }}>Ecossistema</span>
        </h2>
        <div className="mt-10 space-y-3">
          {FAQ.map((f, i) => {
            const aberto = faqAberto === i;
            return (
              <div key={i} style={{ border: '1px solid rgba(255,255,255,.09)', background: 'rgba(255,255,255,.02)' }} className="overflow-hidden rounded-2xl">
                <button
                  onClick={() => setFaqAberto(aberto ? null : i)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-white/5"
                >
                  <span style={{ fontFamily: "'Sora', sans-serif" }} className="text-sm font-bold text-white">{f.p}</span>
                  <ChevronRight size={18} className={`shrink-0 text-gray-500 transition-transform ${aberto ? 'rotate-90 text-[#0A5CC4]' : ''}`} />
                </button>
                {aberto && (
                  <p style={{ color: '#AEB9CE' }} className="border-t border-white/5 px-5 py-4 text-sm leading-relaxed font-medium">
                    {f.r}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <a
            href={zap('Olá! Tenho interesse em estruturar a gestão do meu restaurante com o MiseOn.')}
            style={{ border: '2px solid #0A5CC4', background: 'rgba(10,92,196,0.08)', fontFamily: "'Sora', sans-serif" }}
            className="inline-flex flex-col items-center justify-center rounded-2xl px-8 py-3 transition hover:bg-blue-900/30"
          >
            <span style={{ color: '#4A90E2' }} className="text-xs font-bold uppercase tracking-widest mb-1">Consultoria Especializada</span>
            <span style={{ color: '#4A90E2' }} className="text-xl font-black">{WHATSAPP_VENDAS}</span>
          </a>
        </div>
      </div>
    </section>
  );
}

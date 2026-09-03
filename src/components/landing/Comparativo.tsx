import { Check, X } from 'lucide-react';

import { useI18n } from '../../contexts/I18nContext';
type Linha = { recurso: string; miseon: boolean; concorrente: boolean | 'parcial' };

const LINHAS: Linha[] = [
  { recurso: 'Cardápio digital com pedidos online', miseon: true, concorrente: true },
  { recurso: 'Cupons de desconto', miseon: true, concorrente: true },
  { recurso: 'KDS de cozinha com cronômetros', miseon: true, concorrente: false },
  { recurso: 'Ficha técnica com rendimento e baixa automática de estoque', miseon: true, concorrente: false },
  { recurso: 'Produção de preparos com lotes e validade', miseon: true, concorrente: false },
  { recurso: 'PDV de balcão e mapa de mesas', miseon: true, concorrente: false },
  { recurso: 'Cashback para fidelizar clientes', miseon: true, concorrente: false },
  { recurso: 'White-label: link, visual e marca da sua loja', miseon: true, concorrente: false },
  { recurso: 'Split Pix: dinheiro cai direto na sua conta', miseon: true, concorrente: false },
  { recurso: 'Recuperação de carrinho abandonado', miseon: true, concorrente: false },
];

function Marca({ valor, destaque }: { valor: boolean | 'parcial'; destaque?: boolean }) {
  if (valor === true) {
    return (
      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${destaque ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-gray-400'}`}>
        <Check size={15} strokeWidth={3} />
      </span>
    );
  }
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-500/10 text-red-400">
      <X size={15} strokeWidth={3} />
    </span>
  );
}

export function Comparativo() {
  const { tDynamic } = useI18n();
  return (
    <section style={{ borderTop: '1px solid rgba(10,92,196,0.15)' }} className="py-24">
      <div className="mx-auto max-w-4xl px-6">
        <div className="mb-12 text-center">
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '.3em', color: '#FC5B24', textTransform: 'uppercase', marginBottom: 14 }}>
            Comparativo
          </div>
          <h2 style={{ fontFamily: "'Sora', sans-serif" }} className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {tDynamic('MiseOn × anota-ai: o que muda na prática')}
          </h2>
          <p style={{ color: 'rgba(234,241,251,0.55)' }} className="mx-auto mt-4 max-w-2xl text-base">
            {tDynamic('O anota-ai é um bom cardápio digital. A MiseOn é o cardápio')} <b style={{ color: '#EAF1FB' }}>mais a operação inteira</b>: cozinha, salão, estoque e produção.
          </p>
        </div>

        <div className="overflow-hidden rounded-3xl border border-[rgba(10,92,196,0.25)] bg-[#0B1120]/60">
          {/* Cabeçalho */}
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-gray-800 bg-black/30 px-5 py-4 sm:gap-8 sm:px-7">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Recurso</span>
            <span style={{ fontFamily: "'Sora', sans-serif", color: '#FC5B24' }} className="w-16 text-center text-sm font-extrabold sm:w-20">MiseOn</span>
            <span className="w-16 text-center text-sm font-bold text-gray-400 sm:w-20">anota-ai</span>
          </div>
          {LINHAS.map((l) => (
            <div
              key={l.recurso}
              className={`grid grid-cols-[1fr_auto_auto] items-center gap-3 px-5 py-3.5 sm:gap-8 sm:px-7 ${
                l.miseon && !l.concorrente ? 'bg-[rgba(10,92,196,0.05)]' : ''
              } border-t border-gray-800/60 first:border-t-0`}
            >
              <span className={`text-sm ${l.miseon && !l.concorrente ? 'font-semibold text-white' : 'text-gray-300'}`}>
                {l.recurso}
              </span>
              <span className="flex w-16 justify-center sm:w-20"><Marca valor={l.miseon} destaque={!l.concorrente} /></span>
              <span className="flex w-16 justify-center sm:w-20"><Marca valor={l.concorrente} /></span>
            </div>
          ))}
        </div>

        <p style={{ color: 'rgba(234,241,251,0.35)' }} className="mt-4 text-center text-xs opacity-95 leading-relaxed">
          {tDynamic('Levantamento baseado nas funcionalidades públicas do anota-ai em julho/2026. Se algo mudou por lá, nos avise que corrigimos aqui.')}
        </p>
      </div>
    </section>
  );
}

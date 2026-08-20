import { Sandwich, UtensilsCrossed, Factory } from 'lucide-react';

import { useI18n } from '../../contexts/I18nContext';
const SEGMENTOS = [
  {
    icon: <Sandwich size={22} />,
    titulo: 'Lanchonetes & Hamburguerias',
    dor: 'Fila no balcão, delivery no grito e comanda de papel que some na hora do rush.',
    solucao: ['PDV de balcão rápido + cardápio no celular do cliente', 'KDS com cronômetro: a cozinha sabe o que fazer primeiro', 'Entrega própria com rota ao vivo, sem depender de marketplace'],
  },
  {
    icon: <UtensilsCrossed size={22} />,
    titulo: 'Restaurantes',
    dor: 'Mesa esperando, garçom correndo e pedido que chega errado na cozinha.',
    solucao: ['Mapa de mesas com status em tempo real', 'Pedido vai direto da mesa para o KDS, sem retranscrever', 'Financeiro com gráficos para enxergar o lucro por período'],
  },
  {
    icon: <Factory size={22} />,
    titulo: 'Cozinhas industriais & de elite',
    dor: 'Custo de ficha na planilha desatualizado e produção sem rastreio de validade.',
    solucao: ['Ficha técnica com rendimento: custo e margem por prato', 'Produção de preparos com lotes e data de validade', 'Central de compras gerada a partir do estoque real'],
  },
];

export function Segmentos() {
  const { tDynamic } = useI18n();
  return (
    <section style={{ borderTop: '1px solid rgba(10,92,196,0.15)', background: 'rgba(10,92,196,0.03)' }} className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-14 text-center">
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '.3em', color: '#FC5B24', textTransform: 'uppercase', marginBottom: 14 }}>
            Para quem é
          </div>
          <h2 style={{ fontFamily: "'Sora', sans-serif" }} className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {tDynamic('Feito para a sua operação, não para uma operação genérica')}
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {SEGMENTOS.map((s) => (
            <div
              key={s.titulo}
              className="flex flex-col rounded-3xl border border-gray-800 bg-[#0B1120]/60 p-7 transition-colors hover:border-[rgba(252,91,36,0.35)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(252,91,36,0.12)] text-[#FC5B24]">
                {s.icon}
              </div>
              <h3 style={{ fontFamily: "'Sora', sans-serif" }} className="mt-5 text-lg font-bold text-white">
                {s.titulo}
              </h3>
              <p style={{ color: 'rgba(234,241,251,0.5)' }} className="mt-2 text-sm italic leading-relaxed">
                “{s.dor}”
              </p>
              <ul className="mt-5 space-y-2.5 border-t border-gray-800 pt-5">
                {s.solucao.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-gray-300">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0A5CC4]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

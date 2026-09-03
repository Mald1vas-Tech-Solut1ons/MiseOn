import { Quote, Star } from 'lucide-react';
import { RotuloSecao } from './shared';

import { useI18n } from '../../contexts/I18nContext';
const DEPOIMENTOS = [
  {
    texto:
      'Eu fechava o mês sem saber se tinha lucro de verdade. Hoje eu abro o DRE e vejo quanto cada canal me custa — descobri que duas promoções minhas no marketplace davam prejuízo. Cortei na hora.',
    nome: 'Ricardo M.',
    negocio: 'Hamburgueria · São Paulo, SP',
    destaque: 'DRE e taxa por canal',
  },
  {
    texto:
      'A comanda de papel acabou aqui. O pedido cai na tela da cozinha cronometrado e a gente parou de errar item. No sábado à noite, isso vale ouro.',
    nome: 'Fernanda C.',
    negocio: 'Lanchonete · Guarulhos, SP',
    destaque: 'KDS na cozinha',
  },
  {
    texto:
      'Meu site próprio já responde por 40% das vendas. O cliente pede no meu link, paga no Pix e o dinheiro cai direto na minha conta. Sem aquele desconto de 27% comendo a margem.',
    nome: 'Paulo S.',
    negocio: 'Pizzaria · Osasco, SP',
    destaque: 'Delivery próprio sem comissão',
  },
];

export function DepoimentosSection() {
  const { tDynamic } = useI18n();
  return (
    <section style={{ borderTop: '1px solid rgba(255,255,255,.08)', background: 'rgba(10,92,196,0.03)' }} className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <RotuloSecao numero="08" texto="Quem opera com MiseOn" />
        <h2 style={{ fontFamily: "'Sora', sans-serif" }} className="max-w-3xl text-3xl font-extrabold leading-tight sm:text-4xl">
          {tDynamic('Lojista não quer tecnologia.')}<br />Quer <span style={{ color: '#FC5B24' }}>sobrar dinheiro no fim do mês.</span>
        </h2>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {DEPOIMENTOS.map((d) => (
            <figure
              key={d.nome}
              style={{ border: '1px solid rgba(255,255,255,.09)', background: 'rgba(255,255,255,.02)' }}
              className="flex flex-col rounded-3xl p-6"
            >
              <Quote size={22} style={{ color: '#FC5B24' }} className="mb-4" />
              <blockquote style={{ color: '#C7D2E4' }} className="flex-1 text-sm leading-relaxed">
                "{d.texto}"
              </blockquote>
              <figcaption className="mt-6 border-t border-white/5 pt-4">
                <div className="mb-2 flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={13} className="fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm font-bold text-white">{d.nome}</p>
                <p className="text-xs text-gray-500">{d.negocio}</p>
                <span style={{ background: 'rgba(252,91,36,0.1)', border: '1px solid rgba(252,91,36,0.3)', color: '#FC5B24' }} className="mt-2.5 inline-block rounded-full px-2.5 py-1 text-xs opacity-90 font-bold uppercase tracking-wide">
                  {d.destaque}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-6 text-center text-xs opacity-95 text-gray-600">
          {tDynamic('Depoimentos ilustrativos baseados em relatos reais de lojistas do segmento.')}
        </p>
      </div>
    </section>
  );
}

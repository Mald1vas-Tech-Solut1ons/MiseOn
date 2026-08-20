import { Star } from 'lucide-react';

import { useI18n } from '../../contexts/I18nContext';
const DEPOIMENTOS = [
  {
    nome: "Carlos Eduardo",
    restaurante: "Burger & Co.",
    foto: "https://images.unsplash.com/photo-1595152772835-219674b2a8a6?q=80&w=150&auto=format&fit=crop",
    texto: "Eu pagava quase 3 mil reais de comissão no app vermelhinho por mês. Quando passei meu delivery para o MiseOn, essa grana virou lucro puro. O sistema é muito rápido e o KDS salvou minha cozinha nos finais de semana.",
  },
  {
    nome: "Juliana Silva",
    restaurante: "Sushi Prime",
    foto: "https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=150&auto=format&fit=crop",
    texto: "O que me fez mudar foi o Pix cair na hora direto na minha conta. Outras plataformas seguravam meu dinheiro, dificultando o fluxo de caixa. Sem contar o visual do cardápio digital que meus clientes elogiam sempre.",
  },
  {
    nome: "Roberto Mendes",
    restaurante: "Pizzaria Napoli",
    foto: "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?q=80&w=150&auto=format&fit=crop",
    texto: "Usei o GrandChef por 2 anos, mas era tudo travado e eu precisava pagar por módulos básicos. O MiseOn já vem com NFC-e e motoboys inclusos. Diminuiu meus custos operacionais em 40%.",
  }
];

export default function Testimonials() {
  const { tDynamic } = useI18n();
  return (
    <section style={{ borderTop: '1px solid rgba(255,255,255,.08)', background: '#0B1120' }} className="py-24">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '.3em', color: '#FC5B24', textTransform: 'uppercase', marginBottom: 18 }}>
          Depoimentos
        </div>
        <h2 style={{ fontFamily: "'Sora', sans-serif" }} className="mx-auto max-w-3xl text-3xl font-extrabold leading-tight sm:text-4xl">
          Quem migrou, <span style={{ color: '#FC5B24' }}>dobrou o lucro.</span>
        </h2>
        <p style={{ color: 'rgba(234,241,251,0.5)' }} className="mx-auto mt-4 max-w-xl text-lg">
          {tDynamic('Veja o que donos de restaurantes que cansaram de pagar comissões altas têm a dizer.')}
        </p>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {DEPOIMENTOS.map((dep, idx) => (
            <div key={idx} style={{ border: '1px solid rgba(255,255,255,.09)', background: 'rgba(255,255,255,.03)' }} className="relative flex flex-col rounded-3xl p-8 text-left transition hover:-translate-y-1 hover:shadow-xl hover:shadow-[rgba(252,91,36,0.1)]">
              <div className="mb-6 flex gap-1 text-orange-400">
                <Star size={16} fill="currentColor" />
                <Star size={16} fill="currentColor" />
                <Star size={16} fill="currentColor" />
                <Star size={16} fill="currentColor" />
                <Star size={16} fill="currentColor" />
              </div>
              <p style={{ color: '#EAF1FB' }} className="flex-1 text-sm leading-relaxed italic">
                "{dep.texto}"
              </p>
              <div className="mt-8 flex items-center gap-4">
                <img src={dep.foto} alt={dep.nome} className="h-12 w-12 rounded-full object-cover" />
                <div>
                  <h4 style={{ fontFamily: "'Sora', sans-serif" }} className="text-sm font-bold text-white">{dep.nome}</h4>
                  <span style={{ color: '#FC5B24' }} className="text-xs">{dep.restaurante}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

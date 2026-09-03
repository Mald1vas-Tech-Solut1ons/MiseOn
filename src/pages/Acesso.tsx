import { Link } from 'react-router-dom';
import { ShoppingBag, Store, Bike, ArrowRight, ChefHat } from 'lucide-react';
import MiseOnLogo from '../components/MiseOnLogo';
import SEO from '../components/SEO';
import { PAGE_META } from '../data/pageMeta';
import LanguageToggle from '../components/LanguageToggle';
import { useI18n } from '../contexts/I18nContext';

/**
 * Hall de Acesso — separa claramente as modalidades de entrada.
 * Uma identidade (um login) pode ter vários papéis; aqui o usuário escolhe
 * por qual porta quer entrar. Os dados nunca se misturam entre elas.
 */

interface Porta {
  icon: React.ReactNode;
  titulo: string;
  sub: string;
  desc: string;
  href: string;
  cta: string;
  cor: string;
  secundario?: { label: string; href: string };
}

export default function Acesso() {
  const { tDynamic } = useI18n();

  const PORTAS: Porta[] = [
    {
      icon: <ShoppingBag size={28} />,
      titulo: tDynamic('Sou Cliente'),
      sub: tDynamic('Quero pedir'),
      desc: tDynamic('Veja o universo de lojas e monte seu pedido sem app. Para finalizar a compra e receber em casa, você entra com Google ou e-mail em segundos.'),
      href: '/lojas',
      cta: tDynamic('Ver lojas'),
      cor: '#FC5B24',
    },
    {
      icon: <Store size={28} />,
      titulo: tDynamic('Lojista & Equipe'),
      sub: tDynamic('Assinante e time'),
      desc: tDynamic('Entrada do assinante e da equipe que ele cadastra — cozinha, auxiliar, balcão e admin — cada um com o seu nível de acesso ao painel (pedidos, estoque, entregas, financeiro).'),
      href: '/admin/login',
      cta: tDynamic('Entrar no painel'),
      cor: '#0A5CC4',
      secundario: { label: tDynamic('Ainda não tenho loja — criar agora'), href: '/cadastre-se' },
    },
    {
      icon: <Bike size={28} />,
      titulo: tDynamic('Sou Entregador'),
      sub: tDynamic('Parceiro de entrega'),
      desc: tDynamic('Também é um parceiro cadastrado pelo restaurante, mas com app próprio: suas rotas, navegação com GPS e chat com o cliente. O login é criado pelo restaurante.'),
      href: '/entregador/login',
      cta: tDynamic('Abrir app do entregador'),
      cor: '#22c55e',
    },
  ];

  return (
    <div style={{ background: '#070C18', color: '#EAF1FB', fontFamily: "'Inter', sans-serif" }} className="min-h-screen">
      <SEO {...PAGE_META['/acesso']} />
      {/* Glow */}
      <div style={{ background: 'radial-gradient(circle, rgba(10,92,196,0.30) 0%, transparent 70%)', width: 600, height: 600, borderRadius: '50%', position: 'absolute', top: -180, left: '50%', transform: 'translateX(-55%)', pointerEvents: 'none' }} />

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="filter drop-shadow-[0_0_12px_rgba(255,255,255,0.25)]"><MiseOnLogo size={140} /></Link>
          <LanguageToggle variant="pill" />
        </div>
        <div className="text-center mb-10">
          <div style={{ border: '1px solid rgba(252,91,36,0.4)', background: 'rgba(252,91,36,0.1)', color: '#FC5B24', fontFamily: "'Sora', sans-serif" }}
            className="mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold tracking-wider uppercase">
            <ChefHat size={13} /> {tDynamic('Como você quer entrar?')}
          </div>
          <h1 style={{ fontFamily: "'Sora', sans-serif" }} className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            {tDynamic('Escolha o seu acesso')}
          </h1>
          <p style={{ color: 'rgba(234,241,251,0.6)' }} className="mt-3 max-w-xl mx-auto text-sm sm:text-base">
            {tDynamic('Uma conta, vários papéis. Você pode ser cliente e lojista ao mesmo tempo — cada porta é independente e seus dados nunca se misturam.')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PORTAS.map((p) => (
            <div key={p.titulo}
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
              className="flex flex-col rounded-3xl p-6 transition hover:-translate-y-1 hover:border-white/20"
            >
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
                style={{ background: `${p.cor}1A`, color: p.cor }}>
                {p.icon}
              </div>
              <p style={{ color: p.cor, fontFamily: "'JetBrains Mono', monospace" }} className="text-xs opacity-95 font-bold uppercase tracking-widest">{p.sub}</p>
              <h2 style={{ fontFamily: "'Sora', sans-serif" }} className="mt-1 text-xl font-extrabold">{p.titulo}</h2>
              <p style={{ color: 'rgba(234,241,251,0.6)' }} className="mt-2 text-sm leading-relaxed flex-1">{p.desc}</p>
              <a href={p.href}
                style={{ background: p.cor, fontFamily: "'Sora', sans-serif" }}
                className="mt-5 flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white transition hover:brightness-110">
                {p.cta} <ArrowRight size={16} />
              </a>
              {p.secundario && (
                <a href={p.secundario.href} style={{ color: 'rgba(234,241,251,0.55)' }}
                  className="mt-3 text-center text-xs font-medium hover:text-white transition">
                  {p.secundario.label}
                </a>
              )}
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs" style={{ color: 'rgba(234,241,251,0.35)' }}>
          <Link to="/" className="hover:text-white transition">← {tDynamic('Voltar para o início')}</Link>
        </p>
      </div>
    </div>
  );
}

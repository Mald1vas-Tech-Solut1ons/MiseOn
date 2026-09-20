import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck } from 'lucide-react';
import MiseOnLogo from '../components/MiseOnLogo';
import SEO from '../components/SEO';
import { PAGE_META } from '../data/pageMeta';

import LanguageToggle from '../components/LanguageToggle';
import { useI18n } from '../contexts/I18nContext';

export default function CadastreSuaLoja() {
  const { tDynamic } = useI18n();

  return (
    <div className="flex min-h-screen items-center justify-center p-4 py-10 bg-transparent">
      <SEO {...PAGE_META['/cadastre-se']} />
      <div className="w-full max-w-md rounded-3xl border border-[rgba(10,92,196,0.2)] bg-[#0B1120]/80 backdrop-blur-xl p-8 shadow-[0_0_40px_rgba(10,92,196,0.15)] relative overflow-hidden">
        {/* Glow de fundo */}
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[var(--cor-primaria)] opacity-10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-[var(--cor-secundaria)] opacity-10 blur-3xl" />

        <div className="mb-4 flex justify-end relative z-10">
          <LanguageToggle variant="pill" />
        </div>

        <div className="mb-8 flex flex-col items-center justify-center text-center relative z-10">
          <MiseOnLogo size={150} className="mb-4" />
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 text-xs opacity-95 font-black uppercase tracking-widest text-emerald-400">
            <BadgeCheck size={14} aria-hidden="true" /> {tDynamic('30 Dias Grátis · Sem Cartão')}
          </span>
          <h1 className="text-xl font-bold dark:text-white" style={{ fontFamily: "'Sora', sans-serif" }}>{tDynamic('Cadastre sua loja no MiseOn')}</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {tDynamic('Conheça PDV, cardápio, entregas, estoque e custos por 30 dias. WhatsApp e outras integrações dependem de configuração.')}
          </p>
        </div>

        <div className="relative z-10 space-y-3">
          <p className="text-center text-xs text-gray-400">
            {tDynamic('Entre com sua conta e, em seguida, conte pra gente sobre o seu negócio — é rapidinho e já deixa sua loja pronta.')}
          </p>
          {/*
            `?novo=1` é o que diz à tela de login para não se apresentar como
            "Bem-vindo de volta" a quem nunca esteve aqui. Medido em auditoria
            de usabilidade (18/09/2026): sem este sinal, todo visitante que
            clicava em "Cadastrar minha loja" caía numa tela de login comum —
            o cadastro por e-mail existe no projeto (link mágico cria a conta),
            mas nada avisava que aquele era o caminho certo.
          */}
          <Link to="/admin/login?novo=1"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] hover:bg-[var(--cor-primaria-hover)] transition-colors py-3.5 text-sm font-semibold text-white shadow-lg">
            {tDynamic('Criar minha loja agora')} <ArrowRight size={16} />
          </Link>
        </div>

        <Link to="/" className="mt-6 block text-center text-xs text-gray-400 hover:text-white transition-colors relative z-10">
          {tDynamic('Voltar para o início')}
        </Link>
      </div>
    </div>
  );
}

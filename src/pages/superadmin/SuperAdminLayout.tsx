import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Building2, UserPlus, TrendingDown, ScrollText, LogOut, Receipt, Users, BookOpen, MessageCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

import LanguageToggle from '../../components/LanguageToggle';

import { useI18n } from '../../contexts/I18nContext';
export default function SuperAdminLayout() {
  const { tDynamic } = useI18n();
  const nav = useNavigate();
  const loc = useLocation();
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return nav('/superadmin/login');
      
      // Validação hardcoded do Master (seguro, pois o Supabase já validou a autenticidade do e-mail)
      if (user.email === 'rafaelmaldivas@yahoo.com.br') {
        setOk(true);
      } else {
        setOk(false);
      }
    })();
  }, [nav]);

  const sair = async () => { await supabase.auth.signOut(); nav('/superadmin/login'); };

  if (ok === null) return <div className="flex h-screen items-center justify-center text-gray-400">Carregando…</div>;
  if (ok === false) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-gray-900 p-8 text-center text-white">
        <p className="font-semibold">{tDynamic('Sua conta não tem acesso ao painel SuperAdmin.')}</p>
        <button onClick={sair} className="mt-2 rounded-xl border border-white/30 px-5 py-2.5 text-sm font-semibold">Sair</button>
      </div>
    );
  }

  const itens = [
    { to: '/superadmin/leads', icon: <Users size={18} />, label: 'CRM Leads B2B' },
    { to: '/superadmin/guia-ceo', icon: <BookOpen size={18} />, label: 'Manual CEO & GTM' },
    { to: '/superadmin/tenants', icon: <Building2 size={18} />, label: 'Tenants' },
    { to: '/superadmin/onboarding', icon: <UserPlus size={18} />, label: 'Onboarding' },
    { to: '/superadmin/churn', icon: <TrendingDown size={18} />, label: 'Churn' },
    { to: '/superadmin/auditoria', icon: <ScrollText size={18} />, label: 'Auditoria' },
    { to: '/superadmin/fiscal', icon: <Receipt size={18} />, label: 'Fiscal' },
    { to: '/superadmin/whatsapp', icon: <MessageCircle size={18} />, label: 'WhatsApp' },
    { to: '/superadmin/erros', icon: <AlertTriangle size={18} />, label: 'Erros em produção' },
  ];

  return (
    <div className="min-h-screen bg-[#020617] text-gray-100 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]">
            <Building2 size={18} />
          </div>
          <p className="text-lg font-bold tracking-wide">MiseOn <span className="font-light text-indigo-400">COMMAND</span></p>
        </div>
        <div className="flex items-center gap-3">
          <LanguageToggle variant="minimal" />
          <button onClick={sair} className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white">
            <LogOut size={16} /> Sair
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 p-6">
        <aside className="w-64 shrink-0">
          <nav className="sticky top-24 flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-md">
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Módulos</p>
            {itens.map((i) => (
              <NavLink key={i.to} to={i.to}
                className={({ isActive }) => `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${isActive ? 'bg-indigo-500/20 text-indigo-400 shadow-[inset_0_0_10px_rgba(99,102,241,0.2)]' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}>
                {i.icon} {i.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="flex-1">
          {/* Anima a troca de tela sem remontar o layout (sidebar/sessao ficam de pe) */}
          <div key={loc.pathname} className="mo-screen h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

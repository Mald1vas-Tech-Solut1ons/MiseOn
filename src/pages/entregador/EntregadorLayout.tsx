import { useEffect, useState } from 'react';
import { Outlet, Navigate, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { Bike, LogOut, Loader2, UserCircle, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { User } from '@supabase/supabase-js';

import LanguageToggle from '../../components/LanguageToggle';
import { useI18n } from '../../contexts/I18nContext';

export interface CtxEntregador {
  user: User;
  entregadorId: string;
  lojaId: string;
  nome: string;
  statusDocumentos: 'pendente' | 'aprovado' | 'rejeitado';
}

export default function EntregadorLayout() {
  const { tDynamic } = useI18n();
  const navigate = useNavigate();
  const loc = useLocation();
  const [loading, setLoading] = useState(true);
  const [semPerfilEntregador, setSemPerfilEntregador] = useState(false);
  const [ctx, setCtx] = useState<CtxEntregador | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      checkAuth(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      checkAuth(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAuth = async (user: User | null) => {
    if (!user) {
      setCtx(null);
      setLoading(false);
      return;
    }

    // Verifica se esse usuário é um entregador cadastrado
    const { data, error } = await supabase
      .from('entregadores')
      .select('id, loja_id, nome, ativo, status_documentos')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data || !data.ativo) {
      // NAO deslogar aqui. A sessao do Supabase e uma so por navegador: o
      // signOut que existia neste ponto derrubava tambem a sessao do painel.
      // Na pratica, um lojista que abrisse /entregador (link errado, aba velha
      // do PWA) era expulso do sistema inteiro no meio do expediente.
      // Aqui so negamos o acesso a esta area — quem quiser trocar de conta usa
      // o botao de sair da propria tela.
      setSemPerfilEntregador(true);
      setCtx(null);
      setLoading(false);
      return;
    }

    setSemPerfilEntregador(false);

    setCtx({
      user,
      entregadorId: data.id,
      lojaId: data.loja_id,
      nome: data.nome,
      statusDocumentos: data.status_documentos ?? 'pendente',
    });
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/entregador/login');
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-orange-500" size={32} />
          <p className="text-sm font-semibold text-gray-400">Carregando MiseOn Logistics...</p>
        </div>
      </div>
    );
  }

  if (semPerfilEntregador) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-950 p-8 text-center text-gray-100">
        <Bike size={40} className="text-orange-500" />
        <h1 className="text-lg font-bold">{tDynamic('Esta conta não é de entregador')}</h1>
        <p className="max-w-sm text-sm text-gray-400">
          {tDynamic('Você continua conectado normalmente na sua conta. Para usar o app de entregas, peça para a loja te cadastrar como entregador e entre com aquele acesso.')}
        </p>
        <button
          onClick={handleLogout}
          className="mt-3 rounded-xl border border-gray-700 px-6 py-2.5 text-sm font-bold hover:bg-gray-800 transition-colors"
        >
          {tDynamic('Entrar com outra conta')}
        </button>
      </div>
    );
  }

  if (!ctx) {
    return <Navigate to="/entregador/login" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-gray-100 font-sans">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-800 bg-gray-900/80 px-4 py-3 backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-2 text-orange-500">
          <Bike size={22} className="shrink-0" />
          <span className="font-black text-lg tracking-tight">MiseOn <span className="text-white">Logistics</span></span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageToggle variant="minimal" />
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-gray-300">{ctx.nome}</p>
            <p className="text-xs opacity-90 text-green-400">Online e operando</p>
          </div>
          <NavLink to="/entregador/documentos" className={({isActive}) => `relative rounded-full p-2 transition-colors ${isActive ? 'bg-[var(--cor-primaria)] text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700 bg-gray-800'}`}>
            <FileText size={16} />
            {ctx.statusDocumentos !== 'aprovado' && (
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 border border-gray-900" />
            )}
          </NavLink>
          <NavLink to="/entregador/conta" className={({isActive}) => `rounded-full p-2 transition-colors ${isActive ? 'bg-[var(--cor-primaria)] text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700 bg-gray-800'}`}>
            <UserCircle size={16} />
          </NavLink>
          <button onClick={handleLogout} className="rounded-full bg-red-500/10 p-2 text-red-500 hover:text-red-400 hover:bg-red-500/20 transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto">
        {/* Anima a troca de tela sem remontar o layout (header/sessao ficam de pe) */}
        <div key={loc.pathname} className="mo-screen h-full">
          <Outlet context={ctx} />
        </div>
      </main>
    </div>
  );
}

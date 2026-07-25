import { useEffect, useState, useRef, Suspense } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { ClipboardList, Boxes, Bike, Store, LogOut, UtensilsCrossed, MoreHorizontal, X, TrendingUp, Megaphone, Users, History, CreditCard, ShoppingCart, Flame, ChevronLeft, Menu, UserCircle, LifeBuoy, LayoutDashboard, Calculator, ChefHat, LayoutGrid, MessageSquare, MessageCircle, Plug, FileText, Compass, Scale, Smartphone } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { avaliarAssinatura } from '../../lib/assinatura';
import ThemeToggle from '../../components/ThemeToggle';
import { NotificationCenter } from '../../components/notifications/NotificationCenter';
import { useLedgerAlerts } from '../../hooks/useLedgerAlerts';
import { BrandLoader } from '../../components/BrandLoader';
import { podeAcessar, HOME_POR_PAPEL, type Papel } from '../../lib/permissoes';
import { useGuidedTour } from '../../hooks/useGuidedTour';
import { GuidedTourModal } from '../../components/tour/GuidedTourModal';
import TornarSeLojista from '../../components/admin/TornarSeLojista';

export interface RouteDef {
  to: string;
  icon: React.ReactNode;
  label: string;
  colorHex: string;
}

export interface CtxLoja {
  lojaId: string;
  lojaNome: string;
  lojaSlug: string;
  papel: string; // admin | operador | garcom | entregador
  status_assinatura?: string | null;
  diasAtraso: number;
  trialTerminaEm: string | null;
  segmento_negocio?: string | null;
  modulos_ativos?: Record<string, boolean> | null;
}

export default function AdminLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const [ctx, setCtx] = useState<CtxLoja | null>(null);
  const [semLoja, setSemLoja] = useState(false);
  const [emailUsuario, setEmailUsuario] = useState('');
  const [erroConexao, setErroConexao] = useState(false);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

  // Intelligent transition state
  const prevPathRef = useRef(loc.pathname);
  const [transitionClass, setTransitionClass] = useState('mo-screen');

  // Splash Screen session control
  const [isMinLoadingDone, setIsMinLoadingDone] = useState(() => {
    return sessionStorage.getItem('miseon_splash_done') === 'true';
  });

  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('miseon_sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('miseon_sidebar_collapsed', String(newState));
  };

  // Monitoramento financeiro em tempo real — alertas de estorno suspeito,
  // cancelamento com estoque comprometido e erros de webhook
  useLedgerAlerts({ lojaId: ctx?.lojaId ?? '' });

  // Hook de controle do Tour Guiado pelo Sistema (deve estar no topo antes dos early-returns)
  const tour = useGuidedTour(ctx?.lojaId);

  // Regras Inteligentes de Transição (Forward / Backward)
  useEffect(() => {
    const prevDepth = prevPathRef.current.split('/').filter(Boolean).length;
    const currDepth = loc.pathname.split('/').filter(Boolean).length;

    // Se está voltando para uma rota mais rasa (ex: /admin/pedidos/123 -> /admin/pedidos)
    if (currDepth < prevDepth) {
      setTransitionClass('mo-screen-back');
    }
    // Se está indo para uma rota mais profunda ou navegando no mesmo nível
    else {
      setTransitionClass('mo-screen');
    }
    prevPathRef.current = loc.pathname;
  }, [loc.pathname]);

  useEffect(() => {
    let minLoadTimer: NodeJS.Timeout;
    if (!isMinLoadingDone) {
      minLoadTimer = setTimeout(() => {
        setIsMinLoadingDone(true);
        sessionStorage.setItem('miseon_splash_done', 'true');
      }, 3600);
    }

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return nav('/admin/login');
      const { data, error } = await supabase
        .from('usuarios_loja')
        .select('loja_id, papel, lojas(nome, cor_primaria, cor_secundaria, slug, criado_em, status_assinatura, trial_termina_em, segmento_negocio, modulos_ativos)')
        .eq('user_id', user.id)
        .limit(1)
        .single();
      // Fail-open: erro de leitura (rede, schema, RLS) NÃO é "conta sem loja"
      // e NUNCA deve derrubar a operação — mostra tela de erro com retry.
      // Só é "sem loja" quando a query funcionou e não achou vínculo (PGRST116).
      if (error && error.code !== 'PGRST116') { setErroConexao(true); return; }
      if (!data) { setEmailUsuario(user.email ?? ''); setSemLoja(true); return; }
      const papel = (data as any).papel ?? 'admin';
      const lojaInfo = (data as any).lojas;

      // Fonte única: helper canônico (vocabulário minúsculo + trial_termina_em).
      const { diasAtraso } = avaliarAssinatura(lojaInfo);

      setCtx({
        lojaId: data.loja_id,
        lojaNome: lojaInfo?.nome ?? 'Minha loja',
        lojaSlug: lojaInfo?.slug ?? '',
        papel,
        status_assinatura: lojaInfo?.status_assinatura,
        diasAtraso,
        trialTerminaEm: lojaInfo?.trial_termina_em ?? null,
        segmento_negocio: lojaInfo?.segmento_negocio ?? 'GERAL',
        modulos_ativos: lojaInfo?.modulos_ativos ?? null,
      });

      if (lojaInfo?.cor_primaria) document.documentElement.style.setProperty('--cor-primaria', lojaInfo.cor_primaria);
      if (lojaInfo?.cor_secundaria) document.documentElement.style.setProperty('--cor-secundaria', lojaInfo.cor_secundaria);

      // Motor de Bloqueio Pós-Tolerância (7 Dias de Carência)
      if (diasAtraso > 7 && papel === 'admin' && !loc.pathname.includes('/assinatura')) {
        nav('/admin/assinatura');
      } else if (!podeAcessar(papel, loc.pathname)) {
        nav(HOME_POR_PAPEL[papel as Papel] ?? '/admin/inicio', { replace: true });
      }
    })();

    return () => { if (minLoadTimer) clearTimeout(minLoadTimer); };
  }, [nav, loc.pathname, isMinLoadingDone]);

  // O agendador externo roda 1x/dia (limite do plano) — serve de rede de
  // segurança, não de entrega: "seu pedido saiu para entrega" chegando no
  // dia seguinte não vale nada. Enquanto o painel está aberto, ou seja
  // exatamente durante o serviço, ele cutuca a fila da própria loja.
  // Falha aqui é silenciosa de propósito: e-mail não pode atrapalhar a
  // operação, e o cron recupera o que ficar para trás.
  useEffect(() => {
    if (!ctx?.lojaId) return;
    let vivo = true;

    const cutucar = () => {
      if (!vivo || document.hidden) return;
      supabase.functions
        .invoke('send-transactional-email', { body: { acao: 'drenar', loja_id: ctx.lojaId } })
        .catch(() => { });
    };

    cutucar();
    const timer = setInterval(cutucar, 60_000);
    return () => { vivo = false; clearInterval(timer); };
  }, [ctx?.lojaId]);

  const sair = async () => { await supabase.auth.signOut(); nav('/admin/login'); };

  if (erroConexao) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-8 text-center bg-gray-50 dark:bg-[#0B1120] text-gray-900 dark:text-gray-100">
        <p className="font-semibold text-lg">Não foi possível carregar os dados da loja.</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">Falha de comunicação com o servidor. Sua operação não foi bloqueada — verifique sua internet e tente novamente.</p>
        <button onClick={() => window.location.reload()} className="mt-4 rounded-xl bg-[#004198] hover:bg-[#00337A] px-8 py-3 text-sm font-bold text-white shadow-lg transition-all active:scale-95">Tentar Novamente</button>
        <button onClick={sair} className="text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-red-500">Sair do Sistema</button>
      </div>
    );
  }

  if (semLoja) {
    return (
      <div>
        <TornarSeLojista emailUsuario={emailUsuario} onCriada={() => window.location.reload()} />
        <div className="pb-8 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-500 max-w-md mx-auto">
            Foi convidado pra equipe de uma loja que já existe? Peça pro admin te adicionar pela tela de Equipe, usando este mesmo e-mail, em vez de criar uma loja nova.
          </p>
          <button onClick={sair} className="mt-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-red-500">Sair do Sistema</button>
        </div>
      </div>
    );
  }

  if (!ctx || !isMinLoadingDone) {
    return <BrandLoader />;
  }

  // Se bloqueado (atraso > 7 dias) e for admin, força tela de assinatura
  const isLockdown = ctx.diasAtraso > 7;
  if (isLockdown && ctx.papel !== 'admin') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-8 text-center bg-gray-50 dark:bg-[#0B1120] text-gray-900 dark:text-gray-100">
        <Store size={48} className="text-red-500 mb-2" />
        <h1 className="font-bold text-xl text-red-600">Loja Temporariamente Suspensa</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">O acesso ao sistema operacional está suspenso. Peça para o administrador da loja regularizar a assinatura na plataforma.</p>
        <button onClick={sair} className="mt-4 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 px-8 py-3 text-sm font-bold shadow-sm transition-all active:scale-95">Sair do Sistema</button>
      </div>
    );
  }

  // Semantic colors: 
  // blue for general (Início, Chat, Ajuda)
  // orange/amber for PDV, Mesas
  // green for Pedidos, Entregas
  // red/flame for Cozinha, Producao
  // indigo/purple for Configs (Cardápio, Equipe, Loja)
  // emerald for Finance, Assinatura

  // Semantic colors in HEX for guaranteed application
  const C = {
    blue: '#3b82f6',
    orange: '#f97316',
    amber: '#f59e0b',
    green: '#22c55e',
    red: '#ef4444',
    indigo: '#6366f1',
    emerald: '#10b981',
    purple: '#a855f7',
    pink: '#ec4899',
    gray: '#6b7280'
  };

  const principalBruto: RouteDef[] = ctx.papel === 'entregador'
    ? [{ to: '/admin/entregas', icon: <Bike size={20} />, label: 'Entregas', colorHex: C.emerald }]
    : ctx.papel === 'garcom'
      ? [
        { to: '/admin/mesas', icon: <LayoutGrid size={20} />, label: 'Mapa de Mesas', colorHex: C.amber },
        { to: '/admin/pdv', icon: <Calculator size={20} />, label: 'Lançar Pedido', colorHex: C.orange },
      ]
      : ctx.papel === 'operador'
        ? [
          { to: '/admin/pdv', icon: <Calculator size={20} />, label: 'PDV Balcão', colorHex: C.orange },
          { to: '/admin/mesas', icon: <LayoutGrid size={20} />, label: 'Mapa de Mesas', colorHex: C.amber },
          { to: '/admin/pedidos', icon: <ClipboardList size={20} />, label: 'Pedidos', colorHex: C.green },
          { to: '/admin/kds', icon: <ChefHat size={20} />, label: 'Cozinha (KDS)', colorHex: C.red },
          { to: '/admin/producao', icon: <Flame size={20} />, label: 'Produção', colorHex: C.orange },
          { to: '/admin/entregas', icon: <Bike size={20} />, label: 'Entregas', colorHex: C.emerald },
        ]
        : [
          { to: '/admin/inicio', icon: <LayoutDashboard size={20} />, label: 'Início', colorHex: C.blue },
          { to: '/admin/pdv', icon: <Calculator size={20} />, label: 'PDV Balcão', colorHex: C.orange },
          { to: '/admin/mesas', icon: <LayoutGrid size={20} />, label: 'Mapa de Mesas', colorHex: C.amber },
          { to: '/admin/balanca', icon: <Scale size={20} />, label: 'Balança Buffet', colorHex: C.orange },
          { to: '/admin/garcom-mobile', icon: <Smartphone size={20} />, label: 'Garçom Mobile PWA', colorHex: C.amber },
          { to: '/admin/pedidos', icon: <ClipboardList size={20} />, label: 'Pedidos', colorHex: C.green },
          { to: '/admin/kds', icon: <ChefHat size={20} />, label: 'Cozinha (KDS)', colorHex: C.red },
          { to: '/admin/cardapio', icon: <UtensilsCrossed size={20} />, label: 'Cardápio', colorHex: C.indigo },
          { to: '/admin/estoque', icon: <Boxes size={20} />, label: 'Estoque', colorHex: C.indigo },
          { to: '/admin/producao', icon: <Flame size={20} />, label: 'Produção', colorHex: C.orange },
          { to: '/admin/entregas', icon: <Bike size={20} />, label: 'Entregas', colorHex: C.emerald },
        ];

  const modulos = ctx.modulos_ativos;

  const principal = principalBruto.filter((item) => {
    if (!modulos) return true;
    if (item.to === '/admin/balanca' && modulos.balanca === false) return false;
    if (item.to === '/admin/mesas' && modulos.mesas_3d === false) return false;
    if (item.to === '/admin/garcom-mobile' && modulos.garcom_pwa === false) return false;
    if (item.to === '/admin/kds' && modulos.kds === false) return false;
    if (item.to === '/admin/entregas' && modulos.entregas === false) return false;
    return true;
  });

  const maisBruto: RouteDef[] = [
    { to: '/admin/chat', icon: <MessageSquare size={20} />, label: 'Central de Atendimento (Chat)', colorHex: C.blue },
    { to: '/admin/ifood', icon: <Plug size={20} />, label: 'Integração iFood', colorHex: C.red },
    { to: '/admin/whatsapp', icon: <MessageCircle size={20} />, label: 'Integração WhatsApp', colorHex: C.green },
    { to: '/admin/compras', icon: <ShoppingCart size={20} />, label: 'Central de Compras', colorHex: C.indigo },
    { to: '/admin/financeiro', icon: <TrendingUp size={20} />, label: 'Financeiro', colorHex: C.emerald },
    { to: '/admin/historico', icon: <History size={20} />, label: 'Histórico', colorHex: C.gray },
    { to: '/admin/marketing', icon: <Megaphone size={20} />, label: 'Marketing', colorHex: C.purple },
    { to: '/admin/equipe', icon: <Users size={20} />, label: 'Equipe e Acessos', colorHex: C.pink },
    { to: '/admin/assinatura', icon: <CreditCard size={20} />, label: 'Assinatura SaaS', colorHex: C.emerald },
    { to: '/admin/loja', icon: <Store size={20} />, label: 'Configurações da Loja', colorHex: C.indigo },
    { to: '/admin/fiscal', icon: <FileText size={20} />, label: 'Módulo Fiscal (NFe/NFCe)', colorHex: C.emerald },
    { to: '/admin/ajuda', icon: <LifeBuoy size={20} />, label: 'Central de Ajuda', colorHex: C.blue },
  ];

  const mais = maisBruto.filter((item) => {
    if (!modulos) return true;
    if (item.to === '/admin/ifood' && modulos.ifood === false) return false;
    if (item.to === '/admin/fiscal' && modulos.fiscal === false) return false;
    return true;
  });

  // Barra inferior do mobile: só os destinos de uso constante durante o turno
  // (não a lista inteira — isso é o que o menu "Mais" resolve). Derivado de
  // `principal` por rota, então rótulo/ícone nunca ficam fora de sincronia.
  const ROTAS_BOTTOM_NAV: Record<string, string[]> = {
    admin: ['/admin/inicio', '/admin/pedidos', '/admin/kds', '/admin/pdv'],
    operador: ['/admin/pdv', '/admin/pedidos', '/admin/kds', '/admin/entregas'],
    garcom: ['/admin/mesas', '/admin/pdv'],
    entregador: ['/admin/entregas'],
  };
  const bottomNav = (ROTAS_BOTTOM_NAV[ctx.papel] ?? [])
    .map((to) => principal.find((p) => p.to === to))
    .filter((p): p is (typeof principal)[number] => !!p);

  // "Mais" acende quando a rota atual é algo que só existe fora da barra curada
  const emRotaSoDoMenu = !bottomNav.some((p) => p.to === loc.pathname)
    && (principal.some((p) => p.to === loc.pathname) || mais.some((p) => p.to === loc.pathname));

  const isMainRoute = principal.some(p => p.to === loc.pathname) || loc.pathname === '/admin';
  const innerRouteTitle = mais.find(m => m.to === loc.pathname)?.label;

  const renderSidebarLink = (r: RouteDef, onClick?: () => void) => {
    return (
      <NavLink
        key={r.to}
        to={r.to}
        onClick={onClick}
        style={{ '--route-color': r.colorHex } as React.CSSProperties}
        className={({ isActive }) => `
          group relative flex items-center gap-3 px-3.5 py-3 mx-3 my-1 rounded-2xl text-sm font-semibold transition-all duration-500 overflow-hidden
          nav-link-premium ${isActive ? 'is-active' : ''}
        `}
      >
        {({ isActive }) => (
          <>
            <div className="nav-link-bg absolute inset-0 opacity-0 transition-all duration-500 pointer-events-none rounded-2xl" />

            <div className={`nav-link-icon relative z-10 flex-shrink-0 transition-transform duration-500 ease-out ${isActive ? 'scale-110 drop-shadow-md' : 'group-hover:scale-110'}`}>
              {r.icon}
            </div>

            <span
              className={`nav-link-text relative z-10 whitespace-nowrap transition-all duration-300 ease-in-out ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
                }`}
            >
              {r.label}
            </span>

            {isCollapsed && (
              <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold rounded-lg opacity-0 -translate-x-2 pointer-events-none transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 shadow-xl z-50 whitespace-nowrap">
                {r.label}
                {/* Arrow */}
                <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-4 border-transparent border-r-gray-900 dark:border-r-white" />
              </div>
            )}
          </>
        )}
      </NavLink>
    );
  };

  return (
    <div className="flex h-screen bg-transparent text-gray-900 dark:text-gray-100 font-sans overflow-hidden selection:bg-[#FC5B24] selection:text-white">
      <style>{`
        .nav-link-premium { color: var(--cor-texto-suave); border: 1px solid transparent; }
        .dark .nav-link-premium { color: var(--cor-texto-fraco); }
        .nav-link-premium:hover, .nav-link-premium.is-active { color: var(--route-color) !important; }
        .nav-link-premium.is-active { 
          box-shadow: 0 8px 32px -8px color-mix(in srgb, var(--route-color) 50%, transparent); 
          border-color: color-mix(in srgb, var(--route-color) 40%, transparent); 
          background: linear-gradient(135deg, color-mix(in srgb, var(--route-color) 10%, transparent), transparent);
        }
        .nav-link-premium .nav-link-bg { background: linear-gradient(90deg, color-mix(in srgb, var(--route-color) 15%, transparent), transparent); }
        .dark .nav-link-premium .nav-link-bg { background: linear-gradient(90deg, color-mix(in srgb, var(--route-color) 25%, transparent), transparent); }
        .nav-link-premium:hover .nav-link-bg { opacity: 0.6; }
        .nav-link-premium.is-active .nav-link-bg { opacity: 1; }
        .nav-link-premium:hover .nav-link-icon, .nav-link-premium.is-active .nav-link-icon { filter: drop-shadow(0 0 10px color-mix(in srgb, var(--route-color) 80%, transparent)); transform: scale(1.15); }
      `}</style>

      {/* ── SIDEBAR FLOATING GLASS (DESKTOP) ── */}
      <aside
        className={`hidden lg:flex flex-col relative my-3 ml-3 rounded-3xl bg-white/70 dark:bg-[#070C18]/40 backdrop-blur-3xl border border-white/40 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.05)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-40 print:hidden h-[calc(100vh-1.5rem)] transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isCollapsed ? 'w-[88px]' : 'w-[280px]'
          }`}
      >
        {/* Header da Sidebar (Logo MiseOn) */}
        <div className="h-[88px] flex items-center justify-between px-5 border-b border-gray-200/30 dark:border-white/10 shrink-0 relative">
          {/* Brilho da logo sutil contido no próprio container isolado */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-t-[2rem]">
            <div className="absolute inset-0 bg-gradient-to-r from-[#0A5CC4]/20 to-[#FC5B24]/20 opacity-80 mix-blend-screen pointer-events-none blur-2xl" />
          </div>

          <div className={`flex items-center justify-start overflow-hidden transition-all duration-500 ${isCollapsed ? 'w-12 justify-center' : 'w-full px-2'} relative z-10`}>
            {isCollapsed ? (
              <img src="/icon.png" alt="MiseOn" className="h-10 w-10 shrink-0 object-contain drop-shadow-[0_4px_12px_rgba(252,91,36,0.6)] animate-in fade-in zoom-in duration-500" onError={(e) => { e.currentTarget.style.display = 'none' }} />
            ) : (
              <img src="/MiseOn-repagina-removebg-preview.png" alt="MiseOn" className="w-[180px] h-auto shrink-0 object-contain drop-shadow-[0_4px_16px_rgba(10,92,196,0.6)] animate-in fade-in duration-500" onError={(e) => { e.currentTarget.style.display = 'none' }} />
            )}
          </div>
          {/* Toggle Button Luxuoso */}
          <button
            onClick={toggleSidebar}
            className={`absolute -right-4 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-[#0A101D]/90 backdrop-blur-md border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-300 rounded-full p-2 shadow-[0_4px_20px_rgba(0,0,0,0.15)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.6)] transition-all duration-500 z-50 hover:scale-110 hover:text-[#FC5B24] ring-4 ring-[#F4F7FA] dark:ring-[#070C18] ${isCollapsed ? 'rotate-180' : ''}`}
          >
            <ChevronLeft size={16} strokeWidth={3} />
          </button>
        </div>

        {/* Informações da Loja */}
        <div className={`px-4 py-5 flex flex-col gap-1 overflow-hidden transition-all duration-300 shrink-0 ${isCollapsed ? 'items-center opacity-0 h-0 p-0 m-0 border-0' : 'opacity-100'}`}>
          <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase whitespace-nowrap">Loja Atual</span>
          <h2 className="font-bold text-base truncate text-gray-900 dark:text-white whitespace-nowrap">{ctx.lojaNome}</h2>
          {ctx.papel !== 'admin' && (
            <span className="inline-block mt-1 self-start rounded-md bg-[#004198]/10 px-2 py-0.5 text-[10px] font-bold text-[#004198] dark:text-[#6B9EFF] uppercase">
              {ctx.papel}
            </span>
          )}
        </div>

        {/* Navegação Scrollável */}
        <div className="flex-1 overflow-y-auto py-2 space-y-6 custom-scrollbar overflow-x-hidden">

          {ctx.papel === 'admin' ? (
            <>
              {/* Visão Geral */}
              <div className="space-y-1">
                <p className={`px-5 mb-2 text-[10px] font-bold tracking-widest text-gray-400 uppercase transition-all duration-300 ${isCollapsed ? 'text-center text-[8px]' : ''}`}>
                  {isCollapsed ? '---' : 'Visão Geral'}
                </p>
                {[...principal, ...mais].filter(p => ['/admin/inicio'].includes(p.to)).map(p => renderSidebarLink(p))}
              </div>

              {/* Operação */}
              <div className="space-y-1">
                <p className={`px-5 mb-2 mt-4 text-[10px] font-bold tracking-widest text-gray-400 uppercase transition-all duration-300 ${isCollapsed ? 'text-center text-[8px]' : ''}`}>
                  {isCollapsed ? '---' : 'Operação'}
                </p>
                {[...principal, ...mais].filter(p => ['/admin/pdv', '/admin/mesas', '/admin/balanca', '/admin/garcom-mobile', '/admin/pedidos', '/admin/kds', '/admin/producao', '/admin/entregas'].includes(p.to)).map(p => renderSidebarLink(p))}
              </div>

              {/* Atendimento e Canais */}
              <div className="space-y-1">
                <p className={`px-5 mb-2 mt-4 text-[10px] font-bold tracking-widest text-gray-400 uppercase transition-all duration-300 ${isCollapsed ? 'text-center text-[8px]' : ''}`}>
                  {isCollapsed ? '---' : 'Atendimento e Canais'}
                </p>
                {[...principal, ...mais].filter(p => ['/admin/chat', '/admin/ifood', '/admin/whatsapp'].includes(p.to)).map(p => renderSidebarLink(p))}
              </div>

              {/* Catálogo & Suprimentos */}
              <div className="space-y-1">
                <p className={`px-5 mb-2 mt-4 text-[10px] font-bold tracking-widest text-gray-400 uppercase transition-all duration-300 ${isCollapsed ? 'text-center text-[8px]' : ''}`}>
                  {isCollapsed ? '---' : 'Cardápio e Estoque'}
                </p>
                {[...principal, ...mais].filter(p => ['/admin/cardapio', '/admin/estoque', '/admin/compras'].includes(p.to)).map(p => renderSidebarLink(p))}
              </div>

              {/* Gestão Estratégica */}
              <div className="space-y-1">
                <p className={`px-5 mb-2 mt-4 text-[10px] font-bold tracking-widest text-gray-400 uppercase transition-all duration-300 ${isCollapsed ? 'text-center text-[8px]' : ''}`}>
                  {isCollapsed ? '---' : 'Gestão e Relatórios'}
                </p>
                {[...principal, ...mais].filter(p => ['/admin/financeiro', '/admin/historico', '/admin/marketing'].includes(p.to)).map(p => renderSidebarLink(p))}
              </div>

              {/* Administração */}
              <div className="space-y-1">
                <p className={`px-5 mb-2 mt-4 text-[10px] font-bold tracking-widest text-gray-400 uppercase transition-all duration-300 ${isCollapsed ? 'text-center text-[8px]' : ''}`}>
                  {isCollapsed ? '---' : 'Configurações'}
                </p>
                {[...principal, ...mais].filter(p => ['/admin/equipe', '/admin/loja', '/admin/fiscal', '/admin/assinatura'].includes(p.to)).map(p => renderSidebarLink(p))}
              </div>

              {/* Suporte */}
              <div className="space-y-1">
                <p className={`px-5 mb-2 mt-4 text-[10px] font-bold tracking-widest text-gray-400 uppercase transition-all duration-300 ${isCollapsed ? 'text-center text-[8px]' : ''}`}>
                  {isCollapsed ? '---' : 'Ajuda'}
                </p>
                {[...principal, ...mais].filter(p => ['/admin/ajuda'].includes(p.to)).map(p => renderSidebarLink(p))}
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <p className={`px-5 mb-2 text-[10px] font-bold tracking-widest text-gray-400 uppercase transition-all duration-300 ${isCollapsed ? 'text-center text-[8px]' : ''}`}>
                {isCollapsed ? '---' : 'Operação'}
              </p>
              {principal.map(p => renderSidebarLink(p))}
            </div>
          )}
        </div>

        {/* Footer da Sidebar (Usuário) */}
        <div className={`p-4 border-t border-gray-200/30 dark:border-white/10 space-y-2 shrink-0 transition-all duration-300 overflow-hidden bg-white/20 dark:bg-black/10 backdrop-blur-md rounded-b-[2rem]`}>
          <a
            href={`/${ctx.lojaSlug}`}
            target="_blank"
            rel="noreferrer"
            style={{ '--route-color': '#0A5CC4' } as React.CSSProperties}
            className={`nav-link-premium relative flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-semibold transition-colors group ${isCollapsed ? 'justify-center' : ''}`}
          >
            <div className="nav-link-bg absolute inset-0 opacity-0 transition-opacity duration-500 pointer-events-none rounded-2xl" />
            <Store size={20} className="nav-link-icon shrink-0 transition-transform duration-300" />
            <span className={`nav-link-text whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>Ver Loja Online</span>
            {isCollapsed && <div className="absolute left-full ml-4 px-3 py-2 bg-gray-900/90 backdrop-blur-sm dark:bg-white/90 text-white dark:text-gray-900 text-sm font-bold rounded-xl opacity-0 -translate-x-2 pointer-events-none transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 shadow-xl z-50 whitespace-nowrap">Ver Loja Online</div>}
          </a>
          <NavLink
            to="/admin/conta"
            style={{ '--route-color': '#FC5B24' } as React.CSSProperties}
            className={({ isActive }) => `nav-link-premium relative flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-semibold transition-colors group ${isActive ? 'is-active' : ''} ${isCollapsed ? 'justify-center' : ''}`}
          >
            <div className="nav-link-bg absolute inset-0 opacity-0 transition-opacity duration-500 pointer-events-none rounded-2xl" />
            <UserCircle size={20} className="nav-link-icon shrink-0 transition-transform duration-300" />
            <span className={`nav-link-text whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>Minha Conta</span>
            {isCollapsed && <div className="absolute left-full ml-4 px-3 py-2 bg-gray-900/90 backdrop-blur-sm dark:bg-[#111827]/90 text-white text-sm font-bold rounded-xl opacity-0 -translate-x-2 pointer-events-none transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 shadow-xl z-50 whitespace-nowrap">Minha Conta</div>}
          </NavLink>
          <button
            onClick={sair}
            className={`relative flex items-center gap-3 w-full px-3.5 py-3 rounded-2xl text-sm font-semibold text-gray-500 dark:text-gray-400 hover:bg-red-500/15 hover:text-red-500 dark:hover:bg-red-500/20 dark:hover:text-red-400 transition-colors group ${isCollapsed ? 'justify-center' : ''}`}
          >
            <LogOut size={20} className="shrink-0 group-hover:scale-110 transition-transform duration-300" />
            <span className={`whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>Sair do Sistema</span>
            {isCollapsed && <div className="absolute left-full ml-4 px-3 py-2 bg-red-600/90 backdrop-blur-sm text-white text-sm font-bold rounded-xl opacity-0 -translate-x-2 pointer-events-none transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 shadow-xl z-50 whitespace-nowrap">Sair</div>}
          </button>
        </div>
      </aside>

      {/* ── ÁREA DE CONTEÚDO (MAIN) ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative bg-transparent">

        {/* ── TOP HEADER GLOBAL ── */}
        <header className="h-[88px] flex-shrink-0 bg-transparent flex items-center justify-between px-6 sm:px-10 z-30 print:hidden relative">

          <div className="flex items-center gap-4">
            {/* Mobile Menu Toggle */}
            <button onClick={() => setMenuMobileAberto(true)} className="lg:hidden p-2 -ml-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
              <Menu size={24} />
            </button>

            {/* Mobile Brand / Back Button */}
            <div className="flex lg:hidden items-center gap-2">
              {!isMainRoute ? (
                <button onClick={() => nav(-1)} className="flex items-center gap-1 text-sm font-bold text-[#004198] dark:text-[#6B9EFF]">
                  <ChevronLeft size={18} /> Voltar
                </button>
              ) : (
                <span className="font-extrabold text-lg text-gray-900 dark:text-white truncate">{ctx.lojaNome}</span>
              )}
            </div>

            {/* Desktop Page Title (Optional) */}
            <div className="hidden lg:flex items-center gap-3">
              {!isMainRoute && (
                <button onClick={() => nav(-1)} className="mr-2 p-2 rounded-xl text-gray-400 hover:bg-white/50 dark:hover:bg-white/10 transition-colors shadow-sm">
                  <ChevronLeft size={20} />
                </button>
              )}
              <h1 className="font-['Sora'] font-bold text-2xl text-gray-900 dark:text-white tracking-tight drop-shadow-sm">
                {!isMainRoute ? innerRouteTitle : 'Painel de Controle'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (location.pathname === '/admin/ajuda') {
                  tour.iniciarTourCompleto();
                } else {
                  tour.iniciarTourDaPagina(location.pathname);
                }
              }}
              title={location.pathname === '/admin/ajuda' ? 'Iniciar Tour Completo do Sistema (20 Passos)' : 'Iniciar Tour Guiado desta página'}
              className="flex items-center gap-1.5 rounded-full border border-orange-500/40 bg-orange-500/10 px-3.5 py-1.5 text-xs font-extrabold text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 transition shadow-sm"
            >
              <Compass size={15} />
              <span className="hidden sm:inline">
                {location.pathname === '/admin/ajuda' ? 'Tour Completo 🚀' : 'Tour desta Página 📍'}
              </span>
            </button>
            {ctx?.lojaId && <NotificationCenter lojaId={ctx.lojaId} />}
            <ThemeToggle />
          </div>
        </header>

        {/* ── CONTEÚDO DA PÁGINA (SCROLLÁVEL) ── */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0 relative custom-scrollbar px-6 sm:px-10 pt-2">

          {/* BANNER PROATIVO: TRIAL AINDA VÁLIDO, MAS ACABANDO EM BREVE */}
          {ctx.diasAtraso === 0 && ctx.status_assinatura === 'trial' && ctx.trialTerminaEm && (() => {
            const diasRestantes = Math.ceil((new Date(ctx.trialTerminaEm).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            if (diasRestantes > 5 || diasRestantes < 0) return null;
            return (
              <div className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-3 sm:px-6 flex items-center justify-between shadow-inner">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600 text-white p-1.5 rounded-lg">
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-blue-700 dark:text-blue-400 leading-tight">
                      {diasRestantes <= 0 ? 'Seu teste grátis termina hoje' : `Seu teste grátis termina em ${diasRestantes} dia${diasRestantes === 1 ? '' : 's'}`}
                    </h3>
                    <p className="text-[11px] text-blue-600/80 dark:text-blue-400/80 mt-0.5">Garanta sua assinatura pra não perder o acesso.</p>
                  </div>
                </div>
                <button onClick={() => nav('/admin/assinatura')} className="whitespace-nowrap px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] uppercase tracking-wider font-bold rounded-lg shadow-sm transition-colors">
                  Assinar agora
                </button>
              </div>
            );
          })()}

          {/* BANNER DE CARÊNCIA INFECHÁVEL (DIAS 1 A 7 DE TOLERÂNCIA PÓS-VENCIMENTO) */}
          {ctx.diasAtraso > 0 && ctx.diasAtraso <= 7 && (
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3 sm:px-6 flex items-center justify-between shadow-inner">
              <div className="flex items-center gap-3">
                <div className="bg-amber-500 text-white p-1.5 rounded-lg animate-pulse">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400 leading-tight">Assinatura Vencida (Tolerância: dia {ctx.diasAtraso} de 7)</h3>
                  <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">O acesso total será suspenso em {8 - ctx.diasAtraso} dias caso não seja regularizado.</p>
                </div>
              </div>
              <button onClick={() => nav('/admin/assinatura')} className="whitespace-nowrap px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] uppercase tracking-wider font-bold rounded-lg shadow-sm transition-colors">
                Regularizar Assinatura
              </button>
            </div>
          )}

          {/* Container com transição inteligente (mo-screen ou mo-screen-back) baseada na profundidade */}
          <div key={loc.pathname} className={`mx-auto max-w-6xl w-full h-full ${transitionClass}`}>
            <Suspense fallback={<BrandLoader title="Carregando módulo..." />}>
              <Outlet context={ctx} />
            </Suspense>
          </div>
        </main>

      </div>

      {/* ── MOBILE DRAWER (SIDEBAR NO MOBILE) ── */}
      {menuMobileAberto && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity animate-in fade-in" onClick={() => setMenuMobileAberto(false)} />
          <div className="relative w-[280px] max-w-[80vw] bg-white dark:bg-[#111827] h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-md">
                  <img src="/icon.png" alt="" className="h-5 w-5" />
                </div>
                <span className="font-bold">MiseOn</span>
              </div>
              <button onClick={() => setMenuMobileAberto(false)} className="p-2 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <div className="space-y-1">
                <p className="px-2 mb-2 text-[10px] font-bold text-gray-400 uppercase">Operação</p>
                {principal.map(p => renderSidebarLink(p, () => setMenuMobileAberto(false)))}
              </div>
              {ctx.papel === 'admin' && (
                <div className="space-y-1">
                  <p className="px-2 mb-2 text-[10px] font-bold text-gray-400 uppercase">Gestão</p>
                  {mais.map(p => renderSidebarLink(p, () => setMenuMobileAberto(false)))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
              <NavLink to="/admin/conta" onClick={() => setMenuMobileAberto(false)} className="flex items-center justify-center gap-2 w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 font-bold text-gray-700 dark:text-gray-200">
                <UserCircle size={18} /> Minha Conta
              </NavLink>
              <button onClick={sair} className="flex items-center justify-center gap-2 w-full p-3 rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 font-bold">
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BOTTOM NAV (SOMENTE MOBILE) ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-[#111827] border-t border-gray-200 dark:border-gray-800 flex justify-around items-center h-16 pb-safe print:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {bottomNav.map((i) => (
          <NavLink key={i.to} to={i.to}
            className={({ isActive }) => `
              flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors
              ${isActive ? 'text-[#004198] dark:text-[#6B9EFF]' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500'}
            `}
          >
            {({ isActive }) => (
              <>
                <div className={`${isActive ? 'scale-110' : 'scale-100'} transition-transform duration-200`}>{i.icon}</div>
                <span className="text-[10px] font-bold tracking-tight">{i.label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button
          onClick={() => setMenuMobileAberto(true)}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${emRotaSoDoMenu ? 'text-[#004198] dark:text-[#6B9EFF]' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500'}`}
        >
          <MoreHorizontal size={20} className={emRotaSoDoMenu ? 'scale-110' : 'scale-100'} />
          <span className="text-[10px] font-bold tracking-tight">Mais</span>
        </button>
      </nav>

      {/* ── MODAL DO TOUR GUIADO ── */}
      <GuidedTourModal
        ativo={tour.ativo}
        passoAtual={tour.passoAtual}
        passoIndex={tour.passoIndex}
        totalPassos={tour.totalPassos}
        targetElement={tour.targetElement}
        onProximo={tour.proximoPasso}
        onAnterior={tour.passoAnterior}
        onEncerrar={tour.encerrarTour}
      />
    </div>
  );
}


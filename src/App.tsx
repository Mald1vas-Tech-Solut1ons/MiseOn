import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ScreenTransition } from './components/ScreenTransition';
import { ToastProvider } from './components/ui/Toast';
import { I18nProvider } from './contexts/I18nContext';
import CookieBanner from './components/CookieBanner';
import { AcessibilidadeProvider } from './contexts/AcessibilidadeProvider';
import { BrandLoader } from './components/BrandLoader';
import { supabase } from './lib/supabase';

// ── Chunk: PUBLIC (carrega imediatamente — rotas do cliente final) ─────────────
import Home from './pages/Home';
import Cardapio from './pages/Cardapio';

// ── Lazy: PUBLIC_AUX (raramente acessadas, baixo impacto no LCP) ─────────────
const Acesso          = lazy(() => import('./pages/Acesso'));
const Lojas           = lazy(() => import('./pages/Lojas'));
const CadastreSuaLoja = lazy(() => import('./pages/CadastreSuaLoja'));
const MeusPedidos     = lazy(() => import('./pages/MeusPedidos'));
const AcompanharPedido= lazy(() => import('./pages/Pedido'));
const Termos          = lazy(() => import('./pages/legal/Termos'));
const Privacidade     = lazy(() => import('./pages/legal/Privacidade'));
const Sobre          = lazy(() => import('./pages/legal/Sobre'));
const Contato         = lazy(() => import('./pages/legal/Contato'));
const DescadastroEmail = lazy(() => import('./pages/legal/DescadastroEmail'));
const RedefinirSenha    = lazy(() => import('./pages/RedefinirSenha'));
const Videos           = lazy(() => import('./pages/Videos'));
const NicheLandingPage = lazy(() => import('./pages/landing/NicheLandingPage'));
const EstoquePage      = lazy(() => import('./pages/landing/EstoquePage'));
const Blog             = lazy(() => import('./pages/Blog'));
const BlogPost         = lazy(() => import('./pages/BlogPost'));
const PainelTV         = lazy(() => import('./pages/PainelTV'));
const MarketingStrategyPage = lazy(() => import('./pages/landing/MarketingStrategyPage'));

// ── Lazy: ADMIN_LAYOUT (único layout compartilhado — carrega rápido) ─────────
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const Login       = lazy(() => import('./pages/admin/Login'));

// ── Lazy: ADMIN_OPERACAO (turno de trabalho — pré-carrega após login) ────────
const Dashboard     = lazy(() => import('./pages/admin/Dashboard'));
const PainelPedidos = lazy(() => import('./pages/admin/PainelPedidos'));
const PDV           = lazy(() => import('./pages/admin/PDV'));
const KDS           = lazy(() => import('./pages/admin/KDS'));
const KDSProducao   = lazy(() => import('./pages/admin/KDSProducao'));
const Mesas         = lazy(() => import('./pages/admin/Mesas'));
const Entregas      = lazy(() => import('./pages/admin/Entregas'));
const PainelBalanca = lazy(() => import('./pages/admin/PainelBalanca').then((m) => ({ default: m.PainelBalanca })));
const PainelGarcomMobile = lazy(() => import('./pages/admin/PainelGarcomMobile').then((m) => ({ default: m.PainelGarcomMobile })));

// ── Lazy: ADMIN_GESTAO (chunk separado — só carrega ao navegar) ───────────────
const CardapioAdmin = lazy(() => import('./pages/admin/Cardapio'));
const Estoque       = lazy(() => import('./pages/admin/Estoque'));
const Compras       = lazy(() => import('./pages/admin/Compras'));
const Financeiro    = lazy(() => import('./pages/admin/Financeiro'));
const Historico     = lazy(() => import('./pages/admin/Historico'));
const Marketing     = lazy(() => import('./pages/admin/Marketing'));
const Equipe        = lazy(() => import('./pages/admin/Equipe'));
const Loja          = lazy(() => import('./pages/admin/Loja'));
const Assinatura    = lazy(() => import('./pages/admin/Assinatura'));
const Ajuda         = lazy(() => import('./pages/admin/Ajuda'));
const MinhaConta    = lazy(() => import('./pages/admin/MinhaConta'));
const ChatAdmin     = lazy(() => import('./pages/admin/ChatAdmin'));
const Ifood         = lazy(() => import('./pages/admin/Ifood'));
const WhatsApp      = lazy(() => import('./pages/admin/WhatsApp'));
const Fiscal        = lazy(() => import('./pages/admin/Fiscal'));

// ── Lazy: ENTREGADOR (app isolado) ────────────────────────────────────────────
const EntregadorLayout   = lazy(() => import('./pages/entregador/EntregadorLayout'));
const EntregadorLogin    = lazy(() => import('./pages/entregador/Login'));
const EntregadorDashboard= lazy(() => import('./pages/entregador/Dashboard'));
const EntregadorRota     = lazy(() => import('./pages/entregador/Rota'));
const EntregadorDocumentos = lazy(() => import('./pages/entregador/Documentos'));

// ── Lazy: SUPERADMIN (area interna restrita) ──────────────────────────────────
const SuperAdminLogin  = lazy(() => import('./pages/superadmin/Login'));
const SuperAdminLayout = lazy(() => import('./pages/superadmin/SuperAdminLayout'));
const CrmLeads         = lazy(() => import('./pages/superadmin/CrmLeads'));
const GuiaCeoGtm       = lazy(() => import('./pages/superadmin/GuiaCeoGtm'));
const Tenants          = lazy(() => import('./pages/superadmin/Tenants'));
const Onboarding       = lazy(() => import('./pages/superadmin/Onboarding'));
const Churn            = lazy(() => import('./pages/superadmin/Churn'));
const Auditoria        = lazy(() => import('./pages/superadmin/Auditoria'));
const FiscalPlataforma = lazy(() => import('./pages/superadmin/FiscalPlataforma'));
const WhatsAppPlataforma = lazy(() => import('./pages/superadmin/WhatsAppPlataforma'));
const SuperErros       = lazy(() => import('./pages/superadmin/Erros'));

function AuthRecoveryRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;

    // 1. Redirecionar se a URL contiver tokens de recuperação ou erro no hash/search
    if (hash.includes('type=recovery') || hash.includes('access_token')) {
      if (location.pathname !== '/redefinir-senha') {
        navigate('/redefinir-senha' + hash, { replace: true });
        return;
      }
    } else if (hash.includes('error') || search.includes('error')) {
      if (
        location.pathname !== '/redefinir-senha' &&
        location.pathname !== '/admin/login' &&
        location.pathname !== '/superadmin/login'
      ) {
        navigate('/redefinir-senha?erro=expirado', { replace: true });
        return;
      }
    }

    // 2. Escutar evento de redefinição de senha do Supabase Auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        if (location.pathname !== '/redefinir-senha') {
          navigate('/redefinir-senha', { replace: true });
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, location]);

  return null;
}

export default function App() {
  return (
    <I18nProvider>
      <AcessibilidadeProvider>
        <ToastProvider>
          <BrowserRouter>
            <AuthRecoveryRedirect />
            <CookieBanner />
            <ScreenTransition>
              <Suspense fallback={<BrandLoader title="CARREGANDO MISEON..." />}>
              <Routes>
                {/* ── Admin ── */}
                <Route path="/admin/login" element={<Login />} />
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<Navigate to="inicio" replace />} />
                  <Route path="inicio"    element={<Dashboard />} />
                  <Route path="pdv"       element={<PDV />} />
                  <Route path="kds"       element={<KDS />} />
                  <Route path="mesas"     element={<Mesas />} />
                  <Route path="balanca"   element={<PainelBalanca />} />
                  <Route path="garcom-mobile" element={<PainelGarcomMobile />} />
                  <Route path="pedidos"   element={<PainelPedidos />} />
                  <Route path="entregas"  element={<Entregas />} />
                  <Route path="cardapio"  element={<CardapioAdmin />} />
                  <Route path="estoque"   element={<Estoque />} />
                  <Route path="producao"  element={<KDSProducao />} />
                  <Route path="compras"   element={<Compras />} />
                  <Route path="financeiro" element={<Financeiro />} />
                  <Route path="historico" element={<Historico />} />
                  <Route path="marketing" element={<Marketing />} />
                  <Route path="equipe"    element={<Equipe />} />
                  <Route path="loja"      element={<Loja />} />
                  <Route path="assinatura" element={<Assinatura />} />
                  <Route path="ajuda"     element={<Ajuda />} />
                  <Route path="conta"     element={<MinhaConta />} />
                  <Route path="chat"      element={<ChatAdmin />} />
                  <Route path="ifood"     element={<Ifood />} />
                  <Route path="whatsapp"  element={<WhatsApp />} />
                  <Route path="fiscal"    element={<Fiscal />} />
                </Route>

                {/* ── Superadmin ── */}
                <Route path="/superadmin/login" element={<SuperAdminLogin />} />
                <Route path="/superadmin" element={<SuperAdminLayout />}>
                  <Route index element={<Navigate to="leads" replace />} />
                  <Route path="leads"      element={<CrmLeads />} />
                  <Route path="guia-ceo"   element={<GuiaCeoGtm />} />
                  <Route path="tenants"    element={<Tenants />} />
                  <Route path="onboarding" element={<Onboarding />} />
                  <Route path="churn"      element={<Churn />} />
                  <Route path="auditoria"  element={<Auditoria />} />
                  <Route path="fiscal"     element={<FiscalPlataforma />} />
                  <Route path="whatsapp"   element={<WhatsAppPlataforma />} />
                  <Route path="erros"      element={<SuperErros />} />
                </Route>

                {/* ── Entregador ── */}
                <Route path="/entregador/login" element={<EntregadorLogin />} />
                <Route path="/entregador" element={<EntregadorLayout />}>
                  <Route index element={<EntregadorDashboard />} />
                  <Route path="rota/:id" element={<EntregadorRota />} />
                  <Route path="documentos" element={<EntregadorDocumentos />} />
                  <Route path="conta"    element={<MinhaConta />} />
                </Route>

                {/* ── Público ── */}
                <Route path="/"              element={<Home />} />
                <Route path="/acesso"        element={<Acesso />} />
                <Route path="/sobre"         element={<Sobre />} />
                <Route path="/contato"       element={<Contato />} />
                <Route path="/termos"        element={<Termos />} />
                <Route path="/privacidade"   element={<Privacidade />} />
                <Route path="/email/descadastro" element={<DescadastroEmail />} />
                <Route path="/redefinir-senha" element={<RedefinirSenha />} />
                <Route path="/lojas"         element={<Lojas />} />
                <Route path="/cadastre-se"   element={<CadastreSuaLoja />} />
                <Route path="/videos"        element={<Videos />} />
                <Route path="/depoimentos"   element={<Videos />} />
                <Route path="/demonstracao"  element={<Videos />} />
                <Route path="/pedido/:id"    element={<AcompanharPedido />} />
                
                {/* ── Páginas de Nicho & Funcionalidade (SEO Programático) ── */}
                <Route path="/sistema-para-hamburgueria" element={<NicheLandingPage forcedSlug="sistema-para-hamburgueria" />} />
                <Route path="/sistema-para-lanchonete"   element={<NicheLandingPage forcedSlug="sistema-para-lanchonete" />} />
                <Route path="/sistema-para-pizzaria"     element={<NicheLandingPage forcedSlug="sistema-para-pizzaria" />} />
                <Route path="/sistema-para-restaurantes" element={<NicheLandingPage forcedSlug="sistema-para-restaurantes" />} />
                <Route path="/sistema-para-restaurante-por-quilo" element={<NicheLandingPage forcedSlug="sistema-para-restaurante-por-quilo" />} />
                <Route path="/sistema-para-bar"          element={<NicheLandingPage forcedSlug="sistema-para-bar" />} />
                <Route path="/sistema-para-dark-kitchen" element={<NicheLandingPage forcedSlug="sistema-para-dark-kitchen" />} />
                <Route path="/integracao-ifood"          element={<NicheLandingPage forcedSlug="integracao-ifood" />} />
                <Route path="/cardapio-qr-code"          element={<NicheLandingPage forcedSlug="cardapio-qr-code" />} />
                <Route path="/api-whatsapp-restaurantes" element={<NicheLandingPage forcedSlug="api-whatsapp-restaurantes" />} />
                <Route path="/painel-de-senhas-tv"     element={<NicheLandingPage forcedSlug="painel-de-senhas-tv" />} />
                <Route path="/gestao-fiscal-nfe"         element={<NicheLandingPage forcedSlug="gestao-fiscal-nfe" />} />
                <Route path="/gestao-de-estoque-3d"      element={<EstoquePage />} />
                <Route path="/estrategia-de-marketing-para-restaurantes" element={<MarketingStrategyPage />} />
                <Route path="/ajuda/estoque"             element={<EstoquePage />} />
                <Route path="/blog"                      element={<Blog />} />
                <Route path="/blog/:slug"                element={<BlogPost />} />

                <Route path="/tv/:slug"      element={<PainelTV />} />
                <Route path="/:slug/meus-pedidos" element={<MeusPedidos />} />
                <Route path="/:slug"         element={<Cardapio />} />
                <Route path="*"             element={<Home />} />
              </Routes>
              </Suspense>
            </ScreenTransition>
          </BrowserRouter>
        </ToastProvider>
      </AcessibilidadeProvider>
    </I18nProvider>
  );
}

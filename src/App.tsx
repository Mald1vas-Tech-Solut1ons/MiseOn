import React, { Suspense, useEffect } from 'react';
import { lazyComRecarga, liberarNovaRecarga } from './lib/lazyComRecarga';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ScreenTransition } from './components/ScreenTransition';
import { ToastProvider } from './components/ui/Toast';
import { I18nProvider } from './contexts/I18nContext';
import CookieBanner from './components/CookieBanner';
import { AcessibilidadeProvider } from './contexts/AcessibilidadeProvider';
import { BrandLoader } from './components/BrandLoader';
import AuthRecoveryRedirect from './components/AuthRecoveryRedirect';

// ── Chunk: PUBLIC (carrega imediatamente — rotas do cliente final) ─────────────
import Home from './pages/Home';
import Cardapio from './pages/Cardapio';

// ── Lazy: PUBLIC_AUX (raramente acessadas, baixo impacto no LCP) ─────────────
const Acesso          = lazyComRecarga(() => import('./pages/Acesso'));
const Lojas           = lazyComRecarga(() => import('./pages/Lojas'));
const CadastreSuaLoja = lazyComRecarga(() => import('./pages/CadastreSuaLoja'));
const MeusPedidos     = lazyComRecarga(() => import('./pages/MeusPedidos'));
const PerfilLoja      = lazyComRecarga(() => import('./pages/PerfilLoja'));
const AcompanharPedido= lazyComRecarga(() => import('./pages/Pedido'));
const Termos          = lazyComRecarga(() => import('./pages/legal/Termos'));
const Privacidade     = lazyComRecarga(() => import('./pages/legal/Privacidade'));
const Sobre          = lazyComRecarga(() => import('./pages/legal/Sobre'));
const Contato         = lazyComRecarga(() => import('./pages/legal/Contato'));
const DescadastroEmail = lazyComRecarga(() => import('./pages/legal/DescadastroEmail'));
const RedefinirSenha    = lazyComRecarga(() => import('./pages/RedefinirSenha'));
const Videos           = lazyComRecarga(() => import('./pages/Videos'));
const NicheLandingPage = lazyComRecarga(() => import('./pages/landing/NicheLandingPage'));
const EstoquePage      = lazyComRecarga(() => import('./pages/landing/EstoquePage'));
const Blog             = lazyComRecarga(() => import('./pages/Blog'));
const FerramentasHub   = lazyComRecarga(() => import('./pages/ferramentas/FerramentasHub'));
const FerramentaPage   = lazyComRecarga(() => import('./pages/ferramentas/FerramentaPage'));
const BlogPost         = lazyComRecarga(() => import('./pages/BlogPost'));
const PainelTV         = lazyComRecarga(() => import('./pages/PainelTV'));
const TvPareamento     = lazyComRecarga(() => import('./pages/TvPareamento'));
const CastReceiver     = lazyComRecarga(() => import('./pages/CastReceiver'));
const MarketingStrategyPage = lazyComRecarga(() => import('./pages/landing/MarketingStrategyPage'));
const AutoatendimentoPage = lazyComRecarga(() => import('./pages/landing/AutoatendimentoPage'));
const DemoKioskPage       = lazyComRecarga(() => import('./pages/landing/DemoKioskPage'));
const Totem               = lazyComRecarga(() => import('./pages/Totem'));

// ── Lazy: ADMIN_LAYOUT (único layout compartilhado — carrega rápido) ─────────
const AdminLayout = lazyComRecarga(() => import('./pages/admin/AdminLayout'));
const Login       = lazyComRecarga(() => import('./pages/admin/Login'));

// ── Lazy: ADMIN_OPERACAO (turno de trabalho — pré-carrega após login) ────────
const Dashboard     = lazyComRecarga(() => import('./pages/admin/Dashboard'));
const PainelPedidos = lazyComRecarga(() => import('./pages/admin/PainelPedidos'));
const PDV           = lazyComRecarga(() => import('./pages/admin/PDV'));
const KDS           = lazyComRecarga(() => import('./pages/admin/KDS'));
const KDSEstacao    = lazyComRecarga(() => import('./pages/admin/KDSEstacao'));
const KDSExpeditor  = lazyComRecarga(() => import('./pages/admin/KDSExpeditor'));
const KDSEstacoesConfig = lazyComRecarga(() => import('./pages/admin/KDSEstacoesConfig'));
const KDSProducao   = lazyComRecarga(() => import('./pages/admin/KDSProducao'));
const Mesas         = lazyComRecarga(() => import('./pages/admin/Mesas'));
const Entregas      = lazyComRecarga(() => import('./pages/admin/Entregas'));
const PainelBalanca = lazyComRecarga(() => import('./pages/admin/PainelBalanca').then((m) => ({ default: m.PainelBalanca })));
const PainelGarcomMobile = lazyComRecarga(() => import('./pages/admin/PainelGarcomMobile').then((m) => ({ default: m.PainelGarcomMobile })));

// ── Lazy: ADMIN_GESTAO (chunk separado — só carrega ao navegar) ───────────────
const CardapioAdmin = lazyComRecarga(() => import('./pages/admin/Cardapio'));
const Estoque       = lazyComRecarga(() => import('./pages/admin/Estoque'));
const Compras       = lazyComRecarga(() => import('./pages/admin/Compras'));
const Financeiro    = lazyComRecarga(() => import('./pages/admin/Financeiro'));
const Historico     = lazyComRecarga(() => import('./pages/admin/Historico'));
const Marketing     = lazyComRecarga(() => import('./pages/admin/Marketing'));
const Equipe        = lazyComRecarga(() => import('./pages/admin/Equipe'));
const Loja          = lazyComRecarga(() => import('./pages/admin/Loja'));
const Assinatura    = lazyComRecarga(() => import('./pages/admin/Assinatura'));
const Ajuda         = lazyComRecarga(() => import('./pages/admin/Ajuda'));
const MinhaConta    = lazyComRecarga(() => import('./pages/admin/MinhaConta'));
const ChatAdmin     = lazyComRecarga(() => import('./pages/admin/ChatAdmin'));
const Ifood         = lazyComRecarga(() => import('./pages/admin/Ifood'));
const WhatsApp      = lazyComRecarga(() => import('./pages/admin/WhatsApp'));
const Fiscal        = lazyComRecarga(() => import('./pages/admin/Fiscal'));

// ── Lazy: ENTREGADOR (app isolado) ────────────────────────────────────────────
const EntregadorLayout   = lazyComRecarga(() => import('./pages/entregador/EntregadorLayout'));
const EntregadorLogin    = lazyComRecarga(() => import('./pages/entregador/Login'));
const EntregadorDashboard= lazyComRecarga(() => import('./pages/entregador/Dashboard'));
const EntregadorRota     = lazyComRecarga(() => import('./pages/entregador/Rota'));
const EntregadorDocumentos = lazyComRecarga(() => import('./pages/entregador/Documentos'));

// ── Lazy: SUPERADMIN (area interna restrita) ──────────────────────────────────
const SuperAdminLogin  = lazyComRecarga(() => import('./pages/superadmin/Login'));
const SuperAdminLayout = lazyComRecarga(() => import('./pages/superadmin/SuperAdminLayout'));
const CrmLeads         = lazyComRecarga(() => import('./pages/superadmin/CrmLeads'));
const GuiaCeoGtm       = lazyComRecarga(() => import('./pages/superadmin/GuiaCeoGtm'));
const Tenants          = lazyComRecarga(() => import('./pages/superadmin/Tenants'));
const Onboarding       = lazyComRecarga(() => import('./pages/superadmin/Onboarding'));
const Churn            = lazyComRecarga(() => import('./pages/superadmin/Churn'));
const Auditoria        = lazyComRecarga(() => import('./pages/superadmin/Auditoria'));
const FiscalPlataforma = lazyComRecarga(() => import('./pages/superadmin/FiscalPlataforma'));
const WhatsAppPlataforma = lazyComRecarga(() => import('./pages/superadmin/WhatsAppPlataforma'));
const SuperErros       = lazyComRecarga(() => import('./pages/superadmin/Erros'));
const SuperCadastros   = lazyComRecarga(() => import('./pages/superadmin/Cadastros'));
const SuperEmails      = lazyComRecarga(() => import('./pages/superadmin/Emails'));
const SuperPainel      = lazyComRecarga(() => import('./pages/superadmin/Painel'));
const SuperLoja360     = lazyComRecarga(() => import('./pages/superadmin/Loja360'));

function CookieBannerForaDoReceiver() {
  const location = useLocation();
  return location.pathname === '/cast/receiver' || location.pathname === '/tv' ? null : <CookieBanner />;
}

export default function App() {
  // O app subiu: devolve a permissão de recarga automática, para que a próxima
  // publicação do dia também seja recuperável nesta mesma aba. Enquanto o app
  // não monta, a permissão fica gasta — é ela que impede laço de recarga.
  useEffect(() => { liberarNovaRecarga(); }, []);

  return (
    <I18nProvider>
      <AcessibilidadeProvider>
        <ToastProvider>
          <BrowserRouter>
            <AuthRecoveryRedirect />
            <CookieBannerForaDoReceiver />
            <ScreenTransition>
              <Suspense fallback={<BrandLoader title="CARREGANDO MISEON..." />}>
              <Routes>
                {/* ── Admin ── */}
                <Route path="/admin/login" element={<Login />} />
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<Navigate to="inicio" replace />} />
                  <Route path="inicio"    element={<Dashboard />} />
                  <Route path="pdv"       element={<PDV />} />
                  <Route path="kds"       element={<KDSExpeditor />} />
                  <Route path="kds/expeditor" element={<KDSExpeditor />} />
                  <Route path="kds/legado" element={<KDS />} />
                  <Route path="kds/estacoes" element={<KDSEstacoesConfig />} />
                  <Route path="kds/estacao/:estacaoId" element={<KDSEstacao />} />
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
                  <Route index element={<SuperPainel />} />
                  <Route path="lojas/:id"  element={<SuperLoja360 />} />
                  <Route path="leads"      element={<CrmLeads />} />
                  <Route path="guia-ceo"   element={<GuiaCeoGtm />} />
                  <Route path="tenants"    element={<Tenants />} />
                  <Route path="onboarding" element={<Onboarding />} />
                  <Route path="churn"      element={<Churn />} />
                  <Route path="auditoria"  element={<Auditoria />} />
                  <Route path="fiscal"     element={<FiscalPlataforma />} />
                  <Route path="whatsapp"   element={<WhatsAppPlataforma />} />
                  <Route path="erros"      element={<SuperErros />} />
                  <Route path="cadastros"  element={<SuperCadastros />} />
                  <Route path="emails"     element={<SuperEmails />} />
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
                
                {/* ── Páginas do MiseOn Kiosk (Autoatendimento & Demo) ── */}
                <Route path="/autoatendimento"           element={<AutoatendimentoPage />} />
                <Route path="/totem"                     element={<Navigate to="/autoatendimento" replace />} />
                <Route path="/demo-kiosk"                element={<DemoKioskPage />} />

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
                <Route path="/ferramentas"               element={<FerramentasHub />} />
                <Route path="/ferramentas/calculadora-cmv"       element={<FerramentaPage slug="calculadora-cmv" />} />
                <Route path="/ferramentas/preco-ifood"           element={<FerramentaPage slug="preco-ifood" />} />
                <Route path="/ferramentas/markup-preco-de-venda" element={<FerramentaPage slug="markup-preco-de-venda" />} />
                <Route path="/blog/:slug"                element={<BlogPost />} />

                <Route path="/tv"            element={<TvPareamento />} />
                <Route path="/tv/:slug"      element={<PainelTV />} />
                <Route path="/cast/receiver" element={<CastReceiver />} />
                {/* Perfil da loja: o link que o lojista cola na bio do Instagram. */}
                <Route path="/:slug/perfil" element={<PerfilLoja />} />
                <Route path="/:slug/meus-pedidos" element={<MeusPedidos />} />
                {/* Antes do catch-all /:slug, senao o cardapio engole a rota. */}
                <Route path="/:slug/totem"   element={<Totem />} />
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

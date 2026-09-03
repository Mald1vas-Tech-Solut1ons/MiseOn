import { useEffect, useMemo, useRef, useState, memo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { ShoppingBag, Plus, Minus, X, Search, Clock, MapPin, Star, LogIn, History, Lock, ShieldCheck, User as UserIcon, Trash2, CreditCard, Loader2, Check, Sparkles, Compass, UtensilsCrossed, PartyPopper, Receipt, Mic, Bike, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { FotoProduto, obterFotoFallback, obterFotoProduto } from '../lib/fotoProduto';
import { maskCartaoCredito, maskValidadeCartao, maskCPF, validarCPF } from '../lib/mascaras';
import ModalAuthCliente from '../components/ModalAuthCliente';
import ModalMinhaConta from '../components/ModalMinhaConta';
import PedidoMesaDrawer from '../components/PedidoMesaDrawer';
import VoiceOrderModal from '../components/VoiceOrderModal';
import { Button, Modal, SuccessCelebration, BandeiraMark, BANDEIRAS_ACEITAS } from '../components/ui';
import {
  Loja, Banner, Categoria, Produto, TaxaEntrega, FaixaEntrega, ItemCarrinho,
  HorarioFuncionamento, MetodoPgto, Mesa, fmt, fmtQtd, precoItem, Cupom,
} from '../types';
import { fonteFamilia, isLightColor, obterFundoLojaPorTema, obterTokensLoja, corLegivelSobre } from '../lib/personalizacao';
import { aplicarTema, obterTemaPreferido, type PreferenciaTema } from '../lib/tema';
import CheckoutDrawer from '../components/CheckoutDrawer';
import PagamentoStatus, { type PixInfo } from '../components/PagamentoStatus';
import ThemeToggle from '../components/ThemeToggle';
import LanguageToggle from '../components/LanguageToggle';
import ChatInterface from '../components/chat/ChatInterface';
import MiseOnLoader from '../components/MiseOnLoader';
import SEO from '../components/SEO';
import { getOptimizedImageUrl } from '../lib/cdn';
import TabelaNutricional from '../components/cardapio/TabelaNutricional';
import SeloNutricional from '../components/cardapio/SeloNutricional';
import ResumoNutricionalPedido from '../components/cardapio/ResumoNutricionalPedido';
import type { NutricaoOpcao, NutricaoProduto, NutrienteCatalogo } from '../lib/nutricao';
import { montarJsonLdCardapio } from '../lib/jsonLdCardapio';

import { useI18n } from '../contexts/I18nContext';

const guardarUltimoPedido = (slug: string | undefined, pedidoId: string, numero: number) => {
  if (!slug) return;
  localStorage.setItem(`miseon_ultimo_pedido_${slug}`, JSON.stringify({
    pedidoId,
    numero,
    salvoEm: new Date().toISOString(),
  }));
};

// Recuperação de vendas: registra "abriu o checkout mas não terminou" — sinal de
// alta intenção (bem mais confiável que só ter item no carrinho). Vira alvo de
// mensagem de recuperação no Marketing → Recuperação. Silencioso: falhar aqui
// nunca deve travar a experiência de compra do cliente.
const registrarCarrinhoAberto = async (lojaId: string, user: User, carrinho: ItemCarrinho[]) => {
  try {
    const resumo = carrinho.map((i) => `${i.quantidade}x ${i.produto.nome}`).join(', ').slice(0, 500);
    const valorEstimado = carrinho.reduce((s, i) => s + precoItem(i), 0);
    await supabase.from('carrinhos_abandonados').upsert({
      loja_id: lojaId, user_id: user.id, itens_resumo: resumo, valor_estimado: valorEstimado,
      status: 'ABERTO', atualizado_em: new Date().toISOString(),
    }, { onConflict: 'loja_id,user_id' });
  } catch { /* recuperação de vendas é bônus — nunca deve atrapalhar o checkout */ }
};

const marcarCarrinhoRecuperado = async (lojaId: string, user: User) => {
  try {
    await supabase.from('carrinhos_abandonados').update({ status: 'RECUPERADO' }).eq('loja_id', lojaId).eq('user_id', user.id);
  } catch { /* idem */ }
};

// ── Loja aberta? (horário automático + override manual) ──────────
// Horário que vira a noite (ex.: sábado 10:00–00:50, fecha já domingo de
// madrugada) precisa ser checado contra a linha de ONTEM também — senão às
// 00:50 de domingo a função só olha a linha de domingo e mostra "fechado".
function lojaAberta(loja: Loja | null, horarios: HorarioFuncionamento[]): boolean {
  if (!loja) return false;
  if (loja.aberto_manual !== null && loja.aberto_manual !== undefined) return loja.aberto_manual;
  const agora = new Date();
  const hm = agora.toTimeString().slice(0, 5);
  const diaHoje = agora.getDay();
  const diaOntem = (diaHoje + 6) % 7;

  const dentroDoIntervalo = (h: HorarioFuncionamento, ehLinhaDeOntem: boolean) => {
    const abre = h.abre.slice(0, 5);
    const fecha = h.fecha.slice(0, 5);
    const cruzaMeiaNoite = fecha <= abre;
    if (!cruzaMeiaNoite) return !ehLinhaDeOntem && hm >= abre && hm <= fecha;
    // Cruza meia-noite: a linha de ontem cobre a madrugada de hoje (00:00 até
    // "fecha"); a linha de hoje cobre a partir de "abre" até a meia-noite.
    return ehLinhaDeOntem ? hm <= fecha : hm >= abre;
  };

  const linhasHoje = horarios.filter((h) => h.dia_semana === diaHoje);
  const linhasOntem = horarios.filter((h) => h.dia_semana === diaOntem);
  return linhasHoje.some((h) => dentroDoIntervalo(h, false)) || linhasOntem.some((h) => dentroDoIntervalo(h, true));
}

const ROTULO_METODO: Record<MetodoPgto, string> = {
  PIX: 'Pix', CREDITO: 'Crédito', DEBITO: 'Débito', DINHEIRO: 'Dinheiro', IFOOD: 'iFood',
};

export default function Cardapio() {
  const { tDynamic } = useI18n();
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const numeroMesaUrl = searchParams.get('mesa');
  const waTokenUrl = searchParams.get('wa');
  const [mesaAtual, setMesaAtual] = useState<Mesa | null>(null);
  const [mesaErro, setMesaErro] = useState(false);
  const [pedidoMesaSucesso, setPedidoMesaSucesso] = useState<number | null>(null);
  const [loja, setLoja] = useState<Loja | null>(null);
  const [horarios, setHorarios] = useState<HorarioFuncionamento[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  // Nutrição por produto, indexada por id. Vazio quando a loja ainda não tem
  // ficha técnica com dado nutricional — e aí nenhuma tabela é exibida.
  const [nutricao, setNutricao] = useState<Map<string, NutricaoProduto>>(new Map());
  // Ordem, rótulo, indentação e VDR vêm da tabela `nutrientes` (leitura
  // pública). Reimplementar essa lista no front era garantia de divergir do
  // rótulo oficial na primeira mudança de norma.
  const [catalogoNutrientes, setCatalogoNutrientes] = useState<NutrienteCatalogo[]>([]);
  // O que cada adicional acrescenta — a tabela reage ao que o cliente escolhe.
  const [nutricaoOpcoes, setNutricaoOpcoes] = useState<Map<string, NutricaoOpcao>>(new Map());
  const [taxas, setTaxas] = useState<TaxaEntrega[]>([]);
  const [faixasDistancia, setFaixasDistancia] = useState<FaixaEntrega[]>([]);
  const [busca, setBusca] = useState('');
  const [catAtiva, setCatAtiva] = useState<string | null>(null);
  const [modalAuthAberto, setModalAuthAberto] = useState(false);
  const [modalContaAberto, setModalContaAberto] = useState(false);
  
  const cartKey = `cart_${slug}`;
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>(() => {
    try {
      const salvo = localStorage.getItem(cartKey);
      return salvo ? JSON.parse(salvo) : [];
    } catch { return []; }
  });

  useEffect(() => {
    if (carrinho.length > 0) localStorage.setItem(cartKey, JSON.stringify(carrinho));
    else localStorage.removeItem(cartKey);
  }, [carrinho, cartKey]);

  const [produtoAberto, setProdutoAberto] = useState<Produto | null>(null);
  const [checkoutAberto, setCheckoutAberto] = useState(false);
  const [pedidoNumero, setPedidoNumero] = useState<number | null>(null);
  const [pedidoId, setPedidoId] = useState<string | null>(null);
  const [pedidoTotal, setPedidoTotal] = useState<number | null>(null);
  const [pix, setPix] = useState<PixInfo | null>(null);
  const [metodo, setMetodo] = useState<MetodoPgto>('PIX');
  const [cartao, setCartao] = useState<{ pedidoId: string; numero: number; total: number } | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [temaCliente, setTemaCliente] = useState<PreferenciaTema>(() => obterTemaPreferido());
  const [modalVozAberto, setModalVozAberto] = useState(false);
  const catScrollRef = useRef<HTMLDivElement>(null);

  const rolarCategorias = (dir: 'esq' | 'dir') => {
    if (catScrollRef.current) {
      catScrollRef.current.scrollBy({ left: dir === 'esq' ? -260 : 260, behavior: 'smooth' });
    }
  };

  // Recuperação de vendas: quando o checkout abre com item no carrinho, registra
  // o "quase comprei" — se ele fechar sem terminar, o lojista consegue reativar.
  useEffect(() => {
    if (checkoutAberto && !mesaAtual && user && loja && carrinho.length > 0) {
      registrarCarrinhoAberto(loja.id, user, carrinho);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutAberto]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    // Só atualiza se o usuário realmente mudou. O Supabase dispara SIGNED_IN/TOKEN_REFRESHED
    // ao focar a aba; sem esta guarda, cada foco recria o objeto user e re-renderiza tudo
    // (podendo atrapalhar quem está digitando o cartão).
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) =>
      setUser((prev) => (prev?.id === session?.user?.id ? prev : (session?.user ?? null))),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  // A confirmação do Pix é do <PagamentoStatus> (polling de pagamentos + realtime
  // de pedidos). O realtime de `pagamentos` foi removido: essa tabela não está na
  // publicação realtime, então nunca disparava — era a raiz do "sem feedback".

  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [cupomCopiado, setCupomCopiado] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    localStorage.setItem('miseon_ultima_loja', slug);
    (async () => {
      // `lojas_publicas`: projeção segura da loja (sem credencial fiscal, de
      // pagamento ou de integração). A tabela `lojas` não é mais legível pela
      // vitrine — ver migration 20260815200000.
      const { data: l } = await supabase.from('lojas_publicas').select('*').eq('slug', slug).single();
      if (!l) return;
      setLoja(l);
      const [h, b, c, p, t, f, est, nut, cat, nutOpc, cup] = await Promise.all([
        supabase.from('horarios_funcionamento').select('*').eq('loja_id', l.id),
        supabase.from('banners_destaque').select('*').eq('loja_id', l.id).eq('is_ativo', true).order('ordem_exibicao'),
        supabase.from('categorias').select('*').eq('loja_id', l.id).order('ordem'),
        supabase.from('produtos').select('*, grupos_opcoes(*, opcoes(*))').eq('loja_id', l.id).order('ordem'),
        supabase.from('taxas_entrega').select('*').eq('loja_id', l.id),
        supabase.from('faixas_entrega').select('*').eq('loja_id', l.id).eq('ativo', true).order('ordem').order('km_ate'),
        supabase.rpc('fn_produtos_com_estoque', { p_loja_id: l.id }),
        supabase.rpc('fn_nutricao_cardapio', { p_loja_id: l.id }),
        supabase.from('nutrientes').select('*').eq('ativo', true).order('ordem'),
        supabase.rpc('fn_nutricao_opcoes_cardapio', { p_loja_id: l.id }),
        supabase.from('cupons').select('*').eq('loja_id', l.id).eq('ativo', true),
      ]);
      setHorarios(h.data ?? []);
      setBanners(b.data ?? []);
      setCategorias(c.data ?? []);
      setCupons((cup.data as Cupom[]) ?? []);
      // disponivel = o lojista quer vender; tem_estoque = os insumos da ficha técnica
      // ainda alcançam pra fazer o produto — os dois juntos decidem se aparece pra compra
      const mapaEstoque = new Map<string, boolean>((est.data ?? []).map((e: any) => [e.produto_id, e.tem_estoque]));
      const prodsComPromo = (p.data ?? []).map((prod: Produto) => {
        const nomeU = (prod.nome || '').toUpperCase();
        let preco_original: number | undefined = prod.preco_original;
        if (nomeU.includes('COMBO X-BACON')) preco_original = 54.00;
        if (nomeU.includes('SMASH FIT DE PATINHO')) preco_original = 39.90;
        return {
          ...prod,
          preco_original,
          tem_estoque: mapaEstoque.get(prod.id) ?? true,
        };
      });
      setProdutos(prodsComPromo);
      setNutricao(new Map(((nut.data as NutricaoProduto[]) ?? []).map((n) => [n.produto_id, n])));
      setCatalogoNutrientes((cat.data as NutrienteCatalogo[]) ?? []);
      setNutricaoOpcoes(new Map(((nutOpc.data as NutricaoOpcao[]) ?? []).map((o) => [o.opcao_id, o])));
      setTaxas(t.data ?? []);
      setFaixasDistancia((f.data as FaixaEntrega[]) ?? []);
      document.title = `${l.nome} — Peça online`;

      if (numeroMesaUrl) {
        // A tabela `mesas` não tem mais SELECT público: o QR resolve a mesa
        // pelo RPC fn_mesa_publica (slug + número exatos, não enumerável).
        const { data: mesa } = await supabase
          .rpc('fn_mesa_publica', { p_slug: slug, p_numero: Number(numeroMesaUrl) })
          .maybeSingle();
        if (mesa) setMesaAtual(mesa as Mesa); else setMesaErro(true);
      }
    })();
  }, [slug, numeroMesaUrl]);

  // JSON-LD do cardápio com a informação nutricional de cada prato (NUT-25).
  // Ver src/lib/jsonLdCardapio.ts sobre o alcance real disso hoje.
  useEffect(() => {
    if (!loja || !produtos.length) return;
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = 'jsonld-cardapio';
    el.textContent = JSON.stringify(montarJsonLdCardapio(loja, categorias, produtos, nutricao));
    document.getElementById('jsonld-cardapio')?.remove();
    document.head.appendChild(el);
    return () => el.remove();
  }, [loja, categorias, produtos, nutricao]);

  useEffect(() => {
    if (!loja) return;
    const padrao = loja.tema_cardapio === 'escuro' ? 'escuro' : 'claro';
    const temaInicial = obterTemaPreferido(padrao);
    
    // Evita a chamada síncrona dentro do effect (previne o aviso de "cascading renders")
    setTimeout(() => setTemaCliente(temaInicial), 0);
    const sincronizarTema = (event: Event) => {
      const tema = (event as CustomEvent<{ tema: PreferenciaTema }>).detail?.tema;
      if (tema === 'claro' || tema === 'escuro') setTemaCliente(tema);
    };
    window.addEventListener('miseon:tema', sincronizarTema as EventListener);
    return () => window.removeEventListener('miseon:tema', sincronizarTema as EventListener);
  }, [loja, loja?.id, loja?.tema_cardapio]);

  useEffect(() => {
    if (!loja) return;
    const raiz = document.documentElement;
    const fundo = obterFundoLojaPorTema(temaCliente, loja);
    const tokens = obterTokensLoja(fundo, temaCliente, loja.cor_texto || loja.cor_primaria || '#FC5B24');
    raiz.style.setProperty('--cor-fundo', fundo);
    raiz.style.setProperty('--cor-primaria', loja.cor_primaria || '#FC5B24');
    // Mesma cor da marca, mas corrigida para ser LEGIVEL como texto sobre
    // este fundo. O lojista escolhe primaria e fundo sem nenhuma trava, e
    // combinacoes como vermelho sobre marrom deixavam o PRECO em 3.04:1 —
    // abaixo do minimo 4.5:1 da WCAG AA. Botao continua usando --cor-primaria
    // (texto branco por cima); isto vale para texto sobre o fundo da loja.
    raiz.style.setProperty(
      '--cor-primaria-texto',
      corLegivelSobre(loja.cor_primaria || '#FC5B24', fundo),
    );
    raiz.style.setProperty('--cor-secundaria', loja.cor_secundaria || '#0A5CC4');
    raiz.style.setProperty('--fonte-loja', fonteFamilia(loja.fonte));
    raiz.style.setProperty('--cor-texto', tokens.texto);
    raiz.style.setProperty('--cor-texto-suave', tokens.textoSuave);
    raiz.style.setProperty('--cor-texto-fraco', tokens.textoFraco);
    raiz.style.setProperty('--cor-surface', tokens.surface);
    raiz.style.setProperty('--cor-surface-muted', tokens.surfaceMuted);
    raiz.style.setProperty('--cor-card', tokens.card);
    raiz.style.setProperty('--cor-borda', tokens.border);
    raiz.style.setProperty('--cor-borda-forte', tokens.borderStrong);
    raiz.style.setProperty('--cor-destaque', tokens.destaque);
    aplicarTema(temaCliente);
  }, [loja, temaCliente]);

  const aberta = lojaAberta(loja, horarios);

  const maisPedidos = useMemo(
    () => [...produtos].sort((a, b) => b.vendidos - a.vendidos).slice(0, 6).filter((p) => p.vendidos > 0),
    [produtos],
  );

  const visiveis = useMemo(
    () =>
      produtos.filter(
        (p) =>
          (!catAtiva || p.categoria_id === catAtiva) &&
          (!busca || p.nome.toLowerCase().includes(busca.toLowerCase())),
      ),
    [produtos, catAtiva, busca],
  );

  const totalCarrinho = carrinho.reduce((s, i) => s + precoItem(i), 0);
  const qtdCarrinho = carrinho.reduce((s, i) => s + i.quantidade, 0);

  const addAoCarrinho = (item: ItemCarrinho) => {
    setCarrinho((c) => [...c, item]);
    setProdutoAberto(null);
  };

  const cancelarPedidoPendente = async (pedidoId: string) => {
    await Promise.all([
      supabase.from('pagamentos').update({ status: 'CANCELADO' }).eq('pedido_id', pedidoId).eq('status', 'PENDENTE'),
      supabase.from('pedidos').update({ status: 'CANCELADO' }).eq('id', pedidoId).eq('status', 'NOVO'),
    ]);
  };

  // Gera uma nova cobrança Pix para o mesmo pedido (usado quando a janela expira).
  const regenerarPix = async (): Promise<PixInfo | null> => {
    if (!pedidoId) return null;
    const { data, error } = await supabase.functions.invoke('pix-criar-cobranca', { body: { pedido_id: pedidoId } });
    if (error || (data as any)?.error || !(data as any)?.copia_e_cola) return null;
    return data as PixInfo;
  };

  if (!loja) return <CardapioSkeleton />;

  const iniciais = (loja.nome || '').trim() ? (loja.nome || '').trim()[0].toUpperCase() : '?';

  return (
    <div className="loja-marca min-h-screen pb-28 lg:pb-16">
      <SEO
        title={`${loja.nome} | Cardápio Digital & Pedidos Online`}
        description={`Cardápio digital e pedidos online de ${loja.nome}. Faça seu pedido pelo site ou WhatsApp. Endereço: ${loja.endereco || 'Atendimento local e delivery'}.`}
        keywords={`${loja.nome}, cardapio digital ${loja.nome}, pedir online ${loja.nome}, restaurante ${loja.nome}, delivery ${loja.nome}`}
        canonicalUrl={`https://miseon.app.br/${loja.slug}`}
        ogImage={getOptimizedImageUrl(loja.logo_url || loja.banner_url || 'https://miseon.app.br/icon-512.png')}
        metaPixelId={loja.meta_pixel_id}
        ga4MeasurementId={loja.ga4_measurement_id}
        schemaJson={{
          '@context': 'https://schema.org',
          '@type': 'Restaurant',
          'name': loja.nome,
          'url': `https://miseon.app.br/${loja.slug}`,
          'image': getOptimizedImageUrl(loja.logo_url || loja.banner_url || 'https://miseon.app.br/icon-512.png'),
          'description': `Cardápio digital e pedidos online de ${loja.nome}.`,
          'address': {
            '@type': 'PostalAddress',
            'streetAddress': loja.endereco || 'Brasil',
            'addressCountry': 'BR',
          },
          'servesCuisine': 'Food Service',
          'hasMenu': `https://miseon.app.br/${loja.slug}`,
          'provider': {
            '@type': 'Organization',
            'name': 'MiseOn',
            'url': 'https://miseon.app.br',
          },
        }}
      />
      {/* Hero — banner com gradiente da marca, logo/nome sobrepostos */}
      <header className="relative">
        <div
          className="relative h-48 w-full overflow-hidden sm:h-64 lg:h-80"
          style={{ background: `linear-gradient(135deg, ${loja.cor_primaria}, ${loja.cor_secundaria})` }}
        >
          {/* object-position vertical vem do lojista. Com o centro travado, um
              banner 4000x1714 exibido em 4:1 perdia ~42% da altura sempre pelo
              meio: se a fachada ou o prato nao estivesse no centro exato, sumia
              e nao havia como corrigir sem reeditar a foto. */}
          {loja.banner_url && (
            <img
              src={getOptimizedImageUrl(loja.banner_url)}
              className="h-full w-full object-cover"
              style={{ objectPosition: `50% ${loja.banner_pos_y ?? 50}%` }}
              alt={`Banner de ${loja.nome}`}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/25" />
          <div className="absolute left-3 top-3 sm:left-6 sm:top-6">
            <Link
              to="/lojas"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/20 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-black/30"
            >
              <Compass size={14} /> Hall de lojas
            </Link>
          </div>
          <div className="absolute right-3 top-3 flex gap-2 sm:right-6 sm:top-6">
            <LanguageToggle variant="minimal" />
            <ThemeToggle className="rounded-full border border-white/30 bg-black/20 p-2 text-white backdrop-blur-sm transition hover:bg-black/30" />
            {user ? (
              <>
                <Link to={`/${slug}/meus-pedidos`} title="Meus pedidos"
                  className="rounded-full border border-white/30 bg-black/20 p-2 text-white backdrop-blur-sm transition hover:bg-black/30">
                  <History size={16} />
                </Link>
                <button onClick={() => setModalContaAberto(true)} title="Minha Conta"
                  className="flex items-center gap-1.5 rounded-full border border-white/30 bg-black/20 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-black/30">
                  <UserIcon size={14} /> Minha Conta
                </button>
              </>
            ) : (
              <button onClick={() => setModalAuthAberto(true)}
                className="flex items-center gap-1.5 rounded-full border border-white/30 bg-black/20 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-black/30">
                <LogIn size={14} /> Entrar
              </button>
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0">
            <div className="mx-auto flex max-w-6xl items-end gap-4 px-4 pb-4 sm:px-6 sm:pb-6">
              {loja.logo_url
                ? <img src={getOptimizedImageUrl(loja.logo_url)} className="h-16 w-16 shrink-0 rounded-2xl border-2 border-white/40 object-cover shadow-xl sm:h-24 sm:w-24" alt="" />
                : <div
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-white/40 text-2xl font-bold shadow-xl backdrop-blur-sm sm:h-24 sm:w-24 sm:text-4xl"
                    style={{ background: loja.cor_primaria, color: isLightColor(loja.cor_primaria) ? '#111827' : '#ffffff' }}
                  >
                    {iniciais}
                  </div>}
              <div className="min-w-0 pb-1 text-white">
                <h1 className="truncate text-xl font-bold drop-shadow sm:text-3xl">{loja.nome}</h1>
                <p className="flex items-center gap-1 truncate text-xs text-white/85 sm:text-sm">
                  <MapPin size={12} /> {loja.endereco}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold backdrop-blur-sm ${aberta ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
                    <Clock size={11} /> {aberta ? 'Aberto agora' : 'Fechado'}
                  </span>
                  {/* O que o cliente procura antes de decidir pedir — e o que
                      iFood e Rappi mostram no topo. Antes so havia nome, status
                      e pedido minimo. */}
                  {(loja.meta_preparo_min ?? 0) > 0 && (
                    <span className="flex items-center gap-1 rounded-full px-2 py-0.5 backdrop-blur-sm" style={{ background: 'rgba(255,255,255,0.92)', color: '#111827' }}>
                      <Clock size={11} /> ~{loja.meta_preparo_min} min
                    </span>
                  )}
                  {loja.aceita_entrega && (
                    <span className="flex items-center gap-1 rounded-full px-2 py-0.5 backdrop-blur-sm" style={{ background: 'rgba(255,255,255,0.92)', color: '#111827' }}>
                      <Bike size={11} />
                      {Number(loja.entrega_taxa_padrao ?? 0) > 0
                        ? `${tDynamic('Entrega')} ${fmt(Number(loja.entrega_taxa_padrao))}`
                        : tDynamic('Entrega grátis')}
                    </span>
                  )}
                  {loja.pedido_minimo > 0 && (
                    <span className="rounded-full px-2 py-0.5 backdrop-blur-sm" style={{ background: 'rgba(255,255,255,0.92)', color: '#111827' }}>
                      {tDynamic('Pedido mín.')} {fmt(loja.pedido_minimo)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {mesaAtual && (
        <div className="mx-auto -mt-px max-w-6xl px-4 pt-3 sm:px-6">
          <div className="flex items-center gap-2.5 rounded-2xl border px-4 py-3 shadow-sm" style={{ background: 'var(--cor-destaque)', borderColor: 'var(--cor-borda)' }}>
            <UtensilsCrossed size={18} style={{ color: 'var(--cor-primaria-texto)' }} className="shrink-0" />
            <p className="text-sm font-semibold" style={{ color: 'var(--cor-texto)' }}>
              {tDynamic('Você está pedindo da')} <b>{tDynamic('Mesa')} {mesaAtual.numero}</b>{mesaAtual.nome ? ` (${mesaAtual.nome})` : ''} — {tDynamic('sem precisar de login. A conta fecha no final com o garçom.')}
            </p>
          </div>
        </div>
      )}
      {mesaErro && (
        <div className="mx-auto -mt-px max-w-6xl px-4 pt-3 sm:px-6">
          <div className="flex items-center gap-2.5 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
            <X size={18} className="shrink-0" /> {tDynamic('Essa mesa não foi encontrada — chame um garçom para te ajudar.')}
          </div>
        </div>
      )}
      {pedidoMesaSucesso && (
        <div className="mx-auto -mt-px max-w-6xl px-4 pt-3 sm:px-6">
          <div className="flex items-center justify-between gap-2.5 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-400">
            <span className="flex items-center gap-2.5"><PartyPopper size={18} className="shrink-0" /> {tDynamic('Pedido')} #{pedidoMesaSucesso} {tDynamic('enviado! A cozinha já está preparando.')}</span>
            <button onClick={() => setPedidoMesaSucesso(null)} className="shrink-0"><X size={16} /></button>
          </div>
        </div>
      )}

      {/* Banners promocionais — o layout segue a QUANTIDADE.
          Antes era sempre carrossel com card de largura fixa (w-72/sm:w-96) e
          altura fixa (h-32): com um banner só, a peça ficava encolhida num
          canto e sobrava mais da metade da linha vazia. Carrossel é resposta
          para excesso de itens, não para um item.
            1  -> hero de largura total, proporção cinematográfica
            2  -> lado a lado, os dois grandes
            3+ -> aí sim carrossel, com o card seguinte espiando na borda
          O título deixa de ser legenda truncada embaixo e passa a ser
          sobreposto sobre gradiente, que é onde ele compete com a imagem. */}
      {banners.length > 0 && (() => {
        const unico = banners.length === 1;
        const par = banners.length === 2;

        const executarAcaoBanner = (b: Banner) => {
          if (b.tipo_acao === 'PRODUTO' && b.acao_target_id) {
            const prod = produtos.find((p) => p.id === b.acao_target_id);
            if (prod) setProdutoAberto(prod);
          } else if (b.tipo_acao === 'CATEGORIA' && b.acao_target_id) {
            setCatAtiva(b.acao_target_id);
          } else if (b.tipo_acao === 'CUPOM' && b.acao_target_id) {
            navigator.clipboard.writeText(b.acao_target_id);
            setCupomCopiado(b.acao_target_id);
            setTimeout(() => setCupomCopiado(null), 3000);
          } else if (b.link_redirecionamento) {
            window.open(b.link_redirecionamento, '_blank');
          }
        };

        const Peca = ({ b, className = '', proporcao }: { b: Banner; className?: string; proporcao: string }) => {
          return (
            <button
              type="button"
              onClick={() => executarAcaoBanner(b)}
              className={`vitrine-card group relative block overflow-hidden rounded-[22px] text-left cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${className}`}
              style={{ outlineColor: 'var(--cor-primaria)' }}
            >
              <img
                src={getOptimizedImageUrl(b.imagem_url)}
                alt={b.titulo || 'Destaque da loja'}
                loading="lazy"
                className={`vitrine-card-media w-full object-cover ${proporcao}`}
              />
              {b.titulo && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-5 pb-4 pt-12">
                  <p className={`font-extrabold leading-tight text-white drop-shadow-sm ${unico ? 'text-xl sm:text-3xl' : 'text-base sm:text-xl'}`}>
                    {b.titulo}
                  </p>
                </div>
              )}
            </button>
          );
        };

        // Um banner: protagonista, ocupando a largura toda.
        //
        // 1.91:1 e não algo mais panorâmico (21:9) de propósito: banner de
        // promoção quase sempre TEM TEXTO e sai de ferramenta tipo Canva nos
        // formatos 1200x628 (1.91:1) ou 16:9. Um corte mais largo que isso
        // comeria a chamada escrita — o layout não pode apagar a promoção que
        // o lojista acabou de montar.
        if (unico) {
          return (
            <div className="mx-auto max-w-6xl px-4 pt-4 pb-6 sm:px-6">
              <Peca b={banners[0]} proporcao="aspect-[16/9] sm:aspect-[1.91/1]" />
            </div>
          );
        }

        // Dois: dividem a linha em partes iguais, sem sobra.
        if (par) {
          return (
            <div className="mx-auto grid max-w-6xl gap-4 px-4 pt-4 pb-6 sm:grid-cols-2 sm:px-6">
              {banners.map((b) => (
                <Peca key={b.id} b={b} proporcao="aspect-[16/9]" />
              ))}
            </div>
          );
        }

        // Três ou mais: carrossel de verdade. O card ocupa quase toda a tela no
        // celular para o seguinte aparecer pela borda e convidar ao arraste.
        return (
          <div className="mx-auto max-w-6xl">
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pt-4 pb-6 sm:px-6 hide-scrollbar">
              {banners.map((b) => (
                <Peca
                  key={b.id}
                  b={b}
                  className="w-[86%] shrink-0 snap-center sm:w-[48%] lg:w-[32%]"
                  proporcao="aspect-[16/9]"
                />
              ))}
            </div>
          </div>
        );
      })()}

      {/* Ribbon Promocional de Cupons Ativos & Cashback da Loja */}
      {((cupons && cupons.length > 0) || (loja.cashback_pct ?? 0) > 0) && (
        <div className="mx-auto max-w-6xl px-4 py-2 sm:px-6">
          <div className="flex items-center gap-3 overflow-x-auto pb-1 hide-scrollbar">
            {/* Banner/Badge de Cashback Ativo */}
            {(loja.cashback_pct ?? 0) > 0 && (
              <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-orange-500/10 px-3.5 py-2 text-xs font-bold text-amber-600 dark:text-amber-400 shadow-sm backdrop-blur-sm">
                <Sparkles size={14} className="text-amber-500 animate-pulse" />
                <span>{tDynamic(`Ganhe ${loja.cashback_pct}% de cashback em todas as compras`)}</span>
              </div>
            )}

            {/* Pills de Cupons Promocionais com 1-Clique para Copiar */}
            {cupons.map((c) => {
              const copiado = cupomCopiado === c.codigo;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    navigator.clipboard.writeText(c.codigo);
                    setCupomCopiado(c.codigo);
                    setTimeout(() => setCupomCopiado(null), 3000);
                  }}
                  className={`flex shrink-0 items-center gap-2.5 rounded-2xl border px-3.5 py-2 text-xs font-bold transition-all shadow-sm ${
                    copiado
                      ? 'border-emerald-500 bg-emerald-500 text-white shadow-emerald-500/20'
                      : 'border-orange-500/30 bg-white dark:bg-gray-900 text-gray-900 dark:text-white hover:border-orange-500'
                  }`}
                  title="Clique para copiar o cupom"
                >
                  <PartyPopper size={14} className={copiado ? 'text-white' : 'text-orange-500'} />
                  <span className="font-mono uppercase font-black tracking-wide">{c.codigo}</span>
                  <span className="rounded-lg bg-orange-500/10 px-2 py-0.5 text-xs opacity-90 font-extrabold text-orange-500 dark:bg-orange-500/20">
                    {c.tipo === 'FIXO' ? fmt(Number(c.valor)) : `${c.valor}% OFF`}
                  </span>
                  {c.apenas_primeiro_pedido && (
                    <span className="text-[10px] uppercase font-extrabold text-slate-400">1ª Compra</span>
                  )}
                  {c.pedido_minimo > 0 && (
                    <span className="text-[10px] uppercase font-extrabold text-slate-400">Mín {fmt(Number(c.pedido_minimo))}</span>
                  )}
                  <span className="ml-1 text-[11px] font-semibold underline opacity-80">
                    {copiado ? tDynamic('Copiado!') : tDynamic('Copiar')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl lg:grid lg:grid-cols-[1fr_360px] lg:items-start lg:gap-6 lg:px-6 lg:pt-4">
        <main className="min-w-0">
          {/* Busca */}
          <div className="px-4 pt-2 lg:px-0">
            <div className="vitrine-search flex items-center gap-2 rounded-2xl px-4 py-3">
              <Search size={16} style={{ color: 'var(--cor-texto-fraco)' }} />
              <input
                type="text"
                placeholder={tDynamic('Buscar no cardápio…')}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full bg-transparent text-sm font-semibold outline-none"
                style={{ color: 'var(--cor-texto)' }}
              />
              <button
                type="button"
                onClick={() => setModalVozAberto(true)}
                className="flex items-center gap-1.5 rounded-xl bg-[var(--cor-primaria)] px-3 py-1.5 text-xs font-bold text-white shadow-md hover:brightness-110 transition-all shrink-0"
                title="Fazer pedido por voz com IA"
              >
                <Mic size={14} className="animate-pulse" /> Pedir por voz
              </button>
            </div>
          </div>

          {/* Filtros de categoria com setas de navegação no desktop e suporte a scroll de mouse */}
          <div className="relative flex items-center px-4 py-3 lg:px-0">
            <button
              type="button"
              onClick={() => rolarCategorias('esq')}
              className="hidden sm:flex shrink-0 items-center justify-center h-8 w-8 rounded-full border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-200 shadow-md hover:bg-gray-50 dark:hover:bg-gray-800 mr-2 z-10 transition-all cursor-pointer"
              title="Rolar categorias para a esquerda"
            >
              <ChevronLeft size={16} />
            </button>

            <div
              ref={catScrollRef}
              onWheel={(e) => {
                if (catScrollRef.current && e.deltaY !== 0) {
                  catScrollRef.current.scrollLeft += e.deltaY;
                }
              }}
              className="flex flex-1 gap-2 overflow-x-auto scroll-smooth hide-scrollbar py-1"
            >
              <button
                onClick={() => setCatAtiva(null)}
                className={`vitrine-chip shrink-0 rounded-full px-4 py-2 text-sm font-semibold cursor-pointer ${!catAtiva ? 'is-active' : ''}`}
              >
                Tudo
              </button>
              {categorias.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCatAtiva(c.id === catAtiva ? null : c.id)}
                  className={`vitrine-chip shrink-0 rounded-full px-4 py-2 text-sm font-semibold cursor-pointer ${catAtiva === c.id ? 'is-active' : ''}`}
                >
                  {c.nome}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => rolarCategorias('dir')}
              className="hidden sm:flex shrink-0 items-center justify-center h-8 w-8 rounded-full border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-200 shadow-md hover:bg-gray-50 dark:hover:bg-gray-800 ml-2 z-10 transition-all cursor-pointer"
              title="Rolar categorias para a direita"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Os mais pedidos */}
          {!busca && !catAtiva && maisPedidos.length > 0 && (
            <section className="px-4 lg:px-0">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-black" style={{ color: 'var(--cor-texto)' }}>
                  <Star size={16} className="text-amber-500" /> {tDynamic('Os mais pedidos')}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs opacity-95 font-semibold" style={{ background: 'var(--cor-destaque)', color: 'var(--cor-texto-suave)' }}>
                  <Sparkles size={12} /> {tDynamic('Selecionados pela casa')}
                </span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {maisPedidos.map((p) => (
                  <MaisPedidoCard key={p.id} p={p} nutricao={nutricao.get(p.id)} onClick={() => setProdutoAberto(p)} />
                ))}
              </div>
            </section>
          )}

          {/* Lista por categoria — grid no desktop, lista no mobile */}
          {categorias
            .filter((c) => !catAtiva || c.id === catAtiva)
            .map((c) => {
              const doGrupo = visiveis.filter((p) => p.categoria_id === c.id);
              if (!doGrupo.length) return null;
              return (
                <section key={c.id} className="px-4 pt-4 lg:px-0">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="font-black" style={{ color: 'var(--cor-texto)' }}>{c.nome}</h2>
                    <span className="text-xs font-semibold" style={{ color: 'var(--cor-texto-fraco)' }}>{doGrupo.length} opcoes</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {doGrupo.map((p) => (
                      <ProdutoCard key={p.id} p={p} nutricao={nutricao.get(p.id)} onClick={() => setProdutoAberto(p)} />
                    ))}
                  </div>
                </section>
              );
            })}
        </main>

        {/* Carrinho — barra flutuante no mobile, painel fixo no desktop */}
        <aside className="hidden lg:sticky lg:top-4 lg:block">
          <div className="vitrine-panel overflow-hidden rounded-[28px] p-4">
            <div className="mb-4 rounded-[22px] p-4" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--cor-primaria) 18%, transparent), color-mix(in srgb, var(--cor-secundaria) 10%, transparent))' }}>
              <p className="mb-1 flex items-center gap-2 font-black" style={{ color: 'var(--cor-texto)' }}><ShoppingBag size={18} /> Seu carrinho</p>
              <p className="text-xs" style={{ color: 'var(--cor-texto-suave)' }}>{tDynamic('Revise seus itens e finalize com segurança.')}</p>
            </div>
            {carrinho.length === 0 ? (
              <p className="py-8 text-center text-sm" style={{ color: 'var(--cor-texto-fraco)' }}>{tDynamic('Adicione itens do cardápio.')}</p>
            ) : (
              <>
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {carrinho.map((i, idx) => (
                    <div key={idx} className="rounded-2xl border p-3" style={{ background: 'var(--cor-surface)', borderColor: 'var(--cor-borda)' }}>
                      <div className="flex items-start justify-between text-sm leading-tight">
                        <span className="pr-2 font-semibold" style={{ color: 'var(--cor-texto)' }}>{i.produto.nome}</span>
                        <span className="font-black" style={{ color: 'var(--cor-texto)' }}>{fmt(precoItem(i))}</span>
                      </div>
                      {i.opcoesSelecionadas && i.opcoesSelecionadas.length > 0 && (
                        <p className="line-clamp-1 text-xs opacity-95" style={{ color: 'var(--cor-texto-fraco)' }}>{i.opcoesSelecionadas.map(o => o.nome).join(', ')}</p>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <div className="inline-flex items-center gap-3 rounded-full border px-2.5 py-1.5" style={{ background: 'var(--cor-surface-muted)', borderColor: 'var(--cor-borda)' }}>
                          {i.produto.tipo_venda === 'POR_PESO' ? (
                            <span className="px-1 text-xs font-bold" style={{ color: 'var(--cor-texto)' }}>{fmtQtd(i.quantidade, 'POR_PESO')}</span>
                          ) : (
                            <>
                              <button onClick={() => i.quantidade > 1 ? setCarrinho(carrinho.map((x, y) => y === idx ? { ...x, quantidade: x.quantidade - 1 } : x)) : setCarrinho(carrinho.filter((_, y) => y !== idx))} className="transition-colors hover:text-red-500" style={{ color: 'var(--cor-texto-suave)' }}><Minus size={14} /></button>
                              <span className="w-4 text-center text-xs font-bold" style={{ color: 'var(--cor-texto)' }}>{i.quantidade}</span>
                              <button onClick={() => setCarrinho(carrinho.map((x, y) => y === idx ? { ...x, quantidade: x.quantidade + 1 } : x))} className="transition-colors hover:text-[var(--cor-primaria-texto)]" style={{ color: 'var(--cor-texto-suave)' }}><Plus size={14} /></button>
                            </>
                          )}
                        </div>
                        <button onClick={() => setCarrinho(carrinho.filter((_, y) => y !== idx))} className="transition-colors hover:text-red-500" style={{ color: 'var(--cor-texto-fraco)' }}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <ResumoNutricionalPedido
                  carrinho={carrinho}
                  nutricao={nutricao}
                  nutricaoOpcoes={nutricaoOpcoes}
                  catalogo={catalogoNutrientes}
                />
                <div className="mt-4 flex items-center justify-between border-t pt-4 font-black" style={{ borderColor: 'var(--cor-borda)', color: 'var(--cor-texto)' }}>
                  <span>Total</span><span>{fmt(totalCarrinho)}</span>
                </div>
                <button onClick={() => setCheckoutAberto(true)}
                  className="vitrine-floating-cart mt-4 w-full rounded-2xl py-3.5 font-bold text-white transition hover:brightness-110">
                  Finalizar pedido
                </button>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* Botão do carrinho — só no mobile */}
      {qtdCarrinho > 0 && (
        <button
          onClick={() => setCheckoutAberto(true)}
          className="vitrine-floating-cart fixed bottom-4 left-1/2 flex w-[92%] max-w-md -translate-x-1/2 items-center justify-between rounded-3xl px-5 py-3.5 font-semibold text-white lg:hidden"
        >
          <span className="flex items-center gap-2"><ShoppingBag size={18} /> {qtdCarrinho} item(ns)</span>
          <span>{fmt(totalCarrinho)}</span>
        </button>
      )}

      {produtoAberto && (
        <ModalProduto
          produto={produtoAberto}
          nutricao={nutricao.get(produtoAberto.id)}
          catalogoNutrientes={catalogoNutrientes}
          nutricaoOpcoes={nutricaoOpcoes}
          observacaoNutricional={loja?.nutricao_disclaimer}
          onClose={() => setProdutoAberto(null)}
          onAdd={addAoCarrinho}
        />
      )}
      
      {checkoutAberto && mesaAtual && (
        <PedidoMesaDrawer loja={loja} mesa={mesaAtual} carrinho={carrinho} setCarrinho={setCarrinho}
          onClose={() => setCheckoutAberto(false)}
          onSucesso={(num) => { setCheckoutAberto(false); setPedidoMesaSucesso(num); }} />
      )}

      {checkoutAberto && !mesaAtual && (
        <CheckoutDrawer loja={loja} aberta={aberta} carrinho={carrinho} taxas={taxas} faixasDistancia={faixasDistancia} horarios={horarios} user={user} setCarrinho={setCarrinho} waToken={waTokenUrl}
          onClose={() => setCheckoutAberto(false)} onAbrirAuth={() => setModalAuthAberto(true)}
          onCartao={(info) => { setCheckoutAberto(false); setCartao(info); }}
          onSucesso={(num, id, metodo, pixData, total) => {
            guardarUltimoPedido(slug, id, num);
            if (user) marcarCarrinhoRecuperado(loja.id, user);
            setCarrinho([]); setCheckoutAberto(false); setPedidoNumero(num); setPedidoId(id); setPedidoTotal(total ?? null); setPix(pixData ?? null); setMetodo(metodo);
          }} />
      )}

      {cartao && <CartaoModal loja={loja} info={cartao} onFechar={async () => {
        await cancelarPedidoPendente(cartao.pedidoId);
        setCartao(null);
      }} onAprovado={() => {
        guardarUltimoPedido(slug, cartao.pedidoId, cartao.numero);
        if (user) marcarCarrinhoRecuperado(loja.id, user);
        setCartao(null); setPedidoNumero(cartao.numero); setPedidoId(cartao.pedidoId); setPedidoTotal(cartao.total); setMetodo('CREDITO');
      }} />}

      <ModalAuthCliente isOpen={modalAuthAberto} onClose={() => setModalAuthAberto(false)} />
      
      <VoiceOrderModal
        aberto={modalVozAberto}
        onFechar={() => setModalVozAberto(false)}
        produtos={produtos}
        onAdicionarAoCarrinho={({ produto, quantidade }) => {
          setCarrinho((prev) => {
            const idx = prev.findIndex((item) => item.produto.id === produto.id);
            if (idx >= 0) {
              return prev.map((item, i) => (i === idx ? { ...item, quantidade: item.quantidade + quantidade } : item));
            }
            return [...prev, { produto, quantidade, opcoesSelecionadas: [] }];
          });
        }}
      />
      
      <ModalMinhaConta 
        isOpen={modalContaAberto} 
        onClose={() => setModalContaAberto(false)} 
        lojaId={loja.id}
        userId={user?.id ?? ''}
        userEmail={user?.email}
      />

      {/* Pix: máquina de estados (aguardando -> confirmado -> expirado) com
          confirmação automática por polling. Substitui o QR estático. */}
      {pedidoNumero !== null && pedidoId && pix && (
        <PagamentoStatus
          pedidoId={pedidoId}
          numero={pedidoNumero}
          pix={pix}
          onRegenerar={regenerarPix}
          onFechar={() => { setPedidoNumero(null); setPix(null); setPedidoId(null); setPedidoTotal(null); }}
        />
      )}

      {/* Cartão/dinheiro: pagamento já resolvido no ato -> confirmação direta. */}
      {pedidoNumero !== null && pedidoId && !pix && (
        <Modal aberto onFechar={() => { setPedidoNumero(null); setPix(null); setPedidoId(null); setPedidoTotal(null); setCheckoutAberto(false); }}>
          <SuccessCelebration
            titulo="Pagamento confirmado!"
            subtitulo="A cozinha já foi notificada e começou a preparar."
          >
            <div className="mt-2 space-y-4">
              {/* Resumo do pedido */}
              <div className="rounded-2xl border border-[var(--cor-borda)] bg-[var(--cor-surface)] p-4 text-left">
                <p className="mb-3 flex items-center gap-2 text-xs opacity-90 font-bold uppercase tracking-widest text-[var(--cor-texto-fraco)]">
                  <Receipt size={12} /> {tDynamic('Resumo do pedido')}
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--cor-texto-suave)]">Pedido</span>
                    <span className="font-bold text-[var(--cor-texto)] dark:text-[var(--cor-texto-claro)]">#{pedidoNumero}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--cor-texto-suave)]">{tDynamic('Forma de pagamento')}</span>
                    <span className="font-semibold text-[var(--cor-texto)] dark:text-[var(--cor-texto-claro)]">{ROTULO_METODO[metodo]}</span>
                  </div>
                  {pedidoTotal !== null && (
                    <div className="flex items-center justify-between border-t border-[var(--cor-borda)] pt-2">
                      <span className="font-semibold text-[var(--cor-texto)] dark:text-[var(--cor-texto-claro)]">Total</span>
                      <span className="text-base font-black text-[var(--cor-primaria-texto)]">{fmt(pedidoTotal)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button size="lg" className="flex-1" onClick={() => navigate(`/pedido/${pedidoId}`)}>
                  Acompanhar pedido
                </Button>
                <Button variant="secundario" size="lg" className="flex-1"
                  onClick={() => { setPedidoNumero(null); setPix(null); setPedidoId(null); setPedidoTotal(null); setCheckoutAberto(false); }}>
                  {tDynamic('Voltar ao cardápio')}
                </Button>
              </div>

              <p className="flex items-center justify-center gap-1 text-xs opacity-90 font-semibold text-[var(--cor-texto-fraco)]">
                <ShieldCheck size={12} /> {tDynamic('Transação protegida de ponta a ponta.')}
              </p>
            </div>
          </SuccessCelebration>
        </Modal>
      )}

      {/* Interface de Chat do Cliente */}
      <ChatInterface loja={loja} user={user} />
    </div>
  );
}

// ── Modal do produto (opções/extras + observação) ───────────
function ModalProduto({ produto, nutricao, catalogoNutrientes, nutricaoOpcoes, observacaoNutricional, onClose, onAdd }: {
  produto: Produto;
  nutricao?: NutricaoProduto;
  catalogoNutrientes: NutrienteCatalogo[];
  nutricaoOpcoes: Map<string, NutricaoOpcao>;
  observacaoNutricional?: string | null;
  onClose: () => void;
  onAdd: (i: ItemCarrinho) => void;
}) {
  const isPeso = produto.tipo_venda === 'POR_PESO';
  const [qtd, setQtd] = useState(isPeso ? 0.350 : 1);
  const [obs, setObs] = useState('');
  const [sel, setSel] = useState<Record<string, string[]>>({}); // grupo_id -> opcao_ids

  const grupos = produto.grupos_opcoes ?? [];
  const opcoesSelecionadas = grupos.flatMap((g) => g.opcoes.filter((o) => (sel[g.id] ?? []).includes(o.id)));
  const valido = grupos.every((g) => (sel[g.id]?.length ?? 0) >= g.min_escolhas) && (!isPeso || qtd > 0);
  const precoBaseUnit = isPeso ? Number(produto.preco_por_quilo || 0) : Number(produto.preco);
  const total = (precoBaseUnit * qtd) + (opcoesSelecionadas.reduce((s, o) => s + Number(o.preco_adicional), 0) * (isPeso ? 1 : qtd));

  const toggle = (g: { id: string; max_escolhas: number }, opcaoId: string) => {
    setSel((s) => {
      const atual = s[g.id] ?? [];
      if (atual.includes(opcaoId)) return { ...s, [g.id]: atual.filter((x) => x !== opcaoId) };
      if (atual.length >= g.max_escolhas) return g.max_escolhas === 1 ? { ...s, [g.id]: [opcaoId] } : s;
      return { ...s, [g.id]: [...atual, opcaoId] };
    });
  };

  const fotoPrincipal = obterFotoProduto(produto);
  const imgs = produto.galeria?.length ? produto.galeria : (fotoPrincipal ? [fotoPrincipal] : []);

  return createPortal(
    <div className="fade fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="sheet max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white dark:bg-gray-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        
        {imgs.length > 0 && (
          <div className="relative w-full overflow-hidden rounded-t-3xl bg-gray-100 dark:bg-gray-800">
            <div className="flex w-full snap-x snap-mandatory overflow-x-auto hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {imgs.map((url, i) => (
                <div key={i} className="min-w-full snap-center bg-black/5 dark:bg-black/40 flex items-center justify-center">
                  <FotoProduto
                    src={getOptimizedImageUrl(url) || url || fotoPrincipal}
                    fallback={obterFotoFallback(produto.nome)}
                    className="h-64 sm:h-72 w-full object-cover"
                    alt={`${produto.nome} - foto ${i+1}`}
                  />
                </div>
              ))}
            </div>
            {imgs.length > 1 && (
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
                {imgs.map((_, i) => (
                   <div key={i} className="h-1.5 w-1.5 rounded-full bg-black/30 dark:bg-white/50 backdrop-blur-sm" />
                ))}
              </div>
            )}
            {imgs.length > 1 && (
              <div className="absolute top-2 right-2 rounded-full bg-black/50 px-2 py-1 text-xs opacity-90 font-bold text-white backdrop-blur-sm">
                1/{imgs.length} <span className="opacity-70">(deslize)</span>
              </div>
            )}
          </div>
        )}

        <div className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold dark:text-gray-100">{produto.nome}</h3>
                {produto.destaque && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-500/95 px-2 py-0.5 text-[9px] font-black text-white shadow-sm backdrop-blur-md">
                    <Star size={9} className="fill-current" /> DA CASA
                  </span>
                )}
              </div>

              {/* Preço de Tabela (De: / Por:) com economia visível */}
              {produto.preco_original && produto.preco_original > produto.preco ? (
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="line-through text-xs font-semibold text-gray-400 dark:text-gray-500">
                    De: {fmt(Number(produto.preco_original))}
                  </span>
                  <span className="font-['Sora'] text-base font-black text-emerald-600 dark:text-emerald-400">
                    Por: {fmt(Number(produto.preco))}
                  </span>
                  <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/70 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300">
                    Economia de {fmt(Number(produto.preco_original) - Number(produto.preco))} ({Math.round((((produto.preco_original || 0) - produto.preco) / (produto.preco_original || 1)) * 100)}% OFF)
                  </span>
                </div>
              ) : (
                isPeso && (
                  <span className="mt-0.5 inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                    ⚖️ {fmt(Number(produto.preco_por_quilo || 0))}/kg
                  </span>
                )
              )}
            </div>
            <button onClick={onClose} className="dark:text-gray-300"><X size={20} /></button>
          </div>
          {produto.descricao && <p className="mt-1 whitespace-pre-line text-sm text-gray-500 dark:text-gray-400">{produto.descricao}</p>}
          {nutricao && (
            <TabelaNutricional
              dados={nutricao}
              catalogo={catalogoNutrientes}
              /* O bacon extra e a bebida do combo mudam o que o cliente vai
                 comer — e por isso mudam a tabela na frente dele. */
              extras={opcoesSelecionadas
                .map((o) => nutricaoOpcoes.get(o.id))
                .filter((n): n is NutricaoOpcao => !!n)}
              observacaoLoja={observacaoNutricional}
            />
          )}

          {grupos.map((g) => (
            <div key={g.id} className="mt-4">
              <p className="text-sm font-semibold dark:text-gray-200">
                {g.nome}{' '}
                <span className="font-normal text-gray-400">
                  ({g.min_escolhas > 0 ? `obrigatório · ` : ''}até {g.max_escolhas})
                </span>
              </p>
              <div className="mt-1 space-y-1">
                {g.opcoes.filter((o) => o.disponivel).map((o) => (
                  <label key={o.id} className="flex items-center justify-between rounded-lg border p-2 text-sm dark:border-gray-700 dark:text-gray-200">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={(sel[g.id] ?? []).includes(o.id)}
                        onChange={() => toggle(g, o.id)}
                      />
                      {o.nome}
                    </span>
                    {Number(o.preco_adicional) > 0 && <span className="text-gray-500 dark:text-gray-400">+{fmt(Number(o.preco_adicional))}</span>}
                  </label>
                ))}
              </div>
            </div>
          ))}

          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Alguma observação? Ex: sem cebola…"
            className="mt-4 w-full rounded-xl border p-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            rows={2}
          />

          {/* Seletor de Quantidade / Peso */}
          <div className="mt-4">
            {isPeso ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">⚖️ Peso informado (Kg):</span>
                  <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">{fmtQtd(qtd, 'POR_PESO')}</span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-2">
                  {[0.250, 0.350, 0.500, 0.750, 1.000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setQtd(preset)}
                      className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                        qtd === preset
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white text-emerald-800 border border-emerald-200 dark:bg-gray-800 dark:text-emerald-300 dark:border-emerald-800'
                      }`}
                    >
                      {preset < 1 ? `${preset * 1000}g` : `${preset}kg`}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Em gramas:</span>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={Math.round(qtd * 1000)}
                    onChange={(e) => {
                      const g = Math.max(0, Number(e.target.value || 0));
                      setQtd(g / 1000);
                    }}
                    placeholder="Ex: 350"
                    className="w-24 rounded-lg border border-emerald-300 bg-white p-1.5 text-xs font-bold outline-none dark:border-emerald-800 dark:bg-gray-800 dark:text-gray-100"
                  />
                  <span className="text-xs font-bold text-gray-500">g</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-3 rounded-xl border px-3 py-2 dark:border-gray-700 dark:text-gray-200">
                  <button type="button" onClick={() => setQtd((q) => Math.max(1, q - 1))}><Minus size={16} /></button>
                  <span className="w-5 text-center font-semibold">{qtd}</span>
                  <button type="button" onClick={() => setQtd((q) => q + 1)}><Plus size={16} /></button>
                </div>
                <button
                  disabled={!valido}
                  onClick={() => onAdd({ produto, quantidade: qtd, observacao: obs || undefined, opcoesSelecionadas })}
                  className="flex-1 rounded-xl bg-[var(--cor-primaria)] py-3 font-semibold text-white disabled:opacity-40"
                >
                  Adicionar {fmt(total)}
                </button>
              </div>
            )}

            {isPeso && (
              <button
                disabled={!valido}
                onClick={() => onAdd({ produto, quantidade: qtd, observacao: obs || undefined, opcoesSelecionadas })}
                className="mt-3 flex w-full items-center justify-center rounded-xl bg-[var(--cor-primaria)] py-3 font-semibold text-white disabled:opacity-40"
              >
                Adicionar ({fmtQtd(qtd, 'POR_PESO')}) — {fmt(total)}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Detecção de bandeira (feedback imediato nos primeiros dígitos) ──
type Bandeira = { id: string; nome: string; re: RegExp };
const BANDEIRAS: Bandeira[] = [
  { id: 'visa', nome: 'Visa', re: /^4/ },
  { id: 'mastercard', nome: 'Mastercard', re: /^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/ },
  { id: 'amex', nome: 'American Express', re: /^3[47]/ },
  { id: 'elo', nome: 'Elo', re: /^(4011|4312|4389|4514|4576|5041|5066|5067|509\d|6277|6362|6363|650|651|655)/ },
  { id: 'hipercard', nome: 'Hipercard', re: /^(606282|3841)/ },
  { id: 'diners', nome: 'Diners', re: /^3(0[0-5]|[68])/ },
  { id: 'discover', nome: 'Discover', re: /^(6011|65|64[4-9])/ },
];
const detectarBandeira = (digits: string): Bandeira | null =>
  digits.length >= 4 ? (BANDEIRAS.find((b) => b.re.test(digits)) ?? null) : null;

// Luhn — valida o número do cartão localmente (some feedback antes de enviar)
const luhnValido = (digits: string): boolean => {
  if (digits.length < 13) return false;
  let soma = 0, alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    soma += n; alt = !alt;
  }
  return soma % 10 === 0;
};

// ── Resolução de fotos gastronômicas por produto com fallback inteligente ──
// Foto de produto (catalogo curado, fallback e <FotoProduto>) vive em src/lib/fotoProduto.tsx
// porque a TV do balcao usa exatamente a mesma regra.

// ── Otimização de Performance (React.memo) ──
const MaisPedidoCard = memo(({ p, nutricao, onClick }: { p: Produto; nutricao?: NutricaoProduto; onClick: () => void }) => {
  const foto = obterFotoProduto(p);
  const temDesconto = Boolean(p.preco_original && p.preco_original > p.preco);
  const pctDesconto = temDesconto ? Math.round((((p.preco_original || 0) - p.preco) / (p.preco_original || 1)) * 100) : 0;

  return (
    <button
      onClick={() => p.tem_estoque !== false && onClick()}
      disabled={p.tem_estoque === false}
      className={`vitrine-card relative flex w-56 sm:w-64 shrink-0 flex-col justify-between rounded-[28px] p-4 text-left group transition-all ${
        p.tem_estoque === false ? 'opacity-50' : ''
      }`}
    >
      <div>
        <div className="relative mb-3.5 h-36 sm:h-44 w-full overflow-hidden rounded-2xl bg-gray-100 dark:bg-gray-800/80 shadow-sm flex items-center justify-center">
          <FotoProduto
            src={foto}
            fallback={obterFotoFallback(p.nome)}
            className="vitrine-card-media h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            alt={p.nome}
          />
          {p.destaque && (
            <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-amber-500/95 px-2.5 py-1 text-[10px] font-black text-white shadow-md backdrop-blur-md">
              <Star size={11} className="fill-current" /> DA CASA
            </span>
          )}
          {temDesconto && (
            <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-emerald-500/95 px-2.5 py-1 text-[10px] font-black text-white shadow-md backdrop-blur-md">
              {pctDesconto}% OFF
            </span>
          )}
          {p.tem_estoque === false && (
            <span className="absolute right-2.5 top-2.5 rounded-full bg-black/85 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-md">
              ESGOTADO
            </span>
          )}
        </div>

        <p className="line-clamp-1 text-base font-extrabold transition-colors group-hover:text-[var(--cor-primaria-texto)]" style={{ color: 'var(--cor-texto)' }}>
          {p.nome}
        </p>
        {p.descricao && (
          <p className="mt-1 line-clamp-2 text-xs opacity-90 leading-relaxed" style={{ color: 'var(--cor-texto-suave)' }}>
            {p.descricao}
          </p>
        )}
        <SeloNutricional dados={nutricao} compacto />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-gray-100 dark:border-gray-800/60 pt-3">
        <div>
          {temDesconto && (
            <p className="line-through text-xs font-bold text-gray-400 dark:text-gray-500">
              De: {fmt(Number(p.preco_original))}
            </p>
          )}
          <p className={`font-['Sora'] text-lg font-black ${temDesconto ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--cor-primaria-texto)]'}`}>
            {temDesconto ? `Por: ${fmt(Number(p.preco))}` : (p.tipo_venda === 'POR_PESO' ? `${fmt(Number(p.preco_por_quilo || 0))}/kg` : fmt(Number(p.preco)))}
          </p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100/80 dark:bg-gray-800/80 text-[var(--cor-texto)] group-hover:border-[var(--cor-primaria)] group-hover:bg-[var(--cor-primaria)] group-hover:text-white shadow-sm transition-all">
          <Plus size={18} />
        </span>
      </div>
    </button>
  );
});

const ProdutoCard = memo(({ p, nutricao, onClick }: { p: Produto; nutricao?: NutricaoProduto; onClick: () => void }) => {
  const foto = obterFotoProduto(p);
  const temDesconto = Boolean(p.preco_original && p.preco_original > p.preco);
  const pctDesconto = temDesconto ? Math.round((((p.preco_original || 0) - p.preco) / (p.preco_original || 1)) * 100) : 0;

  return (
    <button
      onClick={() => p.tem_estoque !== false && onClick()}
      disabled={p.tem_estoque === false}
      className={`vitrine-card relative flex w-full items-stretch justify-between gap-4 rounded-[28px] p-4 text-left group transition-all ${
        p.tem_estoque === false ? 'opacity-50' : ''
      }`}
    >
      {/* Coluna de texto (Esquerda) */}
      <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
        <div>
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold text-base sm:text-lg leading-snug transition-colors group-hover:text-[var(--cor-primaria-texto)]" style={{ color: 'var(--cor-texto)' }}>
              {p.nome}
            </p>
            {p.tem_estoque === false && (
              <span className="shrink-0 rounded-full bg-gray-800 px-2 py-0.5 text-[10px] font-bold text-white">
                ESGOTADO
              </span>
            )}
          </div>

          {p.descricao && (
            <p className="mt-1 line-clamp-2 text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--cor-texto-suave)' }}>
              {p.descricao}
            </p>
          )}

          <SeloNutricional dados={nutricao} />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 pt-2">
          <div>
            {temDesconto && (
              <p className="line-through text-xs font-bold text-gray-400 dark:text-gray-500">
                De: {fmt(Number(p.preco_original))}
              </p>
            )}
            <div className="flex items-baseline gap-1.5">
              <p className={`font-['Sora'] text-lg sm:text-xl font-black ${temDesconto ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--cor-primaria-texto)]'}`}>
                {temDesconto ? `Por: ${fmt(Number(p.preco))}` : (p.tipo_venda === 'POR_PESO' ? `${fmt(Number(p.preco_por_quilo || 0))}/kg` : fmt(Number(p.preco)))}
              </p>
              {p.tipo_venda === 'POR_PESO' && (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">⚖️ Kg</span>
              )}
            </div>
          </div>

          <span className="flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100/80 dark:bg-gray-800/80 px-3.5 py-1.5 text-xs font-bold text-[var(--cor-texto)] group-hover:border-[var(--cor-primaria)] group-hover:bg-[var(--cor-primaria)] group-hover:text-white shadow-sm transition-all">
            <Plus size={15} /> Adicionar
          </span>
        </div>
      </div>

      {/* Coluna da Foto Gastronômica (Direita — Padrão iFood / Enterprise) */}
      <div className="relative h-32 w-32 sm:h-36 sm:w-36 shrink-0 overflow-hidden rounded-2xl bg-gray-100 dark:bg-gray-800/80 shadow-sm flex items-center justify-center">
        <FotoProduto
          src={foto}
          fallback={obterFotoFallback(p.nome)}
          className="vitrine-card-media h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          alt={p.nome}
        />
        {p.destaque && (
          <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-amber-500/95 px-2 py-0.5 text-[9px] font-black text-white shadow-sm backdrop-blur-md">
            <Star size={9} className="fill-current" /> DA CASA
          </span>
        )}
        {temDesconto && (
          <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-emerald-500/95 px-2 py-0.5 text-[9px] font-black text-white shadow-sm backdrop-blur-md">
            {pctDesconto}% OFF
          </span>
        )}
      </div>
    </button>
  );
});

const CardapioSkeleton = () => (
  <div className="flex h-screen items-center justify-center bg-[#F4F7FA] dark:bg-[#070C18]">
    <MiseOnLoader status="Carregando cardápio..." rows={3} />
  </div>
);

// BandeiraMark/BANDEIRAS_ACEITAS agora vêm de components/ui (compartilhados com a Assinatura).

// ── Tela dedicada de pagamento com cartão (Efí — tokenização no navegador) ──
// Dados NÃO sensíveis do titular (nome + CPF) para agilizar a próxima compra.
// NUNCA guardamos número do cartão nem CVV — só o que a Efí tokeniza no ato.
const TITULAR_KEY = 'miseon_titular_cartao';
function lerTitularSalvo(): { nome: string; cpf: string } | null {
  try { const r = localStorage.getItem(TITULAR_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}

function CartaoModal({ loja, info, onFechar, onAprovado }: {
  loja: Loja;
  info: { pedidoId: string; numero: number; total: number };
  onFechar: () => void;
  onAprovado: () => void;
}) {
  const { tDynamic } = useI18n();
  const salvo = lerTitularSalvo();
  const [numero, setNumero] = useState('');
  const [nome, setNome] = useState(salvo?.nome ?? '');
  const [cpf, setCpf] = useState(salvo?.cpf ?? '');
  const [validade, setValidade] = useState(''); // MM/AA
  const [cvv, setCvv] = useState('');
  const [parcelas, setParcelas] = useState(1);
  const [salvarDados, setSalvarDados] = useState(!!salvo);
  const [erro, setErro] = useState('');
  const [processando, setProcessando] = useState(false);
  const [verso, setVerso] = useState(false); // vira o cartão ao focar o CVV
  const [tocado, setTocado] = useState<Record<string, boolean>>({});
  const numeroRef = useRef<HTMLInputElement>(null);
  const nomeRef = useRef<HTMLInputElement>(null);
  const validadeRef = useRef<HTMLInputElement>(null);
  const cvvRef = useRef<HTMLInputElement>(null);
  const cpfRef = useRef<HTMLInputElement>(null);
  const pagarRef = useRef<HTMLButtonElement>(null);

  // Comportamento de modal profissional: foco no 1º campo, trava o scroll do fundo e fecha no Esc.
  useEffect(() => {
    const t = setTimeout(() => numeroRef.current?.focus({ preventScroll: true }), 120);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !processando) onFechar(); };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const efiEnvironment =
    import.meta.env.VITE_MISEON_EFI_SANDBOX === 'true' || import.meta.env.VITE_EFI_SANDBOX === 'true'
      ? 'sandbox'
      : 'production';

  const digitos = numero.replace(/\D/g, '');
  const bandeira = detectarBandeira(digitos);
  const [mm, aa] = validade.split('/');
  const validadeOk = (() => {
    if (!mm || !aa || aa.length < 2 || Number(mm) < 1 || Number(mm) > 12) return false;
    const fim = new Date(2000 + Number(aa), Number(mm), 0, 23, 59, 59);
    return fim >= new Date();
  })();
  const okNumero = luhnValido(digitos);
  const okNome = nome.trim().length >= 3;
  const okCpf = validarCPF(cpf);
  const okCvv = /^\d{3,4}$/.test(cvv);
  const tudoOk = okNumero && okNome && okCpf && validadeOk && okCvv;

  // Próximo campo pendente na ordem de preenchimento — recebe o destaque pulsante
  // (classe .campo-proximo) que conduz o olhar do usuário durante o fluxo.
  const proximo = !okNumero ? 'numero' : !okNome ? 'nome' : !validadeOk ? 'validade' : !okCvv ? 'cvv' : !okCpf ? 'cpf' : '';

  // Número renderizado no cartão visual (dígitos digitados + placeholders)
  const numeroDisplay = (() => {
    const base = digitos.padEnd(16, '•').slice(0, 16);
    return base.replace(/(.{4})/g, '$1 ').trim();
  })();

  const pagar = async () => {
    setErro('');
    if (!loja.efi_configurado) {
      return setErro('Cartão online indisponível para esta loja no momento.');
    }
    if (!tudoOk) {
      setTocado({ numero: true, nome: true, cpf: true, validade: true, cvv: true });
      return setErro('Confira os dados do cartão destacados em vermelho.');
    }
    setProcessando(true);
    try {
      // SDK oficial da Efí: tokeniza o cartão no navegador (o número nunca sai daqui)
      if (!(window as any).EfiPay) {
        await new Promise<void>((ok, err) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/payment-token-efi/dist/payment-token-efi-umd.min.js';
          s.onload = () => ok();
          s.onerror = () => err(new Error('Não foi possível carregar o ambiente seguro da Efí. Verifique sua conexão.'));
          document.head.appendChild(s);
        });
      }
      const EfiPay = (window as any).EfiPay;
      const brand = await EfiPay.CreditCard.setCardNumber(digitos).verifyCardBrand();
      // O token do cartão precisa ser gerado para a conta que PROCESSA a cobrança.
      // No modelo split, quem processa é a plataforma (MiseOn) — o payee_code da loja
      // é usado só no repasse, dentro da edge function cartao-pagar.
      // Se a loja optou por antecipação, a cobrança é processada pela conta antecipada
      // da plataforma (~2 dias úteis) — o token precisa ser gerado para ELA.
      // A conta processadora vinha SO de variavel de build da Vercel: trocar de
      // conta Efi exigia redeploy, e mexer no secret do Supabase nao surtia
      // efeito nenhum — armadilha silenciosa que derrubava o cartao inteiro.
      // Agora a fonte e o banco, lido em tempo de execucao; a env continua como
      // ultimo recurso para nao quebrar ambiente antigo.
      const { data: cfgPlataforma } = await supabase
        .from('plataforma_pagamento_publico')
        .select('efi_payee_code, efi_payee_code_antecipado, sandbox')
        .maybeSingle();
      // Ambiente do gateway tambem sai do banco. Antes era variavel de build:
      // virar sandbox/producao exigia redeploy, e a chave ficava num lugar
      // diferente da conta que ela precisa acompanhar — receita de token
      // gerado para o ambiente errado.
      const ambienteEfi = (
        cfgPlataforma?.sandbox === true ? 'sandbox'
        : cfgPlataforma?.sandbox === false ? 'production'
        : efiEnvironment
      ) as 'sandbox' | 'production';
      const payeeAntecipado = (
        cfgPlataforma?.efi_payee_code_antecipado
        ?? (import.meta.env.VITE_MISEON_EFI_PAYEE_CODE_ANTECIPADO as string | undefined)
      )?.trim();
      const payeePadrao = (
        cfgPlataforma?.efi_payee_code
        ?? (import.meta.env.VITE_MISEON_EFI_PAYEE_CODE as string | undefined)
      )?.trim();
      // A conta que PROCESSA é sempre da plataforma. O payee_code da loja entra
      // só no repasse, dentro da edge function — e por isso não é mais exposto
      // à vitrine (auditoria, achado 01). Sem a env da plataforma não há como
      // tokenizar: falha explícita em vez de cair numa conta errada.
      const contaProcessadora = loja.antecipacao_cartao && payeeAntecipado ? payeeAntecipado : payeePadrao;
      if (!contaProcessadora) {
        throw new Error('Pagamento com cartão indisponível no momento. Tente Pix ou pague na entrega.');
      }
      const result = await EfiPay.CreditCard
        .setAccount(contaProcessadora)
        .setEnvironment(ambienteEfi)
        .setCreditCardData({
          brand: brand || bandeira?.id,
          number: digitos,
          cvv,
          expirationMonth: mm.padStart(2, '0'),
          expirationYear: aa.length === 2 ? `20${aa}` : aa,
          holderName: nome,
          holderDocument: cpf.replace(/\D/g, ''),
          reuse: false,
        })
        .getPaymentToken();

      const { data, error } = await supabase.functions.invoke('cartao-pagar', {
        body: {
          pedido_id: info.pedidoId,
          payment_token: result.payment_token,
          installments: parcelas,
          customer: { name: nome, cpf },
        },
      });
      if (error || !data?.aprovado) {
        if ((data as any)?.detail) console.warn('[cartao-pagar] detalhe Efí:', (data as any).detail);
        let msg: unknown = data?.error ?? 'Pagamento não autorizado. Confira os dados ou tente outro cartão.';
        if (error) {
          try {
            const b = await (error as any)?.context?.json?.();
            if (b?.detail) console.warn('[cartao-pagar] detalhe Efí:', b.detail);
            msg = b?.error ?? msg;
          } catch { /* mantém msg */ }
        }
        // Garante texto: nunca joga objeto no JSX (senão o React quebra a tela).
        setErro(typeof msg === 'string' ? msg : 'Pagamento não autorizado. Confira os dados ou tente outro cartão.');
      } else {
        // Guarda (ou limpa) os dados do titular para a próxima compra.
        try {
          if (salvarDados) localStorage.setItem(TITULAR_KEY, JSON.stringify({ nome, cpf }));
          else localStorage.removeItem(TITULAR_KEY);
        } catch { /* localStorage indisponível: ignora */ }
        onAprovado();
      }
    } catch (e: any) {
      setErro(e?.error_description ?? e?.message ?? 'Não foi possível processar o cartão. Tente novamente.');
    }
    setProcessando(false);
  };

  const marcar = (k: string) => setTocado((t) => ({ ...t, [k]: true }));
  const invalido = (k: string, ok: boolean) => tocado[k] && !ok;
  const campoCls = (k: string, ok: boolean) =>
    `w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none transition-colors dark:bg-gray-800 dark:text-gray-100 ${
      invalido(k, ok)
        ? 'border-red-400 focus:border-red-500 dark:border-red-500/60'
        : 'border-gray-200 focus:border-[var(--cor-primaria)] dark:border-gray-700'
    }${!invalido(k, ok) && k === proximo ? ' campo-próximo' : ''}`;
  const rotuloCls = 'mb-0.5 block text-xs opacity-95 font-semibold text-gray-500 dark:text-gray-400';

  // Portal no body: garante que o fixed se refira à janela mesmo com
  // ancestral transformado (ex.: animação de transição de tela).
  return createPortal(
    <div className="fade fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-4">
      {/* Modal centralizado; header e botão de pagar ficam FIXOS
          e o miolo rola sozinho — o botão nunca some da tela. */}
      <div className="pop flex max-h-[92dvh] w-full max-w-[420px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-gray-900 sm:max-h-[90dvh]">

        {/* Cabeçalho fixo */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3.5 dark:border-gray-800">
          <div className="flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-gray-100">
            <Lock size={15} className="text-emerald-500" /> Pagamento seguro
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black" style={{ color: 'var(--cor-primaria-texto)' }}>{fmt(info.total)}</span>
            <button onClick={onFechar} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
          </div>
        </div>

        {/* Corpo rolável — min-h-0 é obrigatório: sem ele o flex item não encolhe
            e empurra o rodapé (botão de pagar) para fora da tela. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {/* Mini-cartão compacto que reage ao que é digitado (flip no CVV) */}
          <div className="mb-3 [perspective:1000px]">
            <div className={`relative h-36 w-full transition-transform duration-500 [transform-style:preserve-3d] ${verso ? '[transform:rotateY(180deg)]' : ''}`}>
              {/* Frente */}
              <div className="absolute inset-0 flex flex-col justify-between overflow-hidden rounded-xl p-4 text-white shadow-lg [backface-visibility:hidden]"
                style={{ background: 'linear-gradient(135deg, var(--cor-primaria) 0%, rgba(17,17,17,0.92) 100%)' }}>
                <div className="flex items-start justify-between">
                  <div className="h-7 w-10 rounded bg-gradient-to-br from-yellow-200 to-yellow-400 shadow-inner" />
                  {bandeira ? <BandeiraMark id={bandeira.id} className="h-7 w-auto" /> : <CreditCard size={22} className="opacity-70" />}
                </div>
                <div className="font-mono text-[15px] tracking-[0.12em]">{numeroDisplay}</div>
                <div className="flex items-end justify-between gap-2 text-xs opacity-95">
                  <span className="truncate font-semibold uppercase">{nome || 'SEU NOME'}</span>
                  <span className="font-mono font-semibold">{validade || 'MM/AA'}</span>
                </div>
              </div>
              {/* Verso */}
              <div className="absolute inset-0 overflow-hidden rounded-xl bg-gray-800 text-white shadow-lg [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <div className="mt-4 h-8 w-full bg-black/80" />
                <div className="flex items-center gap-2 px-4 pt-3">
                  <div className="flex h-8 flex-1 items-center rounded bg-gray-200 px-3 font-mono text-sm tracking-widest text-gray-800">
                    <span className="ml-auto">{cvv || '•••'}</span>
                  </div>
                </div>
                <p className="px-4 pt-1.5 text-right text-xs opacity-90 opacity-70">CVV</p>
              </div>
            </div>
          </div>

          {/* Formulário compacto */}
          <div className="space-y-2.5">
            <label className="block">
              <span className={rotuloCls}>{tDynamic('Número do cartão')}</span>
              <div className="relative">
                <input ref={numeroRef} value={numero}
                  onChange={(e) => {
                    const v = maskCartaoCredito(e.target.value);
                    setNumero(v);
                    const d = v.replace(/\D/g, '');
                    // Número completo → avança sozinho para o nome
                    if (d.length >= (detectarBandeira(d)?.id === 'amex' ? 15 : 16)) nomeRef.current?.focus();
                  }}
                  onBlur={() => marcar('numero')}
                  inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000"
                  className={campoCls('numero', okNumero) + ' pr-16 font-mono tracking-wide'} />
                <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                  {okNumero && <Check size={15} className="text-emerald-500" />}
                  {bandeira && <BandeiraMark id={bandeira.id} className="h-5 w-auto shadow-sm" />}
                </div>
              </div>
            </label>

            <label className="block">
              <span className={rotuloCls}>{tDynamic('Nome impresso no cartão')}</span>
              <input ref={nomeRef} value={nome} onChange={(e) => setNome(e.target.value.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').toUpperCase())} onBlur={() => marcar('nome')}
                onKeyDown={(e) => { if (e.key === 'Enter' && okNome) validadeRef.current?.focus(); }}
                autoComplete="cc-name" placeholder="COMO ESTÁ NO CARTÃO" className={campoCls('nome', okNome)} />
            </label>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="block">
                <span className={rotuloCls}>Validade</span>
                <input ref={validadeRef} value={validade}
                  onChange={(e) => {
                    const v = maskValidadeCartao(e.target.value);
                    setValidade(v);
                    if (v.length === 5) cvvRef.current?.focus(); // MM/AA completo → CVV
                  }}
                  onBlur={() => marcar('validade')}
                  inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" className={campoCls('validade', validadeOk)} />
              </label>
              <label className="block">
                <span className={rotuloCls}>CVV</span>
                <input ref={cvvRef} value={cvv}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setCvv(v);
                    if (v.length >= (bandeira?.id === 'amex' ? 4 : 3)) cpfRef.current?.focus(); // CVV completo → CPF
                  }}
                  onFocus={() => setVerso(true)} onBlur={() => { setVerso(false); marcar('cvv'); }}
                  inputMode="numeric" autoComplete="cc-csc" placeholder="000" className={campoCls('cvv', okCvv)} />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="block">
                <span className={rotuloCls}>CPF do titular</span>
                <input ref={cpfRef} value={cpf}
                  onChange={(e) => {
                    const v = maskCPF(e.target.value);
                    setCpf(v);
                    if (v.length === 14 && validarCPF(v)) pagarRef.current?.focus(); // CPF completo → botão pagar
                  }}
                  onBlur={() => marcar('cpf')}
                  inputMode="numeric" placeholder="000.000.000-00" className={campoCls('cpf', okCpf)} />
              </label>
              <label className="block">
                <span className={rotuloCls}>Parcelamento</span>
                <select value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--cor-primaria)] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                  {[1, 2, 3].map((n) => (<option key={n} value={n}>{n}x de {fmt(info.total / n)}</option>))}
                </select>
              </label>
            </div>
          </div>

          {/* Salvar dados do titular — só nome e CPF, jamais número/CVV */}
          <label className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-xl border border-gray-200 px-3 py-2.5 dark:border-gray-700">
            <input type="checkbox" checked={salvarDados} onChange={(e) => setSalvarDados(e.target.checked)}
              className="h-4 w-4 shrink-0 accent-[var(--cor-primaria)]" />
            <span className="text-[12px] leading-tight text-gray-600 dark:text-gray-300">
              Salvar meu <b>nome e CPF</b> para a próxima compra
              <span className="block text-xs opacity-90 text-gray-400">{tDynamic('Nunca guardamos o número nem o CVV do cartão.')}</span>
            </span>
          </label>

          {/* Selos de confiança */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs opacity-90 text-gray-400">
            <span className="flex items-center gap-1"><Lock size={11} className="text-emerald-500" /> SSL</span>
            <span>·</span>
            <span className="flex items-center gap-1"><ShieldCheck size={11} className="text-emerald-500" /> Tokenizado (PCI)</span>
            <span>·</span>
            <span className="flex items-center gap-1">via <img src="/selo_efi_bank.png" alt="Efí Bank" className="h-3.5 w-auto" /></span>
          </div>
          <div className="mt-2 flex items-center justify-center gap-1.5 opacity-90">
            {BANDEIRAS_ACEITAS.map((b) => (
              <BandeiraMark key={b} id={b} className={`h-[18px] w-auto rounded-sm transition-opacity ${bandeira && bandeira.id !== b ? 'opacity-25' : 'opacity-100'}`} />
            ))}
          </div>
        </div>{/* fim do corpo rolável */}

        {/* Rodapé FIXO: erro + botão de pagar sempre visíveis, sem depender de scroll */}
        <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
          {erro && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
              <X size={15} className="mt-0.5 shrink-0" /> <span>{erro}</span>
            </div>
          )}
          <button ref={pagarRef} onClick={pagar} disabled={processando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3.5 text-[15px] font-black text-white shadow-lg shadow-[var(--cor-primaria)]/30 transition-all hover:brightness-110 focus-visible:ring-4 focus-visible:ring-[var(--cor-primaria)]/40 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50">
            {processando ? <><Loader2 size={17} className="animate-spin" /> Processando…</> : <><Lock size={15} /> Pagar {fmt(info.total)}</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

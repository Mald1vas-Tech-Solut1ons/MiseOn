import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { Search, MapPin, ArrowRight, ChevronLeft, Compass, Sparkles, LocateFixed, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import MiseOnLogo from '../components/MiseOnLogo';
import SEO from '../components/SEO';
import { PAGE_META } from '../data/pageMeta';
import { MiseOnLoader } from '../components/MiseOnLoader';
import type { FaixaEntrega } from '../types';
import { geocode, lojaAtendeDistancia, type LatLng } from '../lib/geo';
import { carregarLocalizacaoCliente, enderecoParaLabel, enderecoParaQuery, salvarLocalizacaoCliente } from '../lib/localizacao-cliente';
import { getOptimizedImageUrl } from '../lib/cdn';

import LanguageToggle from '../components/LanguageToggle';
import { useI18n } from '../contexts/I18nContext';

interface LojaResumo {
  id: string;
  slug: string;
  nome: string;
  descricao?: string;
  logo_url?: string;
  banner_url?: string;
  endereco?: string;
  cor_primaria: string;
  aceita_entrega?: boolean | null;
  lat?: number | null;
  lng?: number | null;
  entrega_modo?: 'BAIRRO' | 'DISTANCIA' | 'HIBRIDO' | null;
  entrega_taxa_base?: number | null;
  entrega_taxa_km?: number | null;
  entrega_raio_km?: number | null;
  entrega_taxa_padrao?: number | null;
}

export default function Lojas() {
  const { tDynamic } = useI18n();
  const [lojas, setLojas] = useState<LojaResumo[]>([]);
  const [faixasEntrega, setFaixasEntrega] = useState<FaixaEntrega[]>([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [ultimaLojaSlug, setUltimaLojaSlug] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [localizacaoCliente, setLocalizacaoCliente] = useState<LatLng | null>(null);
  const [labelLocalizacao, setLabelLocalizacao] = useState('');
  const [localizando, setLocalizando] = useState(false);
  const [tentouDescobrir, setTentouDescobrir] = useState(false);

  useEffect(() => {
    setUltimaLojaSlug(localStorage.getItem('miseon_ultima_loja'));
    const salva = carregarLocalizacaoCliente();
    if (salva) {
      setLocalizacaoCliente({ lat: salva.lat, lng: salva.lng });
      setLabelLocalizacao(salva.label ?? '');
    }
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    const onLocalizacao = (event: Event) => {
      const payload = (event as CustomEvent).detail;
      if (payload?.lat && payload?.lng) {
        setLocalizacaoCliente({ lat: payload.lat, lng: payload.lng });
        setLabelLocalizacao(payload.label ?? '');
      }
    };
    window.addEventListener('miseon:localizacao-cliente', onLocalizacao as EventListener);
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener('miseon:localizacao-cliente', onLocalizacao as EventListener);
    };
  }, []);

  useEffect(() => {
    (async () => {
      const [{ data }, { data: faixas }] = await Promise.all([
        supabase
        .from('lojas_publicas')
        .select('id, slug, nome, descricao, logo_url, banner_url, endereco, cor_primaria, aceita_entrega, lat, lng, entrega_modo, entrega_taxa_base, entrega_taxa_km, entrega_raio_km, entrega_taxa_padrao, frete_gratis_valor_minimo')
        .eq('ativo', true)
        .order('nome'),
        supabase.from('faixas_entrega').select('*').eq('ativo', true).order('ordem').order('km_ate'),
      ]);
      setLojas((data as LojaResumo[]) ?? []);
      setFaixasEntrega((faixas as FaixaEntrega[]) ?? []);
      setCarregando(false);
    })();
  }, []);

  useEffect(() => {
    if (!user || localizacaoCliente || tentouDescobrir) return;
    setTentouDescobrir(true);
    (async () => {
      const { data: clientes } = await supabase
        .from('clientes')
        .select('id')
        .eq('user_id', user.id)
        .limit(20);

      const ids = (clientes ?? []).map((c) => c.id);
      if (!ids.length) return;

      const { data: enderecos } = await supabase
        .from('enderecos_cliente')
        .select('cep, logradouro, numero, bairro, cidade, uf, padrao')
        .in('cliente_id', ids)
        .order('padrao', { ascending: false })
        .limit(10);

      const preferido = enderecos?.[0];
      if (!preferido) return;

      const query = enderecoParaQuery(preferido);
      const geo = await geocode(query);
      if (!geo) return;

      const label = enderecoParaLabel(preferido);
      salvarLocalizacaoCliente({ origem: 'endereco', lat: geo.lat, lng: geo.lng, label });
      setLocalizacaoCliente(geo);
      setLabelLocalizacao(label);
    })();
  }, [user, localizacaoCliente, tentouDescobrir]);

  const usarLocalizacaoAtual = () => {
    if (!navigator.geolocation) return;
    setLocalizando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const geo = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        salvarLocalizacaoCliente({ origem: 'gps', ...geo, label: 'Sua localização atual' });
        setLocalizacaoCliente(geo);
        setLabelLocalizacao('Sua localização atual');
        setLocalizando(false);
      },
      () => setLocalizando(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const visiveis = lojas.filter((l) => !busca || l.nome.toLowerCase().includes(busca.toLowerCase()));
  const ultimaLoja = useMemo(() => lojas.find((l) => l.slug === ultimaLojaSlug) ?? null, [lojas, ultimaLojaSlug]);
  const lojasElegiveis = useMemo(() => {
    const cards = visiveis.map((loja) => {
      const faixas = faixasEntrega.filter((f) => f.loja_id === loja.id);
      const precisaFiltro = user && localizacaoCliente && loja.aceita_entrega !== false && (loja.entrega_modo === 'DISTANCIA' || loja.entrega_modo === 'HIBRIDO') && loja.lat != null && loja.lng != null;
      const cobertura = precisaFiltro ? lojaAtendeDistancia(loja, localizacaoCliente, faixas) : null;
      return {
        ...loja,
        distanciaKm: cobertura?.distanciaKm ?? null,
        taxaEntrega: cobertura?.taxa ?? null,
        faixaNome: cobertura?.faixa?.nome ?? null,
        elegivel: cobertura ? cobertura.atende : true,
      };
    });
    return cards.filter((loja) => loja.elegivel);
  }, [visiveis, faixasEntrega, user, localizacaoCliente]);
  const qtdOcultas = visiveis.length - lojasElegiveis.length;

  return (
    <div style={{ background: '#070C18', color: '#EAF1FB', fontFamily: "'Inter', sans-serif" }} className="min-h-screen">
      <SEO {...PAGE_META['/lojas']} />
      {/* Glow */}
      <div style={{ background: 'radial-gradient(circle, rgba(252,91,36,0.20) 0%, transparent 70%)', width: 500, height: 500, borderRadius: '50%', position: 'absolute', top: -180, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }} />

      <div className="relative z-10 mx-auto max-w-2xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" style={{ color: 'rgba(234,241,251,0.6)' }} className="flex items-center gap-1 text-sm font-medium transition hover:text-white">
            <ChevronLeft size={16} /> Início
          </Link>
          <div className="flex items-center gap-3">
            <LanguageToggle variant="minimal" />
            <Link to="/"><MiseOnLogo size={110} /></Link>
          </div>
        </div>

        <h1 style={{ fontFamily: "'Sora', sans-serif" }} className="text-3xl font-extrabold tracking-tight">{tDynamic('Lojas na MiseOn')}</h1>
        <p style={{ color: 'rgba(234,241,251,0.6)' }} className="mt-1 mb-5 text-sm">{tDynamic('Escolha uma loja e peça direto pelo cardápio, sem app.')}</p>

        <div
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}
          className="mb-5 rounded-2xl p-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#FC5B24]">{tDynamic('Cobertura inteligente de entrega')}</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {user
                  ? (localizacaoCliente ? tDynamic('Mostrando restaurantes que atendem sua localização') : tDynamic('Ative sua localização para filtrar restaurantes por raio de entrega'))
                  : tDynamic('Faça login para filtrar automaticamente restaurantes que atendem sua região')}
              </p>
              {labelLocalizacao && (
                <p className="mt-1 text-xs" style={{ color: 'rgba(234,241,251,0.6)' }}>
                  Base atual: {labelLocalizacao}
                </p>
              )}
              {qtdOcultas > 0 && (
                <p className="mt-1 text-xs text-emerald-400">
                  {qtdOcultas} loja(s) fora do seu raio foram ocultadas para evitar pedido inviável.
                </p>
              )}
            </div>
            <button
              onClick={usarLocalizacaoAtual}
              disabled={localizando}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#FC5B24]/40 bg-[#FC5B24]/10 px-4 py-3 text-sm font-semibold text-[#FC5B24] transition hover:bg-[#FC5B24]/20 disabled:opacity-60"
            >
              {localizando ? <Loader2 size={16} className="animate-spin" /> : <LocateFixed size={16} />}
              Usar minha localização
            </button>
          </div>
        </div>

        {ultimaLoja && (
          <Link
            to={`/${ultimaLoja.slug}`}
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}
            className="mb-5 flex items-center justify-between gap-4 rounded-2xl p-4 transition hover:-translate-y-0.5 hover:border-white/20"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-lg" style={{ background: ultimaLoja.cor_primaria }}>
                <Compass size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#FC5B24]">Ultimo restaurante visitado</p>
                <p className="font-bold text-white">{ultimaLoja.nome}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-white">
              Retomar <ArrowRight size={15} />
            </span>
          </Link>
        )}

        {/* Busca */}
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          className="mb-5 flex items-center gap-2 rounded-2xl px-4 py-3 transition-all duration-300 focus-within:border-[#FC5B24]/50 focus-within:shadow-[0_0_0_4px_rgba(252,91,36,0.10)]">
          <Search size={18} style={{ color: 'rgba(234,241,251,0.5)' }} className="transition-colors group-focus-within:text-[#FC5B24]" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar loja…"
            style={{ color: '#EAF1FB' }}
            className="w-full bg-transparent text-sm outline-none placeholder:text-[rgba(234,241,251,0.4)]" />
        </div>

        {carregando ? (
          <div className="py-10"><MiseOnLoader status="Buscando lojas na sua região" rows={3} /></div>
        ) : (
          <div className="space-y-3">
            {lojasElegiveis.map((l, i) => (
              <Link key={l.slug} to={`/${l.slug}`}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  ['--glow' as string]: `${l.cor_primaria || '#FC5B24'}55`,
                  animationDelay: `${i * 70}ms`,
                }}
                className="group relative flex items-center gap-4 overflow-hidden rounded-2xl p-4 transition-all duration-300 ease-out
                           animate-in fade-in slide-in-from-bottom-3 fill-mode-both
                           hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.06]
                           hover:shadow-[0_18px_50px_-14px_var(--glow)]">
                {/* barra de cor da loja que cresce no hover */}
                <span aria-hidden className="absolute left-0 top-0 h-full w-1 origin-top scale-y-0 transition-transform duration-300 group-hover:scale-y-100"
                  style={{ background: l.cor_primaria }} />
                {/* wash sutil na cor da loja */}
                {l.logo_url
                  ? <img src={getOptimizedImageUrl(l.logo_url)} className="h-16 w-16 shrink-0 rounded-xl object-cover shadow-lg transition-transform duration-300 group-hover:scale-105" alt="" />
                  : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-2xl font-black text-white shadow-lg transition-transform duration-300 group-hover:scale-105" style={{ background: l.cor_primaria }}>
                      {(l.nome || '').trim()[0]?.toUpperCase()}
                    </div>}
                <div className="relative z-10 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p style={{ fontFamily: "'Sora', sans-serif" }} className="truncate text-base font-bold text-white">{l.nome}</p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                      <Sparkles size={10} /> Operante
                    </span>
                    {l.distanciaKm != null && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/70">
                        <MapPin size={10} /> {l.distanciaKm} km
                      </span>
                    )}
                  </div>
                  {l.descricao && <p className="truncate text-xs" style={{ color: 'rgba(234,241,251,0.6)' }}>{l.descricao}</p>}
                  {l.endereco && <p className="mt-1 flex items-center gap-1 truncate text-xs" style={{ color: 'rgba(234,241,251,0.45)' }}><MapPin size={11} /> {l.endereco}</p>}
                  {(l.faixaNome || l.taxaEntrega != null) && (
                    <p className="mt-1 text-[11px] font-semibold" style={{ color: 'rgba(234,241,251,0.62)' }}>
                      {l.faixaNome ? `${l.faixaNome} · ` : ''}{l.taxaEntrega != null ? `Entrega a partir de R$ ${Number(l.taxaEntrega).toFixed(2).replace('.', ',')}` : ''}
                    </p>
                  )}
                </div>
                <ArrowRight size={18} style={{ color: 'rgba(234,241,251,0.4)' }} className="relative z-10 shrink-0 transition-all duration-300 group-hover:translate-x-1 group-hover:text-white" />
              </Link>
            ))}
            {lojasElegiveis.length === 0 && <p className="py-16 text-center text-sm" style={{ color: 'rgba(234,241,251,0.5)' }}>Nenhuma loja encontrada para sua busca ou cobertura atual.</p>}
          </div>
        )}

        <Link to="/cadastre-se"
          style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(234,241,251,0.75)' }}
          className="group relative mt-8 flex items-center justify-center gap-2 overflow-hidden rounded-2xl py-4 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:border-[#FC5B24]/60 hover:shadow-[0_10px_40px_-8px_rgba(252,91,36,0.45)]">
          {/* brilho passando */}
          <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
          {/* wash de cor no hover */}
          <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{ background: 'linear-gradient(135deg, rgba(252,91,36,0.16), rgba(10,92,196,0.16))' }} />
          <span className="relative z-10 flex items-center gap-2 transition-colors duration-300 group-hover:text-white">
            Tem uma loja? <b className="font-extrabold" style={{ fontFamily: "'Sora', sans-serif" }}>Cadastre aqui</b>
            <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </Link>
      </div>
    </div>
  );
}

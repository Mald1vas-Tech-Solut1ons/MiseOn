/**
 * PERFIL DA LOJA — o link da bio.
 *
 * ─── POR QUE ESTA PÁGINA EXISTE ────────────────────────────────────────────
 * O restaurante tem UM link no Instagram. Hoje esse link vai para o sistema do
 * concorrente, que entrega uma lista de produtos e nada mais: quem chega pelo
 * perfil e ainda não quer pedir — está só conhecendo — cai numa vitrine de
 * preços, não acha endereço, não acha horário, não acha o WhatsApp, e sai.
 *
 * Este é o destino que devolve as duas coisas: informação para quem está
 * decidindo e um caminho curto para quem já decidiu. É a página que o lojista
 * cola na bio, no Google, no cartão, no adesivo da porta.
 *
 * ─── REGRA DE CONTEÚDO ─────────────────────────────────────────────────────
 * Nada é inventado. Todo bloco vem do que a loja já cadastrou e SOME quando o
 * dado não existe — página com campo vazio comunica desleixo, e desleixo na
 * página é desleixo percebido na comida.
 *
 * ─── SEO ───────────────────────────────────────────────────────────────────
 * Sai com LocalBusiness/Restaurant em JSON-LD, com endereço, coordenadas,
 * horário e faixa de preço. É o que faz a loja aparecer na busca por nome e no
 * mapa — presença digital que o cardápio sozinho não constrói.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  MapPin, Clock, ShoppingBag, MessageCircle, Instagram, Facebook, Music2,
  Bike, Wallet, ChevronRight,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fmt, type Loja, type HorarioFuncionamento } from '../types';
import { getOptimizedImageUrl } from '../lib/cdn';
import { urlDaRede, arrobaDaRede, type RedeSocial } from '../lib/redesSociais';
import { fonteFamilia, isLightColor, obterFundoLojaPorTema, obterTokensLoja, corLegivelSobre } from '../lib/personalizacao';
import { useI18n } from '../contexts/I18nContext';
import SEO from '../components/SEO';
import MiseOnLoader from '../components/MiseOnLoader';

const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const DIAS_SCHEMA = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function PerfilLoja() {
  const { slug } = useParams();
  const { tDynamic } = useI18n();
  const [loja, setLoja] = useState<Loja | null>(null);
  const [horarios, setHorarios] = useState<HorarioFuncionamento[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: l } = await supabase.from('lojas_publicas').select('*').eq('slug', slug).single();
      if (l) {
        setLoja(l as Loja);
        const { data: h } = await supabase
          .from('horarios_funcionamento').select('*').eq('loja_id', (l as Loja).id).order('dia_semana');
        setHorarios((h as HorarioFuncionamento[]) ?? []);
      }
      setCarregando(false);
    })();
  }, [slug]);

  // Mesma personalização da vitrine: a página é da LOJA, não do MiseOn.
  useEffect(() => {
    if (!loja) return;
    const raiz = document.documentElement;
    const tema = (loja.tema_cardapio ?? 'CLARO') as never;
    const fundo = obterFundoLojaPorTema(tema, loja);
    const tokens = obterTokensLoja(fundo, tema, loja.cor_primaria);
    raiz.style.setProperty('--cor-primaria', loja.cor_primaria);
    raiz.style.setProperty('--cor-primaria-texto', corLegivelSobre(loja.cor_primaria || '#FC5B24', fundo));
    raiz.style.setProperty('--cor-texto', tokens.texto);
    raiz.style.setProperty('--cor-texto-suave', tokens.textoSuave);
    raiz.style.setProperty('--cor-texto-fraco', tokens.textoFraco);
    raiz.style.setProperty('--cor-fundo', fundo);
    raiz.style.setProperty('--cor-surface', tokens.surface);
    raiz.style.setProperty('--cor-borda', tokens.border);
    raiz.style.setProperty('--fonte-loja', fonteFamilia(loja.fonte));
  }, [loja]);

  const horarioDeHoje = useMemo(() => {
    const hoje = new Date().getDay();
    const linhas = horarios.filter((h) => h.dia_semana === hoje);
    if (!linhas.length) return null;
    return linhas.map((h) => `${h.abre.slice(0, 5)} às ${h.fecha.slice(0, 5)}`).join(' e ');
  }, [horarios]);

  const redes = useMemo(() => {
    if (!loja) return [];
    const lista: { rede: RedeSocial; valor?: string | null; Icone: typeof Instagram; rotulo: string }[] = [
      { rede: 'instagram', valor: loja.instagram, Icone: Instagram, rotulo: 'Instagram' },
      { rede: 'tiktok', valor: loja.tiktok, Icone: Music2, rotulo: 'TikTok' },
      { rede: 'facebook', valor: loja.facebook, Icone: Facebook, rotulo: 'Facebook' },
    ];
    return lista
      .map((r) => ({ ...r, url: urlDaRede(r.rede, r.valor), arroba: arrobaDaRede(r.rede, r.valor) }))
      .filter((r) => r.url);
  }, [loja]);

  if (carregando) return <MiseOnLoader status="Carregando perfil..." rows={2} />;
  if (!loja) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-sm font-semibold text-gray-500">{tDynamic('Loja não encontrada.')}</p>
      </div>
    );
  }

  const iniciais = (loja.nome || '?').trim()[0].toUpperCase();
  const whatsappDigitos = String(loja.whatsapp ?? '').replace(/\D/g, '');

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: loja.nome,
    description: loja.descricao || `Cardápio digital e pedidos online de ${loja.nome}.`,
    image: getOptimizedImageUrl(loja.logo_url || loja.banner_url || ''),
    url: `https://miseon.app.br/${loja.slug}/perfil`,
    menu: `https://miseon.app.br/${loja.slug}`,
    telephone: loja.whatsapp || loja.telefone || undefined,
    priceRange: 'R$',
    address: { '@type': 'PostalAddress', streetAddress: loja.endereco || 'Brasil', addressCountry: 'BR' },
    geo: loja.lat && loja.lng ? { '@type': 'GeoCoordinates', latitude: loja.lat, longitude: loja.lng } : undefined,
    sameAs: redes.map((r) => r.url),
    openingHoursSpecification: horarios.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: `https://schema.org/${DIAS_SCHEMA[h.dia_semana]}`,
      opens: h.abre.slice(0, 5),
      closes: h.fecha.slice(0, 5),
    })),
  };

  const Bloco = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
    <section className="rounded-3xl border p-5" style={{ borderColor: 'var(--cor-borda)', background: 'var(--cor-surface)' }}>
      <p className="mb-3 text-xs font-black uppercase tracking-wide" style={{ color: 'var(--cor-texto-fraco)' }}>{titulo}</p>
      {children}
    </section>
  );

  return (
    <div className="loja-marca vitrine-papel min-h-screen pb-16" style={{ background: 'var(--cor-fundo)', fontFamily: 'var(--fonte-loja)' }}>
      <SEO
        title={`${loja.nome} — Perfil, horários e pedidos online`}
        description={loja.descricao || `Endereço, horários, formas de pagamento e cardápio digital de ${loja.nome}. Peça online, sem instalar aplicativo.`}
        canonicalUrl={`https://miseon.app.br/${loja.slug}/perfil`}
        ogImage={getOptimizedImageUrl(loja.logo_url || loja.banner_url || 'https://miseon.app.br/icon-512.png')}
        schemaJson={schema}
        metaPixelId={loja.meta_pixel_id}
        ga4MeasurementId={loja.ga4_measurement_id}
        geoPlacename={loja.endereco}
        geoPosition={loja.lat && loja.lng ? `${loja.lat};${loja.lng}` : undefined}
      />

      {/* Capa + identidade */}
      <header className="relative">
        {loja.banner_url ? (
          <img
            src={getOptimizedImageUrl(loja.banner_url)}
            alt=""
            className="h-40 w-full object-cover sm:h-56"
            style={{ objectPosition: `50% ${loja.banner_pos_y ?? 50}%` }}
          />
        ) : (
          <div className="h-28 w-full sm:h-36" style={{ background: `linear-gradient(135deg, ${loja.cor_primaria}, ${loja.cor_secundaria || loja.cor_primaria})` }} />
        )}

        <div className="mx-auto -mt-12 max-w-2xl px-4">
          <div className="flex flex-col items-center text-center">
            {loja.logo_url
              ? <img src={getOptimizedImageUrl(loja.logo_url)} alt={loja.nome}
                  className="h-24 w-24 rounded-3xl border-4 object-cover shadow-xl"
                  style={{ borderColor: 'var(--cor-fundo)' }} />
              : <div className="flex h-24 w-24 items-center justify-center rounded-3xl border-4 text-3xl font-black shadow-xl"
                  style={{ borderColor: 'var(--cor-fundo)', background: loja.cor_primaria, color: isLightColor(loja.cor_primaria) ? '#111827' : '#fff' }}>
                  {iniciais}
                </div>}

            <h1 className="mt-3 text-2xl font-black" style={{ color: 'var(--cor-texto)' }}>{loja.nome}</h1>
            {loja.descricao && (
              <p className="mt-1.5 max-w-lg text-sm leading-relaxed" style={{ color: 'var(--cor-texto-suave)' }}>{loja.descricao}</p>
            )}

            {horarioDeHoje && (
              <p className="mt-2.5 flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--cor-texto-suave)' }}>
                <Clock size={13} /> {tDynamic('Hoje')}: {horarioDeHoje}
              </p>
            )}

            {redes.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {redes.map(({ rede, url, arroba, Icone, rotulo }) => (
                  <a key={rede} href={url!} target="_blank" rel="noopener noreferrer nofollow"
                    aria-label={`${rotulo}: ${arroba ?? ''}`}
                    className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition hover:brightness-95"
                    style={{ borderColor: 'var(--cor-borda)', color: 'var(--cor-texto)' }}>
                    <Icone size={14} /> {arroba ?? rotulo}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto mt-7 grid max-w-2xl gap-4 px-4">
        {/* A ação que a página existe para provocar */}
        <Link
          to={`/${loja.slug}`}
          className="flex items-center justify-between rounded-3xl px-6 py-5 font-black text-white shadow-lg transition hover:brightness-110"
          style={{ background: loja.cor_primaria }}
        >
          <span className="flex items-center gap-2.5 text-base">
            <ShoppingBag size={20} /> {tDynamic('Ver cardápio e pedir')}
          </span>
          <ChevronRight size={20} />
        </Link>

        {whatsappDigitos && (
          <a
            href={`https://wa.me/55${whatsappDigitos}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between rounded-3xl border px-6 py-4 font-bold transition hover:brightness-95"
            style={{ borderColor: 'var(--cor-borda)', background: 'var(--cor-surface)', color: 'var(--cor-texto)' }}
          >
            <span className="flex items-center gap-2.5 text-sm"><MessageCircle size={18} /> {tDynamic('Falar no WhatsApp')}</span>
            <ChevronRight size={18} style={{ color: 'var(--cor-texto-fraco)' }} />
          </a>
        )}

        {loja.endereco && (
          <Bloco titulo={tDynamic('Onde estamos')}>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--cor-texto-suave)' }}>{loja.endereco}</p>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loja.endereco)}`}
              target="_blank" rel="noopener noreferrer"
              className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-bold"
              style={{ color: 'var(--cor-primaria-texto)' }}
            >
              <MapPin size={15} /> {tDynamic('Abrir no mapa')}
            </a>
          </Bloco>
        )}

        {horarios.length > 0 && (
          <Bloco titulo={tDynamic('Horários')}>
            <ul className="space-y-1.5">
              {DIAS.map((nomeDia, dia) => {
                const doDia = horarios.filter((h) => h.dia_semana === dia);
                const hoje = new Date().getDay() === dia;
                return (
                  <li key={dia} className="flex items-baseline justify-between gap-3 text-sm"
                    style={{ color: hoje ? 'var(--cor-texto)' : 'var(--cor-texto-suave)', fontWeight: hoje ? 700 : 400 }}>
                    <span>{tDynamic(nomeDia)}</span>
                    <span className="tabular-nums">
                      {doDia.length === 0
                        ? tDynamic('Fechado')
                        : doDia.map((h) => `${h.abre.slice(0, 5)}–${h.fecha.slice(0, 5)}`).join(' · ')}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Bloco>
        )}

        <Bloco titulo={tDynamic('Pagamento e entrega')}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold" style={{ borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-suave)' }}><Wallet size={12} /> Pix</span>
            <span className="rounded-lg border px-2.5 py-1 text-xs font-bold" style={{ borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-suave)' }}>{tDynamic('Dinheiro')}</span>
            {loja.efi_configurado && (
              <span className="rounded-lg border px-2.5 py-1 text-xs font-bold" style={{ borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-suave)' }}>{tDynamic('Cartão')}</span>
            )}
          </div>
          <ul className="mt-3 space-y-1.5 text-sm" style={{ color: 'var(--cor-texto-suave)' }}>
            {loja.pedido_minimo > 0 && <li>{tDynamic('Pedido mínimo')} {fmt(loja.pedido_minimo)}</li>}
            {(loja.meta_preparo_min ?? 0) > 0 && <li>{tDynamic('Preparo em cerca de')} {loja.meta_preparo_min} min</li>}
            {loja.aceita_entrega && (
              <li className="flex items-center gap-1.5">
                <Bike size={14} />
                {Number(loja.entrega_taxa_padrao ?? 0) > 0
                  ? `${tDynamic('Entrega')} ${fmt(Number(loja.entrega_taxa_padrao))}`
                  : tDynamic('Entrega grátis')}
                {Number(loja.entrega_raio_km ?? 0) > 0 && ` · ${tDynamic('até')} ${loja.entrega_raio_km} km`}
              </li>
            )}
            {Number(loja.cashback_pct ?? 0) > 0 && (
              <li>{loja.cashback_pct}% {tDynamic('de cashback em toda compra')}</li>
            )}
          </ul>
        </Bloco>

        <a
          href="https://miseon.app.br"
          target="_blank" rel="noopener noreferrer"
          className="mt-2 text-center text-[11px] font-semibold"
          style={{ color: 'var(--cor-texto-fraco)' }}
        >
          {tDynamic('Cardápio digital por')} <span className="font-black" style={{ color: 'var(--cor-primaria-texto)' }}>MiseOn</span>
        </a>
      </main>
    </div>
  );
}

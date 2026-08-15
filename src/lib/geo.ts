// Geolocalização e cálculo de taxa de entrega por distância.
// Tudo é tolerante a falha: geocoding externo pode cair, então quem chama
// deve ter fallback (bairro → taxa padrão). Nada aqui lança exceção pra fora.

export interface LatLng { lat: number; lng: number; }

const RAD = Math.PI / 180;

/** Distância em km entre dois pontos (fórmula de Haversine). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Geocodifica um endereço (Brasil) via Nominatim/OpenStreetMap.
 * Retorna null em qualquer falha (timeout, sem resultado, rede).
 */
export async function geocode(query: string): Promise<LatLng | null> {
  if (!query || query.trim().length < 5) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const url =
      'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=' +
      encodeURIComponent(query);
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'Accept-Language': 'pt-BR' } });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    const hit = Array.isArray(data) ? data[0] : null;
    if (!hit?.lat || !hit?.lon) return null;
    const lat = parseFloat(hit.lat);
    const lng = parseFloat(hit.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

/** Normaliza texto (sem acento/caixa) para comparar bairros com robustez. */
export const normaliza = (s?: string) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export interface ConfigEntrega {
  entrega_modo?: string | null;
  lat?: number | null;
  lng?: number | null;
  entrega_taxa_base?: number | null;
  entrega_taxa_km?: number | null;
  entrega_raio_km?: number | null;
  entrega_taxa_padrao?: number | null;
  frete_gratis_valor_minimo?: number | null;
}

export interface FaixaEntregaCalculo {
  id?: string;
  nome?: string | null;
  km_ate: number;
  taxa_fixa?: number | null;
  taxa_por_km?: number | null;
  pedido_minimo?: number | null;
  ordem?: number | null;
  ativo?: boolean | null;
}

export interface ResultadoEntrega {
  taxa: number;
  distanciaKm: number | null;
  foraDeArea: boolean;
  origem: 'DISTANCIA' | 'BAIRRO' | 'PADRAO' | 'NENHUM';
  geo: LatLng | null;
  faixaId?: string | null;
  faixaNome?: string | null;
  raioConsideradoKm?: number | null;
  freteGratis?: boolean;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Taxa a partir da distância: base + (km × por_km); bloqueia acima do raio; isenta se subtotal atingir frete grátis. */
export function taxaDaDistancia(
  loja: ConfigEntrega,
  distanciaKm: number,
  subtotal: number = 0,
): { taxa: number; fora: boolean; freteGratis: boolean } {
  const base = Number(loja.entrega_taxa_base ?? 0);
  const perKm = Number(loja.entrega_taxa_km ?? 0);
  const raio = loja.entrega_raio_km != null ? Number(loja.entrega_raio_km) : null;
  const fora = raio != null && distanciaKm > raio;

  const minFreteGratis = loja.frete_gratis_valor_minimo != null ? Number(loja.frete_gratis_valor_minimo) : 0;
  const freteGratis = minFreteGratis > 0 && subtotal >= minFreteGratis;

  const taxaFinal = freteGratis ? 0 : r2(base + perKm * distanciaKm);

  return { taxa: taxaFinal, fora, freteGratis };
}

export function obterRaioMaximo(loja: ConfigEntrega, faixasDistancia: FaixaEntregaCalculo[] = []) {
  const raioLoja = loja.entrega_raio_km != null ? Number(loja.entrega_raio_km) : null;
  const raioFaixas = faixasDistancia
    .filter((f) => f.ativo !== false)
    .map((f) => Number(f.km_ate))
    .filter((km) => Number.isFinite(km) && km > 0);

  const maiorFaixa = raioFaixas.length ? Math.max(...raioFaixas) : null;
  return raioLoja ?? maiorFaixa;
}

export function taxaPorFaixa(
  loja: ConfigEntrega,
  distanciaKm: number,
  faixasDistancia: FaixaEntregaCalculo[],
  subtotal: number = 0,
): { taxa: number; fora: boolean; faixa: FaixaEntregaCalculo | null; raio: number | null; freteGratis: boolean } {
  const minFreteGratis = loja.frete_gratis_valor_minimo != null ? Number(loja.frete_gratis_valor_minimo) : 0;
  const freteGratis = minFreteGratis > 0 && subtotal >= minFreteGratis;

  const faixasAtivas = [...faixasDistancia]
    .filter((f) => f.ativo !== false)
    .sort((a, b) => Number(a.km_ate) - Number(b.km_ate));

  const faixa = faixasAtivas.find((f) => distanciaKm <= Number(f.km_ate)) ?? null;
  const raio = obterRaioMaximo(loja, faixasAtivas);

  if (!faixa) {
    return { taxa: 0, fora: raio != null ? distanciaKm > raio : true, faixa: null, raio, freteGratis };
  }

  if (freteGratis) {
    return { taxa: 0, fora: raio != null ? distanciaKm > raio : false, faixa, raio, freteGratis: true };
  }

  const base = Number(loja.entrega_taxa_base ?? 0);
  const taxaFixa = faixa.taxa_fixa != null ? Number(faixa.taxa_fixa) : null;
  const taxaKm = faixa.taxa_por_km != null ? Number(faixa.taxa_por_km) : Number(loja.entrega_taxa_km ?? 0);
  const taxa = taxaFixa != null ? taxaFixa : r2(base + taxaKm * distanciaKm);

  return {
    taxa,
    fora: raio != null ? distanciaKm > raio : false,
    faixa,
    raio,
    freteGratis: false,
  };
}

export function lojaAtendeDistancia(
  loja: ConfigEntrega,
  geoCliente: LatLng,
  faixasDistancia: FaixaEntregaCalculo[] = [],
  subtotal: number = 0,
) {
  if (loja.lat == null || loja.lng == null) {
    return { atende: true, distanciaKm: null as number | null, taxa: 0, faixa: null as FaixaEntregaCalculo | null, raio: obterRaioMaximo(loja, faixasDistancia), freteGratis: false };
  }

  const distanciaKm = r2(haversineKm({ lat: Number(loja.lat), lng: Number(loja.lng) }, geoCliente));
  if (loja.entrega_modo === 'HIBRIDO' && faixasDistancia.some((f) => f.ativo !== false)) {
    const faixa = taxaPorFaixa(loja, distanciaKm, faixasDistancia, subtotal);
    return { atende: !faixa.fora, distanciaKm, taxa: faixa.taxa, faixa: faixa.faixa, raio: faixa.raio, freteGratis: faixa.freteGratis };
  }

  const linear = taxaDaDistancia(loja, distanciaKm, subtotal);
  return {
    atende: !linear.fora,
    distanciaKm,
    taxa: linear.taxa,
    faixa: null,
    raio: obterRaioMaximo(loja, faixasDistancia),
    freteGratis: linear.freteGratis,
  };
}

/**
 * Calcula a entrega com cálculo por distância como padrão principal:
 * `geoCliente` opcional evita geocodificar de novo (quem chama pode cachear).
 */
export async function calcularEntrega(
  loja: ConfigEntrega,
  params: {
    enderecoQuery?: string;
    geoCliente?: LatLng | null;
    bairro?: string;
    subtotal?: number;
    taxasBairro?: { bairro: string; valor: number | string }[];
    faixasDistancia?: FaixaEntregaCalculo[];
  },
): Promise<ResultadoEntrega> {
  const { enderecoQuery, bairro, subtotal = 0, taxasBairro = [], faixasDistancia = [] } = params;

  // 1) Distância (Regra Principal)
  if (loja.lat != null && loja.lng != null) {
    const geo = params.geoCliente ?? (enderecoQuery ? await geocode(enderecoQuery) : null);
    if (geo) {
      const distanciaKm = r2(haversineKm({ lat: Number(loja.lat), lng: Number(loja.lng) }, geo));
      if (loja.entrega_modo === 'HIBRIDO' && faixasDistancia.some((f) => f.ativo !== false)) {
        const faixa = taxaPorFaixa(loja, distanciaKm, faixasDistancia, subtotal);
        return {
          taxa: faixa.taxa,
          distanciaKm,
          foraDeArea: faixa.fora,
          origem: 'DISTANCIA',
          geo,
          faixaId: faixa.faixa?.id ?? null,
          faixaNome: faixa.faixa?.nome ?? null,
          raioConsideradoKm: faixa.raio,
          freteGratis: faixa.freteGratis,
        };
      }
      const { taxa, fora, freteGratis } = taxaDaDistancia(loja, distanciaKm, subtotal);
      return {
        taxa,
        distanciaKm,
        foraDeArea: fora,
        origem: 'DISTANCIA',
        geo,
        raioConsideradoKm: obterRaioMaximo(loja, faixasDistancia),
        freteGratis,
      };
    }
  }

  // 2) Bairro (Fallback de compatibilidade)
  if (bairro && taxasBairro.length > 0) {
    const hit = taxasBairro.find((t) => normaliza(t.bairro) === normaliza(bairro));
    if (hit) return { taxa: Number(hit.valor), distanciaKm: null, foraDeArea: false, origem: 'BAIRRO', geo: null };
  }

  // 3) Padrão
  const padrao = Number(loja.entrega_taxa_padrao ?? 0);
  return {
    taxa: padrao,
    distanciaKm: null,
    foraDeArea: false,
    origem: padrao > 0 ? 'PADRAO' : 'NENHUM',
    geo: null,
    raioConsideradoKm: obterRaioMaximo(loja, faixasDistancia),
  };
}

// Geolocalização e cálculo de taxa de entrega por distância.
// Geocoding externo pode falhar. Nesse caso, o checkout deve pedir que o
// endereço seja corrigido — nunca trocar localização real por uma tabela de
// bairros e cobrar outro frete.

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
  origem: 'DISTANCIA' | 'NAO_LOCALIZADO' | 'CONFIGURACAO_PENDENTE' | 'NENHUM';
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

  // Taxa única: o mesmo valor em qualquer distância até o raio.
  const bruta = loja.entrega_modo === 'FIXA' ? base : base + perKm * distanciaKm;
  const taxaFinal = freteGratis ? 0 : r2(bruta);

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
    return { atende: false, distanciaKm: null as number | null, taxa: 0, faixa: null as FaixaEntregaCalculo | null, raio: obterRaioMaximo(loja, faixasDistancia), freteGratis: false };
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
    subtotal?: number;
    faixasDistancia?: FaixaEntregaCalculo[];
  },
): Promise<ResultadoEntrega> {
  const { enderecoQuery, subtotal = 0, faixasDistancia = [] } = params;

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

  if (loja.lat == null || loja.lng == null) {
    return {
      taxa: 0,
      distanciaKm: null,
      foraDeArea: false,
      origem: 'CONFIGURACAO_PENDENTE',
      geo: null,
      raioConsideradoKm: obterRaioMaximo(loja, faixasDistancia),
    };
  }

  // O endereço existe, mas o serviço de geocodificação não conseguiu dar uma
  // posição confiável. Não há taxa honesta sem origem e destino.
  return {
    taxa: 0,
    distanciaKm: null,
    foraDeArea: false,
    origem: 'NAO_LOCALIZADO',
    geo: null,
    raioConsideradoKm: obterRaioMaximo(loja, faixasDistancia),
  };
}

export type ResumoEntrega =
  | { tipo: 'INDISPONIVEL' }
  | { tipo: 'GRATIS' }
  | { tipo: 'A_PARTIR_DE'; valor: number };

/**
 * O que a vitrine anuncia sobre a entrega, derivado da MESMA regra que cobra
 * (`calcularEntrega` aqui e `fn_entrega_regra` no servidor).
 *
 * Até 23/09/2026 o selo lia `entrega_taxa_padrao`, campo que o cálculo nem
 * usa: toda loja com ele zerado anunciava "Entrega grátis" enquanto o checkout
 * cobrava base + km. Promessa no topo do cardápio que o caixa não cumpre.
 *
 * - Sem localização da loja o servidor recusa entrega: não se anuncia nada.
 * - Faixas: o menor valor entre elas, medido no início de cada faixa.
 * - Faixas sem faixa ativa: indisponível (o servidor recusa).
 * - Por km e taxa única: o valor base (distância zero é o piso).
 */
export function resumoEntrega(
  loja: ConfigEntrega,
  faixasDistancia: FaixaEntregaCalculo[] = [],
): ResumoEntrega {
  if (loja.lat == null || loja.lng == null) return { tipo: 'INDISPONIVEL' };

  const base = Number(loja.entrega_taxa_base ?? 0);
  const porKm = Number(loja.entrega_taxa_km ?? 0);
  const faixas = faixasDistancia
    .filter((f) => f.ativo !== false && Number(f.km_ate) > 0)
    .sort((a, b) => Number(a.km_ate) - Number(b.km_ate));

  // Faixas sem nenhuma faixa ativa: o servidor recusa a entrega (fn_entrega_regra).
  if (loja.entrega_modo === 'HIBRIDO' && faixas.length === 0) return { tipo: 'INDISPONIVEL' };

  let minimo: number;
  if (loja.entrega_modo === 'HIBRIDO') {
    minimo = Math.min(...faixas.map((f, i) => {
      const inicioKm = i === 0 ? 0 : Number(faixas[i - 1].km_ate);
      return f.taxa_fixa != null
        ? Number(f.taxa_fixa)
        : base + Number(f.taxa_por_km ?? porKm) * inicioKm;
    }));
  } else {
    minimo = base;
  }

  minimo = r2(minimo);
  return minimo > 0 ? { tipo: 'A_PARTIR_DE', valor: minimo } : { tipo: 'GRATIS' };
}

export type MotivoRegra = 'SEM_ENTREGA' | 'ENTREGA_NAO_CONFIGURADA' | 'FORA_DA_AREA' | 'ABAIXO_DO_MINIMO_DA_FAIXA';

export interface ResultadoRegra {
  atende: boolean;
  motivo: MotivoRegra | null;
  taxa: number | null;
  raioKm: number | null;
  faixaNome: string | null;
  freteGratis: boolean;
  pedidoMinimo: number;
}

/**
 * Espelho de `fn_entrega_regra` (servidor) para o SIMULADOR da tela de
 * configuração: aplica a regra com os valores ainda não salvos sobre uma
 * distância medida pelo servidor. Quem cobra é sempre o servidor; os testes
 * em geo.test.ts repetem os casos de supabase/tests/entrega_regra_e_cotacao.sql
 * para as duas versões não divergirem.
 */
export function aplicarRegraEntrega(
  loja: ConfigEntrega & { aceita_entrega?: boolean | null },
  faixasDistancia: FaixaEntregaCalculo[],
  distanciaKm: number,
  subtotal = 0,
): ResultadoRegra {
  const vazio = { taxa: null, raioKm: null, faixaNome: null, freteGratis: false, pedidoMinimo: 0 };
  if (loja.aceita_entrega === false) return { atende: false, motivo: 'SEM_ENTREGA', ...vazio };
  if (loja.lat == null || loja.lng == null) return { atende: false, motivo: 'ENTREGA_NAO_CONFIGURADA', ...vazio };

  const dist = r2(distanciaKm);
  const base = Number(loja.entrega_taxa_base ?? 0);
  const porKm = Number(loja.entrega_taxa_km ?? 0);
  const minGratis = Number(loja.frete_gratis_valor_minimo ?? 0);
  const freteGratis = minGratis > 0 && subtotal >= minGratis;

  let taxa: number;
  let raio: number | null;
  let faixaNome: string | null = null;
  let minFaixa = 0;

  if (loja.entrega_modo === 'HIBRIDO') {
    const faixas = faixasDistancia
      .filter((f) => f.ativo !== false && Number(f.km_ate) > 0)
      .sort((a, b) => Number(a.km_ate) - Number(b.km_ate));
    if (!faixas.length) return { atende: false, motivo: 'ENTREGA_NAO_CONFIGURADA', ...vazio };
    raio = Number(faixas[faixas.length - 1].km_ate);
    const faixa = faixas.find((f) => dist <= Number(f.km_ate));
    if (!faixa) return { atende: false, motivo: 'FORA_DA_AREA', ...vazio, raioKm: raio };
    taxa = faixa.taxa_fixa != null
      ? Number(faixa.taxa_fixa)
      : r2(base + Number(faixa.taxa_por_km ?? porKm) * dist);
    minFaixa = Number(faixa.pedido_minimo ?? 0);
    faixaNome = faixa.nome ?? null;
  } else {
    raio = loja.entrega_raio_km != null ? Number(loja.entrega_raio_km) : null;
    if (raio != null && raio > 0 && dist > raio) return { atende: false, motivo: 'FORA_DA_AREA', ...vazio, raioKm: raio };
    taxa = loja.entrega_modo === 'FIXA' ? base : r2(base + porKm * dist);
  }

  if (freteGratis) taxa = 0;
  if (minFaixa > 0 && subtotal < minFaixa) {
    return { atende: false, motivo: 'ABAIXO_DO_MINIMO_DA_FAIXA', taxa, raioKm: raio, faixaNome, freteGratis, pedidoMinimo: minFaixa };
  }
  return { atende: true, motivo: null, taxa, raioKm: raio, faixaNome, freteGratis, pedidoMinimo: minFaixa };
}

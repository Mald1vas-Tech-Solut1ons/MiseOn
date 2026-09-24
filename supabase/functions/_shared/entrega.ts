// MiseOn — entrega: endereço → coordenada → distância pela rua → regra.
//
// Tudo no SERVIDOR. Até 23/09/2026 o navegador geocodificava e mandava lat/lng,
// e o pedido confiava: com a coordenada da própria loja pagava-se só o valor
// base. Agora a distância nasce aqui, vira uma COTAÇÃO gravada, e o pedido só
// aceita entrega com cotação (fn_criar_pedido_completo).
//
// Provedores abertos, sem chave (não há conta de mapas paga no projeto):
//   geocodificação  Nominatim/OpenStreetMap — até 1 req/s, por isso o cache
//   rota            OSRM — distância pelo caminho de carro
//   reserva         BrasilAPI CEP v2 — centro do CEP quando o número não acha
// Se a rota não responder, vale a linha reta × FATOR_RUA, marcada ESTIMATIVA.
// Trocar por Google/Mapbox depois é trocar `geocodificar` e `medirRota`.

// deno-lint-ignore-file no-explicit-any

export interface EnderecoEntrega {
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  sem_numero?: boolean | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

export interface Coordenada { lat: number; lng: number; }
type Precisao = 'ENDERECO' | 'RUA' | 'CEP';

const UA = 'MiseOn/1.0 (+https://miseon.app.br)';
/** Em cidade o caminho pela rua costuma ser maior que a reta; só vale sem rota. */
export const FATOR_RUA = 1.3;

const r2 = (n: number) => Math.round(n * 100) / 100;

export function soDigitos(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

export function numeroNormalizado(e: EnderecoEntrega): string {
  const n = String(e.numero ?? '').trim();
  return e.sem_numero || !n ? 'SN' : n.toUpperCase();
}

function semAcento(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function chaveEndereco(e: EnderecoEntrega): string {
  return semAcento([soDigitos(e.cep), e.logradouro, numeroNormalizado(e), e.cidade, e.uf]
    .map((p) => String(p ?? '').trim().toLowerCase().replace(/\s+/g, ' '))
    .join('|'));
}

export function haversineKm(a: Coordenada, b: Coordenada): number {
  const RAD = Math.PI / 180;
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function buscarJson(url: string, ms = 6000): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR' } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function coordenadaValida(lat: unknown, lng: unknown): Coordenada | null {
  const a = Number(lat), b = Number(lng);
  // Brasil inteiro cabe aqui; fora disso é resultado errado do provedor.
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < -34 || a > 6 || b < -74 || b > -28) return null;
  return { lat: a, lng: b };
}

async function nominatim(params: Record<string, string>): Promise<{ geo: Coordenada; precisao: Precisao } | null> {
  const qs = new URLSearchParams({ format: 'jsonv2', limit: '1', countrycodes: 'br', addressdetails: '1', ...params });
  const data = await buscarJson(`https://nominatim.openstreetmap.org/search?${qs}`);
  const hit = Array.isArray(data) ? data[0] : null;
  const geo = hit ? coordenadaValida(hit.lat, hit.lon) : null;
  if (!geo) return null;
  const temNumero = !!hit.address?.house_number || hit.addresstype === 'building' || hit.type === 'house';
  return { geo, precisao: temNumero ? 'ENDERECO' : 'RUA' };
}

/** Endereço → coordenada, do mais preciso para o menos preciso. */
export async function geocodificar(
  db: any,
  e: EnderecoEntrega,
): Promise<{ geo: Coordenada; precisao: Precisao; fonte: string } | null> {
  const chave = chaveEndereco(e);
  const { data: cache } = await db.from('geocode_cache').select('lat, lng, precisao, fonte').eq('chave', chave).maybeSingle();
  if (cache) return { geo: { lat: Number(cache.lat), lng: Number(cache.lng) }, precisao: cache.precisao, fonte: `cache:${cache.fonte}` };

  const numero = numeroNormalizado(e);
  const rua = [numero !== 'SN' ? numero : '', e.logradouro ?? ''].join(' ').trim();
  const cep = soDigitos(e.cep);

  let achado: { geo: Coordenada; precisao: Precisao; fonte: string } | null = null;

  if (rua && e.cidade) {
    const r = await nominatim({ street: rua, city: String(e.cidade), state: String(e.uf ?? ''), country: 'Brasil' });
    if (r) achado = { ...r, fonte: 'nominatim' };
  }
  if (!achado && rua) {
    const q = [rua, e.bairro, e.cidade, e.uf, cep].filter(Boolean).join(', ');
    const r = await nominatim({ q });
    if (r) achado = { ...r, fonte: 'nominatim' };
  }
  if (!achado && cep.length === 8) {
    const data = await buscarJson(`https://brasilapi.com.br/api/cep/v2/${cep}`);
    const c = data?.location?.coordinates;
    const geo = c ? coordenadaValida(c.latitude, c.longitude) : null;
    if (geo) achado = { geo, precisao: 'CEP', fonte: 'brasilapi' };
  }
  if (!achado) return null;

  await db.from('geocode_cache').upsert({
    chave, lat: achado.geo.lat, lng: achado.geo.lng, precisao: achado.precisao, fonte: achado.fonte,
  });
  return achado;
}

/** Texto livre (endereço da loja) → coordenada. */
export async function localizarTexto(texto: string): Promise<{ geo: Coordenada; precisao: Precisao } | null> {
  if (!texto || texto.trim().length < 5) return null;
  return await nominatim({ q: texto.trim() });
}

/** Distância pelo caminho de carro; sem rota, linha reta corrigida. */
export async function medirDistancia(
  origem: Coordenada,
  destino: Coordenada,
): Promise<{ km: number; metodo: 'ROTA' | 'ESTIMATIVA' }> {
  const url = `https://router.project-osrm.org/route/v1/driving/${origem.lng},${origem.lat};${destino.lng},${destino.lat}?overview=false`;
  const data = await buscarJson(url, 5000);
  const metros = Number(data?.routes?.[0]?.distance);
  if (data?.code === 'Ok' && Number.isFinite(metros) && metros >= 0) {
    return { km: r2(metros / 1000), metodo: 'ROTA' };
  }
  return { km: r2(haversineKm(origem, destino) * FATOR_RUA), metodo: 'ESTIMATIVA' };
}

export interface Cotacao {
  atende: boolean;
  motivo: string | null;
  mensagem: string | null;
  taxa: number | null;
  distancia_km: number | null;
  raio_km: number | null;
  frete_gratis: boolean;
  frete_gratis_acima: number | null;
  pedido_minimo: number;
  faixa_nome: string | null;
  cotacao_id: string | null;
  metodo: 'ROTA' | 'ESTIMATIVA' | null;
  precisao: Precisao | null;
  /** Onde o endereço do cliente foi localizado (o próprio cliente vê). */
  destino: Coordenada | null;
}

const MOTIVOS_SEM_ENDERECO = new Set(['LOJA_INEXISTENTE', 'SEM_ENTREGA', 'ENTREGA_NAO_CONFIGURADA']);

function daRegra(r: any, extra: Partial<Cotacao> = {}): Cotacao {
  return {
    atende: !!r?.atende,
    motivo: r?.motivo ?? null,
    mensagem: r?.mensagem ?? null,
    taxa: r?.taxa != null ? Number(r.taxa) : null,
    distancia_km: r?.distancia_km != null ? Number(r.distancia_km) : null,
    raio_km: r?.raio_km != null ? Number(r.raio_km) : null,
    frete_gratis: !!r?.frete_gratis,
    frete_gratis_acima: r?.frete_gratis_acima != null ? Number(r.frete_gratis_acima) : null,
    pedido_minimo: Number(r?.pedido_minimo ?? 0),
    faixa_nome: r?.faixa_nome ?? null,
    cotacao_id: null,
    metodo: null,
    precisao: null,
    destino: null,
    ...extra,
  };
}

/**
 * Cota a entrega de um endereço para uma loja e grava a cotação que o pedido
 * vai exigir. `db` é um cliente service role.
 */
export async function cotarEntrega(
  db: any,
  lojaId: string,
  endereco: EnderecoEntrega,
  subtotal: number,
): Promise<Cotacao> {
  // Loja que não entrega ou não configurou: responde sem gastar geocodificação.
  const { data: previa, error: ePrevia } = await db.rpc('fn_entrega_regra', {
    p_loja_id: lojaId, p_distancia_km: 0, p_subtotal: subtotal,
  });
  if (ePrevia) throw new Error(ePrevia.message);
  if (previa && MOTIVOS_SEM_ENDERECO.has(previa.motivo)) return daRegra(previa);

  const cep = soDigitos(endereco.cep);
  if (cep.length !== 8 || !endereco.logradouro || !endereco.cidade) {
    return daRegra({ atende: false, motivo: 'ENDERECO_INCOMPLETO',
      mensagem: 'Informe CEP, rua, número e cidade para calcular a entrega.' });
  }

  const { data: loja } = await db.from('lojas').select('lat, lng').eq('id', lojaId).single();
  const origem = coordenadaValida(loja?.lat, loja?.lng);
  if (!origem) return daRegra(previa);

  const chave = chaveEndereco(endereco);
  const numero = numeroNormalizado(endereco);

  // Mesmo endereço cotado há pouco: reaproveita a distância (o carrinho muda,
  // o endereço não) e não repete as consultas externas.
  const { data: recente } = await db.from('entrega_cotacoes')
    .select('id, lat, lng, distancia_km, metodo, precisao, expira_em')
    .eq('loja_id', lojaId).eq('chave_endereco', chave)
    .gt('expira_em', new Date(Date.now() + 20 * 60_000).toISOString())
    .order('criado_em', { ascending: false }).limit(1).maybeSingle();

  let cot = recente;
  if (!cot) {
    const achado = await geocodificar(db, endereco);
    if (!achado) {
      return daRegra({ atende: false, motivo: 'ENDERECO_NAO_LOCALIZADO',
        mensagem: 'Não conseguimos localizar esse endereço. Confira o CEP, a rua e o número.' });
    }
    const dist = await medirDistancia(origem, achado.geo);
    const { data: nova, error } = await db.from('entrega_cotacoes').insert({
      loja_id: lojaId, chave_endereco: chave, cep, numero,
      lat: achado.geo.lat, lng: achado.geo.lng,
      distancia_km: dist.km, metodo: dist.metodo, precisao: achado.precisao,
    }).select('id, lat, lng, distancia_km, metodo, precisao, expira_em').single();
    if (error) throw new Error(error.message);
    cot = nova;
  }

  const { data: regra, error: eRegra } = await db.rpc('fn_entrega_regra', {
    p_loja_id: lojaId, p_distancia_km: cot.distancia_km, p_subtotal: subtotal,
  });
  if (eRegra) throw new Error(eRegra.message);

  return daRegra(regra, {
    cotacao_id: cot.id,
    distancia_km: Number(cot.distancia_km),
    metodo: cot.metodo,
    precisao: cot.precisao,
    destino: { lat: Number(cot.lat), lng: Number(cot.lng) },
  });
}

/** A regra da loja em português, para o chat e para a vitrine. */
export async function descreverRegraEntrega(db: any, lojaId: string): Promise<string> {
  const { data: l } = await db.from('lojas')
    .select('aceita_entrega, lat, entrega_modo, entrega_taxa_base, entrega_taxa_km, entrega_raio_km, frete_gratis_valor_minimo')
    .eq('id', lojaId).single();
  if (!l?.aceita_entrega) return 'Esta loja não faz entrega; o cliente pode retirar no balcão.';
  if (l.lat == null) return 'A entrega desta loja ainda não está configurada; por enquanto só retirada no balcão.';

  const brl = (n: number) => `R$ ${Number(n).toFixed(2).replace('.', ',')}`;
  const km = (n: number) => `${String(Number(n)).replace('.', ',')} km`;
  const linhas: string[] = [];

  if (l.entrega_modo === 'HIBRIDO') {
    const { data: faixas } = await db.from('faixas_entrega')
      .select('nome, km_ate, taxa_fixa, taxa_por_km, pedido_minimo')
      .eq('loja_id', lojaId).eq('ativo', true).order('km_ate');
    if (!faixas?.length) return 'A entrega desta loja ainda não está configurada; por enquanto só retirada no balcão.';
    for (const f of faixas) {
      const valor = f.taxa_fixa != null
        ? brl(f.taxa_fixa)
        : `${brl(Number(l.entrega_taxa_base ?? 0))} + ${brl(f.taxa_por_km)}/km`;
      const min = Number(f.pedido_minimo ?? 0) > 0 ? ` (pedido mínimo ${brl(f.pedido_minimo)})` : '';
      linhas.push(`• até ${km(f.km_ate)}: ${valor}${min}`);
    }
    linhas.push(`Acima de ${km(faixas[faixas.length - 1].km_ate)} a loja não entrega.`);
  } else if (l.entrega_modo === 'FIXA') {
    linhas.push(`• taxa única de ${brl(Number(l.entrega_taxa_base ?? 0))}`);
    if (Number(l.entrega_raio_km) > 0) linhas.push(`Entrega até ${km(l.entrega_raio_km)}.`);
  } else {
    linhas.push(`• ${brl(Number(l.entrega_taxa_base ?? 0))} + ${brl(Number(l.entrega_taxa_km ?? 0))} por km`);
    if (Number(l.entrega_raio_km) > 0) linhas.push(`Entrega até ${km(l.entrega_raio_km)}.`);
  }
  if (Number(l.frete_gratis_valor_minimo) > 0) linhas.push(`Frete grátis em pedidos a partir de ${brl(l.frete_gratis_valor_minimo)}.`);

  return 'Regra de entrega (distância pelo caminho de carro, a partir da loja):\n' + linhas.join('\n');
}

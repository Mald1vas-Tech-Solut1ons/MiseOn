/**
 * MiseOn — Taxa de entrega e loja aberta: as duas regras que saíram do browser
 *
 * Contexto (Sprint 6, 20260908030000 / 20260908040000): até esta data o
 * `fn_criar_pedido_completo` gravava `taxa_entrega` exatamente como o payload
 * mandava, e "loja aberta" só era decidido no navegador do cliente. Um POST
 * com `"taxa_entrega": 0` entregava de graça, e relógio errado (ou fuso
 * diferente) fazia cair pedido com a loja fechada.
 *
 * O que estes testes travam é o COMPORTAMENTO do dinheiro, não a linha de
 * código: a taxa tem de sair da localização real (distância → faixa), o raio
 * tem de barrar, e o frete grátis legítimo tem de continuar
 * zerando. Cada caso aqui é um cenário que já existe na operação real.
 *
 * Cobertura:
 *  ✅ DISTÂNCIA linear (base + km) e arredondamento a 2 casas
 *  ✅ Fora do raio → fora_de_area (o pedido é recusado pela RPC)
 *  ✅ HIBRIDO: faixa com taxa fixa vence base+km
 *  ✅ HIBRIDO: acima da última faixa → fora_de_area
 *  ✅ Frete grátis por valor mínimo (atingido e não atingido)
 *  ✅ endereço sem coordenada é recusado; nunca cai em bairro/taxa padrão
 *  ✅ fn_loja_aberta: aberto_manual vence horário (nos dois sentidos)
 *  ✅ fn_loja_aberta: turno que cruza a meia-noite (22:00–02:00)
 */

import { it, expect, beforeAll, afterAll } from 'vitest';
import { gated } from './gate';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const isConfigured = Boolean(SERVICE_KEY);

let db: SupabaseClient;
let lojaId: string;

/** Coordenada da loja de teste (Zona Norte de SP) e um ponto ~2 km ao sul. */
const LOJA_LAT = -23.4492102;
const LOJA_LNG = -46.5546465;
const PONTO_2KM = { lat: -23.4672102, lng: LOJA_LNG };
const PONTO_20KM = { lat: -23.6292102, lng: LOJA_LNG };

interface Entrega {
  taxa: number;
  distancia_km: number | null;
  origem: 'DISTANCIA' | 'NENHUM';
  fora_de_area: boolean;
  frete_gratis: boolean;
}

async function taxa(
  loja: string,
  args: { lat?: number | null; lng?: number | null; bairro?: string | null; subtotal?: number },
): Promise<Entrega> {
  const { data, error } = await db.rpc('fn_taxa_entrega_calculada', {
    p_loja_id: loja,
    p_lat: args.lat ?? null,
    p_lng: args.lng ?? null,
    p_bairro: args.bairro ?? null,
    p_subtotal: args.subtotal ?? 0,
  });
  if (error) throw new Error(`fn_taxa_entrega_calculada: ${error.message}`);
  return data as Entrega;
}

async function criarLoja(nome: string, extra: Record<string, unknown>) {
  const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { data, error } = await db
    .from('lojas')
    .insert({ nome, slug: `teste-entrega-${sufixo}`, ...extra })
    .select('id')
    .single();
  if (error) throw new Error(`Erro ao criar loja de teste: ${error.message}`);
  return data.id as string;
}

beforeAll(async () => {
  if (!isConfigured) return;
  db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  lojaId = await criarLoja('Loja Teste Entrega', {
    entrega_modo: 'DISTANCIA',
    entrega_taxa_base: 5,
    entrega_taxa_km: 1,
    entrega_raio_km: 8,
    entrega_taxa_padrao: 12,
    frete_gratis_valor_minimo: 0,
    lat: LOJA_LAT,
    lng: LOJA_LNG,
  });

});

afterAll(async () => {
  if (!isConfigured) return;
  if (lojaId) await db.from('lojas').delete().eq('id', lojaId);
});

gated(isConfigured, 'Taxa de entrega — o servidor é quem calcula', () => {
  it('DISTÂNCIA linear: base 5 + 1/km a 2 km = 7,00', async () => {
    const r = await taxa(lojaId, { ...PONTO_2KM, subtotal: 50 });
    expect(r.origem).toBe('DISTANCIA');
    expect(Number(r.distancia_km)).toBeCloseTo(2, 1);
    expect(Number(r.taxa)).toBeCloseTo(7, 2);
    expect(r.fora_de_area).toBe(false);
  });

  it('fora do raio de 8 km marca fora_de_area (a RPC recusa o pedido)', async () => {
    const r = await taxa(lojaId, { ...PONTO_20KM, subtotal: 50 });
    expect(r.fora_de_area).toBe(true);
    expect(Number(r.distancia_km)).toBeGreaterThan(8);
  });

  it('frete grátis por valor mínimo zera a taxa — e só a partir do mínimo', async () => {
    await db.from('lojas').update({ frete_gratis_valor_minimo: 30 }).eq('id', lojaId);
    try {
      const atingiu = await taxa(lojaId, { ...PONTO_2KM, subtotal: 32.9 });
      expect(Number(atingiu.taxa)).toBe(0);
      expect(atingiu.frete_gratis).toBe(true);

      const naoAtingiu = await taxa(lojaId, { ...PONTO_2KM, subtotal: 29.99 });
      expect(Number(naoAtingiu.taxa)).toBeCloseTo(7, 2);
      expect(naoAtingiu.frete_gratis).toBe(false);
    } finally {
      await db.from('lojas').update({ frete_gratis_valor_minimo: 0 }).eq('id', lojaId);
    }
  });

  it('HIBRIDO: faixa com taxa fixa vence base+km; acima da última faixa é fora de área', async () => {
    await db.from('lojas').update({ entrega_modo: 'HIBRIDO', entrega_raio_km: null }).eq('id', lojaId);
    const { error } = await db.from('faixas_entrega').insert([
      { loja_id: lojaId, nome: 'Perto', km_ate: 3, taxa_fixa: 4.5, ativo: true, ordem: 1 },
      { loja_id: lojaId, nome: 'Médio', km_ate: 6, taxa_fixa: 8.0, ativo: true, ordem: 2 },
    ]);
    if (error) throw new Error(error.message);

    try {
      const dentro = await taxa(lojaId, { ...PONTO_2KM, subtotal: 50 });
      // 2 km cai na faixa "Perto": taxa fixa 4,50 (e NÃO 5 + 1×2 = 7).
      expect(Number(dentro.taxa)).toBeCloseTo(4.5, 2);

      const longe = await taxa(lojaId, { ...PONTO_20KM, subtotal: 50 });
      expect(longe.fora_de_area).toBe(true);
    } finally {
      await db.from('faixas_entrega').delete().eq('loja_id', lojaId);
      await db.from('lojas')
        .update({ entrega_modo: 'DISTANCIA', entrega_raio_km: 8 })
        .eq('id', lojaId);
    }
  });

  it('endereço sem coordenada é recusado em vez de virar uma taxa por bairro', async () => {
    await expect(taxa(lojaId, { bairro: 'São João', subtotal: 50 }))
      .rejects.toThrow('Não foi possível localizar o endereço de entrega');
  });

  it('loja inexistente devolve zero, nunca erro de servidor', async () => {
    const r = await taxa('00000000-0000-0000-0000-000000000000', { ...PONTO_2KM });
    expect(Number(r.taxa)).toBe(0);
    expect(r.origem).toBe('NENHUM');
  });
});

gated(isConfigured, 'Loja aberta — decidido no banco, no fuso da operação', () => {
  async function aberta(loja: string): Promise<boolean> {
    const { data, error } = await db.rpc('fn_loja_aberta', { p_loja_id: loja });
    if (error) throw new Error(`fn_loja_aberta: ${error.message}`);
    return data as boolean;
  }

  it('aberto_manual vence o horário nos dois sentidos', async () => {
    await db.from('lojas').update({ aberto_manual: true }).eq('id', lojaId);
    expect(await aberta(lojaId)).toBe(true);

    await db.from('lojas').update({ aberto_manual: false }).eq('id', lojaId);
    expect(await aberta(lojaId)).toBe(false);

    await db.from('lojas').update({ aberto_manual: null }).eq('id', lojaId);
  });

  it('sem horário cadastrado, a loja está fechada', async () => {
    await db.from('horarios_funcionamento').delete().eq('loja_id', lojaId);
    expect(await aberta(lojaId)).toBe(false);
  });

  it('turno 22:00–02:00 em todos os dias: aberta exatamente na janela real', async () => {
    // O turno cruza a meia-noite, então a madrugada de hoje é coberta pela
    // linha de ONTEM — é justamente o caso que o cálculo ingênuo erra.
    await db.from('horarios_funcionamento').delete().eq('loja_id', lojaId);
    const linhas = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
      loja_id: lojaId, dia_semana: d, abre: '22:00:00', fecha: '02:00:00',
    }));
    const { error } = await db.from('horarios_funcionamento').insert(linhas);
    if (error) throw new Error(error.message);

    // A expectativa é calculada pelo TESTE a partir do relógio do banco no
    // fuso da operação; quem responde é a função. Se divergirem, ela errou.
    const { data: agora } = await db.rpc('fn_agora_sao_paulo_hhmm');
    const hhmm = String(agora ?? '');
    const [h] = hhmm.split(':').map(Number);
    const esperado = h >= 22 || h < 2;

    expect(await aberta(lojaId)).toBe(esperado);
  });
});

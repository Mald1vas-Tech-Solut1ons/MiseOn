/**
 * MiseOn — Regra de entrega e loja aberta: as duas regras que saíram do browser
 *
 * Contexto (Sprint 6, 20260908030000 / 20260908040000): até esta data o
 * `fn_criar_pedido_completo` gravava `taxa_entrega` exatamente como o payload
 * mandava, e "loja aberta" só era decidido no navegador do cliente. Um POST
 * com `"taxa_entrega": 0` entregava de graça, e relógio errado (ou fuso
 * diferente) fazia cair pedido com a loja fechada.
 *
 * Atualizado em 24/09/2026 (migration 20260924010000): a RPC virou
 * `fn_entrega_regra(loja, distancia_km, subtotal)` — a distância não é mais
 * calculada dentro do banco a partir de lat/lng nem de bairro, ela chega já
 * pronta (medida no servidor pela rua, em `entrega-cotar`; ver
 * `supabase/functions/_shared/entrega.ts`). Este arquivo ficou testando a
 * RPC antiga (`fn_taxa_entrega_calculada`), que não existe mais — schema
 * cache do Postgres devolvia "could not find the function" em toda suíte de
 * integração, quebrando o CI desde então. Portado para a função atual.
 *
 * O que estes testes travam é o COMPORTAMENTO do dinheiro, não a linha de
 * código: a taxa tem de sair da distância (faixa), o raio tem de barrar, e o
 * frete grátis legítimo tem de continuar zerando. Cada caso aqui é um
 * cenário que já existe na operação real.
 *
 * Cobertura:
 *  ✅ DISTANCIA linear (base + km) e arredondamento a 2 casas
 *  ✅ Fora do raio → FORA_DA_AREA (o pedido é recusado pela RPC)
 *  ✅ HIBRIDO: faixa com taxa fixa vence base+km
 *  ✅ HIBRIDO: acima da última faixa → FORA_DA_AREA
 *  ✅ Frete grátis por valor mínimo (atingido e não atingido)
 *  ✅ loja sem localização (lat/lng nulos) é recusada; nunca vira taxa padrão
 *  ✅ fn_loja_aberta: aberto_manual vence horário (nos dois sentidos)
 *  ✅ fn_loja_aberta: turno que cruza a meia-noite (22:00–02:00)
 */

import { it, expect, beforeAll, afterAll } from 'vitest';
import { gated } from './gate';
import { apagarLojaDescartavel, criarLojaDescartavel, exigirDescartavel } from './loja-descartavel';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const isConfigured = Boolean(SERVICE_KEY);

let db: SupabaseClient;
let lojaId: string;

/** Coordenada da loja de teste (Zona Norte de SP) — só precisa existir;
 * quem decide a distância nestes testes é o parâmetro, não o ponto. */
const LOJA_LAT = -23.4492102;
const LOJA_LNG = -46.5546465;

interface RegraEntrega {
  atende: boolean;
  motivo: string | null;
  taxa: number | null;
  distancia_km: number | null;
  raio_km: number | null;
  frete_gratis: boolean;
}

async function regra(loja: string, distanciaKm: number, subtotal = 0): Promise<RegraEntrega> {
  const { data, error } = await db.rpc('fn_entrega_regra', {
    p_loja_id: loja,
    p_distancia_km: distanciaKm,
    p_subtotal: subtotal,
  });
  if (error) throw new Error(`fn_entrega_regra: ${error.message}`);
  return data as RegraEntrega;
}

beforeAll(async () => {
  if (!isConfigured) return;
  db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  lojaId = (await criarLojaDescartavel(db, 'entrega-taxa-e-porta', {
    entrega_modo: 'DISTANCIA',
    entrega_taxa_base: 5,
    entrega_taxa_km: 1,
    entrega_raio_km: 8,
    entrega_taxa_padrao: 12,
    frete_gratis_valor_minimo: 0,
    lat: LOJA_LAT,
    lng: LOJA_LNG,
  })).id;
  exigirDescartavel(lojaId, 'entrega-taxa-e-porta');

});

afterAll(async () => {
  if (!isConfigured) return;
  if (lojaId) await apagarLojaDescartavel(db, lojaId);
});

gated(isConfigured, 'Regra de entrega — o servidor é quem calcula', () => {
  it('DISTANCIA linear: base 5 + 1/km a 2 km = 7,00', async () => {
    const r = await regra(lojaId, 2, 50);
    expect(r.atende).toBe(true);
    expect(r.motivo).toBeNull();
    expect(Number(r.distancia_km)).toBeCloseTo(2, 1);
    expect(Number(r.taxa)).toBeCloseTo(7, 2);
  });

  it('fora do raio de 8 km marca FORA_DA_AREA (a RPC recusa o pedido)', async () => {
    const r = await regra(lojaId, 20, 50);
    expect(r.atende).toBe(false);
    expect(r.motivo).toBe('FORA_DA_AREA');
  });

  it('frete grátis por valor mínimo zera a taxa — e só a partir do mínimo', async () => {
    await db.from('lojas').update({ frete_gratis_valor_minimo: 30 }).eq('id', lojaId);
    try {
      const atingiu = await regra(lojaId, 2, 32.9);
      expect(Number(atingiu.taxa)).toBe(0);
      expect(atingiu.frete_gratis).toBe(true);

      const naoAtingiu = await regra(lojaId, 2, 29.99);
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
      const dentro = await regra(lojaId, 2, 50);
      // 2 km cai na faixa "Perto": taxa fixa 4,50 (e NÃO 5 + 1×2 = 7).
      expect(Number(dentro.taxa)).toBeCloseTo(4.5, 2);

      const longe = await regra(lojaId, 20, 50);
      expect(longe.atende).toBe(false);
      expect(longe.motivo).toBe('FORA_DA_AREA');
    } finally {
      await db.from('faixas_entrega').delete().eq('loja_id', lojaId);
      await db.from('lojas')
        .update({ entrega_modo: 'DISTANCIA', entrega_raio_km: 8 })
        .eq('id', lojaId);
    }
  });

  it('loja sem localização (lat/lng nulos) é recusada, nunca vira taxa padrão', async () => {
    await db.from('lojas').update({ lat: null, lng: null }).eq('id', lojaId);
    try {
      const r = await regra(lojaId, 2, 50);
      expect(r.atende).toBe(false);
      expect(r.motivo).toBe('ENTREGA_NAO_CONFIGURADA');
    } finally {
      await db.from('lojas').update({ lat: LOJA_LAT, lng: LOJA_LNG }).eq('id', lojaId);
    }
  });

  it('loja inexistente devolve atende=false, nunca erro de servidor', async () => {
    const r = await regra('00000000-0000-0000-0000-000000000000', 2, 50);
    expect(r.atende).toBe(false);
    expect(r.motivo).toBe('LOJA_INEXISTENTE');
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

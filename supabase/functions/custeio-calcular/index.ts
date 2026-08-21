/**
 * Edge Function: custeio-calcular
 *
 * Camada de serviço canônica para cálculo e persistência de custos.
 * Usa os MESMOS módulos TypeScript do frontend (custeio.ts + unidades.ts),
 * eliminando a duplicação de lógica entre browser e banco.
 *
 * POST /functions/v1/custeio-calcular
 *
 * Body (JSON):
 * {
 *   acao: 'CALCULAR_CUSTO' | 'CALCULAR_BOM' | 'BAIXAR_PEPS',
 *
 *   // Para CALCULAR_CUSTO:
 *   insumo_id: string,
 *   quantidade: number,
 *   unidade: string,
 *   metodo?: 'PEPS' | 'MEDIO',
 *
 *   // Para CALCULAR_BOM:
 *   receita: Array<{ insumo_id, quantidade, unidade }>,
 *   metodo?: 'PEPS' | 'MEDIO',
 *
 *   // Para BAIXAR_PEPS (requer token admin):
 *   insumo_id: string,
 *   quantidade: number,
 *   unidade: string,
 * }
 *
 * Resposta:
 * {
 *   custo: number,                    // custo total calculado (R$)
 *   custo_unitario_base: number,      // custo por unidade base do insumo
 *   metodo: 'PEPS' | 'MEDIO',
 *   detalhes?: {                      // presente em CALCULAR_BOM
 *     linhas: Array<{ nome, custo, quantidade, unidade }>
 *   }
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  custoDeUso,
  custoUnitarioBase,
  custoBOM,
  baixarPEPS,
  ErroCusteio,
  type ItemEstoque,
  type FatorItem,
  type Lote,
  type MetodoCusteio,
  type LinhaBOM,
} from './custeio.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-chat-session',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

// ---------------------------------------------------------------------------
// Carrega um item do banco e o converte para ItemEstoque (interface do motor)
// ---------------------------------------------------------------------------

async function carregarItem(
  supabase: ReturnType<typeof createClient>,
  insumoId: string,
  lojaId: string,
): Promise<ItemEstoque> {
  const [insumoRes, lotesRes, fatoresRes] = await Promise.all([
    supabase
      .from('insumos')
      .select('id, nome, unidade_medida')
      .eq('id', insumoId)
      .eq('loja_id', lojaId)
      .single(),
    supabase
      .from('lotes_estoque')
      .select('id, quantidade_restante, custo_unitario, criado_em')
      .eq('insumo_id', insumoId)
      .eq('loja_id', lojaId)
      .gt('quantidade_restante', 0)
      .order('criado_em', { ascending: true }),
    supabase
      .from('fatores_conversao')
      .select('unidade_origem, unidade_destino, multiplicador')
      .or(`item_id.eq.${insumoId},item_id.is.null`),
  ]);

  if (insumoRes.error || !insumoRes.data) {
    throw new ErroCusteio(`Insumo ${insumoId} não encontrado.`);
  }

  const insumo = insumoRes.data as { id: string; nome: string; unidade_medida: string };

  const lotes: Lote[] = (lotesRes.data ?? []).map((l: {
    id: string; quantidade_restante: number; custo_unitario: number; criado_em: string;
  }) => ({
    id: l.id,
    data: l.criado_em,
    quantidade: Number(l.quantidade_restante),
    custoTotal: Number(l.quantidade_restante) * Number(l.custo_unitario),
  }));

  const fatores: FatorItem[] = (fatoresRes.data ?? []).map((f: {
    unidade_origem: string; unidade_destino: string; multiplicador: number;
  }) => ({
    de: f.unidade_origem,
    para: f.unidade_destino,
    multiplicador: Number(f.multiplicador),
  }));

  return {
    id: insumo.id,
    nome: insumo.nome,
    unidadeBase: insumo.unidade_medida,
    fatores,
    lotes,
  };
}

// ---------------------------------------------------------------------------
// Resolve loja_id do usuário autenticado
// ---------------------------------------------------------------------------

async function resolverLojaId(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('usuarios_loja')
    .select('loja_id')
    .eq('user_id', userId)
    .single();
  if (error || !data) throw new Error('Usuário sem loja associada.');
  return (data as { loja_id: string }).loja_id;
}

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: 'Acesso negado.' }, 403);

    const lojaId = await resolverLojaId(supabase, user.id);
    const body = await req.json() as {
      acao: string;
      insumo_id?: string;
      quantidade?: number;
      unidade?: string;
      metodo?: MetodoCusteio;
      receita?: Array<{ insumo_id: string; quantidade: number; unidade: string }>;
    };

    const metodo: MetodoCusteio = body.metodo ?? 'PEPS';

    // ── Ação: CALCULAR_CUSTO ──────────────────────────────────────────────
    if (body.acao === 'CALCULAR_CUSTO') {
      if (!body.insumo_id || !body.quantidade || !body.unidade) {
        return json({ error: 'insumo_id, quantidade e unidade são obrigatórios.' }, 400);
      }
      const item = await carregarItem(supabase, body.insumo_id, lojaId);
      const custo = custoDeUso(item, body.quantidade, body.unidade, metodo);
      const custo_unitario_base = custoUnitarioBase(item, metodo);

      return json({ custo: +custo.toFixed(6), custo_unitario_base: +custo_unitario_base.toFixed(6), metodo });
    }

    // ── Ação: CALCULAR_BOM ────────────────────────────────────────────────
    if (body.acao === 'CALCULAR_BOM') {
      if (!body.receita?.length) return json({ error: 'receita não pode ser vazia.' }, 400);

      const ids = [...new Set(body.receita.map((l) => l.insumo_id))];
      const itensArr = await Promise.all(ids.map((id) => carregarItem(supabase, id, lojaId)));
      const itensMap = new Map(itensArr.map((i) => [i.id, i]));

      const linhasBOM: LinhaBOM[] = body.receita.map((l) => ({
        itemId: l.insumo_id,
        quantidade: l.quantidade,
        unidade: l.unidade,
      }));

      const resultado = custoBOM(linhasBOM, itensMap, metodo);
      return json({
        custo: +resultado.total.toFixed(6),
        metodo,
        detalhes: {
          linhas: resultado.linhas.map((l) => ({
            nome: l.nome,
            custo: +l.custo.toFixed(6),
            quantidade: l.quantidade,
            unidade: l.unidade,
          })),
        },
      });
    }

    // ── Ação: BAIXAR_PEPS — apenas persistência ───────────────────────────
    // Não muta lotes aqui; a baixa real continua sendo feita pelo trigger SQL
    // (fn_mov_custear_baixa + fn_consumir_lotes_peps). Esta ação apenas calcula
    // e retorna o custo estimado da baixa para fins de preview/auditoria.
    if (body.acao === 'BAIXAR_PEPS') {
      if (!body.insumo_id || !body.quantidade || !body.unidade) {
        return json({ error: 'insumo_id, quantidade e unidade são obrigatórios.' }, 400);
      }
      const item = await carregarItem(supabase, body.insumo_id, lojaId);
      // Clona os lotes para não mutar o estado real — é um preview.
      const itemClone = { ...item, lotes: item.lotes.map((l) => ({ ...l })) };
      const { custo, consumido } = baixarPEPS(itemClone, body.quantidade, body.unidade);
      return json({
        custo: +custo.toFixed(6),
        metodo: 'PEPS' as MetodoCusteio,
        detalhes: { lotes_consumidos: consumido },
      });
    }

    return json({ error: `Ação desconhecida: "${body.acao}".` }, 400);

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = e instanceof ErroCusteio ? 422 : 500;
    console.error(`[custeio-calcular] ${msg}`);
    return json({ error: msg }, status);
  }
});

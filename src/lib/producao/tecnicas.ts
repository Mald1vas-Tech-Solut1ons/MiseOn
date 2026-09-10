import { supabase } from '../supabase';

export type TipoTecnica = 'LIMPEZA' | 'CORTE' | 'COCCAO' | 'PORCIONAMENTO';

export interface Tecnica {
  codigo: string;
  rotulo: string;
  tipo: TipoTecnica;
  descricao: string | null;
  ordem: number;
}

export type OrigemRendimento =
  | 'MEDIDO_LOJA'
  | 'REFERENCIA_INGREDIENTE'
  | 'REFERENCIA_CATEGORIA'
  | 'USUARIO';

export interface RendimentoTecnica {
  rendimento_pct: number | null;
  origem: OrigemRendimento | null;
  amostras?: number;
}

/** Como a operação lê a procedência do número, em ordem de autoridade. */
export const ROTULO_ORIGEM: Record<OrigemRendimento, string> = {
  MEDIDO_LOJA: 'medido na sua cozinha',
  REFERENCIA_INGREDIENTE: 'referência para este ingrediente',
  REFERENCIA_CATEGORIA: 'referência da categoria',
  USUARIO: 'informado por você',
};

export const TIPO_ROTULO: Record<TipoTecnica, string> = {
  LIMPEZA: 'Limpeza e pré-preparo',
  CORTE: 'Corte',
  COCCAO: 'Cocção',
  PORCIONAMENTO: 'Porcionamento',
};

/**
 * O catálogo é global e imutável durante a sessão — carregar uma vez evita um
 * round-trip por linha de ficha aberta.
 */
let cache: Promise<Tecnica[]> | null = null;

export function carregarTecnicas(): Promise<Tecnica[]> {
  if (!cache) {
    cache = (async () => {
      const { data, error } = await supabase
        .from('tecnicas_culinarias')
        .select('codigo, rotulo, tipo, descricao, ordem')
        .eq('ativo', true)
        .order('ordem');
      if (error) {
        // Catálogo indisponível não pode travar o cadastro da ficha: sem
        // técnica, a linha volta a ser bruto = líquido, como antes. Zera o
        // cache para a próxima abertura tentar de novo.
        cache = null;
        console.error('catálogo de técnicas indisponível:', error);
        return [];
      }
      return (data ?? []) as Tecnica[];
    })();
  }
  return cache;
}

/**
 * Fator de correção aplicável a este insumo com esta técnica. O banco resolve a
 * precedência (medido da loja > referência do ingrediente > da categoria) e
 * devolve `null` quando não há base — o sistema não inventa rendimento.
 */
export async function buscarRendimento(
  insumoId: string,
  tecnicaCodigo: string,
): Promise<RendimentoTecnica> {
  const { data, error } = await supabase.rpc('fn_rendimento_tecnica', {
    p_insumo_id: insumoId,
    p_tecnica_codigo: tecnicaCodigo,
  });
  if (error) {
    console.error('fn_rendimento_tecnica:', error);
    return { rendimento_pct: null, origem: null };
  }
  const r = data as RendimentoTecnica | null;
  const pct = Number(r?.rendimento_pct);
  return {
    rendimento_pct: Number.isFinite(pct) && pct > 0 ? pct : null,
    origem: r?.origem ?? null,
    amostras: r?.amostras,
  };
}

/** Registra uma pesagem real e devolve a nova média da casa. */
export async function registrarRendimentoMedido(
  insumoId: string,
  tecnicaCodigo: string,
  pesoBruto: number,
  pesoLiquido: number,
): Promise<RendimentoTecnica & { rendimento_desta_medicao?: number }> {
  const { data, error } = await supabase.rpc('fn_registrar_rendimento_medido', {
    p_insumo_id: insumoId,
    p_tecnica_codigo: tecnicaCodigo,
    p_peso_bruto: pesoBruto,
    p_peso_liquido: pesoLiquido,
  });
  if (error) throw error;
  return data as RendimentoTecnica & { rendimento_desta_medicao?: number };
}

/** Fator de correção clássico do food service: FC = bruto / líquido (≥ 1). */
export const fatorCorrecao = (rendimentoPct: number): number =>
  rendimentoPct > 0 ? 1 / rendimentoPct : 0;

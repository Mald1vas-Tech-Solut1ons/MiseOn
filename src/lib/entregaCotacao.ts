import { supabase } from './supabase';

/**
 * Cotação de entrega feita NO SERVIDOR (edge function `entrega-cotar`).
 *
 * O servidor localiza o endereço, mede a distância pelo caminho de carro,
 * aplica a regra da loja (`fn_entrega_regra`) e grava a cotação. O pedido de
 * entrega só é aceito com o `cotacao_id` — a coordenada do navegador não entra
 * mais na conta (até 23/09/2026 entrava, e dava para pagar só a taxa base).
 */
export interface CotacaoEntrega {
  atende: boolean;
  motivo:
    | null
    | 'LOJA_INEXISTENTE'
    | 'SEM_ENTREGA'
    | 'ENTREGA_NAO_CONFIGURADA'
    | 'ENDERECO_INCOMPLETO'
    | 'ENDERECO_NAO_LOCALIZADO'
    | 'FORA_DA_AREA'
    | 'ABAIXO_DO_MINIMO_DA_FAIXA';
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
  precisao: 'ENDERECO' | 'RUA' | 'CEP' | null;
  destino: { lat: number; lng: number } | null;
}

export interface EnderecoCotacao {
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  sem_numero?: boolean | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

export async function cotarEntrega(
  lojaId: string,
  endereco: EnderecoCotacao,
  subtotal: number,
): Promise<CotacaoEntrega> {
  const { data, error } = await supabase.functions.invoke('entrega-cotar', {
    body: { acao: 'cotar', loja_id: lojaId, endereco, subtotal },
  });
  if (error) throw error;
  return data as CotacaoEntrega;
}

export async function localizarEnderecoLoja(texto: string): Promise<{ lat: number; lng: number; precisao: string }> {
  const { data, error } = await supabase.functions.invoke('entrega-cotar', {
    body: { acao: 'localizar', texto },
  });
  if (error) throw error;
  return data as { lat: number; lng: number; precisao: string };
}

/** "5,1 km pela rua" — honesto sobre o que foi medido. */
export function descreverDistancia(c: Pick<CotacaoEntrega, 'distancia_km' | 'metodo'>): string {
  if (c.distancia_km == null) return '';
  const km = c.distancia_km.toFixed(1).replace('.', ',');
  return c.metodo === 'ROTA' ? `${km} km pela rua` : `~${km} km (estimado)`;
}

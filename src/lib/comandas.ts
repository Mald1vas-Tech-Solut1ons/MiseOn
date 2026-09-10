import { supabase } from './supabase';
import type { MetodoPgto } from '../types';

/**
 * Retorna o id da comanda ABERTA da mesa (reaproveitando entre várias
 * rodadas de pedido) ou cria uma nova se não houver nenhuma em aberto.
 * Usado tanto pelo cliente pedindo via QR quanto pelo garçom no PDV.
 *
 * Passa pelo RPC SECURITY DEFINER fn_comanda_aberta_mesa: a tabela
 * `comandas` não tem mais SELECT/INSERT públicos (vazamento entre lojas —
 * ver migration 20260722070000_seguranca_comandas_mesas_publicas). O RPC
 * valida que a mesa pertence à loja e está ativa antes de abrir/reusar.
 */
export async function obterOuCriarComandaAberta(lojaId: string, mesaId: string): Promise<string> {
  const { data, error } = await supabase.rpc('fn_comanda_aberta_mesa', {
    p_loja_id: lojaId,
    p_mesa_id: mesaId,
  });
  if (error || !data) throw error ?? new Error('Falha ao abrir a comanda da mesa');
  return data as string;
}

/**
 * Lança um item avulso (bebida, sobremesa, repique de prato) numa comanda já
 * ABERTA — de mesa ou individual do buffet — sem exigir mesa_id. Usado pelo
 * garçom para atender uma comanda que nasceu na balança (ver migration
 * 20260909000000_garcom_acessa_comanda_buffet.sql).
 */
export async function lancarItemAvulsoComanda(params: {
  lojaId: string;
  comandaId: string;
  produtoId?: string | null;
  nomeProduto?: string | null;
  precoUnitario: number;
  quantidade: number;
  observacao?: string | null;
  /** Modificadores escolhidos (ponto da carne, com gelo e limão...). Só o id
   *  viaja: nome e preço vêm do catálogo, no banco. */
  opcoes?: { id: string }[];
}): Promise<{ comanda_id: string; pedido_id: string; valor_total: number }> {
  const { data, error } = await supabase.rpc('fn_lancar_item_avulso_comanda', {
    p_loja_id: params.lojaId,
    p_comanda_id: params.comandaId,
    p_produto_id: params.produtoId || null,
    p_nome_produto: params.nomeProduto || null,
    p_preco_unitario: params.precoUnitario,
    p_quantidade: params.quantidade,
    p_observacao: params.observacao || null,
    p_opcoes: params.opcoes ?? [],
  });
  if (error) throw error;
  return data as { comanda_id: string; pedido_id: string; valor_total: number };
}

/** Registra o recebimento presencial e fecha a comanda de forma atômica. */
export async function fecharComandaBuffet(
  comandaId: string,
  metodoPagamento: Exclude<MetodoPgto, 'IFOOD'>,
): Promise<{ comanda_id: string; status: 'FECHADA'; valor_pago: number; metodo_pagamento: MetodoPgto }> {
  const { data, error } = await supabase.rpc('fn_fechar_comanda_buffet', {
    p_comanda_id: comandaId,
    p_metodo_pagamento: metodoPagamento,
  });
  if (error) throw error;
  return data as { comanda_id: string; status: 'FECHADA'; valor_pago: number; metodo_pagamento: MetodoPgto };
}

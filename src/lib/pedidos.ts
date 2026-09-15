import { supabase } from './supabase';
import { ItemCarrinho, MetodoPgto } from '../types';

export interface CreatePedidoParams {
  chave: string;
  metodo?: MetodoPgto;
  cashback_usado?: number;
  lojaId: string;
  tipo_pedido: string;
  origem: string;
  identificador_cliente: string;
  cliente_id?: string | null;
  comanda_id?: string;
  mesa_numero?: number;
  subtotal: number;
  desconto: number;
  valor_total: number;
  troco_para?: number | null;
  carrinho: ItemCarrinho[];
}

export async function createPedidoPedido(dados: CreatePedidoParams) {
  const { data, error } = await supabase.rpc('fn_pdv_registrar', {
    p_chave: dados.chave,
    p_payload: {
      loja_id: dados.lojaId, tipo_pedido: dados.tipo_pedido,
      identificador_cliente: dados.identificador_cliente, cliente_id: dados.cliente_id ?? null,
      comanda_id: dados.comanda_id ?? null, mesa_numero: dados.mesa_numero ?? null,
      desconto: dados.desconto, valor_total: Math.round(dados.valor_total * 100) / 100,
      troco_para: dados.troco_para ?? null, metodo: dados.metodo ?? null,
      cashback_usado: dados.cashback_usado ?? 0,
      itens: dados.carrinho.map((item) => ({
        produto_id: item.produto.id, quantidade: item.quantidade,
        observacao: item.observacao ?? null, assento_numero: item.assento_numero ?? null,
        opcoes: item.opcoesSelecionadas.map((opcao) => ({ id: opcao.id })),
      })),
    },
  });
  if (error || !data) throw error ?? new Error('Não foi possível confirmar a venda.');
  return data as { id: string; numero: number; senha: number | null; valor_total: number; requer_cozinha: boolean };
}

import { supabase } from './supabase';
import { ItemCarrinho } from '../types';

export interface CreatePedidoParams {
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
  const temCozinha = dados.carrinho.some(
    (i) => i.produto.estacao_preparo === 'COZINHA' || !i.produto.estacao_preparo
  );

  const baseInsert = {
    loja_id: dados.lojaId,
    tipo_pedido: dados.tipo_pedido,
    origem: dados.origem,
    identificador_cliente: dados.identificador_cliente,
    cliente_id: dados.cliente_id ?? null,
    comanda_id: dados.comanda_id,
    mesa_numero: dados.mesa_numero,
    subtotal: dados.subtotal,
    desconto: dados.desconto,
    valor_total: dados.valor_total,
    troco_para: dados.troco_para,
    requer_cozinha: temCozinha,
    estacao_atual: temCozinha ? 'COZINHA' : 'BALCAO',
    enviado_cozinha_em: temCozinha ? new Date().toISOString() : null,
  };

  const { data: ped, error: e1 } = await supabase.from('pedidos').insert({
    ...baseInsert,
    etapa_kds_atual: 'etapa_fila',
  }).select('id, numero').single();

  if (e1 || !ped) throw e1 ?? new Error('Falha ao criar o pedido');

  for (const item of dados.carrinho) {
    const precoItemFinal = Number(item.produto.preco) + item.opcoesSelecionadas.reduce((s, o) => s + Number(o.preco_adicional), 0);
    
    const { data: it, error: e2 } = await supabase.from('itens_pedido').insert({
      pedido_id: ped.id,
      produto_id: item.produto.id,
      nome_produto: item.produto.nome,
      preco_unitario: precoItemFinal,
      quantidade: item.quantidade,
      observacao: item.observacao ?? null,
    }).select('id').single();
    
    if (e2 || !it) throw e2 ?? new Error('Falha ao registrar item');
    
    if (item.opcoesSelecionadas.length > 0) {
      const { error: e3 } = await supabase.from('itens_pedido_opcoes').insert(
        item.opcoesSelecionadas.map((o) => ({
          item_id: it.id, 
          opcao_id: o.id, 
          nome_opcao: o.nome, 
          preco_adicional: Number(o.preco_adicional)
        }))
      );
      if (e3) throw e3;
    }
  }

  // Desconta os insumos da Ficha Técnica e Adicionais, gerando movimentação de estoque.
  //
  // A venda NÃO é desfeita se a baixa falhar: o cliente está no balcão e o
  // pedido já existe. Mas o erro também não pode sumir — `fn_baixar_estoque`
  // levanta exceção quando um insumo ficaria negativo, e essa exceção vinha
  // sendo descartada aqui. O efeito era o pior possível: a venda concluía, o
  // estoque não baixava e ninguém ficava sabendo. O inventário ia divergindo
  // do real em silêncio — justamente o número que o lojista compra da gente.
  //
  // Agora a falha sobe junto com o pedido, para a tela avisar o operador.
  const { error: erroEstoque } = await supabase.rpc('fn_baixar_estoque', { p_pedido_id: ped.id });

  return { ...ped, avisoEstoque: erroEstoque?.message ?? null };
}

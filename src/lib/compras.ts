/**
 * Módulo de Compras — tipos e serviços.
 *
 * ─── O MODELO ──────────────────────────────────────────────────────────────
 * Uma `compra` é UM documento que muda de natureza ao longo da vida: nasce
 * rascunho (o que eu preciso), vira pedido (o que eu encomendei) e morre nota
 * conferida (o que de fato chegou). Intenção e fato moram na mesma linha de
 * `compras_itens` porque a diferença entre os dois é o produto: quem pediu
 * 10 kg e recebeu 6, de outra marca, 15% mais caro, está sendo informado
 * sobre o seu fornecedor.
 *
 * O recebimento roda numa RPC transacional (`fn_receber_compra`) e não em
 * chamadas soltas do navegador — estoque que sobe pela metade é estoque que
 * mente.
 */

import { supabase } from './supabase';
import { opcoesDeEntrada } from './unidades';
import type { Insumo } from '../types';

export type CompraStatus =
  | 'RASCUNHO' | 'ENVIADO' | 'RECEBIDO_PARCIAL' | 'RECEBIDO' | 'CANCELADO';

export type CompraItemStatus =
  | 'PENDENTE' | 'RECEBIDO' | 'PARCIAL' | 'NAO_VEIO' | 'SUBSTITUIDO';

export const ROTULO_STATUS: Record<CompraStatus, string> = {
  RASCUNHO: 'Rascunho',
  ENVIADO: 'Pedido enviado',
  RECEBIDO_PARCIAL: 'Recebido em parte',
  RECEBIDO: 'Recebido',
  CANCELADO: 'Cancelado',
};

export const ROTULO_ITEM_STATUS: Record<CompraItemStatus, string> = {
  PENDENTE: 'A conferir',
  RECEBIDO: 'Recebido',
  PARCIAL: 'Veio menos',
  NAO_VEIO: 'Não veio',
  SUBSTITUIDO: 'Substituído',
};

export interface Fornecedor {
  id: string;
  loja_id: string;
  nome: string;
  razao_social?: string | null;
  cnpj?: string | null;
  telefone?: string | null;
  email?: string | null;
  contato_nome?: string | null;
  prazo_entrega_dias?: number | null;
  pedido_minimo?: number | null;
  condicao_pagamento?: string | null;
  dias_entrega?: number[] | null;
  observacao?: string | null;
  ativo: boolean;
  criado_em?: string;
}

export interface CompraItem {
  id: string;
  compra_id: string;
  loja_id: string;
  insumo_id: string;
  qtd_pedida: number;
  unidade_pedida: string;
  fator_pedida: number;
  preco_unitario_previsto?: number | null;
  status: CompraItemStatus;
  insumo_recebido_id?: string | null;
  qtd_recebida?: number | null;
  unidade_recebida?: string | null;
  fator_recebida?: number | null;
  preco_total_pago?: number | null;
  marca?: string | null;
  lote_fornecedor?: string | null;
  vence_em?: string | null;
  recebido_em?: string | null;
  observacao?: string | null;
  insumo?: Pick<Insumo, 'id' | 'nome' | 'unidade_medida' | 'detalhes_rendimento'>;
}

export interface CompraResumo {
  id: string;
  loja_id: string;
  status: CompraStatus;
  numero_nota?: string | null;
  data_pedido: string;
  data_prevista?: string | null;
  recebido_em?: string | null;
  frete: number;
  desconto: number;
  observacao?: string | null;
  fornecedor_id?: string | null;
  fornecedor_nome?: string | null;
  itens_total: number;
  itens_conferidos: number;
  total_previsto: number;
  total_pago: number;
}

/** Uma leitura por insumo: quanto sai por dia e quanto tempo o saldo cobre. */
export interface InsumoGiro {
  insumo_id: string;
  loja_id: string;
  nome: string;
  unidade_medida: string;
  quantidade_atual: number;
  estoque_minimo: number;
  categoria_insumo?: string | null;
  fornecedor_padrao_id?: string | null;
  fornecedor_nome?: string | null;
  prazo_entrega_dias?: number | null;
  consumo_30d: number;
  consumo_diario: number;
  dias_cobertura: number | null;
  perda_30d: number;
  custo_unitario: number;
  capital_parado: number;
}

export interface LoteValidade {
  lote_id: string;
  insumo_id: string;
  insumo_nome: string;
  unidade_medida: string;
  lote_fornecedor?: string | null;
  vence_em: string;
  dias_para_vencer: number;
  quantidade_restante: number;
  custo_unitario: number;
  valor_em_risco: number;
  risco: 'VENCIDO' | 'CRITICO' | 'ATENCAO' | 'OK';
}

export interface HistoricoPreco {
  insumo_id: string;
  insumo_nome: string;
  unidade_base: string;
  fornecedor_id?: string | null;
  fornecedor_nome?: string | null;
  marca?: string | null;
  recebido_em: string;
  numero_nota?: string | null;
  qtd_recebida: number;
  unidade_recebida: string;
  preco_total_pago: number;
  qtd_base: number;
  custo_unitario_base: number;
}

// ---------------------------------------------------------------------------
// Sugestão de compra
// ---------------------------------------------------------------------------

export interface SugestaoCompra {
  insumo: Insumo;
  giro?: InsumoGiro;
  /** Unidade em que este insumo é comprado (topo da cadeia de rendimento). */
  unidadeCompra: string;
  /** Quantas unidades-base valem 1 unidade de compra. */
  fator: number;
  /** Quanto falta, na unidade de uso. */
  faltaBase: number;
  /** Quanto comprar, na unidade de compra (embalagens inteiras). */
  qtdSugerida: number;
  precoUnitario: number;
  diasCobertura: number | null;
  urgencia: 'ZERADO' | 'CRITICO' | 'COBERTURA';
  /** Dias entre pedir e receber, segundo o cadastro do fornecedor. */
  prazoEntrega: number;
  /**
   * O estoque acaba antes da mercadoria chegar. É o alerta mais acionável da
   * tela: não adianta pedir na quantidade certa se já é tarde.
   */
  rupturaAntesDaEntrega: boolean;
  fornecedorId: string | null;
  fornecedorNome: string | null;
}

/**
 * Quanto comprar de um insumo para cobrir `diasAlvo` dias de operação.
 *
 * Duas correções sobre o "estoque mínimo" clássico:
 *
 *  1. O mínimo sozinho é um número digitado uma vez e esquecido — ignora que
 *     dois itens com o mesmo mínimo podem girar 10 kg/dia e 200 g/dia. Aqui o
 *     alvo é o MAIOR entre o mínimo cadastrado e o consumo real projetado: o
 *     cadastro vira piso, não verdade única.
 *
 *  2. Mercadoria não chega no ato. Se o fornecedor entrega em 2 dias, comprar
 *     hoje o que cobre 7 dias deixa a operação descoberta — o alvo tem que
 *     cobrir o ciclo MAIS o prazo de entrega (ponto de pedido).
 *
 * Retorna null quando não há o que comprar.
 */
export function sugerirCompra(
  insumo: Insumo,
  giro: InsumoGiro | undefined,
  diasAlvo = 7,
): SugestaoCompra | null {
  const saldo = Number(insumo.quantidade_atual) || 0;
  const minimo = Number(insumo.estoque_minimo) || 0;
  const consumoDiario = Number(giro?.consumo_diario) || 0;
  const prazoEntrega = Math.max(0, Number(giro?.prazo_entrega_dias) || 0);

  // Comprar hoje precisa cobrir até a PRÓXIMA entrega chegar, não até hoje.
  const alvo = Math.max(minimo, consumoDiario * (diasAlvo + prazoEntrega));
  if (alvo <= 0 || saldo > alvo) return null;

  const opcoes = opcoesDeEntrada(
    insumo.unidade_medida,
    insumo.detalhes_rendimento?.regras,
    insumo.detalhes_rendimento?.equivalencias,
  );
  const compra = opcoes[0] ?? { codigo: insumo.unidade_medida, fatorParaBase: 1 };
  const fator = compra.fatorParaBase > 0 ? compra.fatorParaBase : 1;

  const faltaBase = alvo - saldo;
  // Fornecedor não vende meia caixa: arredonda para embalagem inteira.
  const qtdSugerida = Math.max(1, Math.ceil(faltaBase / fator));

  const diasCobertura = giro?.dias_cobertura ?? null;

  return {
    insumo,
    giro,
    unidadeCompra: compra.codigo,
    fator,
    faltaBase,
    qtdSugerida,
    precoUnitario: Number(insumo.preco_embalagem) || 0,
    diasCobertura,
    urgencia: saldo <= 0 ? 'ZERADO' : saldo <= minimo ? 'CRITICO' : 'COBERTURA',
    prazoEntrega,
    // Zerado com prazo de entrega é ruptura por definição: já está descoberto.
    rupturaAntesDaEntrega: prazoEntrega > 0 && (diasCobertura ?? 0) < prazoEntrega,
    fornecedorId: giro?.fornecedor_padrao_id ?? null,
    fornecedorNome: giro?.fornecedor_nome ?? null,
  };
}

// ---------------------------------------------------------------------------
// Serviços
// ---------------------------------------------------------------------------

export async function listarFornecedores(lojaId: string): Promise<Fornecedor[]> {
  const { data, error } = await supabase
    .from('fornecedores').select('*')
    .eq('loja_id', lojaId).eq('ativo', true).order('nome');
  if (error) throw error;
  return (data as Fornecedor[]) ?? [];
}

export async function salvarFornecedor(f: Partial<Fornecedor> & { loja_id: string; nome: string }) {
  const payload = { ...f, nome: f.nome.trim() };
  const { data, error } = f.id
    ? await supabase.from('fornecedores').update(payload).eq('id', f.id).select().single()
    : await supabase.from('fornecedores').insert(payload).select().single();
  if (error) throw error;
  return data as Fornecedor;
}

/** Arquiva em vez de apagar: fornecedor apagado levaria junto o histórico de preço. */
export async function arquivarFornecedor(id: string) {
  const { error } = await supabase.from('fornecedores').update({ ativo: false }).eq('id', id);
  if (error) throw error;
}

export async function listarCompras(lojaId: string, limite = 50): Promise<CompraResumo[]> {
  const { data, error } = await supabase
    .from('vw_compras_resumo').select('*')
    .eq('loja_id', lojaId)
    .order('data_pedido', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data as CompraResumo[]) ?? [];
}

export async function carregarItens(compraId: string): Promise<CompraItem[]> {
  const { data, error } = await supabase
    .from('compras_itens')
    .select('*, insumo:insumos!compras_itens_insumo_id_fkey(id, nome, unidade_medida, detalhes_rendimento)')
    .eq('compra_id', compraId)
    .order('criado_em');
  if (error) throw error;
  return (data as CompraItem[]) ?? [];
}

export interface NovoItemCompra {
  insumo_id: string;
  qtd_pedida: number;
  unidade_pedida: string;
  fator_pedida: number;
  preco_unitario_previsto?: number | null;
}

export async function criarCompra(
  lojaId: string,
  itens: NovoItemCompra[],
  dados: { fornecedor_id?: string | null; data_prevista?: string | null; observacao?: string | null; status?: CompraStatus } = {},
): Promise<string> {
  const { data, error } = await supabase.from('compras').insert({
    loja_id: lojaId,
    fornecedor_id: dados.fornecedor_id ?? null,
    data_prevista: dados.data_prevista ?? null,
    observacao: dados.observacao ?? null,
    status: dados.status ?? 'ENVIADO',
  }).select('id').single();
  if (error) throw error;

  const compraId = (data as { id: string }).id;
  if (itens.length > 0) {
    const { error: errItens } = await supabase.from('compras_itens').insert(
      itens.map(i => ({ ...i, compra_id: compraId, loja_id: lojaId })),
    );
    // Compra sem itens não serve para nada: melhor não deixar o documento órfão.
    if (errItens) {
      await supabase.from('compras').delete().eq('id', compraId);
      throw errItens;
    }
  }
  return compraId;
}

export async function cancelarCompra(id: string) {
  const { error } = await supabase.from('compras').update({ status: 'CANCELADO' }).eq('id', id);
  if (error) throw error;
}

/** O que se declara ao conferir cada item da entrega. */
export interface ItemRecebimento {
  item_id: string;
  qtd: number;
  unidade: string;
  fator: number;
  preco_total?: number | null;
  marca?: string | null;
  lote?: string | null;
  vence_em?: string | null;
  observacao?: string | null;
  /** Preenchido só quando veio outro insumo no lugar do pedido. */
  insumo_recebido_id?: string | null;
}

export interface ResultadoRecebimento {
  compra_id: string;
  status: CompraStatus;
  itens_recebidos: number;
  itens_divergentes: number;
  itens_pendentes: number;
  total_pago: number;
}

export async function receberCompra(
  compraId: string,
  itens: ItemRecebimento[],
  extras: { numero_nota?: string | null; recebido_em?: string; frete?: number | null; desconto?: number | null } = {},
): Promise<ResultadoRecebimento> {
  const { data, error } = await supabase.rpc('fn_receber_compra', {
    p_compra_id: compraId,
    p_itens: itens,
    p_numero_nota: extras.numero_nota ?? null,
    p_recebido_em: extras.recebido_em ?? new Date().toISOString(),
    p_frete: extras.frete ?? null,
    p_desconto: extras.desconto ?? null,
  });
  if (error) throw error;
  return data as ResultadoRecebimento;
}

export async function carregarGiro(lojaId: string): Promise<InsumoGiro[]> {
  const { data, error } = await supabase
    .from('vw_insumo_giro').select('*').eq('loja_id', lojaId);
  if (error) throw error;
  return (data as InsumoGiro[]) ?? [];
}

export async function carregarValidades(lojaId: string): Promise<LoteValidade[]> {
  const { data, error } = await supabase
    .from('vw_lotes_validade').select('*')
    .eq('loja_id', lojaId).neq('risco', 'OK')
    .order('dias_para_vencer');
  if (error) throw error;
  return (data as LoteValidade[]) ?? [];
}

export async function historicoPrecos(insumoId: string, limite = 30): Promise<HistoricoPreco[]> {
  const { data, error } = await supabase
    .from('vw_historico_precos_compra').select('*')
    .eq('insumo_id', insumoId)
    .order('recebido_em', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data as HistoricoPreco[]) ?? [];
}

// ---------------------------------------------------------------------------
// Transformações: monta e desmonta
// ---------------------------------------------------------------------------

export interface LadoTransformacao {
  insumo_id: string;
  qtd: number;
  unidade: string;
  fator: number;
  /**
   * Peso do rateio de custo (só nos destinos). Existe porque nem toda parte
   * vale o mesmo: 1 kg de filé não custa o que custa 1 kg de carcaça, ainda
   * que saiam do mesmo animal. Ausente ⇒ rateia pela quantidade.
   */
  peso?: number;
  vence_em?: string | null;
}

export interface ResultadoTransformacao {
  transformacao_id: string;
  custo_consumido: number;
  custo_atribuido: number;
  destinos: number;
}

export async function transformarEstoque(
  lojaId: string,
  tipo: 'DESMONTE' | 'MONTAGEM',
  origens: LadoTransformacao[],
  destinos: LadoTransformacao[],
  observacao?: string,
): Promise<ResultadoTransformacao> {
  const { data, error } = await supabase.rpc('fn_transformar_estoque', {
    p_loja_id: lojaId,
    p_tipo: tipo,
    p_origens: origens,
    p_destinos: destinos,
    p_observacao: observacao ?? null,
  });
  if (error) throw error;
  return data as ResultadoTransformacao;
}

export interface ResultadoInventario {
  movimentacao_id?: string;
  saldo_anterior?: number;
  saldo_novo?: number;
  diferenca: number;
  unidade_base?: string;
  custo_diferenca?: number;
  mensagem?: string;
}

export async function ajustarInventario(
  insumoId: string,
  qtdContada: number,
  unidade: string,
  fator: number,
  observacao?: string,
): Promise<ResultadoInventario> {
  const { data, error } = await supabase.rpc('fn_ajustar_inventario', {
    p_insumo_id: insumoId,
    p_qtd_contada: qtdContada,
    p_unidade: unidade,
    p_fator: fator,
    p_observacao: observacao ?? null,
  });
  if (error) throw error;
  return data as ResultadoInventario;
}

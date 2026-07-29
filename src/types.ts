// ── Tipos espelhando o schema Supabase ──────────────────────

export type TipoPedido = 'DELIVERY' | 'SALAO' | 'RETIRADA_BALCAO';
export type StatusPedido = 'NOVO' | 'ACEITO' | 'PREPARANDO' | 'PRONTO' | 'EM_ROTA' | 'FINALIZADO' | 'CANCELADO';
export type MetodoPgto = 'PIX' | 'CREDITO' | 'DEBITO' | 'DINHEIRO' | 'IFOOD';
export type TipoRemetente = 'CLIENTE' | 'LOJA' | 'ENTREGADOR';
export type TipoRemuneracao = 'FIXO' | 'POR_ENTREGA' | 'POR_KM' | 'DESLIGADO';
export type StatusRota = 'PENDENTE' | 'EM_ANDAMENTO' | 'FINALIZADA';
export type EntregaModo = 'BAIRRO' | 'DISTANCIA' | 'HIBRIDO';
// Fluxo passa-bastão (docs/PLANO-FLUXO-PEDIDOS.md): estação de preparo do
// produto e o bastão atual do pedido entre balcão e cozinha.
export type EstacaoPreparo = 'COZINHA' | 'DIRETO';
export type EstacaoAtual = 'BALCAO' | 'COZINHA';
export type TipoVenda = 'UNITARIO' | 'POR_PESO';

export interface EtapaKDS {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  estacaoPreparo?: string;
}

export interface LeadCadastro {
  id: string;
  nome_responsavel: string;
  nome_loja: string;
  tipo_negocio?: string | null;
  cidade?: string | null;
  whatsapp: string;
  email?: string | null;
  observacao?: string | null;
  status: 'novo' | 'contatado' | 'convertido' | 'descartado';
  criado_em: string;
}

export interface Loja {
  id: string;
  slug: string;
  nome: string;
  descricao?: string;
  logo_url?: string;
  banner_url?: string;
  cor_primaria: string;
  cor_secundaria: string;
  fonte?: string;
  cor_texto?: string;
  cor_fundo_claro?: string | null;
  cor_fundo_escuro?: string | null;
  tema_cardapio?: 'claro' | 'escuro' | null;
  whatsapp: string;
  telefone?: string;
  endereco?: string;
  cnpj?: string;
  razao_social?: string;
  pedido_minimo: number;
  aberto_manual?: boolean | null;
  aceita_agendamento?: boolean | null;
  agendamento_antecedencia_min?: number | null; // antecedência mínima p/ agendar, em minutos
  nfe_ambiente?: 'homologacao' | 'producao';
  nfe_habilitado?: boolean;
  nfe_regime_tributario?: string;
  nfe_inscricao_estadual?: string;
  nfe_id_csc?: string;
  nfe_csc?: string;

  // iFood
  ifood_merchant_id?: string;
  ifood_authorization_code?: string;
  ifood_refresh_token?: string;
  plano_tipo?: string;
  ifood_addon_ativo?: boolean;
  ifood_taxa_pct?: number;
  ifood_taxa_fixa?: number;

  cashback_pct?: number | null; // % do pedido creditado como saldo pro cliente (0 = desligado)
  meta_preparo_min?: number; // meta de tempo de preparo da cozinha (min), default 20
  pix_chave?: string;
  efi_payee_code?: string; // habilita cartão de crédito online + split de cartão (Efí)
  efi_titular_documento?: string | null; // CPF/CNPJ do titular da conta Efí (favorecido do split Pix)
  efi_conta?: string | null; // número da conta Efí do lojista (favorecido do split Pix)
  antecipacao_cartao?: boolean | null; // true = crédito processado na modalidade antecipada (~2 dias úteis, taxa maior)
  taxa_servico_padrao_pct?: number | null; // % sugerido ao abrir uma comanda de mesa (editável no fechamento)
  status_assinatura?: 'trial' | 'ativa' | 'atrasada' | 'cancelada' | 'vitalicio' | null;
  trial_termina_em?: string | null; // data-limite: fim do trial ou próximo vencimento da assinatura paga
  // Entrega / geolocalização
  lat?: number | null;
  lng?: number | null;
  entrega_modo?: EntregaModo | null;
  entrega_taxa_base?: number | null;
  entrega_taxa_km?: number | null;
  entrega_raio_km?: number | null;
  entrega_taxa_padrao?: number | null;
  // Formas de pagamento aceitas
  aceita_online?: boolean | null;   // Pix/Crédito via Efí (pague agora)
  aceita_entrega?: boolean | null;  // Dinheiro/maquininha (pague na entrega)
  kds_etapas?: EtapaKDS[] | null; // Configuração de etapas do KDS Kanban
  segmento_negocio?: SegmentoNegocio | null;
  modulos_ativos?: ModulosAtivos | null;
}

export type SegmentoNegocio =
  | 'HAMBURGUERIA'
  | 'PIZZARIA'
  | 'RESTAURANTE_A_LA_CARTE'
  | 'RESTAURANTE_POR_QUILO'
  | 'DARK_KITCHEN'
  | 'BAR_PUB'
  | 'GERAL';

export interface ModulosAtivos {
  balanca?: boolean;
  mesas_3d?: boolean;
  garcom_pwa?: boolean;
  pizzas?: boolean;
  kds?: boolean;
  entregas?: boolean;
  ifood?: boolean;
  fiscal?: boolean;
}

export interface ReposicaoBuffet {
  id: string;
  loja_id: string;
  preparo_id: string;
  nome_cuba: string;
  peso_reposto_kg: number;
  peso_sobra_limpa_kg?: number;
  status?: 'NA_PISTA' | 'FECHADO';
  custo_estimado_total?: number;
  preparado_por?: string | null;
  observacao?: string | null;
  criado_em: string;
  preparo?: Insumo;
}

export interface HorarioFuncionamento {
  id?: string;
  dia_semana: number; // 0=domingo
  abre: string;
  fecha: string;
}

export interface Banner {
  id: string;
  imagem_url: string;
  titulo?: string;
  link_redirecionamento?: string;
  ordem_exibicao: number;
  is_ativo?: boolean;
}

export interface Categoria {
  id: string;
  nome: string;
  ordem: number;
  ativo?: boolean;
}

export interface Opcao {
  id: string;
  grupo_id: string;
  nome: string;
  preco_adicional: number;
  disponivel: boolean;
  insumo_id?: string | null;
  quantidade_insumo?: number | null;
}

export interface GrupoOpcoes {
  id: string;
  produto_id: string;
  nome: string;
  min_escolhas: number;
  max_escolhas: number;
  ordem?: number;
  opcoes: Opcao[];
}

export interface ProdutoCusto {
  produto_id: string;
  nome: string;
  preco_venda: number;
  custo_insumos: number;
  taxa_rateio: number;
  lucro_bruto: number;
  lucro_liquido: number;
  margem_pct: number;
}

export interface InsumoRendimentoJSON {
  regras: {
    de_qtd: number;
    de_unidade: string;
    para_qtd: number;
    para_unidade: string;
  }[];
  /**
   * Unidades de entrada fora da cadeia de compra, aprendidas quando o lojista
   * recebe o insumo numa medida que ele não cadastrou (ex.: cabeça de alho num
   * item comprado em kg). Ficam à parte de `regras` de propósito: a cadeia é
   * linear e alimenta o custeio; estas são atalhos laterais só de entrada.
   */
  equivalencias?: {
    unidade: string;
    /** Quantas `rende_unidade` valem 1 `unidade`. */
    rende_qtd: number;
    rende_unidade: string;
  }[];
}

export interface FichaTecnica {
  produto_id: string;
  insumo_id: string;
  quantidade_consumida: number;
}

export interface Produto {
  id: string;
  categoria_id?: string;
  nome: string;
  descricao?: string;
  preco: number;
  imagem_url?: string;
  galeria?: string[];
  is_combo: boolean;
  destaque: boolean;
  disponivel: boolean;
  controla_estoque?: boolean;
  ordem?: number;
  vendidos: number;
  tipo_venda?: TipoVenda;
  preco_por_quilo?: number;
  grupos_opcoes?: GrupoOpcoes[];
  fichas_tecnicas?: FichaTecnica[];
  tem_estoque?: boolean; // calculado no client via fn_produtos_com_estoque — não existe como coluna
  estacao_preparo?: EstacaoPreparo; // COZINHA (default) = entra no KDS. DIRETO = revenda, balcão entrega sem passar pela cozinha.
  pdv_code?: string; // para mapeamento com iFood
}

export interface Cupom {
  id: string;
  codigo: string;
  descricao?: string;
  tipo: 'PERCENTUAL' | 'FIXO';
  valor: number;
  pedido_minimo: number;
  apenas_primeiro_pedido: boolean;
  metodo_exigido?: MetodoPgto;
  validade?: string | null;
  limite_usos?: number | null;
  usos?: number;
  ativo?: boolean;
}

export interface TaxaEntrega {
  id: string;
  bairro: string;
  valor: number;
  ativo?: boolean;
}

export interface FaixaEntrega {
  id: string;
  loja_id: string;
  nome?: string | null;
  km_ate: number;
  taxa_fixa?: number | null;
  taxa_por_km?: number | null;
  pedido_minimo?: number | null;
  ordem?: number | null;
  ativo?: boolean | null;
}

export interface ItemCarrinho {
  produto: Produto;
  quantidade: number;
  observacao?: string;
  opcoesSelecionadas: Opcao[];
  assento_numero?: number | null;
}

export interface ItemPedido {
  id: string;
  produto_id?: string | null; // null em itens iFood sem de-para (pdv_code não encontrado)
  nome_produto: string;
  preco_unitario: number;
  quantidade: number;
  observacao?: string;
  assento_numero?: number | null;
  fracionado?: boolean;
  participantes_assentos?: number[] | null;
  quantidade_original?: number | null;
  parent_item_id?: string | null;
  origem_balanca?: boolean;
  tara_g?: number;
  itens_pedido_opcoes?: { nome_opcao: string; preco_adicional: number }[];
  // join opcional com produtos para o KDS saber a estação de preparo de cada item
  produtos?: { estacao_preparo?: EstacaoPreparo | null } | null;
}

export interface Pedido {
  id: string;
  loja_id?: string;
  numero: number;
  tipo_pedido: TipoPedido;
  status: StatusPedido;
  identificador_cliente: string;
  telefone_contato?: string;
  endereco_entrega?: string;
  bairro?: string;
  cep?: string;
  logradouro?: string;
  numero_endereco?: string;
  complemento?: string;
  cidade?: string;
  uf?: string;
  distancia_km?: number | null;
  lat?: number | null;
  lng?: number | null;
  ponto_referencia?: string;
  subtotal: number;
  taxa_entrega: number;
  desconto: number;
  valor_total: number;
  troco_para?: number;
  observacao?: string;
  origem?: string; // link | balcao | mesa | whatsapp | ifood
  ifood_order_id?: string | null;
  valor_bruto_ifood?: number | null;
  taxa_ifood_retida?: number | null;
  comanda_id?: string | null;
  mesa_numero?: number | null;
  agendado_para?: string | null; // null = pedido imediato
  cashback_usado?: number;
  estacao_atual?: EstacaoAtual; // bastão do fluxo: quem pode avançar o pedido agora
  requer_cozinha?: boolean; // true se algum item é estacao_preparo=COZINHA (calculado por trigger)
  enviado_cozinha_em?: string | null;
  devolvido_balcao_em?: string | null;
  conferido_em?: string | null;
  criado_em: string;
  cliente_id?: string | null;
  cliente_user_id?: string | null;
  entregador_id?: string | null;
  rota_id?: string | null;
  ordem_entrega?: number | null;
  itens_pedido?: ItemPedido[];
  pagamentos?: { metodo: MetodoPgto; status: string; valor_pago: number }[];
  nfe_status?: 'NAO_EMITIDA' | 'PROCESSANDO' | 'AUTORIZADA' | 'REJEITADA' | 'CANCELADA' | 'ERRO';
  nfe_chave?: string | null;
  nfe_numero?: string | null;
  nfe_url?: string | null;
  nfe_erros?: any;
  chat_conversation_id?: string | null;
  etapa_kds_atual?: string | null;
  timestamps_etapas_kds?: Record<string, string> | null;
}

export interface Cliente {
  id: string;
  user_id?: string | null;
  telefone: string;
  nome?: string;
  email?: string | null;
  endereco?: string;
  bairro?: string;
  forma_pagamento_preferida?: MetodoPgto | null;
  total_pedidos: number;
  ultimo_pedido?: string | null;
  criado_em: string;
  enderecos?: EnderecoCliente[];
  favoritos?: FavoritoCliente[];
}

// ── Cashback ─────────────────────────────────────────────────

export interface CashbackSaldo {
  cliente_id: string;
  loja_id: string;
  saldo: number;
  atualizado_em: string;
}

export interface CashbackMovimento {
  id: string;
  loja_id: string;
  cliente_id: string;
  pedido_id?: string | null;
  tipo: 'CREDITO' | 'USO';
  valor: number;
  criado_em: string;
}

// ── Recuperação de vendas ────────────────────────────────────

export interface CarrinhoAbandonado {
  id: string;
  loja_id: string;
  user_id: string;
  cliente_id?: string | null;
  itens_resumo: string;
  valor_estimado: number;
  status: 'ABERTO' | 'RECUPERADO';
  criado_em: string;
  atualizado_em: string;
  cliente?: { nome?: string | null; telefone: string } | null;
}

export interface EnderecoCliente {
  id: string;
  cliente_id: string;
  cep: string;
  logradouro: string;
  numero?: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  ponto_referencia?: string;
  padrao: boolean;
}

export interface FavoritoCliente {
  id: string;
  cliente_id: string;
  produto_id: string;
  produto?: Produto;
}

export interface Insumo {
  id: string;
  nome: string;
  unidade_medida: string;
  quantidade_atual: number;
  estoque_minimo: number;
  preco_embalagem: number;
  qtd_embalagem: number;
  detalhes_rendimento?: InsumoRendimentoJSON | null;
  ativo: boolean;
  is_preparo?: boolean;
  categoria_insumo?: string;
  /** Setor físico de armazenamento (geladeira/armario/dispensa); null = automático. */
  setor?: string | null;
  rendimento_porcoes?: number;
  pessoas_servidas?: number;
  validade_horas?: number | null; // preparos: horas até vencer após produção (null = não controla)
  rendimento_padrao_kg?: number | null;
  fichas_preparo?: FichaPreparo[];
  criado_em?: string;
}

export interface ProducaoPreparo {
  id: string;
  loja_id: string;
  preparo_id: string;
  lotes: number;
  quantidade_produzida: number;
  produzido_em: string;
  vence_em?: string | null;
  status: 'ATIVO' | 'DESCARTADO';
  descartado_em?: string | null;
  quantidade_descartada?: number | null;
}

export type TipoContrato = 'CLT' | 'FREELANCE' | 'PJ' | 'TEMPORARIO';

export interface MembroEquipe {
  user_id: string;
  papel: string;
  nome?: string | null;
  telefone?: string | null;
  tipo_contrato: TipoContrato;
  criado_em?: string | null;
  email: string;
  ultimo_acesso?: string | null;
  confirmado?: boolean;
  sou_eu?: boolean;
}

export interface FichaPreparo {
  id: string;
  loja_id: string;
  preparo_id: string;
  insumo_id: string;
  quantidade: number;
  insumo?: Insumo;
}

// ── Logistics ────────────────────────────────────────────────

export interface Entregador {
  id: string;
  loja_id: string;
  user_id?: string | null;
  nome: string;
  telefone: string;
  veiculo?: string | null;
  placa?: string | null;
  ativo: boolean;
  criado_em: string;
}

export interface RotaEntrega {
  id: string;
  loja_id: string;
  entregador_id: string;
  status: StatusRota;
  criado_em: string;
  finalizado_em?: string | null;
  entregador?: Entregador;
  pedidos?: Pedido[];
}

export interface MensagemPedido {
  id: string;
  pedido_id: string;
  remetente_tipo: TipoRemetente;
  mensagem: string;
  lida: boolean;
  criado_em: string;
}

// ── Mesas & Comandas (salão) ────────────────────────────────────

export type FormatoMesa = 'REDONDA' | 'QUADRADA' | 'RETANGULAR' | 'BOOTH';

export interface Mesa {
  id: string;
  loja_id: string;
  numero: number;
  nome?: string | null;
  capacidade?: number | null;
  pos_x?: number | null;
  pos_z?: number | null;
  rotacao?: number | null;
  formato?: FormatoMesa | null;
  setor?: string | null;
  ativo: boolean;
  criado_em: string;
}

export interface Comanda {
  id: string;
  loja_id: string;
  mesa_id?: string | null;
  status: 'ABERTA' | 'FECHADA';
  taxa_servico_pct: number;
  valor_servico: number;
  metodo_pagamento?: string | null;
  aberta_em: string;
  fechada_em?: string | null;
  fechada_por?: string | null;
  tipo_comanda?: 'MESA' | 'INDIVIDUAL';
  numero_cartao?: string | null;
  nome_cliente?: string | null;
  comanda_mae_id?: string | null;
}

// ── Balança & PWA Garçom ──────────────────────────────────────

export type ProtocoloBalanca = 'TOLEDO_PRIX3' | 'TOLEDO_PRIX4' | 'FILIZOLA_CS15' | 'URANO' | 'CUSTOM_SERIAL' | 'NETWORK_TCP' | 'EMULADOR';
export type ModoConexaoBalanca = 'WEB_SERIAL' | 'NETWORK_WEBHOOK' | 'EMULADOR';

export interface BalancaConfiguracao {
  id: string;
  loja_id: string;
  protocolo: ProtocoloBalanca;
  modo_conexao: ModoConexaoBalanca;
  baud_rate: number;
  data_bits: number;
  stop_bits: number;
  parity: 'none' | 'even' | 'odd';
  tara_padrao_g: number;
  produto_buffet_id?: string | null;
  ip_dispositivo?: string | null;
  porta_dispositivo?: number | null;
  ativo: boolean;
  criado_em?: string;
  atualizado_em?: string;
}

export type TipoChamadoGarcom = 'ATENDIMENTO' | 'FECHAMENTO' | 'DUVIDA' | 'OUTRO';
export type StatusChamadoGarcom = 'PENDENTE' | 'EM_ATENDIMENTO' | 'CONCLUIDO' | 'CANCELADO';

export interface ChamadoGarcom {
  id: string;
  loja_id: string;
  mesa_id?: string | null;
  comanda_id?: string | null;
  assento_numero?: number | null;
  tipo: TipoChamadoGarcom;
  status: StatusChamadoGarcom;
  mensagem?: string | null;
  atendido_por?: string | null;
  criado_em: string;
  atendido_em?: string | null;
  mesa_numero?: number;
}


// ── Frente de Caixa ───────────────────────────────────────────

export interface CaixaTurno {
  id: string;
  loja_id: string;
  aberto_por?: string | null;
  aberto_por_nome?: string | null;
  fundo_troco: number;
  aberto_em: string;
  fechado_em?: string | null;
  valor_esperado?: number | null;
  valor_contado?: number | null;
  diferenca?: number | null;
  observacao?: string | null;
  status: 'ABERTO' | 'FECHADO';
}

export interface CaixaMovimentacao {
  id: string;
  loja_id: string;
  turno_id: string;
  tipo: 'SANGRIA' | 'REFORCO';
  valor: number;
  motivo?: string | null;
  criado_em: string;
}

// ── Configurações ─────────────────────────────────────────────

export interface CheckoutStatus {
  totalPedidosMes: number;
  faturamentoMes: number;
  taxaSetupMensal: number;
  mensalidadeAtual: number;
}

// ── Chat Interno ──────────────────────────────────────────────
export interface ChatConversation {
  id: string;
  loja_id: string;
  cliente_id?: string | null;
  session_id?: string | null;
  criado_em: string;
  canal?: 'VITRINE' | 'WHATSAPP';
  telefone?: string | null;
  wa_janela_expira_em?: string | null;
  ia_ativa?: boolean;
  // Join virtual
  mensagens_nao_lidas?: number;
  ultima_mensagem?: string;
  data_ultima_mensagem?: string;
  cliente_nome?: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  remetente_tipo: 'CLIENTE' | 'LOJA' | 'SISTEMA';
  conteudo: string;
  lida: boolean;
  criado_em: string;
}

export interface ConfiguracoesCusto {
  loja_id: string;
  custo_aluguel: number;
  custo_energia: number;
  custo_agua: number;
  custo_internet: number;
  custo_gas: number;
  outros_custos_fixos: number;
  expectativa_vendas_mes: number;
  tipo_remuneracao_entregador?: TipoRemuneracao;
  valor_remuneracao_entregador?: number;
  entregador_taxa_minima?: number;
  entregador_raio_minimo_km?: number;
  entregador_taxa_km_excedente?: number;
  criado_em?: string;
  atualizado_em?: string;
}

// ── Utilitários ───────────────────────────────────────────────

export const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const fmtQtd = (qtd: number, tipoVenda?: TipoVenda) => {
  if (tipoVenda === 'POR_PESO') {
    return `${qtd.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`;
  }
  return String(qtd);
};

export const precoItem = (i: ItemCarrinho) => {
  const precoBase = i.produto.tipo_venda === 'POR_PESO'
    ? Number(i.produto.preco_por_quilo || 0) * i.quantidade
    : Number(i.produto.preco) * i.quantidade;
  const precoExtras = i.opcoesSelecionadas.reduce((s, o) => s + Number(o.preco_adicional), 0) * (i.produto.tipo_venda === 'POR_PESO' ? 1 : i.quantidade);
  return precoBase + precoExtras;
};

// ── Props & Types UI ──────────────────────────────────────────

export type Via = 'cozinha' | 'romaneio' | 'nota';
export type EtapaVenda = 'CARRINHO' | 'PAGANDO' | 'PIX_AGUARDANDO' | 'SUCESSO';
export type ModoPDV = 'BALCAO' | 'MESA';

export interface VendaConcluida {
  pedidoId: string;
  numero: number;
  total: number;
  metodo: MetodoPgto;
  troco: number;
  itens: ItemCarrinho[];
  temCozinha?: boolean;
}

export interface PedidoHeaderProps {
  pedido: Pedido;
}

export interface PedidoItensProps {
  pedido: Pedido;
  precisaConferir: boolean;
  conferidos: Set<string>;
  toggleConferido: (id: string) => void;
}

export interface PedidoFooterProps {
  pedido: Pedido;
}

export interface PedidoActionsProps {
  pedido: Pedido;
  papel: string;
  naCozinha: boolean;
  precisaConferir: boolean;
  todosConferidos: boolean;
  semAvancoSalao: boolean;
  destinoStatus: StatusPedido;
  destinoLabel: string;
  isDelivery: boolean;
  processando: boolean;
  fluxoProx?: StatusPedido;
  fluxoLabel?: string;
  onAvancar: (status: StatusPedido) => Promise<void>;
  onEnviarCozinha: () => Promise<void>;
  onCancelar: () => void;
  onImprimir: (via: Via) => void;
  executar: (fn: () => Promise<void>) => Promise<void>;
}
export interface PedidoItensProps {
  pedido: Pedido;
  precisaConferir: boolean;
  conferidos: Set<string>;
  toggleConferido: (id: string) => void;
}

export interface PedidoFooterProps {
  pedido: Pedido;
}

export interface PedidoActionsProps {
  pedido: Pedido;
  papel: string;
  naCozinha: boolean;
  precisaConferir: boolean;
  todosConferidos: boolean;
  semAvancoSalao: boolean;
  destinoStatus: StatusPedido;
  destinoLabel: string;
  isDelivery: boolean;
  processando: boolean;
  fluxoProx?: StatusPedido;
  fluxoLabel?: string;
  onAvancar: (status: StatusPedido) => Promise<void>;
  onEnviarCozinha: () => Promise<void>;
  onCancelar: () => void;
  onImprimir: (via: Via) => void;
  executar: (fn: () => Promise<void>) => Promise<void>;
}

export interface HeaderBarProps {
  modo: ModoPDV;
  setModo: (modo: ModoPDV) => void;
  turno: CaixaTurno | null | undefined;
  dinheiroGaveta: number;
  setModalCaixa: (modal: 'ABRIR' | 'SANGRIA' | 'REFORCO' | 'FECHAR' | null) => void;
  setValorCaixa: (valor: string) => void;
}

export interface CaixaModalProps {
  modalCaixa: 'ABRIR' | 'SANGRIA' | 'REFORCO' | 'FECHAR' | null;
  setModalCaixa: (modal: 'ABRIR' | 'SANGRIA' | 'REFORCO' | 'FECHAR' | null) => void;
  salvandoCaixa: boolean;
  valorCaixa: string;
  setValorCaixa: (valor: string) => void;
  motivoCaixa: string;
  setMotivoCaixa: (motivo: string) => void;
  obsFechamento: string;
  setObsFechamento: (obs: string) => void;
  turno: CaixaTurno | null | undefined;
  dinheiroTurno: number;
  reforcos: number;
  sangrias: number;
  dinheiroGaveta: number;
  abrirTurno: () => Promise<void>;
  registrarMov: (tipo: 'SANGRIA' | 'REFORCO') => Promise<void>;
  fecharTurno: () => Promise<void>;
}

export interface Movimentacao {
  id: string;
  loja_id: string;
  insumo_id: string;
  tipo: string;
  quantidade: number;
  motivo?: string;
  pedido_id?: string;
  lote_fornecedor?: string;
  vence_em?: string;
  criado_em: string;
}

export interface ProductGridProps {
  busca: string;
  setBusca: (busca: string) => void;
  categorias: { id: string; nome: string }[];
  catAtiva: string;
  setCatAtiva: (cat: string) => void;
  produtosVisiveis: Produto[];
  tocarProduto: (p: Produto) => void;
}

export interface ClientePDV {
  id: string;
  nome: string;
  telefone: string;
  saldoCashback?: number;
}

export interface CartSidebarProps {
  lojaId?: string;
  carrinho: ItemCarrinho[];
  limparVenda: () => void;
  mudarQtd: (idx: number, delta: number) => void;
  removerItem: (idx: number) => void;
  nomeCliente: string;
  setNomeCliente: (nome: string) => void;
  clienteSelecionado?: ClientePDV | null;
  setClienteSelecionado?: (cliente: ClientePDV | null) => void;
  desconto: string;
  setDesconto: (desc: string) => void;
  subtotal: number;
  descontoNum: number;
  total: number;
  erro: string;
  modo: ModoPDV;
  turno: CaixaTurno | null | undefined;
  mesaSelecionada: Mesa | null;
  enviandoMesa: boolean;
  setEtapa: (etapa: EtapaVenda) => void;
  setMetodo: (metodo: MetodoPgto | null) => void;
  setErro: (erro: string) => void;
  enviarParaMesa: () => Promise<void>;
}

export interface PaymentModalProps {
  total: number;
  metodo: MetodoPgto | null;
  setMetodo: (metodo: MetodoPgto | null) => void;
  setErro: (erro: string) => void;
  valorRecebido: string;
  setValorRecebido: (valor: string) => void;
  recebidoNum: number;
  troco: number;
  erro: string;
  processando: boolean;
  registrarVenda: (metodo: MetodoPgto) => Promise<void>;
  setEtapa: (etapa: EtapaVenda) => void;
}

export interface OrderSuccessModalProps {
  venda: VendaConcluida | null;
  imprimirVenda: (template: 'COMANDA_COZINHA' | 'RECIBO_CLIENTE') => Promise<void>;
  limparVenda: () => void;
}

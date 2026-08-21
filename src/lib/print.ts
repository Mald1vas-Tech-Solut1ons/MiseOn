import { Pedido, ItemPedido, Insumo, Loja, fmt } from '../types';
import { getOptimizedImageUrl } from './cdn';

type PrintTemplate = 'COMANDA_COZINHA' | 'OS_PRODUCAO' | 'VIA_ENTREGADOR' | 'RECIBO_CLIENTE' | 'ETIQUETA_VALIDADE' | 'CONTA_MESA';

interface PrintOptions {
  template: PrintTemplate;
  lojaNome: string;
  loja?: Loja | null;      // dados de marca + comerciais (logo, CNPJ, razão social, endereço)
  pedido?: Pedido;
  itens?: ItemPedido[];
  // Específico para a conta consolidada de uma mesa (várias rodadas/pedidos)
  contaMesa?: {
    mesaNumero: number;
    numerosPedidos: number[];
    itens: { nome_produto: string; quantidade: number; preco_unitario: number; opcoes?: { nome_opcao: string; preco_adicional: number }[] }[];
    subtotal: number;
    taxaServicoPct: number;
    valorServico: number;
    total: number;
    metodoPagamento?: string;
    valorPagoParcial?: number;
  };
  // Específico para OS de Produção
  osData?: {
    numero: number;
    preparo: Insumo;
    quantidadeLotes: number;
    rendimentoTotal: string;
    ingredientes: { nome: string; qtd: number; unidade: string; ok: boolean }[];
    dataFab?: string;
    dataValidade?: string;
    responsavel?: string;
  };
}

/**
 * Motor de Impressão (Thermal 58mm/80mm)
 * Cria um iframe invisível, injeta o CSS otimizado para bobinas e dispara o window.print()
 */
export function imprimir(options: PrintOptions) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  const content = gerarHtml(options);

  doc.open();
  doc.write(`
    <html>
      <head>
        <title>Impressão - ${esc(options.loja?.nome || options.lojaNome)}</title>
        <style>
          @page { margin: 0; }
          body {
            font-family: 'Courier New', Courier, monospace;
            color: #000;
            margin: 0;
            padding: 8px;
            width: 100%;
            max-width: 80mm; /* Padrão térmica, ajusta automaticamente pra 58mm */
            font-size: 12px;
            line-height: 1.25;
          }
          * { box-sizing: border-box; }
          h1, h2, h3, p { margin: 0; padding: 0; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .uppercase { text-transform: uppercase; }
          .font-bold { font-weight: bold; }
          .sm { font-size: 11px; }
          .xs { font-size: 9px; }
          .text-lg { font-size: 16px; }
          .text-xl { font-size: 20px; }
          .text-2xl { font-size: 24px; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .divider-solid { border-top: 1px solid #000; margin: 8px 0; }
          .flex { display: flex; }
          .justify-between { justify-content: space-between; }
          .mt-1 { margin-top: 4px; }
          .mt-2 { margin-top: 8px; }
          .mb-1 { margin-bottom: 4px; }
          .mb-2 { margin-bottom: 8px; }
          .ml-5 { margin-left: 20px; }
          .logo { max-width: 150px; max-height: 90px; margin: 0 auto 4px; display: block; filter: grayscale(1) contrast(1.3); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .logo-mini { width: 28px; height: auto; margin: 4px auto 2px; display: block; filter: grayscale(1) contrast(1.4); }
          .num-box { border-top: 2px dashed #000; border-bottom: 2px dashed #000; padding: 4px 0; margin: 6px 0; }
          .os-header { background-color: #000; color: #fff; padding: 4px; text-align: center; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table { width: 100%; border-collapse: collapse; }
          .col-qtd { width: 15%; }
          .col-valor { width: 28%; text-align: right; }
          .etiqueta-box { border: 3px solid #000; padding: 12px; margin-bottom: 8px; border-radius: 8px; }
          .etiqueta-title { background: #000; color: #fff; text-align: center; font-weight: 900; padding: 4px; font-size: 16px; margin: -12px -12px 12px -12px; border-radius: 4px 4px 0 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .etiqueta-row { display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px dotted #ccc; padding-bottom: 4px; }
        </style>
      </head>
      <body>
        ${content}
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => { document.body.removeChild(iframe); }, 1000);
  }, 300);
}

/* ── Helpers ─────────────────────────────────────────────── */
const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function formatarQtdItem(qtd: number): string {
  const n = Number(qtd || 0);
  if (Number.isInteger(n)) return `${n}x`;
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`;
}

const tipoLabel = (p: Pedido) =>
  p.tipo_pedido === 'DELIVERY' ? 'ENTREGA' : p.tipo_pedido === 'SALAO' ? 'SALÃO' : 'RETIRADA NO BALCÃO';

const metodoPgto = (p: Pedido) => p.pagamentos?.[0]?.metodo ?? '—';
const pedidoPago = (p: Pedido) => !!p.pagamentos?.some((pg) => pg.status === 'PAGO');

/** Cabeçalho com a identidade da loja (logo + nome; e dados comerciais se `comercial`). */
function cabecalhoLoja(o: PrintOptions, subtitulo: string, comercial = false): string {
  const nome = o.loja?.nome || o.lojaNome || 'MiseOn';
  const logo = o.loja?.logo_url ? `<img class="logo" src="${esc(getOptimizedImageUrl(o.loja.logo_url))}" alt="" />` : '';
  const tel = o.loja?.telefone || o.loja?.whatsapp;
  const linhasComerciais = comercial ? [
    o.loja?.razao_social ? `<div class="sm uppercase">${esc(o.loja.razao_social)}</div>` : '',
    o.loja?.cnpj ? `<div class="sm">CNPJ: ${esc(o.loja.cnpj)}</div>` : '',
    o.loja?.endereco ? `<div class="sm">${esc(o.loja.endereco)}</div>` : '',
    tel ? `<div class="sm">Tel: ${esc(tel)}</div>` : '',
  ].join('') : '';
  return `
    <div class="text-center">
      ${logo}
      <div class="font-bold text-lg uppercase">${esc(nome)}</div>
      ${linhasComerciais}
      <div class="divider-solid"></div>
      <div class="font-bold uppercase">${esc(subtitulo)}</div>
    </div>`;
}

/** Rodapé com a identidade do sistema MiseOn (plataforma emissora). */
function rodapeMiseOn(nota?: string): string {
  return `
    <div class="divider"></div>
    <div class="text-center">
      ${nota ? `<div class="xs uppercase">${esc(nota)}</div>` : ''}
      <img class="logo-mini" src="/icon.png" alt="" />
      <div class="font-bold sm" style="letter-spacing:3px;">MISEON</div>
      <div class="xs uppercase">Sistema Inteligente para sua Cozinha</div>
    </div>`;
}

function numeroPedidoBox(p: Pedido): string {
  return `
    <div class="num-box text-center">
      <div class="font-bold text-xl uppercase">PEDIDO #${esc(p.numero)}</div>
      <div class="font-bold sm uppercase">* ${tipoLabel(p)} *</div>
    </div>`;
}

function gerarHtml(opts: PrintOptions): string {
  switch (opts.template) {
    case 'COMANDA_COZINHA': return htmlComandaCozinha(opts);
    case 'OS_PRODUCAO':     return htmlOsProducao(opts);
    case 'ETIQUETA_VALIDADE':return htmlEtiqueta(opts);
    case 'VIA_ENTREGADOR':  return htmlViaEntregador(opts);
    case 'RECIBO_CLIENTE':  return htmlReciboCliente(opts);
    case 'CONTA_MESA':      return htmlContaMesa(opts);
    default: return '';
  }
}

// ------------------------------------------------------------------
// 1. COMANDA DA COZINHA (Foco na montagem do prato — sem preços)
// ------------------------------------------------------------------
function htmlComandaCozinha(o: PrintOptions) {
  const { pedido, itens } = o;
  if (!pedido || !itens) return '';
  const data = new Date(pedido.criado_em).toLocaleString('pt-BR');

  const itensHtml = itens.map((i) => `
    <div class="mt-2">
      <div class="font-bold flex">
        <span style="margin-right:8px;">${formatarQtdItem(i.quantidade)}</span>
        <span class="uppercase">${esc(i.nome_produto)}</span>
      </div>
      ${(i.itens_pedido_opcoes ?? []).map((op) => `<div class="ml-5 sm uppercase">+ ${esc(op.nome_opcao)}</div>`).join('')}
      ${i.observacao ? `<div class="ml-5 font-bold uppercase" style="border-left:3px solid #000; padding-left:6px;">OBS: ${esc(i.observacao)}</div>` : ''}
    </div>`).join('');

  return `
    ${cabecalhoLoja(o, 'Comanda · Cozinha')}
    ${numeroPedidoBox(pedido)}
    <div class="text-center sm mb-1">EMISSÃO: ${data}</div>
    ${pedido.identificador_cliente ? `<div class="text-center font-bold uppercase">Cliente: ${esc(pedido.identificador_cliente)}</div>` : ''}
    <div class="divider"></div>
    ${itensHtml}
    ${pedido.observacao ? `<div class="divider"></div><div class="font-bold uppercase">OBS. GERAL: ${esc(pedido.observacao)}</div>` : ''}
    ${rodapeMiseOn('*** FIM DA COMANDA ***')}
  `;
}

// ------------------------------------------------------------------
// 2. OS DE PRODUÇÃO (Foco em repor estoque interno)
// ------------------------------------------------------------------
function htmlOsProducao(o: PrintOptions) {
  const { osData } = o;
  if (!osData) return '';
  const data = new Date().toLocaleString('pt-BR');

  const ingHtml = osData.ingredientes.map((i) => `
    <tr>
      <td class="col-qtd">${i.qtd}</td>
      <td>${esc(i.unidade)}</td>
      <td class="uppercase">${esc(i.nome)}</td>
      <td class="text-right font-bold">${i.ok ? '[OK]' : '[FALTA]'}</td>
    </tr>`).join('');

  return `
    ${cabecalhoLoja(o, 'Ordem de Serviço · Produção')}
    <div class="text-center xs uppercase mb-2">*** USO INTERNO — NÃO É COMANDA DE CLIENTE ***</div>
    <div class="num-box text-center">
      <div class="font-bold text-2xl uppercase">${esc(osData.preparo.nome)}</div>
    </div>
    <div class="text-center">
      <div class="font-bold text-lg">PRODUZIR: ${osData.quantidadeLotes} ${osData.quantidadeLotes > 1 ? 'LOTES' : 'LOTE'}</div>
      <div class="sm">Rende ${esc(osData.rendimentoTotal)}</div>
      <div class="xs mt-1">EMISSÃO: ${data}</div>
    </div>
    <div class="divider"></div>
    <div class="font-bold uppercase mb-1">Ingredientes (total):</div>
    <table>${ingHtml}</table>
    ${rodapeMiseOn('*** FIM DA ORDEM DE SERVIÇO ***')}
  `;
}

// ------------------------------------------------------------------
// 2.1. ETIQUETA DE VALIDADE (Para colar no pote após OS)
// ------------------------------------------------------------------
function htmlEtiqueta(o: PrintOptions) {
  const { osData, lojaNome, loja } = o;
  if (!osData) return '';
  const nomeLoja = loja?.nome || lojaNome;

  return `
    <div class="etiqueta-box">
      <div class="etiqueta-title">ETIQUETA DE CONTROLE</div>
      
      <div class="text-center mb-2">
        <div class="font-bold text-xl uppercase">${esc(osData.preparo.nome)}</div>
        <div class="sm font-bold uppercase mt-1">LOTE/OS: #${esc(osData.numero)}</div>
      </div>
      
      <div class="etiqueta-row">
        <span class="sm font-bold">DATA DE FABRICAÇÃO:</span>
        <span class="font-bold uppercase">${esc(osData.dataFab || '')}</span>
      </div>
      
      <div class="etiqueta-row">
        <span class="sm font-bold">DATA DE VALIDADE:</span>
        <span class="font-bold uppercase text-lg">${esc(osData.dataValidade || '')}</span>
      </div>

      <div class="etiqueta-row">
        <span class="sm font-bold">RENDIMENTO:</span>
        <span class="font-bold uppercase">${esc(osData.rendimentoTotal)}</span>
      </div>

      <div class="etiqueta-row" style="border:none; margin-bottom:0;">
        <span class="sm font-bold">RESPONSÁVEL:</span>
        <span class="font-bold uppercase">${esc(osData.responsavel || 'Operador')}</span>
      </div>
      
      <div class="divider-solid" style="margin: 12px 0;"></div>
      <div class="text-center xs uppercase font-bold text-gray-500">${esc(nomeLoja)}</div>
    </div>
  `;
}

// ------------------------------------------------------------------
/**
 * Observação de entrega, em destaque.
 *
 * "Deixar na portaria", "interfone quebrado, ligar ao chegar" — o iFood manda
 * isso em `delivery.observations` e é critério de homologação exibir na comanda
 * ("Exiba observações de entrega claramente na comanda"). Mais que critério: é
 * a diferença entre a entrega acontecer e a moto voltar com a sacola.
 *
 * Vai emoldurado porque a via do entregador é lida de relance, em pé, com o
 * capacete na mão. Texto solto no meio do endereço se perde.
 */
function observacaoEntregaHtml(pedido: Pedido): string {
  if (!pedido.observacao_entrega) return '';
  return `<div class="mt-2 font-bold uppercase" style="border:2px solid #000; padding:4px;">ATENÇÃO: ${esc(pedido.observacao_entrega)}</div>`;
}

/**
 * O que só existe em pedido de marketplace.
 *
 * A bandeira do cartão e o CPF na nota são critérios de homologação do iFood, e
 * o código de coleta é o que o entregador DELES apresenta na loja — quem está
 * no balcão precisa do papel na mão para conferir, não de uma tela.
 */
function dadosIfoodHtml(pedido: Pedido): string {
  if (pedido.origem !== 'ifood') return '';
  const linhas = [
    pedido.ifood_codigo_coleta ? `COD. COLETA: ${esc(pedido.ifood_codigo_coleta)}` : '',
    pedido.ifood_cartao_bandeira ? `CARTÃO: ${esc(pedido.ifood_cartao_bandeira)}` : '',
    pedido.documento_cliente ? `CPF/CNPJ: ${esc(pedido.documento_cliente)}` : '',
    pedido.ifood_info_extra ? esc(pedido.ifood_info_extra) : '',
  ].filter(Boolean);
  if (linhas.length === 0) return '';
  return `<div class="sm uppercase mt-1">${linhas.join('<br/>')}</div>`;
}

// 3. VIA DO ENTREGADOR (Foco no endereço e cobrança — sem custo interno)
// ------------------------------------------------------------------
function htmlViaEntregador(o: PrintOptions) {
  const { pedido, itens } = o;
  if (!pedido || !itens) return '';

  const itensHtml = itens.map((i) => `<div class="font-bold uppercase">${formatarQtdItem(i.quantidade)} ${esc(i.nome_produto)}</div>`).join('');
  const pago = pedidoPago(pedido);
  const troco = pedido.troco_para ? Number(pedido.troco_para) - Number(pedido.valor_total) : null;

  return `
    ${cabecalhoLoja(o, 'Romaneio · Entrega')}
    ${numeroPedidoBox(pedido)}
    <div class="divider"></div>
    <div class="font-bold uppercase">${esc(pedido.identificador_cliente)}</div>
    ${pedido.telefone_contato ? `<div class="sm">TEL: ${esc(pedido.telefone_contato)}</div>` : ''}
    <div class="mt-2 font-bold uppercase">ENDEREÇO:</div>
    <div class="font-bold uppercase">${esc(pedido.endereco_entrega || 'Retirada')}${pedido.bairro ? ' - ' + esc(pedido.bairro) : ''}</div>
    ${pedido.complemento ? `<div class="sm uppercase">COMPL: ${esc(pedido.complemento)}</div>` : ''}
    ${pedido.ponto_referencia ? `<div class="sm uppercase">REF: ${esc(pedido.ponto_referencia)}</div>` : ''}
    ${observacaoEntregaHtml(pedido)}
    ${dadosIfoodHtml(pedido)}
    <div class="divider"></div>
    <div class="font-bold uppercase">Itens:</div>
    ${itensHtml}
    <div class="divider"></div>
    <div class="flex justify-between font-bold text-lg">
      <span>TOTAL:</span><span>${fmt(Number(pedido.valor_total))}</span>
    </div>
    <div class="flex justify-between mt-1">
      <span>PAGAMENTO:</span><span class="font-bold uppercase">${esc(metodoPgto(pedido))}${pago ? ' (PAGO)' : ''}</span>
    </div>
    ${!pago && troco !== null && troco >= 0
      ? `<div class="text-center font-bold uppercase mt-2" style="border:2px dashed #000; padding:4px;">LEVAR TROCO<br/><span class="sm">Cliente paga ${fmt(Number(pedido.troco_para))} · troco ${fmt(troco)}</span></div>`
      : ''}
    ${pago ? `<div class="text-center font-bold uppercase sm mt-1">*** PEDIDO JÁ PAGO — NÃO COBRAR ***</div>` : ''}
    ${rodapeMiseOn('*** BOA ENTREGA! ***')}
  `;
}

// ------------------------------------------------------------------
// 4. RECIBO / NOTA DO CLIENTE (Cupom não fiscal com dados comerciais)
// ------------------------------------------------------------------
function htmlReciboCliente(o: PrintOptions) {
  const { pedido, itens } = o;
  if (!pedido || !itens) return '';
  const data = new Date(pedido.criado_em).toLocaleString('pt-BR');

  const itensHtml = itens.map((i) => {
    const adicionais = (i.itens_pedido_opcoes ?? []).reduce((s, op) => s + Number(op.preco_adicional || 0), 0);
    const totalItem = (Number(i.preco_unitario) + adicionais) * Number(i.quantidade);
    const ops = (i.itens_pedido_opcoes ?? []).map((op) =>
      `<div class="xs uppercase">+ ${esc(op.nome_opcao)}${Number(op.preco_adicional) > 0 ? ' (' + fmt(Number(op.preco_adicional)) + ')' : ''}</div>`).join('');
    return `
      <tr>
        <td class="col-qtd font-bold">${formatarQtdItem(i.quantidade)}</td>
        <td><div class="font-bold uppercase">${esc(i.nome_produto)}</div>${ops}</td>
        <td class="col-valor">${fmt(totalItem)}</td>
      </tr>`;
  }).join('');

  return `
    ${cabecalhoLoja(o, 'Cupom de Venda', true)}
    <div class="text-center xs uppercase mb-1">Documento sem valor fiscal</div>
    ${numeroPedidoBox(pedido)}
    <div class="text-center sm mb-1">EMISSÃO: ${data}</div>
    <div class="divider"></div>
    <div class="font-bold uppercase sm">CLIENTE: ${esc(pedido.identificador_cliente)}</div>
    ${pedido.telefone_contato ? `<div class="xs">TEL: ${esc(pedido.telefone_contato)}</div>` : ''}
    ${pedido.tipo_pedido === 'DELIVERY' && pedido.endereco_entrega ? `<div class="xs uppercase">ENTREGA: ${esc(pedido.endereco_entrega)}${pedido.bairro ? ' - ' + esc(pedido.bairro) : ''}${pedido.complemento ? ' · ' + esc(pedido.complemento) : ''}</div>` : ''}
    <div class="divider"></div>
    <table>${itensHtml}</table>
    <div class="divider"></div>
    <table>
      <tr><td>Subtotal</td><td class="text-right">${fmt(Number(pedido.subtotal))}</td></tr>
      ${Number(pedido.taxa_entrega) > 0 ? `<tr><td>Taxa de entrega</td><td class="text-right">${fmt(Number(pedido.taxa_entrega))}</td></tr>` : ''}
      ${Number(pedido.desconto) > 0 ? `<tr><td class="font-bold">Desconto</td><td class="text-right font-bold">-${fmt(Number(pedido.desconto))}</td></tr>` : ''}
      <tr><td class="text-lg font-bold">TOTAL</td><td class="text-right text-lg font-bold">${fmt(Number(pedido.valor_total))}</td></tr>
    </table>
    <div class="divider"></div>
    <div class="text-center">
      <div class="font-bold uppercase sm">Forma de pagamento</div>
      <div class="font-bold uppercase text-lg">${esc(metodoPgto(pedido))}</div>
      ${pedido.troco_para ? `<div class="sm uppercase">(Levar troco para ${fmt(Number(pedido.troco_para))})</div>` : ''}
    </div>
    <div class="divider"></div>
    <div class="text-center font-bold uppercase">Obrigado pela preferência!</div>
    ${rodapeMiseOn()}
  `;
}

// ------------------------------------------------------------------
// 5. CONTA DA MESA (Fechamento de comanda — consolida N pedidos)
// ------------------------------------------------------------------
function htmlContaMesa(o: PrintOptions) {
  const { contaMesa } = o;
  if (!contaMesa) return '';
  const data = new Date().toLocaleString('pt-BR');

  const itensHtml = contaMesa.itens.map((i) => {
    const adicionais = (i.opcoes ?? []).reduce((s, op) => s + Number(op.preco_adicional || 0), 0);
    const totalItem = (Number(i.preco_unitario) + adicionais) * Number(i.quantidade);
    const ops = (i.opcoes ?? []).map((op) => `<div class="xs uppercase">+ ${esc(op.nome_opcao)}</div>`).join('');
    return `
      <tr>
        <td class="col-qtd font-bold">${formatarQtdItem(i.quantidade)}</td>
        <td><div class="font-bold uppercase">${esc(i.nome_produto)}</div>${ops}</td>
        <td class="col-valor">${fmt(totalItem)}</td>
      </tr>`;
  }).join('');

  return `
    ${cabecalhoLoja(o, 'Conta da Mesa', true)}
    <div class="text-center xs uppercase mb-1">Documento sem valor fiscal</div>
    <div class="num-box text-center">
      <div class="font-bold text-2xl uppercase">MESA ${esc(contaMesa.mesaNumero)}</div>
      <div class="sm">Pedidos: ${contaMesa.numerosPedidos.map((n) => `#${n}`).join(', ')}</div>
    </div>
    <div class="text-center sm mb-1">FECHAMENTO: ${data}</div>
    <div class="divider"></div>
    <table>${itensHtml}</table>
    <div class="divider"></div>
    <table>
      <tr><td>Subtotal</td><td class="text-right">${fmt(contaMesa.subtotal)}</td></tr>
      ${contaMesa.valorServico > 0 ? `<tr><td>Taxa de serviço (${contaMesa.taxaServicoPct}%)</td><td class="text-right">${fmt(contaMesa.valorServico)}</td></tr>` : ''}
      <tr><td class="text-lg font-bold">TOTAL</td><td class="text-right text-lg font-bold">${fmt(contaMesa.total)}</td></tr>
    </table>
    ${contaMesa.metodoPagamento ? `
    <div class="divider"></div>
    <div class="text-center">
      <div class="font-bold uppercase sm">${contaMesa.valorPagoParcial ? 'Pagamento Parcial' : 'Forma de pagamento'}</div>
      <div class="font-bold uppercase text-lg">${esc(contaMesa.metodoPagamento)} ${contaMesa.valorPagoParcial ? `- ${fmt(contaMesa.valorPagoParcial)}` : ''}</div>
    </div>` : ''}
    <div class="divider"></div>
    <div class="text-center font-bold uppercase">Obrigado pela preferência!</div>
    ${rodapeMiseOn()}
  `;
}

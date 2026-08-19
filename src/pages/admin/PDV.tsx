import { useEffect, useMemo, useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { X, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  fmt, precoItem, type Produto, type Opcao, type ItemCarrinho, type Loja, type Mesa,
  type CaixaTurno, type CaixaMovimentacao, type MetodoPgto, type ClientePDV,
} from '../../types';
import { imprimir } from '../../lib/print';
import { obterOuCriarComandaAberta } from '../../lib/comandas';
import type { CtxLoja } from './AdminLayout';
import MiseOnLoader from '../../components/MiseOnLoader';

import { HeaderBar } from '../../components/pdv/HeaderBar';
import { ProductGrid } from '../../components/pdv/ProductGrid';
import { CartSidebar } from '../../components/pdv/CartSidebar';
import { PaymentModal } from '../../components/pdv/PaymentModal';
import { OrderSuccessModal } from '../../components/pdv/OrderSuccessModal';
import { CaixaModal } from '../../components/pdv/CaixaModal';
import { ModalOpcoes } from '../../components/pdv/ModalOpcoes';
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications';
import { useToast } from '../../components/ui/Toast';
import { tocarSom } from '../../lib/som';
import { traduzirErro } from '../../lib/erros';
import { createPedidoPedido, isErroColunaKdsAusente } from '../../lib/pedidos';
import { getOptimizedImageUrl } from '../../lib/cdn';

/* ─────────────────────────────────────────────────────────────
   PDV — Frente de balcão touch-first.
   Venda em segundos: toca no produto → carrinho → cobrar.
   O pedido nasce origem='balcao', vira ACEITO na hora (baixa
   estoque via trigger) e cai no KDS da cozinha como os demais.

   Também funciona em "modo mesa" (garçom): o pedido vai pra
   comanda da mesa igual ao cliente que pede pelo QR — sem cobrar
   na hora, a conta fecha depois no Mapa de Mesas.
   ───────────────────────────────────────────────────────────── */

import { useI18n } from '../../contexts/I18nContext';

type EtapaVenda = 'CARRINHO' | 'PAGANDO' | 'PIX_AGUARDANDO' | 'SUCESSO';
type ModoPDV = 'BALCAO' | 'MESA';

interface VendaConcluida {
  pedidoId: string;
  numero: number;
  total: number;
  metodo: MetodoPgto;
  troco: number;
  itens: ItemCarrinho[];
  temCozinha?: boolean;
}

export default function PDV() {
  const { tDynamic } = useI18n();
  const { lojaId } = useOutletContext<CtxLoja>();
  const toast = useToast();

  // catálogo
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<{ id: string; nome: string }[]>([]);
  const [loja, setLoja] = useState<Loja | null>(null);
  const [catAtiva, setCatAtiva] = useState<string | 'TODAS'>('TODAS');
  const [busca, setBusca] = useState('');

  // modo mesa (garçom lança pedido pra comanda em vez de cobrar na hora)
  const [modo, setModo] = useState<ModoPDV>('BALCAO');
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [mesaSelecionada, setMesaSelecionada] = useState<Mesa | null>(null);
  const [enviandoMesa, setEnviandoMesa] = useState(false);
  const [pedidoMesaOk, setPedidoMesaOk] = useState<{ numero: number; mesaNumero: number } | null>(null);

  // caixa
  const [turno, setTurno] = useState<CaixaTurno | null | undefined>(undefined); // undefined = carregando
  const [movs, setMovs] = useState<CaixaMovimentacao[]>([]);
  const [dinheiroTurno, setDinheiroTurno] = useState(0); // vendas em dinheiro do turno
  const [modalCaixa, setModalCaixa] = useState<'ABRIR' | 'SANGRIA' | 'REFORCO' | 'FECHAR' | null>(null);

  // venda
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [nomeCliente, setNomeCliente] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState<ClientePDV | null>(null);
  const [desconto, setDesconto] = useState('');
  const [etapa, setEtapa] = useState<EtapaVenda>('CARRINHO');
  const [metodo, setMetodo] = useState<MetodoPgto | null>(null);
  const [valorRecebido, setValorRecebido] = useState('');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');
  const [venda, setVenda] = useState<VendaConcluida | null>(null);
  const [pixInfo, setPixInfo] = useState<{ pedidoId: string; copiaECola?: string; qrImagem?: string | null } | null>(null);

  // modal de opções do produto
  const [escolhendo, setEscolhendo] = useState<Produto | null>(null);

  useRealtimeNotifications({ lojaId, contexto: 'PDV', modoPdv: modo });

  /* ── carregamento ── */
  const carregarCatalogo = useCallback(async () => {
    const [{ data: prods }, { data: cats }, { data: lj }, { data: mesasData }] = await Promise.all([
      supabase.from('produtos').select('*, grupos_opcoes(*, opcoes(*))').eq('loja_id', lojaId).eq('disponivel', true).order('ordem'),
      supabase.from('categorias').select('id, nome').eq('loja_id', lojaId).eq('ativo', true).order('ordem'),
      supabase.from('lojas').select('*').eq('id', lojaId).single(),
      supabase.from('mesas').select('*').eq('loja_id', lojaId).eq('ativo', true).order('numero'),
    ]);
    setProdutos((prods as Produto[]) ?? []);
    setCategorias(cats ?? []);
    setLoja((lj as Loja) ?? null);
    setMesas((mesasData as Mesa[]) ?? []);
  }, [lojaId]);

  const carregarCaixa = useCallback(async () => {
    const { data: t } = await supabase.from('caixa_turnos').select('*')
      .eq('loja_id', lojaId).eq('status', 'ABERTO').order('aberto_em', { ascending: false }).limit(1).maybeSingle();
    const turnoAtual = (t as CaixaTurno) ?? null;
    setTurno(turnoAtual);
    if (!turnoAtual) { setMovs([]); setDinheiroTurno(0); return; }

    const [{ data: m }, { data: vendasDinheiro }] = await Promise.all([
      supabase.from('caixa_movimentacoes').select('*').eq('turno_id', turnoAtual.id).order('criado_em'),
      // Dinheiro que passa por ESTA gaveta: balcão (retirada) e mesas fechadas em dinheiro.
      // Delivery em dinheiro fica com o entregador, não entra na gaveta do PDV.
      supabase.from('pedidos').select('valor_total, pagamentos(metodo, status)')
        .eq('loja_id', lojaId).in('tipo_pedido', ['RETIRADA_BALCAO', 'SALAO']).neq('status', 'CANCELADO')
        .gte('criado_em', turnoAtual.aberto_em),
    ]);
    setMovs((m as CaixaMovimentacao[]) ?? []);
    const soma = (vendasDinheiro ?? []).reduce((s, p: any) => {
      const pago = (p.pagamentos ?? []).some((pg: any) => pg.metodo === 'DINHEIRO' && pg.status === 'PAGO');
      return s + (pago ? Number(p.valor_total) : 0);
    }, 0);
    setDinheiroTurno(soma);
  }, [lojaId]);

  useEffect(() => {
    setTimeout(() => {
      carregarCatalogo();
      carregarCaixa();
    }, 0);
  }, [lojaId, carregarCatalogo, carregarCaixa]);

  /* ── derivados ── */
  const produtosVisiveis = useMemo(() => {
    let lista = produtos;
    if (catAtiva !== 'TODAS') lista = lista.filter((p) => p.categoria_id === catAtiva);
    if (busca.trim()) lista = lista.filter((p) => p.nome.toLowerCase().includes(busca.trim().toLowerCase()));
    return lista;
  }, [produtos, catAtiva, busca]);

  const subtotal = useMemo(() => carrinho.reduce((s, i) => s + precoItem(i), 0), [carrinho]);
  const descontoNum = Math.min(Number(String(desconto).replace(',', '.') || 0), subtotal);
  const total = subtotal - descontoNum;
  const recebidoNum = Number(String(valorRecebido).replace(',', '.') || 0);
  const troco = metodo === 'DINHEIRO' ? Math.max(0, recebidoNum - total) : 0;

  const reforcos = movs.filter((m) => m.tipo === 'REFORCO').reduce((s, m) => s + Number(m.valor), 0);
  const sangrias = movs.filter((m) => m.tipo === 'SANGRIA').reduce((s, m) => s + Number(m.valor), 0);
  const dinheiroGaveta = Number(turno?.fundo_troco ?? 0) + dinheiroTurno + reforcos - sangrias;

  /* ── carrinho ── */
  const adicionarProduto = (p: Produto, opcoes: Opcao[] = [], quantidade = 1, observacao = '') => {
    toast(`${p.nome} adicionado!`, 'info');
    setCarrinho((c) => {
      // agrupa itens idênticos (mesmo produto, mesmas opções, mesma obs)
      const chave = (i: ItemCarrinho) => i.produto.id + '|' + i.opcoesSelecionadas.map((o) => o.id).sort().join(',') + '|' + (i.observacao ?? '');
      const nova = { produto: p, quantidade, opcoesSelecionadas: opcoes, observacao: observacao || undefined };
      const idx = c.findIndex((i) => chave(i) === chave(nova));
      if (idx >= 0) {
        const cp = [...c]; cp[idx] = { ...cp[idx], quantidade: cp[idx].quantidade + quantidade }; return cp;
      }
      return [...c, nova];
    });
  };

  const tocarProduto = (p: Produto) => {
    const temOpcoes = (p.grupos_opcoes ?? []).some((g) => (g.opcoes ?? []).filter((o) => o.disponivel).length > 0);
    if (temOpcoes || p.tipo_venda === 'POR_PESO') setEscolhendo(p);
    else adicionarProduto(p);
  };

  const mudarQtd = (idx: number, delta: number) => {
    setCarrinho((c) => c.map((i, x) => x === idx ? { ...i, quantidade: Math.max(1, i.quantidade + delta) } : i));
  };

  const limparVenda = () => {
    setCarrinho([]); setNomeCliente(''); setClienteSelecionado(null); setDesconto(''); setEtapa('CARRINHO');
    setMetodo(null); setValorRecebido(''); setErro(''); setVenda(null); setPixInfo(null);
  };

  /* ── fechamento da venda ── */
  const registrarVenda = async (met: MetodoPgto) => {
    if (carrinho.length === 0) return;
    if (met === 'DINHEIRO' && recebidoNum < total) { setErro('Valor recebido menor que o total.'); return; }
    setProcessando(true); setErro('');
    try {
      const ped = await createPedidoPedido({
        lojaId,
        tipo_pedido: 'RETIRADA_BALCAO',
        origem: 'balcao',
        identificador_cliente: nomeCliente.trim() || 'Balcão',
        cliente_id: clienteSelecionado?.id ?? null,
        subtotal,
        desconto: descontoNum,
        valor_total: total,
        troco_para: met === 'DINHEIRO' && recebidoNum > total ? recebidoNum : null,
        carrinho,
      });

      // Baixa saldo de cashback do cliente se foi utilizado
      if (clienteSelecionado?.id && descontoNum > 0 && (clienteSelecionado.saldoCashback ?? 0) > 0) {
        const cashbackUsado = Math.min(clienteSelecionado.saldoCashback ?? 0, descontoNum);
        if (cashbackUsado > 0) {
          await supabase.rpc('fn_usar_cashback', {
            p_cliente_id: clienteSelecionado.id, p_loja_id: lojaId, p_pedido_id: ped.id, p_valor: cashbackUsado,
          });
        }
      }

      // Se só tem revenda direta (latas de Coca-Cola, etc.), não vai pra cozinha.
      const temCozinha = carrinho.some((i) => i.produto.estacao_preparo === 'COZINHA' || !i.produto.estacao_preparo);

      const pagoAgora = met !== 'PIX'; // dinheiro/maquininha recebem na hora; Pix espera o QR
      const { error: e4 } = await supabase.from('pagamentos').insert({
        pedido_id: ped.id, metodo: met, valor_pago: total,
        status: pagoAgora ? 'PAGO' : 'PENDENTE',
        data_pagamento: pagoAgora ? new Date().toISOString() : null,
      });
      if (e4) throw e4;

      if (met === 'PIX') {
        toast('Aguardando pagamento Pix...', 'info');
        // gera a cobrança e mostra o QR na tela para o cliente apontar o celular
        const { data: pix, error: e5 } = await supabase.functions.invoke('pix-criar-cobranca', { body: { pedido_id: ped.id } });
        if (e5 || pix?.error) throw new Error(String(pix?.error ?? e5?.message ?? 'Falha ao gerar o Pix'));
        setPixInfo({ pedidoId: ped.id, copiaECola: pix.copia_e_cola, qrImagem: pix.qr_imagem });
        setVenda({ pedidoId: ped.id, numero: ped.numero, total, metodo: met, troco: 0, itens: carrinho, temCozinha });
        setEtapa('PIX_AGUARDANDO');
      } else {
        const atualizacaoCozinha = {
          status: 'ACEITO',
          requer_cozinha: temCozinha,
          estacao_atual: temCozinha ? 'COZINHA' : 'BALCAO',
          enviado_cozinha_em: temCozinha ? new Date().toISOString() : null,
        };
        // etapa_kds_atual depende da migration 20260724010000_kds_etapas_kanban.sql;
        // se o banco ainda não tem a coluna (schema cache / PGRST204), refaz sem ela
        let { error: eUpd } = await supabase.from('pedidos').update({
          ...atualizacaoCozinha,
          etapa_kds_atual: 'etapa_fila',
        }).eq('id', ped.id);
        if (isErroColunaKdsAusente(eUpd)) {
          ({ error: eUpd } = await supabase.from('pedidos').update(atualizacaoCozinha).eq('id', ped.id));
        }
        if (eUpd) console.error('Falha ao enviar pedido à cozinha:', eUpd);
        if (!temCozinha) {
          // Bypass completo pra revenda direta de balcão: o cliente já pegou a Coca-Cola e pagou
          await supabase.rpc('fn_avancar_status_pedido', { p_pedido_id: ped.id, p_novo_status: 'PRONTO' });
          await supabase.rpc('fn_avancar_status_pedido', { p_pedido_id: ped.id, p_novo_status: 'FINALIZADO' });
        }
        setVenda({ pedidoId: ped.id, numero: ped.numero, total, metodo: met, troco, itens: carrinho, temCozinha });
        setEtapa('SUCESSO');
        toast(`Venda concluída! Pedido #${ped.numero}`, 'sucesso');
        tocarSom();
        carregarCaixa();
      }
    } catch (e) {
      console.error(e);
      const t = traduzirErro(e);
      setErro(`${t.titulo} — ${t.acao}`);
    } finally {
      setProcessando(false);
    }
  };

  /* ── modo mesa: envia a rodada pra comanda, sem cobrar agora ── */
  const enviarParaMesa = async () => {
    if (!mesaSelecionada || carrinho.length === 0) return;
    setEnviandoMesa(true); setErro('');
    try {
      const comandaId = await obterOuCriarComandaAberta(lojaId, mesaSelecionada.id);
      const ped = await createPedidoPedido({
        lojaId,
        tipo_pedido: 'SALAO',
        origem: 'garcom',
        comanda_id: comandaId,
        mesa_numero: mesaSelecionada.numero,
        identificador_cliente: nomeCliente.trim() || `Mesa ${mesaSelecionada.numero}`,
        cliente_id: clienteSelecionado?.id ?? null,
        subtotal,
        desconto: descontoNum,
        valor_total: total,
        carrinho,
      });

      setPedidoMesaOk({ numero: ped.numero, mesaNumero: mesaSelecionada.numero });
      toast(`Pedido #${ped.numero} enviado para mesa ${mesaSelecionada.numero}`, 'sucesso');
      tocarSom();
      setCarrinho([]); setNomeCliente(''); setDesconto('');
    } catch (e) {
      console.error(e);
      setErro('Erro ao enviar para a mesa: ' + String((e as Error)?.message ?? e));
    }
    setEnviandoMesa(false);
  };

  useEffect(() => {
    if (!pedidoMesaOk) return;
    const t = setTimeout(() => setPedidoMesaOk(null), 5000);
    return () => clearTimeout(t);
  }, [pedidoMesaOk]);

  const confirmarPixRecebido = async () => {
    if (!pixInfo) return;
    setProcessando(true);
    try {
      await supabase.from('pagamentos').update({ status: 'PAGO', data_pagamento: new Date().toISOString() })
        .eq('pedido_id', pixInfo.pedidoId).eq('metodo', 'PIX');
      await supabase.from('pedidos').update({ status: 'ACEITO' }).eq('id', pixInfo.pedidoId);
      if (venda && !venda.temCozinha) {
        const r1 = await supabase.rpc('fn_avancar_status_pedido', { p_pedido_id: pixInfo.pedidoId, p_novo_status: 'PRONTO' });
        if (r1.error) throw r1.error;
        const r2 = await supabase.rpc('fn_avancar_status_pedido', { p_pedido_id: pixInfo.pedidoId, p_novo_status: 'FINALIZADO' });
        if (r2.error) throw r2.error;
      }
      setEtapa('SUCESSO');
      toast(`Venda concluída! Pedido #${venda?.numero ?? ''}`, 'sucesso');
      tocarSom();
      carregarCaixa();
    } catch (e) {
      console.error(e);
      const t = traduzirErro(e);
      setErro(`${t.titulo} — ${t.acao}`);
    } finally {
      setProcessando(false);
    }
  };

  // Pix pago via webhook → confirma sozinho na tela
  useEffect(() => {
    if (etapa !== 'PIX_AGUARDANDO' || !pixInfo) return;

    // Timeout de 5 minutos (300.000 ms) para liberar o PDV se não for pago
    const timeoutLimpeza = setTimeout(() => {
      limparVenda();
      setErro('Tempo limite de 5 minutos excedido para o pagamento do Pix.');
    }, 5 * 60 * 1000);

    const canal = supabase
      .channel(`pdv-pix-${pixInfo.pedidoId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pagamentos', filter: `pedido_id=eq.${pixInfo.pedidoId}` }, async (payload) => {
        if ((payload.new as any)?.status === 'PAGO') {
          await supabase.from('pedidos').update({ status: 'ACEITO' }).eq('id', pixInfo.pedidoId);
          if (venda && !venda.temCozinha) {
            await supabase.rpc('fn_avancar_status_pedido', { p_pedido_id: pixInfo.pedidoId, p_novo_status: 'PRONTO' });
            await supabase.rpc('fn_avancar_status_pedido', { p_pedido_id: pixInfo.pedidoId, p_novo_status: 'FINALIZADO' });
          }
          setEtapa('SUCESSO');
          toast(`Venda concluída!`, 'sucesso');
          tocarSom();
          carregarCaixa();
        }
      })
      .subscribe();
    return () => { 
      clearTimeout(timeoutLimpeza);
      supabase.removeChannel(canal); 
    };
  }, [etapa, pixInfo, carregarCaixa, toast, venda]);

  const imprimirVenda = async (template: 'COMANDA_COZINHA' | 'RECIBO_CLIENTE') => {
    if (!venda) return;
    const { data: pedidoCompleto } = await supabase.from('pedidos')
      .select('*, itens_pedido(*, itens_pedido_opcoes(*))').eq('id', venda.pedidoId).single();
    if (pedidoCompleto) {
      imprimir({ template, lojaNome: loja?.nome || 'MiseOn', loja, pedido: pedidoCompleto, itens: pedidoCompleto.itens_pedido });
    }
  };

  /* ── caixa: abrir/mov/fechar ── */
  const [valorCaixa, setValorCaixa] = useState('');
  const [motivoCaixa, setMotivoCaixa] = useState('');
  const [obsFechamento, setObsFechamento] = useState('');
  const [salvandoCaixa, setSalvandoCaixa] = useState(false);

  const abrirTurno = async () => {
    setSalvandoCaixa(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('caixa_turnos').insert({
      loja_id: lojaId,
      aberto_por: user?.id ?? null,
      aberto_por_nome: (user?.user_metadata?.nome as string) ?? user?.email ?? null,
      fundo_troco: Number(String(valorCaixa).replace(',', '.') || 0),
    });
    setSalvandoCaixa(false);
    setModalCaixa(null); setValorCaixa('');
    carregarCaixa();
  };

  const registrarMov = async (tipo: 'SANGRIA' | 'REFORCO') => {
    if (!turno || Number(valorCaixa || 0) <= 0) return;
    setSalvandoCaixa(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('caixa_movimentacoes').insert({
      loja_id: lojaId, turno_id: turno.id, tipo,
      valor: Number(String(valorCaixa).replace(',', '.')), motivo: motivoCaixa.trim() || null, user_id: user?.id ?? null,
    });
    setSalvandoCaixa(false);
    setModalCaixa(null); setValorCaixa(''); setMotivoCaixa('');
    carregarCaixa();
  };

  const fecharTurno = async () => {
    if (!turno) return;
    setSalvandoCaixa(true);
    const { data: { user } } = await supabase.auth.getUser();
    const contado = Number(String(valorCaixa).replace(',', '.') || 0);
    await supabase.from('caixa_turnos').update({
      status: 'FECHADO',
      fechado_em: new Date().toISOString(),
      fechado_por: user?.id ?? null,
      valor_esperado: dinheiroGaveta,
      valor_contado: contado,
      diferenca: contado - dinheiroGaveta,
      observacao: obsFechamento.trim() || null,
    }).eq('id', turno.id);
    setSalvandoCaixa(false);
    setModalCaixa(null); setValorCaixa(''); setObsFechamento('');
    carregarCaixa();
  };

  /* ═════════════════════════ UI ═════════════════════════ */

  if (turno === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <MiseOnLoader status={tDynamic('Abrindo o PDV...')} rows={2} />
      </div>
    );
  }

  const propsCaixaModal = {
    modalCaixa, setModalCaixa, salvandoCaixa, valorCaixa, setValorCaixa,
    motivoCaixa, setMotivoCaixa,
    obsFechamento, setObsFechamento,
    turno, dinheiroTurno, reforcos, sangrias, dinheiroGaveta,
    abrirTurno, registrarMov, fecharTurno
  };

  return (
    <div data-tour="tour-pdv-header" className="flex h-[calc(100vh-64px)] flex-col lg:h-screen">
      <HeaderBar
        modo={modo}
        setModo={(m) => {
          setModo(m);
          toast(m === 'BALCAO' ? tDynamic('Modo Balcão ativado') : tDynamic('Modo Mesa ativado'), 'info');
        }}
        turno={turno}
        dinheiroGaveta={dinheiroGaveta}
        setModalCaixa={setModalCaixa}
        setValorCaixa={setValorCaixa}
      />

      {pedidoMesaOk && (
        <div className="flex items-center justify-between gap-2 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/15 dark:text-emerald-400">
          <span className="flex items-center gap-1.5"><Check size={13} /> {tDynamic('Pedido')} #{pedidoMesaOk.numero} {tDynamic('enviado para a Mesa')} {pedidoMesaOk.mesaNumero}!</span>
          <button onClick={() => setPedidoMesaOk(null)}><X size={13} /></button>
        </div>
      )}

      {modo === 'MESA' && (
        <div className="border-b border-gray-200 bg-white px-4 py-2.5 dark:border-gray-800 dark:bg-gray-900">
          {mesas.length === 0 ? (
            <p className="text-xs text-gray-400">{tDynamic('Nenhuma mesa cadastrada ainda — crie mesas no Mapa de Mesas.')}</p>
          ) : (
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-gray-400">{tDynamic('Mesa:')}</span>
              {mesas.map((m) => (
                <button key={m.id} onClick={() => setMesaSelecionada(m)}
                  className={`shrink-0 rounded-full border-2 px-3.5 py-1.5 text-xs font-black transition ${mesaSelecionada?.id === m.id ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)] text-white' : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300'}`}>
                  {m.numero}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <ProductGrid
          busca={busca}
          setBusca={setBusca}
          categorias={categorias}
          catAtiva={catAtiva}
          setCatAtiva={setCatAtiva}
          produtosVisiveis={produtosVisiveis}
          tocarProduto={tocarProduto}
        />

        <CartSidebar
          lojaId={lojaId}
          carrinho={carrinho}
          limparVenda={limparVenda}
          mudarQtd={mudarQtd}
          removerItem={(idx) => setCarrinho((c) => c.filter((_, x) => x !== idx))}
          nomeCliente={nomeCliente}
          setNomeCliente={setNomeCliente}
          clienteSelecionado={clienteSelecionado}
          setClienteSelecionado={setClienteSelecionado}
          desconto={desconto}
          setDesconto={setDesconto}
          subtotal={subtotal}
          descontoNum={descontoNum}
          total={total}
          erro={erro}
          modo={modo}
          turno={turno}
          mesaSelecionada={mesaSelecionada}
          enviandoMesa={enviandoMesa}
          setEtapa={setEtapa}
          setMetodo={setMetodo}
          setErro={setErro}
          enviarParaMesa={enviarParaMesa}
        />
      </div>

      {/* ── Modal: opções do produto ── */}
      {escolhendo && (
        <ModalOpcoes produto={escolhendo} onFechar={() => setEscolhendo(null)}
          onConfirmar={(opcoes, qtd, obs) => { adicionarProduto(escolhendo, opcoes, qtd, obs); setEscolhendo(null); }} />
      )}

      {/* ── Modal: pagamento ── */}
      {etapa === 'PAGANDO' && (
        <PaymentModal
          total={total}
          metodo={metodo}
          setMetodo={setMetodo}
          setErro={setErro}
          valorRecebido={valorRecebido}
          setValorRecebido={setValorRecebido}
          recebidoNum={recebidoNum}
          troco={troco}
          erro={erro}
          processando={processando}
          registrarVenda={registrarVenda}
          setEtapa={setEtapa}
        />
      )}

      {/* ── Modal: Pix aguardando ── */}
      {etapa === 'PIX_AGUARDANDO' && pixInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl dark:bg-gray-900">
            <h3 className="text-lg font-black dark:text-gray-100">Pix de {fmt(total)}</h3>
            <p className="mt-1 text-xs text-gray-500">Peça para o cliente apontar a câmera para o QR Code.</p>
            {pixInfo.qrImagem
              ? <img src={getOptimizedImageUrl(pixInfo.qrImagem)} alt="QR Code Pix" className="mx-auto mt-4 w-56 rounded-2xl border border-gray-200 dark:border-gray-700" />
              : <p className="mt-4 break-all rounded-xl bg-gray-100 p-3 font-mono text-[10px] dark:bg-gray-800 dark:text-gray-200">{pixInfo.copiaECola}</p>}
            <p className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold text-gray-500">
              Aguardando o pagamento cair… confirma sozinho.
            </p>
            <div className="mt-4 flex gap-2">
              <button onClick={limparVenda} className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-bold text-gray-500 dark:border-gray-700">Cancelar</button>
              <button onClick={confirmarPixRecebido} disabled={processando} className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-50">Já caiu — confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: sucesso ── */}
      {etapa === 'SUCESSO' && venda && (
        <OrderSuccessModal
          venda={venda}
          imprimirVenda={imprimirVenda}
          limparVenda={limparVenda}
        />
      )}

      {/* ── Modais do caixa ── */}
      {modalCaixa && (
        <CaixaModal {...propsCaixaModal} />
      )}
    </div>
  );
}



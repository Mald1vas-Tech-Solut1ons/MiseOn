import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bell, Smartphone, CheckCircle, Volume2, Divide, ChevronRight, Zap,
  Utensils, Users, Clock, Plus, Search, Check, ShoppingBag, X,
  Banknote, CreditCard, QrCode, Calculator, Trash2, ArrowLeft, RefreshCw, AlertTriangle
} from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useGarcomPush } from '../../hooks/useGarcomPush';
import type { CtxLoja } from './AdminLayout';
import { fmt, precoItem, type Mesa, type Produto, type Opcao, type ItemCarrinho, type MetodoPgto, type Comanda, type Pedido } from '../../types';
import { ModalDivisaoItemGarcom } from '../../components/mesas/ModalDivisaoItemGarcom';
import { createPedidoPedido } from '../../lib/pedidos';
import { useI18n } from '../../contexts/I18nContext';

type TabGarcom = 'MESAS' | 'CHAMADOS' | 'CARDAPIO' | 'FECHAMENTO';

interface MesaComConsumo extends Mesa {
  comanda?: Comanda;
  totalParcial: number;
  totalPago: number;
  qtdItens: number;
  temItemEmPreparo: boolean;
  tempoMinutos: number;
}

function minutosDesde(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

export function PainelGarcomMobile() {
  const { tDynamic } = useI18n();
  const { lojaId } = useOutletContext<CtxLoja>();
  const {
    chamadosPendentes,
    pushHabilitado,
    solicitarPermissaoPush,
    atenderChamado,
    concluirChamado,
  } = useGarcomPush(lojaId);

  // Estados principais
  const [tabAtiva, setTabAtiva] = useState<TabGarcom>('MESAS');
  const [mesas, setMesas] = useState<MesaComConsumo[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<{ id: string; nome: string }[]>([]);
  const [catAtiva, setCatAtiva] = useState<string | 'TODAS'>('TODAS');
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);

  // Seleção e Comanda Ativa
  const [mesaSelecionada, setMesaSelecionada] = useState<MesaComConsumo | null>(null);
  const [pedidosMesa, setPedidosMesa] = useState<Pedido[]>([]);
  const [assentoAtivo, setAssentoAtivo] = useState<number | null>(null);

  // Lançamento de Pedido / Carrinho
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [produtoModalOpcoes, setProdutoModalOpcoes] = useState<Produto | null>(null);
  const [opcoesSelecionadasModal, setOpcoesSelecionadasModal] = useState<Opcao[]>([]);
  const [qtdModal, setQtdModal] = useState(1);
  const [obsModal, setObsModal] = useState('');
  const [assentoModal, setAssentoModal] = useState<number | null>(null);
  const [enviandoPedido, setEnviandoPedido] = useState(false);
  const [sucessoPedidoMsg, setSucessoPedidoMsg] = useState('');

  // Fracionamento (Método 1)
  const [produtoParaFracionar, setProdutoParaFracionar] = useState<Produto | null>(null);

  // Fechamento de Conta
  const [taxaServicoPct, setTaxaServicoPct] = useState(10);
  const [modoDivisao, setModoDivisao] = useState<'POR_ASSENTO' | 'IGUALITARIA' | 'LIVRE'>('POR_ASSENTO');
  const [qtdPessoasIgual, setQtdPessoasIgual] = useState(2);
  const [valorLivreDigitado, setValorLivreDigitado] = useState('');
  const [metodoPgto, setMetodoPgto] = useState<MetodoPgto>('DINHEIRO');
  const [valorRecebidoDinheiro, setValorRecebidoDinheiro] = useState('');
  const [processandoFechamento, setProcessandoFechamento] = useState(false);
  const [erroFechamento, setErroFechamento] = useState('');

  /* ── Carregamento de Dados ── */
  const carregarDados = useCallback(async () => {
    if (!lojaId) return;

    try {
      const [{ data: ms }, { data: ps }, { data: cs }, { data: comandas }] = await Promise.all([
        supabase.from('mesas').select('*').eq('loja_id', lojaId).eq('ativo', true).order('numero'),
        supabase.from('produtos').select('*, grupos_opcoes(*, opcoes(*))').eq('loja_id', lojaId).eq('disponivel', true).order('ordem'),
        supabase.from('categorias').select('id, nome').eq('loja_id', lojaId).eq('ativo', true).order('ordem'),
        supabase.from('comandas').select('*').eq('loja_id', lojaId).eq('status', 'ABERTA'),
      ]);

      const listaMesas = (ms as Mesa[]) || [];
      const listaComandas = (comandas as Comanda[]) || [];
      const comandaPorMesa = new Map(listaComandas.map((c) => [c.mesa_id, c]));
      const comandaIds = listaComandas.map((c) => c.id);

      const consumoPorComanda = new Map<string, { total: number; pago: number; qtd: number; emPreparo: boolean }>();

      if (comandaIds.length > 0) {
        const { data: peds } = await supabase
          .from('pedidos')
          .select('id, comanda_id, status, valor_total, criado_em, itens_pedido(quantidade), pagamentos(valor_pago)')
          .in('comanda_id', comandaIds)
          .neq('status', 'CANCELADO');

        for (const p of (peds as any[]) || []) {
          const acum = consumoPorComanda.get(p.comanda_id) || { total: 0, pago: 0, qtd: 0, emPreparo: false };
          acum.total += Number(p.valor_total || 0);
          acum.pago += (p.pagamentos || []).reduce((s: number, pg: any) => s + Number(pg.valor_pago || 0), 0);
          acum.qtd += (p.itens_pedido || []).reduce((s: number, i: any) => s + Number(i.quantidade || 0), 0);
          if (['NOVO', 'ACEITO', 'PREPARANDO'].includes(p.status)) acum.emPreparo = true;
          consumoPorComanda.set(p.comanda_id, acum);
        }
      }

      const mesasFormatadas: MesaComConsumo[] = listaMesas.map((m) => {
        const comanda = comandaPorMesa.get(m.id);
        const cons = comanda ? consumoPorComanda.get(comanda.id) : undefined;
        return {
          ...m,
          comanda,
          totalParcial: cons?.total || 0,
          totalPago: cons?.pago || 0,
          qtdItens: cons?.qtd || 0,
          temItemEmPreparo: cons?.emPreparo || false,
          tempoMinutos: comanda ? minutosDesde(comanda.aberta_em) : 0,
        };
      });

      setMesas(mesasFormatadas);
      setProdutos((ps as Produto[]) || []);
      setCategorias(cs || []);

      // Se havia uma mesa selecionada, atualiza suas informações
      if (mesaSelecionada) {
        const mAtualizada = mesasFormatadas.find((x) => x.id === mesaSelecionada.id) || null;
        setMesaSelecionada(mAtualizada);
      }
    } catch (e) {
      console.error('Erro ao carregar dados do Garçom PWA:', e);
    } finally {
      setCarregando(false);
    }
  }, [lojaId, mesaSelecionada?.id]);

  useEffect(() => {
    carregarDados();
    const canal = supabase
      .channel(`garcom-mobile-${lojaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas', filter: `loja_id=eq.${lojaId}` }, () => carregarDados())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos', filter: `loja_id=eq.${lojaId}` }, () => carregarDados())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chamados_garcom', filter: `loja_id=eq.${lojaId}` }, () => carregarDados())
      .subscribe();

    return () => { supabase.removeChannel(canal); };
  }, [lojaId, carregarDados]);

  /* ── Carregar Pedidos da Mesa Selecionada ── */
  const carregarPedidosMesa = useCallback(async (comandaId: string) => {
    const { data } = await supabase
      .from('pedidos')
      .select('id, numero, status, valor_total, criado_em, estacao_atual, etapa_kds_atual, itens_pedido(id, nome_produto, quantidade, preco_unitario, observacao, assento_numero, itens_pedido_opcoes(nome_opcao, preco_adicional))')
      .eq('comanda_id', comandaId)
      .neq('status', 'CANCELADO')
      .order('criado_em', { ascending: false });

    setPedidosMesa((data as unknown as Pedido[]) || []);
  }, []);

  const abrirMesa = (m: MesaComConsumo) => {
    setMesaSelecionada(m);
    setAssentoAtivo(null);
    setCarrinho([]);
    setSucessoPedidoMsg('');
    if (m.comanda) {
      carregarPedidosMesa(m.comanda.id);
    } else {
      setPedidosMesa([]);
    }
  };

  /* ── Filtro de Produtos ── */
  const produtosFiltrados = useMemo(() => {
    let lista = produtos;
    if (catAtiva !== 'TODAS') lista = lista.filter((p) => p.categoria_id === catAtiva);
    if (busca.trim()) lista = lista.filter((p) => p.nome.toLowerCase().includes(busca.trim().toLowerCase()));
    return lista;
  }, [produtos, catAtiva, busca]);

  /* ── Adicionar Produto ao Carrinho do Garçom ── */
  const abrirModalOpcoesProduto = (p: Produto) => {
    const temOpcoes = (p.grupos_opcoes || []).some((g) => (g.opcoes || []).filter((o) => o.disponivel).length > 0);
    if (temOpcoes) {
      setProdutoModalOpcoes(p);
      setOpcoesSelecionadasModal([]);
      setQtdModal(1);
      setObsModal('');
      setAssentoModal(assentoAtivo);
    } else {
      adicionarAoCarrinho(p, [], 1, '', assentoAtivo);
    }
  };

  const adicionarAoCarrinho = (p: Produto, opcoes: Opcao[], quantidade: number, obs: string, assento: number | null) => {
    setCarrinho((c) => {
      const itemNovo: ItemCarrinho = {
        produto: p,
        quantidade,
        opcoesSelecionadas: opcoes,
        observacao: obs.trim() || undefined,
        assento_numero: assento,
      };
      return [...c, itemNovo];
    });
  };

  const subtotalCarrinho = useMemo(() => carrinho.reduce((s, i) => s + precoItem(i), 0), [carrinho]);

  /* ── Enviar Pedido Direto para a Cozinha (Status ACEITO -> KDS) ── */
  const enviarPedidoMesa = async () => {
    if (!mesaSelecionada || carrinho.length === 0 || !lojaId) return;

    setEnviandoPedido(true);
    try {
      // Buscar ou criar comanda aberta da mesa
      let comandaId = mesaSelecionada.comanda?.id;
      if (!comandaId) {
        const { data: novaCom, error: errCom } = await supabase
          .from('comandas')
          .insert({
            loja_id: lojaId,
            mesa_id: mesaSelecionada.id,
            status: 'ABERTA',
            taxa_servico_pct: taxaServicoPct,
            valor_servico: 0,
          })
          .select()
          .single();

        if (errCom) throw errCom;
        comandaId = novaCom.id;
      }

      // Envia o pedido com status ACEITO para que entre direto no KDS da cozinha
      const ped = await createPedidoPedido({
        lojaId,
        tipo_pedido: 'SALAO',
        origem: 'garcom_mobile',
        comanda_id: comandaId,
        mesa_numero: mesaSelecionada.numero,
        identificador_cliente: `Mesa #${mesaSelecionada.numero}`,
        subtotal: subtotalCarrinho,
        desconto: 0,
        valor_total: subtotalCarrinho,
        carrinho,
      });

      setSucessoPedidoMsg(`✅ Pedido #${ped.numero} enviado com sucesso para a Cozinha (Mesa #${mesaSelecionada.numero})!`);
      setCarrinho([]);
      carregarDados();
      if (comandaId) carregarPedidosMesa(comandaId);
    } catch (e: any) {
      console.error('Erro ao enviar pedido do garçom:', e);
      alert('Falha ao enviar pedido: ' + (e.message || String(e)));
    } finally {
      setEnviandoPedido(false);
    }
  };

  /* ── Rachar Produto no Lançamento (Método 1) ── */
  const lancarItemFracionado = async (produto: Produto, assentos: number[]) => {
    if (!mesaSelecionada || !lojaId) return;

    try {
      let comandaId = mesaSelecionada.comanda?.id;
      if (!comandaId) {
        const { data: novaCom, error: errCom } = await supabase
          .from('comandas')
          .insert({
            loja_id: lojaId,
            mesa_id: mesaSelecionada.id,
            status: 'ABERTA',
            taxa_servico_pct: 10,
            valor_servico: 0,
          })
          .select()
          .single();

        if (errCom) throw errCom;
        comandaId = novaCom.id;
      }

      // Buscar ou criar pedido vinculado em status ACEITO
      let { data: pedido } = await supabase
        .from('pedidos')
        .select('*')
        .eq('comanda_id', comandaId)
        .neq('status', 'CANCELADO')
        .maybeSingle();

      if (!pedido) {
        const { data: novoPed, error: errPed } = await supabase
          .from('pedidos')
          .insert({
            loja_id: lojaId,
            comanda_id: comandaId,
            mesa_numero: mesaSelecionada.numero,
            tipo_pedido: 'SALAO',
            status: 'ACEITO',
            requer_cozinha: true,
            estacao_atual: 'COZINHA',
            etapa_kds_atual: 'etapa_fila',
            enviado_cozinha_em: new Date().toISOString(),
            identificador_cliente: `Mesa #${mesaSelecionada.numero}`,
            subtotal: 0,
            desconto: 0,
            valor_total: 0,
            origem: 'garcom_mobile',
          })
          .select()
          .single();

        if (errPed) throw errPed;
        pedido = novoPed;
      }

      const fracao = 1 / assentos.length;
      const precoFracionado = Number((produto.preco * fracao).toFixed(2));

      const inserts = assentos.map((assentoNum) => ({
        pedido_id: pedido.id,
        produto_id: produto.id,
        nome_produto: `${produto.nome} (1/${assentos.length})`,
        preco_unitario: precoFracionado,
        quantidade: 1,
        fracionado: true,
        participantes_assentos: assentos,
        assento_numero: assentoNum,
      }));

      const { error: errItens } = await supabase.from('itens_pedido').insert(inserts);
      if (errItens) throw errItens;

      const { data: todosItens } = await supabase
        .from('itens_pedido')
        .select('preco_unitario, quantidade')
        .eq('pedido_id', pedido.id);

      const novoSubtotal = (todosItens || []).reduce(
        (acc, item) => acc + Number(item.preco_unitario) * Number(item.quantidade),
        0
      );

      await supabase
        .from('pedidos')
        .update({ subtotal: novoSubtotal, valor_total: novoSubtotal })
        .eq('id', pedido.id);

      setProdutoParaFracionar(null);
      setSucessoPedidoMsg(`✅ ${produto.nome} fracionado com sucesso entre os assentos [${assentos.join(', ')}]!`);
      carregarDados();
      if (comandaId) carregarPedidosMesa(comandaId);
    } catch (err: any) {
      console.error('Erro ao fracionar item no lançamento:', err);
      alert('Falha ao lançar item fracionado.');
    }
  };

  /* ── Cálculos de Fechamento de Conta ── */
  const subtotalMesa = mesaSelecionada?.totalParcial || 0;
  const valorServicoMesa = subtotalMesa * (taxaServicoPct / 100);
  const totalMesa = subtotalMesa + valorServicoMesa;
  const saldoDevedorMesa = Math.max(0, totalMesa - (mesaSelecionada?.totalPago || 0));

  // Itens consumidos por assento
  const itensPorAssento = useMemo(() => {
    const mapa = new Map<number, number>();
    for (const p of pedidosMesa) {
      for (const i of p.itens_pedido || []) {
        if (i.assento_numero) {
          const val = Number(i.preco_unitario) * Number(i.quantidade);
          mapa.set(i.assento_numero, (mapa.get(i.assento_numero) || 0) + val);
        }
      }
    }
    return mapa;
  }, [pedidosMesa]);

  const subtotalAssentoAtivo = assentoAtivo ? (itensPorAssento.get(assentoAtivo) || 0) : subtotalMesa;
  const valorServicoAssentoAtivo = subtotalAssentoAtivo * (taxaServicoPct / 100);
  const totalAssentoAtivo = subtotalAssentoAtivo + valorServicoAssentoAtivo;

  const valorACobrarFechamento = useMemo(() => {
    if (modoDivisao === 'IGUALITARIA') {
      return saldoDevedorMesa / Math.max(1, qtdPessoasIgual);
    }
    if (modoDivisao === 'POR_ASSENTO' && assentoAtivo) {
      return totalAssentoAtivo;
    }
    if (modoDivisao === 'LIVRE') {
      return Number(valorLivreDigitado.replace(',', '.')) || saldoDevedorMesa;
    }
    return saldoDevedorMesa;
  }, [modoDivisao, saldoDevedorMesa, qtdPessoasIgual, assentoAtivo, totalAssentoAtivo, valorLivreDigitado]);

  /* ── Confirmar Pagamento & Fechamento de Conta ── */
  const confirmarFechamentoConta = async () => {
    if (!mesaSelecionada?.comanda || pedidosMesa.length === 0) return;
    if (mesaSelecionada.temItemEmPreparo) {
      setErroFechamento('Ainda existem itens em preparo na cozinha. Aguarde a finalização.');
      return;
    }
    if (valorACobrarFechamento <= 0) {
      setErroFechamento('Informe um valor válido a cobrar.');
      return;
    }

    setProcessandoFechamento(true);
    setErroFechamento('');

    try {
      const comanda = mesaSelecionada.comanda;
      const pedidoBase = [...pedidosMesa].sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0];
      const isPagamentoParcial = valorACobrarFechamento < saldoDevedorMesa - 0.05;

      const { error: ePgto } = await supabase.from('pagamentos').insert({
        pedido_id: pedidoBase.id,
        metodo: metodoPgto,
        valor_pago: valorACobrarFechamento,
        status: 'PAGO',
        data_pagamento: new Date().toISOString(),
      });
      if (ePgto) throw ePgto;

      if (!isPagamentoParcial) {
        if (valorServicoMesa > 0) {
          await supabase
            .from('pedidos')
            .update({ valor_total: Number(pedidoBase.valor_total) + valorServicoMesa })
            .eq('id', pedidoBase.id);
        }

        await supabase
          .from('pedidos')
          .update({ status: 'FINALIZADO' })
          .eq('comanda_id', comanda.id)
          .not('status', 'in', '(CANCELADO,FINALIZADO)');

        const { data: { user } } = await supabase.auth.getUser();
        await supabase
          .from('comandas')
          .update({
            status: 'FECHADA',
            fechada_em: new Date().toISOString(),
            fechada_por: user?.id ?? null,
            metodo_pagamento: metodoPgto,
            valor_servico: valorServicoMesa,
            taxa_servico_pct: taxaServicoPct,
          })
          .eq('id', comanda.id);

        alert(`🎉 Conta da Mesa #${mesaSelecionada.numero} fechada com sucesso!`);
        setMesaSelecionada(null);
        setTabAtiva('MESAS');
      } else {
        alert(`✅ Pagamento parcial de ${fmt(valorACobrarFechamento)} registrado com sucesso!`);
      }

      carregarDados();
    } catch (e: any) {
      console.error('Erro ao fechar conta:', e);
      setErroFechamento('Erro ao processar pagamento: ' + (e.message || String(e)));
    } finally {
      setProcessandoFechamento(false);
    }
  };

  /* ═════════════════════════ UI RENDER ═════════════════════════ */

  return (
    <div className="mx-auto max-w-md pb-24 space-y-4">
      {/* Topo Header Garçom PWA */}
      <div className="rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-amber-600 p-4 text-slate-950 shadow-xl space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-black text-lg">
            <Smartphone size={22} />
            <span>Garçom Mobile PWA</span>
          </div>
          <button
            onClick={carregarDados}
            className="flex items-center gap-1 rounded-full bg-slate-950/20 px-2.5 py-1 text-xs font-bold hover:bg-slate-950/40 transition"
          >
            <RefreshCw size={12} className={carregando ? 'animate-spin' : ''} /> Ao Vivo
          </button>
        </div>

        {!pushHabilitado && (
          <button
            onClick={solicitarPermissaoPush}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-950 py-2 text-xs font-bold text-orange-400 shadow-md hover:bg-slate-900 transition mt-1"
          >
            <Volume2 size={15} /> Ativar Vibração & Notificações Push
          </button>
        )}
      </div>

      {/* Navegação por Abas Principais */}
      <div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-slate-900/80 p-1.5 border border-slate-800 backdrop-blur-md">
        <button
          onClick={() => setTabAtiva('MESAS')}
          className={`flex flex-col items-center justify-center rounded-xl py-2 text-xs font-bold transition ${
            tabAtiva === 'MESAS'
              ? 'bg-orange-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Utensils size={16} />
          <span className="mt-0.5">Mesas</span>
        </button>

        <button
          onClick={() => setTabAtiva('CHAMADOS')}
          className={`flex flex-col items-center justify-center rounded-xl py-2 text-xs font-bold transition relative ${
            tabAtiva === 'CHAMADOS'
              ? 'bg-orange-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Bell size={16} />
          <span className="mt-0.5">Chamados</span>
          {chamadosPendentes.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 font-mono text-[10px] font-black text-white animate-bounce">
              {chamadosPendentes.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setTabAtiva('CARDAPIO')}
          disabled={!mesaSelecionada}
          className={`flex flex-col items-center justify-center rounded-xl py-2 text-xs font-bold transition disabled:opacity-40 ${
            tabAtiva === 'CARDAPIO'
              ? 'bg-orange-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShoppingBag size={16} />
          <span className="mt-0.5">Lançar</span>
        </button>

        <button
          onClick={() => setTabAtiva('FECHAMENTO')}
          disabled={!mesaSelecionada || !mesaSelecionada.comanda}
          className={`flex flex-col items-center justify-center rounded-xl py-2 text-xs font-bold transition disabled:opacity-40 ${
            tabAtiva === 'FECHAMENTO'
              ? 'bg-orange-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calculator size={16} />
          <span className="mt-0.5">Conta</span>
        </button>
      </div>

      {/* Banner de Mesa Ativa Selecionada */}
      {mesaSelecionada && (
        <div className="flex items-center justify-between rounded-2xl border border-orange-500/40 bg-orange-500/10 px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <Utensils size={16} className="text-orange-400" />
            <span className="font-bold text-orange-200">
              Mesa #{mesaSelecionada.numero} {mesaSelecionada.nome ? `(${mesaSelecionada.nome})` : ''}
            </span>
            <span className="font-mono text-xs opacity-90 text-orange-300">
              · {fmt(saldoDevedorMesa)}
            </span>
          </div>
          <button
            onClick={() => setMesaSelecionada(null)}
            className="text-xs font-bold text-orange-400 underline hover:text-orange-300"
          >
            Trocar
          </button>
        </div>
      )}

      {/* ════════════════ ABA 1: MAPA DE MESAS & BIPAGEM DE COMANDA ════════════════ */}
      {tabAtiva === 'MESAS' && (
        <div className="space-y-3">
          {/* Bipagem / Leitura de Cartão de Comanda no Salão (Evita Filas no Caixa) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3 space-y-2">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              🔍 Bipar / Ler Cartão de Comanda do Cliente (#104, #rafael):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Bipe o QR Code / código do cartão..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && busca.trim()) {
                    e.preventDefault();
                    // Buscar comanda por numero_cartao ou mesa
                    const termo = busca.trim();
                    const { data: com } = await supabase
                      .from('comandas')
                      .select('*')
                      .eq('loja_id', lojaId)
                      .eq('status', 'ABERTA')
                      .ilike('numero_cartao', `%${termo}%`)
                      .maybeSingle();

                    if (com) {
                      const mesaAssoc = mesas.find((m) => m.comanda?.id === com.id) || {
                        id: com.mesa_id || com.id,
                        loja_id: lojaId,
                        numero: 0,
                        nome: `Cartão #${com.numero_cartao || 'Comanda'}`,
                        ativo: true,
                        criado_em: new Date().toISOString(),
                        comanda: com,
                        totalParcial: 0,
                        totalPago: 0,
                        qtdItens: 0,
                        temItemEmPreparo: false,
                        tempoMinutos: 0,
                      };
                      abrirMesa(mesaAssoc);
                    } else {
                      alert(`Nenhuma comanda aberta encontrada para o cartão "${termo}".`);
                    }
                  }
                }}
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs font-bold text-slate-100 placeholder-slate-500 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Utensils size={14} className="text-orange-400" />
              Salão / Mesas Ativas ({mesas.length})
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              {mesas.filter((m) => !!m.comanda).length} Ocupadas · {mesas.filter((m) => !m.comanda).length} Livres
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {mesas.map((m) => {
              const ocupada = !!m.comanda;
              const ehSelecionada = mesaSelecionada?.id === m.id;
              const temChamado = chamadosPendentes.some((c) => c.mesa_id === m.id);

              return (
                <div
                  key={m.id}
                  onClick={() => abrirMesa(m)}
                  className={`cursor-pointer rounded-2xl border-2 p-3.5 shadow-md transition text-left space-y-2 relative overflow-hidden ${
                    ehSelecionada
                      ? 'border-orange-500 bg-orange-500/10'
                      : ocupada
                      ? 'border-amber-500/40 bg-slate-900/90'
                      : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-lg text-slate-100">
                      #{m.numero}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                        ocupada
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}
                    >
                      {ocupada ? 'Ocupada' : 'Livre'}
                    </span>
                  </div>

                  {m.nome && <p className="text-xs opacity-90 text-slate-400 truncate">{m.nome}</p>}

                  {ocupada ? (
                    <div className="space-y-1 border-t border-slate-800 pt-2">
                      <div className="font-extrabold text-base text-orange-400">
                        {fmt(m.totalParcial - m.totalPago)}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                        <Clock size={11} /> {m.tempoMinutos}m · {m.qtdItens} itens
                      </div>
                      {m.temItemEmPreparo && (
                        <span className="inline-block rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-300">
                          🍳 Em preparo
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 pt-2">{tDynamic('Toque para abrir comanda')}</p>
                  )}

                  {temChamado && (
                    <div className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Extrato da Mesa Selecionada (se houver) */}
          {mesaSelecionada && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-4 mt-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-bold text-slate-100 text-base">
                    Comanda Mesa #{mesaSelecionada.numero}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {mesaSelecionada.comanda ? `Aberta há ${mesaSelecionada.tempoMinutos} minutos` : 'Mesa livre'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTabAtiva('CARDAPIO')}
                    className="flex items-center gap-1 rounded-xl bg-orange-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-orange-400 transition"
                  >
                    <Plus size={14} /> + Lançar Pedido
                  </button>
                </div>
              </div>

              {pedidosMesa.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Nenhum pedido lançado nesta comanda ainda.</p>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {pedidosMesa.map((p) => (
                    <div key={p.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-1.5 text-xs">
                      <div className="flex justify-between font-bold text-slate-300">
                        <span>Pedido #{p.numero}</span>
                        <span className="text-orange-400">{fmt(Number(p.valor_total))}</span>
                      </div>
                      {(p.itens_pedido || []).map((i) => (
                        <div key={i.id} className="flex justify-between text-slate-400">
                          <span>
                            {i.quantidade}× {i.nome_produto}
                            {i.assento_numero ? ` (Cad. #${i.assento_numero})` : ''}
                          </span>
                          <span className="font-mono text-slate-300">
                            {fmt(Number(i.preco_unitario) * Number(i.quantidade))}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {mesaSelecionada.comanda && (
                <div className="flex items-center justify-between border-t border-slate-800 pt-3">
                  <div>
                    <span className="text-xs opacity-90 text-slate-400 block">Total Consumido</span>
                    <span className="text-lg font-extrabold text-orange-400">{fmt(subtotalMesa)}</span>
                  </div>
                  <button
                    onClick={() => setTabAtiva('FECHAMENTO')}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-lg"
                  >
                    <Calculator size={14} /> Fechar / Rachar Conta
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════════ ABA 2: CHAMADOS PENDENTES ════════════════ */}
      {tabAtiva === 'CHAMADOS' && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Bell size={14} className="text-orange-400" />
            Chamados no Salão ({chamadosPendentes.length})
          </h2>

          {chamadosPendentes.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center text-xs text-slate-400 space-y-2">
              <CheckCircle size={32} className="mx-auto text-emerald-500/60 mb-2" />
              <div className="font-semibold text-slate-300 text-sm">Nenhum chamado no momento</div>
              <div>O smartphone vibrará quando um cliente solicitar atendimento na mesa.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {chamadosPendentes.map((chamado) => (
                <div
                  key={chamado.id}
                  className={`rounded-2xl p-4 border shadow-lg space-y-3 ${
                    chamado.tipo === 'FECHAMENTO'
                      ? 'bg-rose-500/10 border-rose-500/40 text-rose-200'
                      : 'bg-orange-500/10 border-orange-500/40 text-orange-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-base flex items-center gap-1.5">
                      <Zap size={16} className="text-amber-400" />
                      Mesa #{chamado.mesa_numero || 'Geral'}
                    </span>
                    <span className="text-xs font-mono font-semibold rounded-full bg-slate-950/60 px-2.5 py-0.5 border border-slate-800">
                      {chamado.tipo}
                    </span>
                  </div>

                  <p className="text-xs opacity-90">
                    {chamado.tipo === 'FECHAMENTO'
                      ? 'Cliente solicitou o fechamento da conta!'
                      : 'Cliente solicita garçom para atendimento na mesa.'}
                  </p>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => atenderChamado(chamado.id)}
                      className="flex-1 rounded-xl bg-orange-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-orange-400 transition"
                    >
                      Atender Agora
                    </button>
                    <button
                      onClick={() => concluirChamado(chamado.id)}
                      className="rounded-xl bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                    >
                      Concluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════ ABA 3: LANÇAMENTO / CARDÁPIO ════════════════ */}
      {tabAtiva === 'CARDAPIO' && (
        <div className="space-y-4">
          {!mesaSelecionada ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center text-xs text-slate-400">
              Selecione uma mesa no mapa para lançar pedidos.
            </div>
          ) : (
            <>
              {/* Barra de Busca & Categorias */}
              <div className="space-y-2">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar produto pelo nome..."
                    className="w-full rounded-xl bg-slate-900 border border-slate-800 pl-9 pr-3 py-2.5 text-xs text-slate-100 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    onClick={() => setCatAtiva('TODAS')}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold shrink-0 transition ${
                      catAtiva === 'TODAS'
                        ? 'bg-orange-500 text-slate-950'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    Todas
                  </button>
                  {categorias.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCatAtiva(c.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold shrink-0 transition ${
                        catAtiva === c.id
                          ? 'bg-orange-500 text-slate-950'
                          : 'bg-slate-900 text-slate-400 border border-slate-800'
                      }`}
                    >
                      {c.nome}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modalidade Especial: Fracionamento de Item (Método 1) */}
              <button
                onClick={() => {
                  if (produtos.length > 0) setProdutoParaFracionar(produtos[0]);
                }}
                className="w-full flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition"
              >
                <span className="flex items-center gap-1.5">
                  <Divide size={16} /> Rachar item no lançamento (Método 1)
                </span>
                <ChevronRight size={14} />
              </button>

              {sucessoPedidoMsg && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-300 flex justify-between items-center">
                  <span>{sucessoPedidoMsg}</span>
                  <button onClick={() => setSucessoPedidoMsg('')}><X size={14} /></button>
                </div>
              )}

              {/* Lista de Produtos do Cardápio */}
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {produtosFiltrados.map((prod) => (
                  <div
                    key={prod.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-orange-500/50 transition"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="font-semibold text-slate-200 text-xs truncate">{prod.nome}</div>
                      <div className="text-xs text-orange-400 font-mono font-bold mt-0.5">
                        {fmt(prod.preco)}
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={() => setProdutoParaFracionar(prod)}
                        className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-bold text-amber-400 hover:bg-slate-700 transition"
                      >
                        Rachar
                      </button>
                      <button
                        onClick={() => abrirModalOpcoesProduto(prod)}
                        className="rounded-lg bg-orange-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-orange-400 transition flex items-center gap-1"
                      >
                        <Plus size={13} /> Adicionar
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Carrinho / Sacola de Lançamento */}
              {carrinho.length > 0 && (
                <div className="rounded-2xl border border-orange-500/40 bg-slate-900 p-4 space-y-3 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-xs text-orange-300 uppercase tracking-wider flex items-center gap-1">
                      <ShoppingBag size={14} /> Sacola do Pedido ({carrinho.length} itens)
                    </span>
                    <button
                      onClick={() => setCarrinho([])}
                      className="text-xs text-rose-400 hover:underline font-semibold"
                    >
                      Limpar
                    </button>
                  </div>

                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {carrinho.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs text-slate-300">
                        <div>
                          <span className="font-bold text-slate-100">{item.quantidade}× {item.produto.nome}</span>
                          {item.assento_numero && <span className="text-[10px] text-blue-400 font-mono block">Cadeira #{item.assento_numero}</span>}
                          {item.observacao && <span className="text-[10px] text-slate-400 block">Obs: {item.observacao}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-orange-400 font-bold">{fmt(precoItem(item))}</span>
                          <button onClick={() => setCarrinho(carrinho.filter((_, x) => x !== idx))} className="text-slate-500 hover:text-rose-400">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between border-t border-slate-800 pt-2 text-sm font-extrabold text-slate-100">
                    <span>Total da Sacola</span>
                    <span className="text-orange-400">{fmt(subtotalCarrinho)}</span>
                  </div>

                  <button
                    onClick={enviarPedidoMesa}
                    disabled={enviandoPedido}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-sm font-bold text-slate-950 hover:bg-orange-400 transition shadow-lg disabled:opacity-50"
                  >
                    <Zap size={16} /> {enviandoPedido ? 'Enviando…' : `Enviar Pedido para Cozinha (Mesa #${mesaSelecionada.numero})`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ════════════════ ABA 4: FECHAMENTO DE CONTA ════════════════ */}
      {tabAtiva === 'FECHAMENTO' && (
        <div className="space-y-4">
          {!mesaSelecionada || !mesaSelecionada.comanda ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center text-xs text-slate-400">
              Selecione uma mesa com comanda aberta no mapa para fechar a conta.
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-4">
              <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-100 text-base">
                    Fechamento de Conta · Mesa #{mesaSelecionada.numero}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Comanda de {mesaSelecionada.qtdItens} itens · Aberta há {mesaSelecionada.tempoMinutos}m
                  </p>
                </div>
              </div>

              {mesaSelecionada.temItemEmPreparo && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs font-semibold text-amber-300">
                  <AlertTriangle size={15} /> A cozinha ainda está preparando itens desta mesa.
                </div>
              )}

              {/* Modalidade de Divisão */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Modalidade de Divisão
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => setModoDivisao('POR_ASSENTO')}
                    className={`rounded-xl p-2 text-xs font-bold border transition ${
                      modoDivisao === 'POR_ASSENTO'
                        ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                        : 'border-slate-800 bg-slate-950 text-slate-400'
                    }`}
                  >
                    Por Assento
                  </button>
                  <button
                    onClick={() => setModoDivisao('IGUALITARIA')}
                    className={`rounded-xl p-2 text-xs font-bold border transition ${
                      modoDivisao === 'IGUALITARIA'
                        ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                        : 'border-slate-800 bg-slate-950 text-slate-400'
                    }`}
                  >
                    Igualitária
                  </button>
                  <button
                    onClick={() => setModoDivisao('LIVRE')}
                    className={`rounded-xl p-2 text-xs font-bold border transition ${
                      modoDivisao === 'LIVRE'
                        ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                        : 'border-slate-800 bg-slate-950 text-slate-400'
                    }`}
                  >
                    Valor Livre
                  </button>
                </div>

                {modoDivisao === 'POR_ASSENTO' && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-1">
                    <button
                      onClick={() => setAssentoAtivo(null)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold shrink-0 transition border ${
                        assentoAtivo === null
                          ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                          : 'border-slate-800 bg-slate-950 text-slate-400'
                      }`}
                    >
                      Mesa Toda ({fmt(subtotalMesa)})
                    </button>
                    {Array.from({ length: mesaSelecionada.capacidade || 4 }).map((_, idx) => {
                      const numAssento = idx + 1;
                      const valConsumido = itensPorAssento.get(numAssento) || 0;
                      return (
                        <button
                          key={numAssento}
                          onClick={() => setAssentoAtivo(numAssento)}
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold shrink-0 transition border ${
                            assentoAtivo === numAssento
                              ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                              : 'border-slate-800 bg-slate-950 text-slate-400'
                          }`}
                        >
                          Cadeira #{numAssento} ({fmt(valConsumido)})
                        </button>
                      );
                    })}
                  </div>
                )}

                {modoDivisao === 'IGUALITARIA' && (
                  <div className="flex items-center justify-between rounded-xl bg-slate-950 p-3 border border-slate-800 text-xs">
                    <span className="text-slate-300 font-semibold">{tDynamic('Dividir por quantas pessoas?')}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQtdPessoasIgual((q) => Math.max(1, q - 1))}
                        className="h-7 w-7 rounded-lg bg-slate-800 font-black text-slate-200"
                      >
                        -
                      </button>
                      <span className="font-mono text-sm font-black text-white">{qtdPessoasIgual}</span>
                      <button
                        onClick={() => setQtdPessoasIgual((q) => q + 1)}
                        className="h-7 w-7 rounded-lg bg-slate-800 font-black text-slate-200"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                {modoDivisao === 'LIVRE' && (
                  <div className="space-y-1 pt-1">
                    <label className="text-xs font-semibold text-slate-400">Valor a pagar agora (R$)</label>
                    <input
                      type="text"
                      value={valorLivreDigitado}
                      onChange={(e) => setValorLivreDigitado(e.target.value)}
                      placeholder={fmt(saldoDevedorMesa)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-center text-base font-black text-white outline-none focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              {/* Taxa de Serviço & Resumo */}
              <div className="rounded-xl bg-slate-950 p-3 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Taxa de Serviço (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={taxaServicoPct}
                    onChange={(e) => setTaxaServicoPct(Number(e.target.value))}
                    className="w-14 rounded-lg border border-slate-800 bg-slate-900 p-1 text-center font-bold text-slate-100"
                  />
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-mono text-slate-200">{fmt(subtotalMesa)}</span>
                </div>
                {valorServicoMesa > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Serviço ({taxaServicoPct}%)</span>
                    <span className="font-mono text-slate-200">{fmt(valorServicoMesa)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-extrabold text-slate-100 border-t border-slate-800 pt-2">
                  <span>A Cobrar Agora</span>
                  <span className="text-emerald-400 font-mono">{fmt(valorACobrarFechamento)}</span>
                </div>
              </div>

              {/* Forma de Pagamento */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Forma de Pagamento
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { m: 'DINHEIRO' as MetodoPgto, label: 'Dinheiro', icon: Banknote },
                    { m: 'PIX' as MetodoPgto, label: 'Pix', icon: QrCode },
                    { m: 'CREDITO' as MetodoPgto, label: 'Crédito', icon: CreditCard },
                    { m: 'DEBITO' as MetodoPgto, label: 'Débito', icon: CreditCard },
                  ].map((item) => (
                    <button
                      key={item.m}
                      onClick={() => setMetodoPgto(item.m)}
                      className={`flex items-center justify-center gap-2 rounded-xl p-3 text-xs font-bold border transition ${
                        metodoPgto === item.m
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                          : 'border-slate-800 bg-slate-950 text-slate-400'
                      }`}
                    >
                      <item.icon size={16} /> {item.label}
                    </button>
                  ))}
                </div>

                {metodoPgto === 'DINHEIRO' && (
                  <div className="pt-1">
                    <label className="text-xs font-semibold text-slate-400">Valor recebido (para troco)</label>
                    <input
                      type="text"
                      value={valorRecebidoDinheiro}
                      onChange={(e) => setValorRecebidoDinheiro(e.target.value)}
                      placeholder={fmt(valorACobrarFechamento)}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-center text-sm font-bold text-white outline-none focus:border-emerald-500"
                    />
                    {Number(valorRecebidoDinheiro.replace(',', '.')) > valorACobrarFechamento && (
                      <p className="text-xs text-emerald-400 font-bold mt-1 text-center">
                        Troco: {fmt(Number(valorRecebidoDinheiro.replace(',', '.')) - valorACobrarFechamento)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {erroFechamento && <p className="text-xs font-bold text-rose-400 text-center">{erroFechamento}</p>}

              <button
                onClick={confirmarFechamentoConta}
                disabled={processandoFechamento}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white hover:bg-emerald-500 transition shadow-lg disabled:opacity-50"
              >
                <Check size={18} /> {processandoFechamento ? 'Processando…' : `Confirmar Pagamento (${fmt(valorACobrarFechamento)})`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal de Opções do Produto (Quando abre via Lançamento) */}
      {produtoModalOpcoes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-100 text-sm">{produtoModalOpcoes.nome}</h3>
              <button onClick={() => setProdutoModalOpcoes(null)}><X size={18} className="text-slate-400" /></button>
            </div>

            {/* Grupos de Opções */}
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {(produtoModalOpcoes.grupos_opcoes || []).map((grp) => (
                <div key={grp.id} className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{grp.nome}</span>
                  <div className="space-y-1">
                    {(grp.opcoes || []).filter((o) => o.disponivel).map((op) => {
                      const sel = opcoesSelecionadasModal.some((x) => x.id === op.id);
                      return (
                        <button
                          key={op.id}
                          onClick={() => {
                            if (sel) {
                              setOpcoesSelecionadasModal(opcoesSelecionadasModal.filter((x) => x.id !== op.id));
                            } else {
                              setOpcoesSelecionadasModal([...opcoesSelecionadasModal, op]);
                            }
                          }}
                          className={`w-full flex justify-between p-2 rounded-xl text-xs font-semibold border transition ${
                            sel ? 'border-orange-500 bg-orange-500/20 text-orange-300' : 'border-slate-800 bg-slate-950 text-slate-400'
                          }`}
                        >
                          <span>{op.nome}</span>
                          <span>+{fmt(Number(op.preco_adicional))}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="space-y-1 pt-2">
                <label className="text-xs font-semibold text-slate-400 block">Assento / Cadeira (Opcional)</label>
                <select
                  value={assentoModal || ''}
                  onChange={(e) => setAssentoModal(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2 text-xs text-slate-100"
                >
                  <option value="">Geral (Mesa)</option>
                  {Array.from({ length: mesaSelecionada?.capacidade || 4 }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>Cadeira #{i + 1}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 block">Observação (ex: sem cebola)</label>
                <input
                  type="text"
                  value={obsModal}
                  onChange={(e) => setObsModal(e.target.value)}
                  placeholder="Sem cebola, ponto da carne..."
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2 text-xs text-slate-100"
                />
              </div>
            </div>

            <button
              onClick={() => {
                adicionarAoCarrinho(produtoModalOpcoes, opcoesSelecionadasModal, qtdModal, obsModal, assentoModal);
                setProdutoModalOpcoes(null);
              }}
              className="w-full rounded-xl bg-orange-500 py-3 text-xs font-bold text-slate-950 hover:bg-orange-400 transition"
            >
              Adicionar à Sacola da Mesa
            </button>
          </div>
        </div>
      )}

      {/* Modal Método 1: Fracionamento no Lançamento */}
      {produtoParaFracionar && mesaSelecionada && (
        <ModalDivisaoItemGarcom
          produto={produtoParaFracionar}
          capacidadeMesa={mesaSelecionada.capacidade || 6}
          onCancelar={() => setProdutoParaFracionar(null)}
          onConfirmar={(assentos) => lancarItemFracionado(produtoParaFracionar, assentos)}
        />
      )}
    </div>
  );
}

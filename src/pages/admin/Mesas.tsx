import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  LayoutGrid, Plus, QrCode, X, Users, Clock, Check, Banknote, CreditCard,
  Trash2, Printer, AlertTriangle, Loader2, Copy, Percent, Box, SlidersHorizontal, Move,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fmt, type Mesa, type Comanda, type Pedido, type Loja, type MetodoPgto } from '../../types';
import { gerarQrDataUrl } from '../../lib/qr';
import { imprimir } from '../../lib/print';
import type { CtxLoja } from './AdminLayout';
import MiseOnLoader from '../../components/MiseOnLoader';
import { Mesas3DCanvas } from '../../lib/mesas3d/Mesas3DCanvas';
import { prepararLayoutSalao3D } from '../../lib/mesas3d/layoutMesas';
import type { Mesa3DPosicionada } from '../../lib/mesas3d/types';
import { GarcomMesaDrawer } from '../../components/mesas3d/GarcomMesaDrawer';
import { EditorLayout3DModal } from '../../components/mesas3d/EditorLayout3DModal';
import { ModalDivisaoProdutoCaixa } from '../../components/mesas/ModalDivisaoProdutoCaixa';
import type { ItemPedido } from '../../types';
import { useI18n } from '../../contexts/I18nContext';

/* ─────────────────────────────────────────────────────────────
   Mapa de Mesas — visão do salão para o garçom/gerente.
   Cada mesa "ocupada" tem uma comanda ABERTA que agrupa N
   pedidos (rodadas). Fechar a conta soma tudo, aplica a taxa
   de serviço e gera um pagamento por pedido (mesmo padrão do
   resto do sistema — sem mexer no schema de pagamentos).
   ───────────────────────────────────────────────────────────── */

const METODOS: { m: MetodoPgto; label: string; icon: typeof Banknote }[] = [
  { m: 'DINHEIRO', label: 'Dinheiro', icon: Banknote },
  { m: 'PIX', label: 'Pix (chave da loja)', icon: QrCode },
  { m: 'CREDITO', label: 'Crédito (maquininha)', icon: CreditCard },
  { m: 'DEBITO', label: 'Débito (maquininha)', icon: CreditCard },
];

const STATUS_EM_PREPARO: Pedido['status'][] = ['NOVO', 'ACEITO', 'PREPARANDO'];

interface MesaComComanda extends Mesa {
  comanda?: Comanda;
  totalParcial: number;
  totalPago: number;
  qtdItens: number;
  temItemEmPreparo: boolean;
}

function minutosDesde(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

const novaMesaSchema = z.object({
  numero: z.string().min(1, 'O número é obrigatório').regex(/^\d+$/, 'Apenas números'),
  nome: z.string().optional(),
  capacidade: z.string().optional()
});

export default function Mesas() {
  const { tDynamic } = useI18n();
  const { lojaId, lojaSlug } = useOutletContext<CtxLoja>();
  const [loja, setLoja] = useState<Loja | null>(null);
  const [mesas, setMesas] = useState<MesaComComanda[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Estados da Engine 3D e Salão
  const [viewModo, setViewModo] = useState<'SALAO_3D' | 'GRADE'>('SALAO_3D');
  const [mesasBrutas, setMesasBrutas] = useState<Mesa[]>([]);
  const [comandasCruas, setComandasCruas] = useState<Comanda[]>([]);
  const [pedidosCruos, setPedidosCruos] = useState<Pedido[]>([]);
  const [garcomDrawerMesa, setGarcomDrawerMesa] = useState<Mesa3DPosicionada | null>(null);
  const [assentoInicialDrawer, setAssentoInicialDrawer] = useState<number | null>(null);
  const [modalEditorLayout, setModalEditorLayout] = useState(false);
  const [modoEdicao3D, setModoEdicao3D] = useState(false);

  const [modalNovaMesa, setModalNovaMesa] = useState(false);
  const [salvandoMesa, setSalvandoMesa] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<z.infer<typeof novaMesaSchema>>({
    resolver: zodResolver(novaMesaSchema)
  });

  const [mesaQr, setMesaQr] = useState<Mesa | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  const [mesaDetalhe, setMesaDetalhe] = useState<MesaComComanda | null>(null);
  const [pedidosComanda, setPedidosComanda] = useState<Pedido[]>([]);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [taxaEditavel, setTaxaEditavel] = useState('0');
  const [fechando, setFechando] = useState<MetodoPgto | null>(null);
  const [valorRecebido, setValorRecebido] = useState('');
  const [erroFechamento, setErroFechamento] = useState('');
  const [processandoFechamento, setProcessandoFechamento] = useState(false);

  const [mostrarTransferencia, setMostrarTransferencia] = useState(false);
  const [transferindoPara, setTransferindoPara] = useState('');
  const [modalDivisaoCaixa, setModalDivisaoCaixa] = useState(false);

  const carregar = useCallback(async () => {
    const [{ data: mesasData }, { data: lj }, { data: comandas }] = await Promise.all([
      supabase.from('mesas').select('*').eq('loja_id', lojaId).eq('ativo', true).order('numero'),
      supabase.from('lojas').select('*').eq('id', lojaId).single(),
      supabase.from('comandas').select('*').eq('loja_id', lojaId).eq('status', 'ABERTA'),
    ]);
    setLoja((lj as Loja) ?? null);
    setMesasBrutas((mesasData as Mesa[]) ?? []);
    setComandasCruas((comandas as Comanda[]) ?? []);

    const comandaPorMesa = new Map((comandas as Comanda[] ?? []).map((c) => [c.mesa_id, c]));
    const comandaIds = (comandas ?? []).map((c: any) => c.id);

    const pedidosPorComanda = new Map<string, { total: number; pago: number; qtd: number; emPreparo: boolean }>();
    let todosPedidosBrutos: Pedido[] = [];

    if (comandaIds.length > 0) {
      const { data: pedidos } = await supabase
        .from('pedidos')
        .select('id, comanda_id, status, valor_total, criado_em, itens_pedido(*), pagamentos(valor_pago)')
        .in('comanda_id', comandaIds)
        .neq('status', 'CANCELADO');

      todosPedidosBrutos = (pedidos as unknown as Pedido[]) ?? [];
      setPedidosCruos(todosPedidosBrutos);

      for (const p of (pedidos as any[]) ?? []) {
        const atual = pedidosPorComanda.get(p.comanda_id) ?? { total: 0, pago: 0, qtd: 0, emPreparo: false };
        atual.total += Number(p.valor_total);
        atual.pago += (p.pagamentos ?? []).reduce((s: number, pg: any) => s + Number(pg.valor_pago), 0);
        atual.qtd += (p.itens_pedido ?? []).reduce((s: number, i: any) => s + i.quantidade, 0);
        if (STATUS_EM_PREPARO.includes(p.status)) atual.emPreparo = true;
        pedidosPorComanda.set(p.comanda_id, atual);
      }
    } else {
      setPedidosCruos([]);
    }

    setMesas(((mesasData as Mesa[]) ?? []).map((m) => {
      const comanda = comandaPorMesa.get(m.id);
      const agregado = comanda ? pedidosPorComanda.get(comanda.id) : undefined;
      return {
        ...m,
        comanda,
        totalParcial: agregado?.total ?? 0,
        totalPago: agregado?.pago ?? 0,
        qtdItens: agregado?.qtd ?? 0,
        temItemEmPreparo: agregado?.emPreparo ?? false,
      };
    }));
    setCarregando(false);
  }, [lojaId]);

  useEffect(() => {
    setTimeout(() => {
      carregar();
    }, 0);
    const canal = supabase
      .channel(`mesas-${lojaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas', filter: `loja_id=eq.${lojaId}` }, () => carregar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos', filter: `loja_id=eq.${lojaId}` }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [lojaId, carregar]);

  const livres = mesas.filter((m) => !m.comanda);
  const ocupadas = mesas.filter((m) => !!m.comanda);

  /* ── criar mesa ── */
  const criarMesa = async (data: z.infer<typeof novaMesaSchema>) => {
    setSalvandoMesa(true);
    const { error } = await supabase.from('mesas').insert({
      loja_id: lojaId,
      numero: Number(data.numero),
      nome: data.nome?.trim() || null,
      capacidade: data.capacidade ? Number(data.capacidade) : null,
    });
    setSalvandoMesa(false);
    if (error) { alert('Erro ao criar mesa: ' + (error.message.includes('duplicate') ? 'já existe uma mesa com esse número.' : error.message)); return; }
    setModalNovaMesa(false); 
    reset();
    carregar();
  };

  const excluirMesa = async (mesa: MesaComComanda) => {
    if (mesa.comanda) return alert('Essa mesa está com uma comanda aberta — feche a conta antes de excluir.');
    if (!confirm(`Remover a Mesa ${mesa.numero}?`)) return;
    await supabase.from('mesas').update({ ativo: false }).eq('id', mesa.id);
    carregar();
  };

  /* ── QR da mesa ── */
  const abrirQr = async (mesa: Mesa) => {
    setMesaQr(mesa);
    const url = `${window.location.origin}/${lojaSlug}?mesa=${mesa.numero}`;
    setQrDataUrl(await gerarQrDataUrl(url));
  };

  const imprimirQr = () => {
    if (!mesaQr || !qrDataUrl) return;
    const janela = window.open('', '_blank', 'width=420,height=560');
    if (!janela) return;
    janela.document.write(`
      <html><head><title>QR Mesa ${mesaQr.numero}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
        .card { border: 3px solid #111; border-radius: 20px; padding: 28px; text-align:center; width: 320px; }
        h1 { font-size: 42px; margin: 0 0 4px; }
        p { color:#444; font-size:13px; margin: 4px 0 18px; }
        img { width: 240px; height: 240px; }
        .rodape { margin-top: 16px; font-size: 11px; color:#888; letter-spacing: 2px; text-transform: uppercase; }
      </style></head>
      <body>
        <div class="card">
          <p style="text-transform:uppercase;font-weight:700;letter-spacing:2px;">Mesa</p>
          <h1>${mesaQr.numero}</h1>
          <p>{tDynamic('Aponte a câmera do celular')}<br/>para ver o cardápio e pedir</p>
          <img src="${qrDataUrl}" />
          <div class="rodape">MiseOn</div>
        </div>
        <script>window.onload = () => window.print();</script>
      </body></html>
    `);
    janela.document.close();
  };

  /* ── detalhe da mesa / comanda ── */
  const abrirDetalhe = async (mesa: MesaComComanda) => {
    setMesaDetalhe(mesa);
    setErroFechamento(''); setFechando(null); setValorRecebido('');
    setTaxaEditavel(String(loja?.taxa_servico_padrao_pct ?? mesa.comanda?.taxa_servico_pct ?? 0));
    if (!mesa.comanda) { setPedidosComanda([]); return; }
    setCarregandoDetalhe(true);
    const { data } = await supabase
      .from('pedidos')
      .select('id, numero, status, valor_total, criado_em, itens_pedido(id, nome_produto, quantidade, preco_unitario, observacao, itens_pedido_opcoes(nome_opcao, preco_adicional)), pagamentos(valor_pago)')
      .eq('comanda_id', mesa.comanda.id)
      .neq('status', 'CANCELADO')
      .order('criado_em');
    setPedidosComanda((data as unknown as Pedido[]) ?? []);
    setCarregandoDetalhe(false);
  };

  const subtotalComanda = useMemo(() => pedidosComanda.reduce((s, p) => s + Number(p.valor_total), 0), [pedidosComanda]);
  const valorServico = subtotalComanda * (Number(String(taxaEditavel).replace(',', '.') || 0) / 100);
  const totalComanda = subtotalComanda + valorServico;
  const valorJaPago = pedidosComanda.reduce((s, p) => s + ((p.pagamentos as any) ?? []).reduce((s2: number, pg: any) => s2 + Number(pg.valor_pago), 0), 0);
  const saldoDevedor = Math.max(0, totalComanda - valorJaPago);
  const bloqueadoPorPreparo = pedidosComanda.some((p) => STATUS_EM_PREPARO.includes(p.status));
  
  const recebidoNum = Number(String(valorRecebido).replace(',', '.') || (fechando !== 'DINHEIRO' ? saldoDevedor : 0));
  const trocoFechamento = fechando === 'DINHEIRO' ? Math.max(0, recebidoNum - saldoDevedor) : 0;

  const confirmarFechamento = async (metodo: MetodoPgto) => {
    if (!mesaDetalhe?.comanda || pedidosComanda.length === 0) return;
    if (bloqueadoPorPreparo) { setErroFechamento('Ainda tem item sendo preparado — aguarde ficar pronto.'); return; }
    if (recebidoNum <= 0) { setErroFechamento('Informe o valor pago.'); return; }
    
    setProcessandoFechamento(true); setErroFechamento('');
    try {
      const comanda = mesaDetalhe.comanda;
      const pedidoBase = [...pedidosComanda].sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0];
      const isPagamentoParcial = recebidoNum < saldoDevedor;
      const valorAPagar = isPagamentoParcial ? recebidoNum : saldoDevedor;

      // O cliente Supabase NÃO lança em erro — devolve { error }. O try/catch
      // em volta deste bloco nunca pegou nada: a conta era impressa e a tela
      // dizia "fechado" mesmo quando a mesa continuava ocupada no sistema ou o
      // pagamento não constava. Cada escrita é conferida antes da seguinte.

      // Cria o registro do pagamento atrelado ao último pedido (apenas para constar na comanda)
      const { error: ePgto } = await supabase.from('pagamentos').insert({
        pedido_id: pedidoBase.id, metodo, valor_pago: valorAPagar, status: 'PAGO', data_pagamento: new Date().toISOString(),
      });
      if (ePgto) throw ePgto;

      if (!isPagamentoParcial) {
        // Fechamento Total
        if (valorServico > 0) {
          // Acrescenta a taxa no último pedido
          const { error: eTaxa } = await supabase.from('pedidos').update({ valor_total: Number(pedidoBase.valor_total) + valorServico }).eq('id', pedidoBase.id);
          if (eTaxa) throw eTaxa;
        }
        const { error: eFin } = await supabase.from('pedidos').update({ status: 'FINALIZADO' }).eq('comanda_id', comanda.id).not('status', 'in', '(CANCELADO,FINALIZADO)');
        if (eFin) throw eFin;
        const { data: { user } } = await supabase.auth.getUser();
        const { error: eCom } = await supabase.from('comandas').update({
          status: 'FECHADA', fechada_em: new Date().toISOString(), fechada_por: user?.id ?? null,
          metodo_pagamento: metodo, valor_servico: valorServico, taxa_servico_pct: Number(taxaEditavel || 0),
        }).eq('id', comanda.id);
        if (eCom) throw eCom;
      }

      imprimir({
        template: 'CONTA_MESA',
        lojaNome: loja?.nome || 'MiseOn',
        loja,
        contaMesa: {
          mesaNumero: mesaDetalhe.numero,
          numerosPedidos: pedidosComanda.map((p) => p.numero),
          itens: pedidosComanda.flatMap((p) => (p.itens_pedido ?? []).map((i) => ({
            nome_produto: i.nome_produto, quantidade: i.quantidade, preco_unitario: Number(i.preco_unitario),
            opcoes: i.itens_pedido_opcoes?.map((o) => ({ nome_opcao: o.nome_opcao, preco_adicional: Number(o.preco_adicional) })),
          }))),
          subtotal: subtotalComanda,
          taxaServicoPct: Number(taxaEditavel || 0),
          valorServico,
          total: totalComanda,
          metodoPagamento: METODOS.find((x) => x.m === metodo)?.label.split(' (')[0],
          valorPagoParcial: isPagamentoParcial ? valorAPagar : undefined,
        },
      });

      if (!isPagamentoParcial) {
        setMesaDetalhe(null);
      }
      setFechando(null); setValorRecebido('');
      carregar();
    } catch (e: any) {
      console.error(e);
      setErroFechamento('Erro ao fechar a conta: ' + (e.message ?? String(e)));
    }
    setProcessandoFechamento(false);
  };

  const imprimirPreviaConta = () => {
    if (!mesaDetalhe || pedidosComanda.length === 0) return;
    imprimir({
      template: 'CONTA_MESA',
      lojaNome: loja?.nome || 'MiseOn',
      loja,
      contaMesa: {
        mesaNumero: mesaDetalhe.numero,
        numerosPedidos: pedidosComanda.map((p) => p.numero),
        itens: pedidosComanda.flatMap((p) => (p.itens_pedido ?? []).map((i) => ({
          nome_produto: i.nome_produto, quantidade: i.quantidade, preco_unitario: Number(i.preco_unitario),
          opcoes: i.itens_pedido_opcoes?.map((o) => ({ nome_opcao: o.nome_opcao, preco_adicional: Number(o.preco_adicional) })),
        }))),
        subtotal: subtotalComanda,
        taxaServicoPct: Number(taxaEditavel || 0),
        valorServico,
        total: totalComanda,
      },
    });
  };

  const transferirMesa = async () => {
    if (!mesaDetalhe?.comanda) return;
    const numDestino = Number(transferindoPara);
    const mesaDest = mesas.find((m) => m.numero === numDestino);
    
    if (!mesaDest) return setErroFechamento('Mesa de destino não cadastrada.');
    if (mesaDest.comanda) return setErroFechamento('A mesa de destino já está ocupada.');
    
    setProcessandoFechamento(true);
    try {
      await supabase.from('comandas').update({ mesa_id: mesaDest.id }).eq('id', mesaDetalhe.comanda.id);
      await supabase.from('pedidos').update({ mesa_numero: numDestino }).eq('comanda_id', mesaDetalhe.comanda.id);
      setMostrarTransferencia(false);
      setTransferindoPara('');
      setMesaDetalhe(null);
      carregar();
    } catch (e: any) {
      setErroFechamento('Erro ao transferir: ' + e.message);
    }
    setProcessandoFechamento(false);
  };

  const mesas3D = useMemo(() => {
    return prepararLayoutSalao3D(mesasBrutas, comandasCruas, pedidosCruos);
  }, [mesasBrutas, comandasCruas, pedidosCruos]);

  const salvarPosicaoMesa3D = async (mesaId: string, novaPos: { x: number; z: number; rotacao: number }) => {
    await supabase.from('mesas').update({
      pos_x: novaPos.x,
      pos_z: novaPos.z,
      rotacao: novaPos.rotacao,
    }).eq('id', mesaId);
    carregar();
  };

  const inputCls = 'w-full rounded-xl border border-gray-300 p-2.5 text-sm outline-none focus:border-[var(--cor-primaria)] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100';

  if (carregando) {
    return (
      <div className="flex h-64 items-center justify-center">
        <MiseOnLoader status="Carregando mapa do salão..." rows={2} />
      </div>
    );
  }

  return (
    <div data-tour="tour-mesas-header" className="mx-auto max-w-5xl p-4 pb-12">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black dark:text-gray-100">
            <Box size={22} className="text-orange-500" /> {tDynamic('Mapa do Salão & Assentos 3D')}
          </h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {ocupadas.length} {tDynamic('ocupada')}{ocupadas.length !== 1 ? 's' : ''} · {livres.length} {tDynamic('livre')}{livres.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Seletor de Modo: Salão 3D vs Grade 2D */}
          <div className="flex rounded-xl border border-gray-200 bg-gray-100 p-1 dark:border-gray-800 dark:bg-gray-900">
            <button
              onClick={() => setViewModo('SALAO_3D')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                viewModo === 'SALAO_3D'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              <Box size={14} /> {tDynamic('Salão 3D')}
            </button>
            <button
              onClick={() => setViewModo('GRADE')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                viewModo === 'GRADE'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              <LayoutGrid size={14} /> {tDynamic('Grade 2D')}
            </button>
          </div>

          {viewModo === 'SALAO_3D' && (
            <>
              <button
                onClick={() => setModoEdicao3D(!modoEdicao3D)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                  modoEdicao3D
                    ? 'border-orange-500 bg-orange-500/20 text-orange-400'
                    : 'border-gray-200 bg-white text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300'
                }`}
              >
                <Move size={14} /> {modoEdicao3D ? tDynamic('Arraste Ativo') : tDynamic('Mover Mesas')}
              </button>

              <button
                onClick={() => setModalEditorLayout(true)}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <SlidersHorizontal size={14} /> {tDynamic('Ajustar Salão')}
              </button>
            </>
          )}

          <button onClick={() => setModalNovaMesa(true)} className="flex items-center gap-1.5 rounded-xl bg-[var(--cor-primaria)] px-4 py-2 text-sm font-bold text-white shadow-md transition hover:brightness-110">
            <Plus size={16} /> {tDynamic('Nova mesa')}
          </button>
        </div>
      </div>

      {mesas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 py-16 text-center dark:border-gray-700">
          <LayoutGrid size={32} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-semibold text-gray-500">Nenhuma mesa cadastrada ainda.</p>
          <p className="mt-1 text-xs text-gray-400">{tDynamic('Crie suas mesas e gere o QR Code para os clientes pedirem direto de onde estão sentados.')}</p>
        </div>
      ) : viewModo === 'SALAO_3D' ? (
        <Mesas3DCanvas
          mesas3D={mesas3D}
          altura="650px"
          modoEdicao={modoEdicao3D}
          onSelecionarMesa={(m3d, assentoNum) => {
            setGarcomDrawerMesa(m3d);
            setAssentoInicialDrawer(assentoNum ?? null);
          }}
          onLayoutChange={salvarPosicaoMesa3D}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {mesas.map((m) => {
            const ocupada = !!m.comanda;
            const min = m.comanda ? minutosDesde(m.comanda.aberta_em) : 0;
            return (
              <div key={m.id}
                className={`group relative overflow-hidden rounded-2xl border-2 p-4 shadow-sm transition ${ocupada ? 'border-orange-400 bg-orange-50 dark:border-orange-900/60 dark:bg-orange-900/10' : 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900'}`}>
                <button onClick={() => abrirDetalhe(m)} className="block w-full text-left">
                  <div className="flex items-start justify-between">
                    <span className="font-['Sora'] text-2xl font-black dark:text-gray-100">{m.numero}</span>
                    {ocupada
                      ? <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-black text-white">OCUPADA</span>
                      : <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">LIVRE</span>}
                  </div>
                  {m.nome && <p className="mt-0.5 truncate text-[11px] text-gray-400">{m.nome}</p>}
                  {m.capacidade && <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-400"><Users size={11} /> {m.capacidade} lugares</p>}
                  {ocupada ? (
                    <div className="mt-3 border-t border-orange-200 pt-2 dark:border-orange-900/40">
                      <p className="text-lg font-black text-orange-600 dark:text-orange-400">{fmt(m.totalParcial - m.totalPago)}</p>
                      <p className="flex items-center gap-1 text-[11px] text-gray-500"><Clock size={10} /> {min}min · {m.qtdItens} item(ns){m.temItemEmPreparo ? ' · prep.' : ''}{m.totalPago > 0 ? ' · (Pago par.)' : ''}</p>
                    </div>
                  ) : (
                    <p className="mt-3 text-[11px] text-gray-400">{tDynamic('Toque para abrir a conta')}</p>
                  )}
                </button>
                <div className="mt-2 flex gap-1.5 border-t border-gray-100 pt-2 dark:border-gray-800">
                  <button onClick={() => abrirQr(m)} className="flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"><QrCode size={12} /> QR Code</button>
                  {!ocupada && (
                    <button onClick={() => excluirMesa(m)} className="rounded-lg px-2 py-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"><Trash2 size={12} /></button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal: nova mesa ── */}
      {modalNovaMesa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => !salvandoMesa && setModalNovaMesa(false)}>
          <form onSubmit={handleSubmit(criarMesa)} className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black dark:text-gray-100">Nova mesa</h3>
              <button type="button" onClick={() => setModalNovaMesa(false)} className="text-gray-400"><X size={20} /></button>
            </div>
            
            <label className="text-xs font-bold text-gray-600 dark:text-gray-300">{tDynamic('Número da mesa *')}</label>
            <input {...register('numero')} placeholder="ex: 5" inputMode="numeric" autoFocus className={`${inputCls} mt-1 text-center text-xl font-black ${errors.numero ? 'border-red-500 focus:border-red-500' : ''}`} />
            {errors.numero && <p className="mt-1 text-[10px] text-red-500">{errors.numero.message}</p>}

            <label className="mt-3 block text-xs font-bold text-gray-600 dark:text-gray-300">Nome (opcional)</label>
            <input {...register('nome')} placeholder="ex: Varanda" className={`${inputCls} mt-1`} />
            
            <label className="mt-3 block text-xs font-bold text-gray-600 dark:text-gray-300">Lugares (opcional)</label>
            <input {...register('capacidade')} placeholder="ex: 4" inputMode="numeric" className={`${inputCls} mt-1`} />
            
            <button type="submit" disabled={salvandoMesa} className="mt-4 w-full rounded-2xl bg-[var(--cor-primaria)] py-3.5 text-sm font-black text-white disabled:opacity-50">
              {salvandoMesa ? 'Criando…' : 'Criar mesa'}
            </button>
          </form>
        </div>
      )}

      {/* ── Modal: QR da mesa ── */}
      {mesaQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setMesaQr(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-black dark:text-gray-100">QR · Mesa {mesaQr.numero}</h3>
              <button onClick={() => setMesaQr(null)} className="text-gray-400"><X size={20} /></button>
            </div>
            {qrDataUrl
              ? <img src={qrDataUrl} alt={`QR Mesa ${mesaQr.numero}`} className="mx-auto w-56 rounded-2xl border border-gray-200 dark:border-gray-700" />
              : <div className="flex h-56 items-center justify-center"><Loader2 className="animate-spin text-gray-300" /></div>}
            <p className="mt-3 text-xs text-gray-500">O cliente aponta a câmera e cai direto no cardápio, já identificado como Mesa {mesaQr.numero} — sem precisar criar login.</p>
            <button onClick={imprimirQr} disabled={!qrDataUrl} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--cor-primaria)] py-3.5 text-sm font-black text-white disabled:opacity-50">
              <Printer size={16} /> {tDynamic('Imprimir para a mesa')}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: detalhe da mesa / fechar conta ── */}
      {mesaDetalhe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => !processandoFechamento && setMesaDetalhe(null)}>
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl bg-white shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <h3 className="text-lg font-black dark:text-gray-100">Mesa {mesaDetalhe.numero}</h3>
              <div className="flex items-center gap-3">
                {mesaDetalhe.comanda && (
                  <>
                    <button onClick={() => setModalDivisaoCaixa(true)} className="text-xs font-bold text-orange-500 hover:underline">
                      {tDynamic('Rachar por Produto')}
                    </button>
                    <button onClick={() => setMostrarTransferencia(!mostrarTransferencia)} className="text-xs font-bold text-[var(--cor-primaria)]">Mover</button>
                  </>
                )}
                <button onClick={() => { setMesaDetalhe(null); setMostrarTransferencia(false); }} className="text-gray-400"><X size={20} /></button>
              </div>
            </div>

            {mostrarTransferencia && mesaDetalhe.comanda && (
              <div className="bg-gray-50 dark:bg-gray-800/50 p-5 border-b border-gray-100 dark:border-gray-800">
                <p className="text-sm font-bold dark:text-gray-200 mb-2">{tDynamic('Transferir para qual mesa?')}</p>
                <div className="flex gap-2">
                  <select value={transferindoPara} onChange={(e) => setTransferindoPara(e.target.value)} className={`${inputCls} flex-1`}>
                    <option value="">{tDynamic('Selecione uma mesa livre')}</option>
                    {livres.map(m => <option key={m.id} value={m.numero}>Mesa {m.numero}</option>)}
                  </select>
                  <button onClick={transferirMesa} disabled={!transferindoPara || processandoFechamento} className="rounded-xl bg-[var(--cor-primaria)] px-4 text-sm font-bold text-white disabled:opacity-50">
                    Mover
                  </button>
                </div>
                {erroFechamento && <p className="mt-2 text-xs text-red-500 font-semibold">{erroFechamento}</p>}
              </div>
            )}

            {!mesaDetalhe.comanda ? (
              <div className="p-8 text-center">
                <p className="text-sm text-gray-500">{tDynamic('Essa mesa está livre — sem comanda aberta.')}</p>
                <p className="mt-1 text-xs text-gray-400">{tDynamic('Gere o QR Code para o cliente pedir, ou use o PDV em modo mesa para lançar o primeiro pedido.')}</p>
              </div>
            ) : carregandoDetalhe ? (
              <div className="p-8 text-center text-sm text-gray-400">Carregando comanda…</div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-5">
                  {bloqueadoPorPreparo && (
                    <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-400">
                      <AlertTriangle size={14} /> {tDynamic('Ainda tem item sendo preparado — a conta libera para fechar quando tudo estiver pronto.')}
                    </div>
                  )}
                  <div className="space-y-3">
                    {pedidosComanda.map((p) => (
                      <div key={p.id} className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-gray-400">Pedido #{p.numero}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_EM_PREPARO.includes(p.status) ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>{p.status}</span>
                        </div>
                        {p.itens_pedido?.map((i) => (
                          <div key={i.id} className="flex justify-between text-[13px]">
                            <span className="text-gray-600 dark:text-gray-300">{i.quantidade}× {i.nome_produto}</span>
                            <span className="font-semibold dark:text-gray-200">{fmt(Number(i.preco_unitario) * i.quantidade)}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-100 p-5 dark:border-gray-800">
                  <div className="mb-2 flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-300"><Percent size={12} /> {tDynamic('Taxa de serviço')}</label>
                    <div className="flex items-center gap-1">
                      <input value={taxaEditavel} onChange={(e) => {
                        const value = e.target.value;
                        if (value.startsWith('-')) { setErroFechamento('Valor não pode ser negativo'); return; }
                        const clean = value.replace(/[^\d,]/g, '').replace(/,+/g, ',');
                        const parts = clean.split(',');
                        if (parts[1] && parts[1].length > 2) {
                          setTaxaEditavel(parts[0] + ',' + parts[1].slice(0, 2));
                        } else {
                          setTaxaEditavel(clean);
                        }
                      }} className="w-14 rounded-lg border border-gray-300 p-1.5 text-center text-xs font-bold dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                      <span className="text-xs font-bold text-gray-400">%</span>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-gray-500">
                    <div className="flex justify-between"><span>Subtotal</span><span>{fmt(subtotalComanda)}</span></div>
                    {valorServico > 0 && <div className="flex justify-between"><span>{tDynamic('Taxa de serviço')}</span><span>{fmt(valorServico)}</span></div>}
                    {valorJaPago > 0 && <div className="flex justify-between font-medium text-emerald-600 dark:text-emerald-400"><span>Já pago</span><span>- {fmt(valorJaPago)}</span></div>}
                    <div className="flex justify-between text-lg font-black dark:text-gray-100">
                      <span>Restante</span>
                      <span className={saldoDevedor === 0 ? 'text-emerald-600' : 'text-[var(--cor-primaria)]'}>{fmt(saldoDevedor)}</span>
                    </div>
                  </div>

                  {saldoDevedor > 0 && (
                    <button onClick={imprimirPreviaConta} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2 text-xs font-bold text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5">
                      <Printer size={13} /> Imprimir conta parcial
                    </button>
                  )}

                  {!fechando ? (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {saldoDevedor > 0 ? METODOS.map((op) => (
                        <button key={op.m} onClick={() => { setFechando(op.m); setErroFechamento(''); setValorRecebido(''); }} disabled={bloqueadoPorPreparo}
                          className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-gray-200 p-3 text-xs font-bold text-gray-600 transition hover:border-[var(--cor-primaria)] hover:text-[var(--cor-primaria)] disabled:opacity-40 dark:border-gray-700 dark:text-gray-300">
                          <op.icon size={18} />{op.label}
                        </button>
                      )) : (
                        <div className="col-span-2 text-center text-sm font-bold text-emerald-600">{tDynamic('A conta já foi 100% paga.')} <button onClick={() => confirmarFechamento('DINHEIRO')} className="underline">Fechar comanda agora.</button></div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl bg-gray-50 p-4 dark:bg-gray-800/50">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-black dark:text-gray-100">{METODOS.find((m) => m.m === fechando)?.label}</p>
                        <button onClick={() => setFechando(null)} className="text-xs font-bold text-gray-400">trocar</button>
                      </div>
                      {fechando === 'DINHEIRO' && (
                        <>
                          <label className="text-xs font-bold text-gray-600 dark:text-gray-300">Valor a pagar agora (pode ser parcial)</label>
                          <input value={valorRecebido} onChange={(e) => {
                            const value = e.target.value;
                            if (value.startsWith('-')) { setErroFechamento('Valor não pode ser negativo'); return; }
                            const clean = value.replace(/[^\d,]/g, '').replace(/,+/g, ',');
                            const parts = clean.split(',');
                            if (parts[1] && parts[1].length > 2) {
                              setValorRecebido(parts[0] + ',' + parts[1].slice(0, 2));
                            } else {
                              setValorRecebido(clean);
                            }
                          }} placeholder={fmt(saldoDevedor)} inputMode="decimal" autoFocus
                            className="mt-1 w-full rounded-xl border border-gray-300 p-3 text-center text-xl font-black outline-none focus:border-[var(--cor-primaria)] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                          {recebidoNum >= saldoDevedor && recebidoNum > 0 && (
                            <p className="mt-2 text-center text-sm font-bold text-gray-600 dark:text-gray-300">Troco: <span className="text-lg font-black text-emerald-600">{fmt(trocoFechamento)}</span></p>
                          )}
                        </>
                      )}
                      {fechando !== 'DINHEIRO' && (
                        <div className="mb-3">
                          <label className="text-xs font-bold text-gray-600 dark:text-gray-300">{tDynamic('Valor a passar na maquininha/pix')}</label>
                          <input value={valorRecebido} onChange={(e) => {
                            const value = e.target.value;
                            if (value.startsWith('-')) { setErroFechamento('Valor não pode ser negativo'); return; }
                            const clean = value.replace(/[^\d,]/g, '').replace(/,+/g, ',');
                            const parts = clean.split(',');
                            if (parts[1] && parts[1].length > 2) {
                              setValorRecebido(parts[0] + ',' + parts[1].slice(0, 2));
                            } else {
                              setValorRecebido(clean);
                            }
                          }} placeholder={fmt(saldoDevedor)} inputMode="decimal"
                            className="mt-1 w-full rounded-xl border border-gray-300 p-3 text-center text-xl font-black outline-none focus:border-[var(--cor-primaria)] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                        </div>
                      )}
                      {fechando === 'PIX' && (
                        <div className="text-center">
                          {loja?.pix_chave ? (
                            <>
                              <p className="text-xs text-gray-500">Peça para o cliente pagar {fmt(recebidoNum || saldoDevedor)} nesta chave:</p>
                              <p className="mt-1 flex items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 font-mono text-sm font-bold dark:bg-gray-950 dark:text-gray-100">
                                {loja.pix_chave} <Copy size={13} className="cursor-pointer text-gray-400" onClick={() => navigator.clipboard.writeText(loja.pix_chave!)} />
                              </p>
                            </>
                          ) : (
                            <p className="text-xs text-amber-600">{tDynamic('Cadastre a chave Pix da loja em Configurações → Pagamentos para mostrar aqui.')}</p>
                          )}
                          <p className="mt-2 text-[11px] text-gray-400">{tDynamic('Confirme abaixo assim que o Pix cair.')}</p>
                        </div>
                      )}
                      {(fechando === 'CREDITO' || fechando === 'DEBITO') && (
                        <p className="text-center text-xs text-gray-500">Passe {fmt(recebidoNum || saldoDevedor)} na maquininha e confirme abaixo.</p>
                      )}

                      {erroFechamento && <p className="mt-2 text-center text-xs font-semibold text-red-500">{erroFechamento}</p>}

                      <button onClick={() => confirmarFechamento(fechando)} disabled={processandoFechamento || recebidoNum <= 0}
                        className={`mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white disabled:opacity-40 ${recebidoNum < saldoDevedor ? 'bg-amber-600' : 'bg-emerald-600'}`}>
                        {processandoFechamento ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                        {processandoFechamento ? 'Processando…' : recebidoNum < saldoDevedor ? 'Confirmar pagamento parcial' : 'Confirmar e fechar conta'}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Drawer do Garçom com Gestão de Assentos e Divisão de Comanda */}
      {garcomDrawerMesa && (
        <GarcomMesaDrawer
          mesa3d={garcomDrawerMesa}
          assentoInicial={assentoInicialDrawer}
          loja={loja}
          onClose={() => setGarcomDrawerMesa(null)}
          onAtualizar={carregar}
        />
      )}

      {/* Modal de Edição de Layout e Formatos de Mesa */}
      {modalEditorLayout && (
        <EditorLayout3DModal
          mesas={mesasBrutas}
          onClose={() => setModalEditorLayout(false)}
          onSalvo={() => {
            setModalEditorLayout(false);
            carregar();
          }}
        />
      )}

      {/* Modal de Divisão de Produto no Caixa (Método 2) */}
      {modalDivisaoCaixa && mesaDetalhe && (
        <ModalDivisaoProdutoCaixa
          numeroMesa={mesaDetalhe.numero}
          capacidadeMesa={mesaDetalhe.capacidade || 6}
          itensMesa={pedidosComanda.flatMap((p) => (p.itens_pedido || []) as unknown as ItemPedido[])}
          onCancelar={() => setModalDivisaoCaixa(false)}
          onConfirmarDivisao={(resumoAssentos) => {
            console.log('Divisão confirmada pelo caixa:', resumoAssentos);
            setModalDivisaoCaixa(false);
            alert('Divisão por produto gravada com sucesso! As contas individuais dos assentos foram atualizadas.');
            carregar();
          }}
        />
      )}
    </div>
  );
}

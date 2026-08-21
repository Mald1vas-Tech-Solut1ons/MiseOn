import { useEffect, useRef, useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin, Navigation, CheckCircle2, Phone, Bike, MessageCircle, X,
  Plus, Trash2, Users, Send, Route, Loader2, AlertCircle, UserPlus, ChevronDown,
  Radio, Printer, DollarSign, TrendingUp, Compass, AlertTriangle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Pedido, Entregador, RotaEntrega, MensagemPedido, fmt } from '../../types';
import type { CtxLoja } from './AdminLayout';
import { imprimir } from '../../lib/print';
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications';
import { ModalCodigoEntrega } from '../../components/pedidos/ModalCodigoEntrega';
import { despacharNoIfood, ehPedidoIfood, entregaEhDaLoja } from '../../lib/ifood';

import { useI18n } from '../../contexts/I18nContext';
const iconeMoto = L.divIcon({
  html: '<div style="font-size:26px;line-height:1">🛵</div>',
  className: '', iconSize: [26, 26], iconAnchor: [13, 13],
});

// Gera ícone colorido por entregador
const iconeMotoCor = (cor: string, nome: string) => L.divIcon({
  html: `<div style="background:${cor};color:#fff;border-radius:50% 50% 50% 0;border:2px solid #fff;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:bold;box-shadow:0 2px 8px rgba(0,0,0,0.4);transform:rotate(-45deg)"><span style="transform:rotate(45deg)">${nome.charAt(0).toUpperCase()}</span></div>`,
  className: '', iconSize: [32, 32], iconAnchor: [16, 32],
});

const CORES_ENTREGADORES = ['#f97316', '#3b82f6', '#8b5cf6', '#ef4444', '#22c55e', '#ec4899', '#14b8a6'];

// ── Mapa de Live Tracking Admin (todos os entregadores em campo) ───────────
interface PosicaoEntregador {
  entregador_id: string;
  entregador_nome: string;
  pedido_id: string;
  pedido_numero: number;
  lat: number;
  lng: number;
  atualizado_em: string;
}

function LiveTrackingAdmin({ lojaId }: { lojaId: string }) {
  const [posicoes, setPosicoes] = useState<PosicaoEntregador[]>([]);
  const [loading, setLoading] = useState(true);
  const defaultCenter: [number, number] = [-23.5505, -46.6333]; // SP como padrão

  const carregarPosicoes = useCallback(async () => {
    // Buscar todos os pedidos EM_ROTA desta loja com localização ativa
    const { data: pedidosRota } = await supabase
      .from('pedidos')
      .select('id, numero, entregador_id, entregadores(nome)')
      .eq('loja_id', lojaId)
      .eq('status', 'EM_ROTA');

    if (!pedidosRota || pedidosRota.length === 0) {
      setPosicoes([]);
      setLoading(false);
      return;
    }

    const pedidoIds = pedidosRota.map((p: any) => p.id);
    const { data: locs } = await supabase
      .from('localizacao_entregador')
      .select('pedido_id, lat, lng, atualizado_em')
      .in('pedido_id', pedidoIds);

    if (!locs) { setLoading(false); return; }

    const merged: PosicaoEntregador[] = locs.map((loc: any) => {
      const ped = pedidosRota.find((p: any) => p.id === loc.pedido_id) as any;
      return {
        entregador_id: ped?.entregador_id ?? loc.pedido_id,
        entregador_nome: ped?.entregadores?.nome ?? 'Entregador',
        pedido_id: loc.pedido_id,
        pedido_numero: ped?.numero ?? 0,
        lat: Number(loc.lat),
        lng: Number(loc.lng),
        atualizado_em: loc.atualizado_em,
      };
    });

    setPosicoes(merged);
    setLoading(false);
  }, [lojaId]);

  useEffect(() => {
    setTimeout(carregarPosicoes, 0);

    // Realtime: atualiza ao receber nova posição de qualquer entregador
    const canal = supabase.channel('admin-live-tracking')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'localizacao_entregador' }, () => {
        carregarPosicoes();
      })
      .subscribe();

    const interval = setInterval(carregarPosicoes, 15000); // fallback polling a cada 15s

    return () => {
      supabase.removeChannel(canal);
      clearInterval(interval);
    };
  }, [carregarPosicoes]);

  const center = posicoes.length > 0
    ? [posicoes[0].lat, posicoes[0].lng] as [number, number]
    : defaultCenter;

  // Agrupa por entregador para cor consistente
  const entregadoresUnicos = [...new Set(posicoes.map(p => p.entregador_id))];
  const corPorEntregador: Record<string, string> = {};
  entregadoresUnicos.forEach((id, i) => {
    corPorEntregador[id] = CORES_ENTREGADORES[i % CORES_ENTREGADORES.length];
  });

  if (posicoes.length === 0 && !loading) return null; // Não renderiza se não há ninguém em campo

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-md mb-6 relative">
      {/* Header do mapa */}
      <div className="absolute top-0 left-0 right-0 z-[400] flex items-center justify-between px-4 py-2.5 bg-gray-900/90 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-green-400 animate-pulse" />
          <span className="text-xs font-bold text-white">Live Tracking — {posicoes.length} entregador{posicoes.length !== 1 ? 'es' : ''} em campo</span>
        </div>
        <div className="flex items-center gap-2">
          {entregadoresUnicos.map((id) => {
            const pos = posicoes.find(p => p.entregador_id === id);
            return (
              <div key={id} className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: corPorEntregador[id] }} />
                <span className="text-[10px] font-medium text-gray-300">{pos?.entregador_nome}</span>
              </div>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="h-[280px] flex items-center justify-center bg-gray-100 dark:bg-gray-900">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : (
        <MapContainer center={center} zoom={13} style={{ height: 280, width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          {posicoes.map((pos) => (
            <Marker
              key={pos.pedido_id}
              position={[pos.lat, pos.lng]}
              icon={iconeMotoCor(corPorEntregador[pos.entregador_id] ?? '#f97316', pos.entregador_nome)}
            >
              <Popup>
                <div className="text-sm font-medium">
                  <p className="font-bold">{pos.entregador_nome}</p>
                  <p className="text-gray-500">Pedido #{pos.pedido_numero}</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Atualizado {new Date(pos.atualizado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      )}
    </div>
  );
}

// ── Aba 1: Fila de Entrega (legado, para entregadores sem app) ─────────────

const MENSAGENS_RAPIDAS = [
  'Estou a caminho! 🛵',
  'Cheguei, pode descer? 📍',
  'Pequeno atraso no trânsito, já estou quase! 🙏',
  'Não estou encontrando o endereço. Pode me ligar?',
];

function FilaDeEntregas({ lojaId }: { lojaId: string }) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [mensagemPara, setMensagemPara] = useState<Pedido | null>(null);
  const [minhaPosicao, setMinhaPosicao] = useState<{ lat: number; lng: number } | null>(null);
  const [validandoEntrega, setValidandoEntrega] = useState<Pedido | null>(null);
  const [erroIfood, setErroIfood] = useState<string | null>(null);
  const watchIds = useRef<Record<string, number>>({});

  const carregar = async () => {
    const { data } = await supabase
      .from('pedidos')
      .select('*, itens_pedido(*), pagamentos(metodo,status,valor_pago)')
      .eq('loja_id', lojaId)
      .eq('tipo_pedido', 'DELIVERY')
      .in('status', ['PRONTO', 'EM_ROTA'])
      .order('criado_em');
    setPedidos((data as Pedido[]) ?? []);
  };


  useEffect(() => {
    setTimeout(carregar, 0);
    const canal = supabase.channel('entregas-loja-fila')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos', filter: `loja_id=eq.${lojaId}` }, () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
      Object.values(watchIds.current).forEach((id) => navigator.geolocation?.clearWatch(id));
    };
  }, [lojaId]);

  const transmitirLocalizacao = (pedidoId: string) => {
    if (!navigator.geolocation || watchIds.current[pedidoId]) return;
    let ultimoEnvio = 0;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const agora = Date.now();
        setMinhaPosicao({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        if (agora - ultimoEnvio < 8000) return;
        ultimoEnvio = agora;
        supabase.from('localizacao_entregador')
          .upsert({ pedido_id: pedidoId, lat: pos.coords.latitude, lng: pos.coords.longitude, atualizado_em: new Date().toISOString() })
          .then(() => { });
      },
      () => { },
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    watchIds.current[pedidoId] = id;
  };

  const pararLocalizacao = (pedidoId: string) => {
    const id = watchIds.current[pedidoId];
    if (id) { navigator.geolocation.clearWatch(id); delete watchIds.current[pedidoId]; }
  };

  const abrirMaps = (p: Pedido) => {
    const d = encodeURIComponent(`${p.endereco_entrega ?? ''} ${p.bairro ?? ''}`);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${d}&travelmode=driving`, '_blank');
  };

  /**
   * Sair para entrega, num pedido do iFood, e um ato com duas pontas: o
   * /dispatch precisa ser aceito la antes de a moto virar "em rota" aqui. Se o
   * iFood recusar e o status ja tivesse mudado, o cliente veria o pedido parado
   * na cozinha com a entrega na rua.
   */
  const iniciarRota = async (p: Pedido) => {
    if (ehPedidoIfood(p) && entregaEhDaLoja(p)) {
      const r = await despacharNoIfood(p.id);
      // `desligado` e recusa sao coisas diferentes. Recusa do iFood para a
      // operacao, senao os dois sistemas divergem. Preferencia desligada e
      // decisao do proprio lojista — a moto sai, e o iFood ele toca pelo
      // Portal do Parceiro. Tratar os dois igual travava a entrega.
      if (!r.ok && !r.desligado) {
        setErroIfood(r.erro ?? 'O iFood recusou o despacho deste pedido.');
        return;
      }
    }
    setErroIfood(null);
    await supabase.from('pedidos').update({ status: 'EM_ROTA' }).eq('id', p.id);
    transmitirLocalizacao(p.id);
    abrirMaps(p);
  };

  /** Entrega de pedido do iFood so encerra depois do codigo do cliente. */
  const concluir = async (p: Pedido) => {
    if (ehPedidoIfood(p) && entregaEhDaLoja(p)) {
      setValidandoEntrega(p);
      return;
    }
    await darBaixa(p);
  };

  const darBaixa = async (p: Pedido) => {
    pararLocalizacao(p.id);
    await supabase.from('pedidos').update({ status: 'FINALIZADO' }).eq('id', p.id);
    await supabase.from('localizacao_entregador').delete().eq('pedido_id', p.id);
  };

  const enviarWhatsapp = (p: Pedido, texto: string) => {
    if (!p.telefone_contato) return;
    window.open(`https://wa.me/${p.telefone_contato.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`, '_blank');
    setMensagemPara(null);
  };

  const emRota = pedidos.filter(p => p.status === 'EM_ROTA');
  const aguardando = pedidos.filter(p => p.status === 'PRONTO');
  // Retoma transmissão ao recarregar
  useEffect(() => { emRota.forEach(p => transmitirLocalizacao(p.id)); }, [emRota.map(p => p.id).join(',')]);

  const CardPedido = ({ p }: { p: Pedido }) => {
    const pgto = p.pagamentos?.[0];
    const cobrar = pgto && pgto.status !== 'PAGO';
    return (
      <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-lg font-bold dark:text-white">#{p.numero}</span>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mt-0.5">{p.identificador_cliente}</p>
          </div>
          <span className="text-sm font-bold text-[var(--cor-primaria)]">{fmt(Number(p.valor_total))}</span>
        </div>

        <p className="flex items-start gap-1.5 text-sm text-gray-500 dark:text-gray-400">
          <MapPin size={14} className="mt-0.5 shrink-0" />
          {p.endereco_entrega}{p.bairro ? ` — ${p.bairro}` : ''}
        </p>

        <ul className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-2 space-y-0.5">
          {p.itens_pedido?.map(i => <li key={i.id}>{i.quantidade}x {i.nome_produto}</li>)}
        </ul>

        {cobrar ? (
          <p className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-2 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
            COBRAR NA ENTREGA: {pgto.metodo}{p.troco_para ? ` · troco p/ ${fmt(Number(p.troco_para))}` : ''}
          </p>
        ) : (
          <p className="text-xs font-semibold text-green-600 dark:text-green-400">✓ Já pago ({pgto?.metodo})</p>
        )}

        <div className="flex gap-2 flex-wrap">
          {p.telefone_contato && (
            <a href={`tel:${p.telefone_contato}`} className="rounded-xl border border-gray-200 dark:border-gray-700 p-2.5 text-gray-500">
              <Phone size={16} />
            </a>
          )}
          {p.telefone_contato && (
            <button onClick={() => setMensagemPara(p)} className="rounded-xl border border-gray-200 dark:border-gray-700 p-2.5 text-green-600">
              <MessageCircle size={16} />
            </button>
          )}
          <button onClick={() => abrirMaps(p)} className="rounded-xl border border-gray-200 dark:border-gray-700 p-2.5 text-blue-700">
            <MapPin size={16} />
          </button>
          <button onClick={() => {
            const d = encodeURIComponent(`${p.endereco_entrega ?? ''} ${p.bairro ?? ''}`);
            window.open(`https://waze.com/ul?q=${d}&navigate=yes`, '_blank');
          }} className="rounded-xl border border-gray-200 dark:border-gray-700 p-2.5 text-blue-500">
            <Navigation size={16} />
          </button>
          {p.status === 'PRONTO' ? (
            <button onClick={() => iniciarRota(p)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-800 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
              <Bike size={15} /> Iniciar Rota
            </button>
          ) : (
            <button onClick={() => concluir(p)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-500 transition-colors">
              <CheckCircle2 size={15} /> Entregue
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <ModalCodigoEntrega
        pedido={validandoEntrega}
        tipo="entrega"
        onFechar={() => setValidandoEntrega(null)}
        onValidado={async () => {
          const alvo = validandoEntrega;
          setValidandoEntrega(null);
          if (alvo) await darBaixa(alvo);
        }}
      />

      {/* Recusa do iFood no despacho: o pedido continua PRONTO nos dois lados,
          e quem esta no balcao precisa saber por que a moto nao saiu. */}
      {erroIfood && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/30 dark:bg-red-900/10">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-500" />
          <p className="flex-1 text-xs font-semibold leading-snug text-red-700 dark:text-red-300">{erroIfood}</p>
          <button onClick={() => setErroIfood(null)} className="text-xs font-bold text-red-500 hover:underline">
            Fechar
          </button>
        </div>
      )}

      {minhaPosicao && (
        <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm h-[250px]">
          <MapContainer center={[minhaPosicao.lat, minhaPosicao.lng]} zoom={14} style={{ height: '100%', width: '100%' }}>
            <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[minhaPosicao.lat, minhaPosicao.lng]} icon={iconeMoto}><Popup>Você está aqui</Popup></Marker>
          </MapContainer>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="mb-3 font-bold flex items-center gap-2 text-gray-800 dark:text-gray-100"><Bike size={18} className="text-[var(--cor-primaria)]" /> Em rota ({emRota.length})</h2>
          <div className="space-y-3">{emRota.map(p => <CardPedido key={p.id} p={p} />)}</div>
        </div>
        <div>
          <h2 className="mb-3 font-bold flex items-center gap-2 text-gray-800 dark:text-gray-100"><CheckCircle2 size={18} className="text-gray-400" /> Prontos ({aguardando.length})</h2>
          <div className="space-y-3">{aguardando.map(p => <CardPedido key={p.id} p={p} />)}</div>
        </div>
      </div>

      {pedidos.length === 0 && (
        <p className="py-16 text-center text-sm text-gray-400">Nenhuma entrega pendente 🎉</p>
      )}

      {mensagemPara && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setMensagemPara(null)}>
          <div className="w-full max-w-lg rounded-t-3xl bg-white dark:bg-gray-900 p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold dark:text-white">Mensagem via WhatsApp</h3>
              <button onClick={() => setMensagemPara(null)}><X size={20} /></button>
            </div>
            <div className="space-y-2">
              {MENSAGENS_RAPIDAS.map(m => (
                <button key={m} onClick={() => enviarWhatsapp(mensagemPara, m)}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 p-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente de Métricas de Rendimentos das Taxas de Entrega ─────────

function PainelRendimentoEntregas({ lojaId }: { lojaId: string }) {
  const { tDynamic } = useI18n();
  const [metricas, setMetricas] = useState({
    totalTaxas: 0,
    qtdEntregas: 0,
    taxaMedia: 0,
    distanciaMediaKm: 0,
    curtasCount: 0, // 0-3 km
    mediasCount: 0, // 3-6 km
    longasCount: 0, // 6+ km
  });
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      const dataInicio = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: pedidos } = await supabase
        .from('pedidos')
        .select('taxa_entrega, distancia_km, status')
        .eq('loja_id', lojaId)
        .eq('tipo_pedido', 'DELIVERY')
        .gte('criado_em', dataInicio)
        .neq('status', 'CANCELADO');

      if (!pedidos || pedidos.length === 0) {
        setCarregando(false);
        return;
      }

      let somaTaxas = 0;
      let somaDistancias = 0;
      let comDistancia = 0;
      let curtas = 0;
      let medias = 0;
      let longas = 0;

      pedidos.forEach((p: any) => {
        const t = Number(p.taxa_entrega || 0);
        somaTaxas += t;
        const d = Number(p.distancia_km);
        if (Number.isFinite(d) && d > 0) {
          somaDistancias += d;
          comDistancia++;
          if (d <= 3) curtas++;
          else if (d <= 6) medias++;
          else longas++;
        }
      });

      const qtd = pedidos.length;
      setMetricas({
        totalTaxas: somaTaxas,
        qtdEntregas: qtd,
        taxaMedia: qtd > 0 ? somaTaxas / qtd : 0,
        distanciaMediaKm: comDistancia > 0 ? somaDistancias / comDistancia : 0,
        curtasCount: curtas,
        mediasCount: medias,
        longasCount: longas,
      });
      setCarregando(false);
    })();
  }, [lojaId]);

  if (carregando) return null;

  return (
    <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm space-y-4 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
        <div>
          <h3 className="font-['Sora'] font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
            <DollarSign className="text-emerald-500" size={20} />
            {tDynamic('Rendimentos & Performance das Taxas (Últimos 30 Dias)')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {tDynamic('Indicadores financeiros reais arrecadados através do cálculo por distância.')}
          </p>
        </div>
        <span className="self-start sm:self-auto rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          {tDynamic('Cálculo Ativo por Km')}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-3.5">
          <span className="text-[11px] font-semibold text-gray-400 block">Total em Taxas</span>
          <p className="font-['Sora'] text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
            {fmt(metricas.totalTaxas)}
          </p>
          <span className="text-[10px] text-gray-400 mt-0.5 block">{metricas.qtdEntregas} entregas no período</span>
        </div>

        <div className="rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 p-3.5">
          <span className="text-[11px] font-semibold text-gray-400 block">{tDynamic('Taxa Média por Pedido')}</span>
          <p className="font-['Sora'] text-lg font-black text-gray-900 dark:text-white mt-0.5">
            {fmt(metricas.taxaMedia)}
          </p>
          <span className="text-[10px] text-emerald-500 font-bold mt-0.5 flex items-center gap-0.5">
            <TrendingUp size={12} /> R$/entrega cobrado
          </span>
        </div>

        <div className="rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 p-3.5">
          <span className="text-[11px] font-semibold text-gray-400 block">{tDynamic('Distância Média')}</span>
          <p className="font-['Sora'] text-lg font-black text-blue-500 mt-0.5">
            {metricas.distanciaMediaKm.toFixed(1)} km
          </p>
          <span className="text-[10px] text-blue-400 font-medium mt-0.5 flex items-center gap-0.5">
            <Compass size={12} /> {tDynamic('Raio médio de rota')}
          </span>
        </div>

        <div className="rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 p-3.5">
          <span className="text-[11px] font-semibold text-gray-400 block">{tDynamic('Distribuição por Raio')}</span>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-gray-700 dark:text-gray-300">
            <span className="text-emerald-500">{metricas.curtasCount}c (0-3km)</span> ·
            <span className="text-blue-500">{metricas.mediasCount}m (3-6km)</span>
          </div>
          <span className="text-[10px] text-gray-400 mt-0.5 block">{metricas.longasCount} entregas acima de 6km</span>
        </div>
      </div>
    </div>
  );
}

// ── Aba 2: Gestão de Entregadores & Despacho de Rotas ─────────

function GestaoEntregadores({ lojaId }: { lojaId: string }) {
  const { tDynamic } = useI18n();
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [rotas, setRotas] = useState<RotaEntrega[]>([]);
  const [pedidosProntos, setPedidosProntos] = useState<Pedido[]>([]);
  const [loadingEntregadores, setLoadingEntregadores] = useState(true);
  const [lojaNome, setLojaNome] = useState('MiseOn');

  // Formulário novo entregador
  const [novoNome, setNovoNome] = useState('');
  const [novoTel, setNovoTel] = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [novoVeiculo, setNovoVeiculo] = useState('moto');
  const [salvandoEntregador, setSalvandoEntregador] = useState(false);
  const [showFormEntregador, setShowFormEntregador] = useState(false);
  const [erroEntregador, setErroEntregador] = useState('');

  // Despacho de rota
  const [entregadorSelecionado, setEntregadorSelecionado] = useState('');
  const [pedidosSelecionados, setPedidosSelecionados] = useState<string[]>([]);
  const [despachando, setDespachando] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);

  // Chat
  const [chatPedido, setChatPedido] = useState<Pedido | null>(null);
  const [mensagens, setMensagens] = useState<MensagemPedido[]>([]);
  const [msgInput, setMsgInput] = useState('');

  const carregar = async () => {
    setLoadingEntregadores(true);
    const [{ data: entList }, { data: rotasList }, { data: pedList }, { data: lojaData }] = await Promise.all([
      supabase.from('entregadores').select('*').eq('loja_id', lojaId).eq('ativo', true).order('nome'),
      supabase.from('rotas_entrega').select('*, entregadores(nome), pedidos(*, itens_pedido(*, itens_pedido_opcoes(*)), pagamentos(metodo, status, valor_pago))').eq('loja_id', lojaId).in('status', ['PENDENTE', 'EM_ANDAMENTO']).order('criado_em', { ascending: false }),
      supabase.from('pedidos').select('*').eq('loja_id', lojaId).eq('tipo_pedido', 'DELIVERY').eq('status', 'PRONTO').is('rota_id', null).order('criado_em'),
      supabase.from('lojas').select('nome').eq('id', lojaId).single()
    ]);
    setEntregadores((entList as Entregador[]) ?? []);
    setRotas((rotasList as RotaEntrega[]) ?? []);
    setPedidosProntos((pedList as Pedido[]) ?? []);
    if (lojaData?.nome) setLojaNome(lojaData.nome);
    setLoadingEntregadores(false);
  };

  useEffect(() => {
    setTimeout(carregar, 0);
    const canal = supabase.channel('entregas-loja-gestao')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos', filter: `loja_id=eq.${lojaId}` }, () => carregar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rotas_entrega', filter: `loja_id=eq.${lojaId}` }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [lojaId]);

  // Chat
  useEffect(() => {
    if (!chatPedido) return;
    const carregarMsgs = async () => {
      const { data } = await supabase.from('mensagens_pedido').select('*').eq('pedido_id', chatPedido.id).order('criado_em', { ascending: true });
      if (data) setMensagens(data as MensagemPedido[]);
    };
    carregarMsgs();
    const canal = supabase.channel(`admin-chat-${chatPedido.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens_pedido', filter: `pedido_id=eq.${chatPedido.id}` }, payload => {
        setMensagens(prev => [...prev, payload.new as MensagemPedido]);
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [chatPedido?.id]);

  const enviarChat = async (texto: string) => {
    if (!texto.trim() || !chatPedido) return;
    setMsgInput('');
    await supabase.from('mensagens_pedido').insert({ pedido_id: chatPedido.id, remetente_tipo: 'LOJA', mensagem: texto.trim() });
  };

  const salvarEntregador = async () => {
    if (!novoNome.trim() || !novoTel.trim()) return setErroEntregador('Nome e telefone são obrigatórios.');
    setSalvandoEntregador(true);
    setErroEntregador('');

    let user_id: string | null = null;
    if (novoEmail.trim()) {
      // Convida via magic link / cria conta
      const { data: inviteData } = await supabase.auth.admin?.inviteUserByEmail?.(novoEmail.trim()) ?? { data: null };
      user_id = inviteData?.user?.id ?? null;
    }

    const { error } = await supabase.from('entregadores').insert({
      loja_id: lojaId,
      nome: novoNome.trim(),
      telefone: novoTel.trim(),
      veiculo: novoVeiculo,
      user_id,
      ativo: true,
    });

    if (error) {
      setErroEntregador('Erro ao salvar. Verifique os dados.');
    } else {
      setNovoNome(''); setNovoTel(''); setNovoEmail(''); setNovoVeiculo('moto');
      setShowFormEntregador(false);
      setFeedback({ tipo: 'sucesso', msg: `Entregador "${novoNome}" cadastrado com sucesso!` });
      setTimeout(() => setFeedback(null), 4000);
      carregar();
    }
    setSalvandoEntregador(false);
  };

  const despacharRota = async () => {
    if (!entregadorSelecionado || pedidosSelecionados.length === 0) return;
    setDespachando(true);

    // Calcular ordem: pedidos selecionados já vêm ordenados pelo usuário (ou podemos ordenar por distância futuramente)
    const { data: rotaData, error: rotaErr } = await supabase.from('rotas_entrega').insert({
      loja_id: lojaId,
      entregador_id: entregadorSelecionado,
      status: 'PENDENTE',
    }).select().single();

    if (rotaErr || !rotaData) {
      setFeedback({ tipo: 'erro', msg: 'Erro ao criar rota. Tente novamente.' });
      setDespachando(false);
      return;
    }

    // Atribuir pedidos à rota com ordem
    const updates = pedidosSelecionados.map((pedId, idx) =>
      supabase.from('pedidos').update({
        rota_id: rotaData.id,
        entregador_id: entregadorSelecionado,
        ordem_entrega: idx + 1,
      }).eq('id', pedId)
    );

    await Promise.all(updates);

    // Gera link para o entregador
    const ent = entregadores.find(e => e.id === entregadorSelecionado);
    const linkApp = `${window.location.origin}/entregador`;
    const msg = `Olá ${ent?.nome}! Você tem ${pedidosSelecionados.length} entrega(s) nova(s) no MiseOn Logistics. Acesse: ${linkApp}`;
    if (ent?.telefone) {
      window.open(`https://wa.me/${ent.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
    }

    setPedidosSelecionados([]);
    setEntregadorSelecionado('');
    setFeedback({ tipo: 'sucesso', msg: `Rota criada e notificação enviada para ${ent?.nome}!` });
    setTimeout(() => setFeedback(null), 5000);
    setDespachando(false);
    carregar();
  };

  const removerEntregador = async (id: string) => {
    await supabase.from('entregadores').update({ ativo: false }).eq('id', id);
    carregar();
  };

  const togglePedido = (id: string) =>
    setPedidosSelecionados(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  if (loadingEntregadores) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={32} className="animate-spin text-gray-400" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Feedback global */}
      {feedback && (
        <div className={`rounded-xl p-4 flex items-center gap-3 text-sm font-semibold transition-all ${feedback.tipo === 'sucesso' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          {feedback.tipo === 'sucesso' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {feedback.msg}
        </div>
      )}

      {/* ── Seção 1: Despachar Nova Rota ─── */}
      <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
        <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
          <Route size={18} className="text-[var(--cor-primaria)]" /> Despachar Nova Rota
        </h2>

        {pedidosProntos.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">{tDynamic('Nenhum pedido PRONTO aguardando rota. Os pedidos aparecem aqui assim que a cozinha finalizar.')}</p>
        ) : (
          <div className="space-y-4">
            {/* Seleção do entregador */}
            <div>
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">1. Selecionar Entregador</label>
              <div className="relative">
                <select
                  value={entregadorSelecionado}
                  onChange={e => setEntregadorSelecionado(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 py-3 px-4 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--cor-primaria)] dark:text-white"
                >
                  <option value="">— Escolha o entregador —</option>
                  {entregadores.map(e => <option key={e.id} value={e.id}>{e.nome} ({e.veiculo ?? 'Moto'})</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Seleção dos pedidos */}
            <div>
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">
                2. Selecionar Pedidos ({pedidosSelecionados.length} selecionado{pedidosSelecionados.length !== 1 ? 's' : ''})
              </label>
              <div className="space-y-2">
                {pedidosProntos.map(p => {
                  const sel = pedidosSelecionados.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => togglePedido(p.id)}
                      className={`cursor-pointer rounded-xl border p-3 transition-all ${sel ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/5' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${sel ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]' : 'border-gray-300 dark:border-gray-600'}`}>
                          {sel && <CheckCircle2 size={12} className="text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm dark:text-white">#{p.numero} · {p.identificador_cliente}</p>
                          <p className="text-xs text-gray-400 truncate">{p.endereco_entrega}{p.bairro ? ` — ${p.bairro}` : ''}</p>
                        </div>
                        <span className="text-xs font-bold text-[var(--cor-primaria)] shrink-0">{fmt(Number(p.valor_total))}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={despacharRota}
              disabled={!entregadorSelecionado || pedidosSelecionados.length === 0 || despachando}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3.5 text-sm font-bold text-white disabled:opacity-40 hover:brightness-110 transition-all shadow-lg shadow-[var(--cor-primaria)]/20"
            >
              {despachando ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              {despachando ? 'Criando rota...' : `Despachar ${pedidosSelecionados.length > 0 ? `(${pedidosSelecionados.length} pedidos)` : ''}`}
            </button>
          </div>
        )}
      </div>

      {/* ── Seção 2: Rotas Ativas ─── */}
      {rotas.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
          <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <Bike size={18} className="text-blue-500" /> Rotas em Campo ({rotas.length})
          </h2>
          <div className="space-y-3">
            {rotas.map(rota => {
              const pedidos = ((rota.pedidos ?? []) as Pedido[]).sort((a, b) => (a.ordem_entrega ?? 0) - (b.ordem_entrega ?? 0));
              const entregues = pedidos.filter(p => p.status === 'FINALIZADO').length;
              const total = pedidos.length;
              const pct = total > 0 ? Math.round((entregues / total) * 100) : 0;
              return (
                <div key={rota.id} className="rounded-xl border border-gray-100 dark:border-gray-800 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${rota.status === 'EM_ANDAMENTO' ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
                      <p className="font-bold text-sm dark:text-white">{(rota.entregador as any)?.nome ?? '—'}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${rota.status === 'EM_ANDAMENTO' ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
                      {rota.status === 'EM_ANDAMENTO' ? 'Em campo' : 'Aguardando'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{entregues}/{total} entregas</span>
                      <span className="font-bold">{pct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                      <div className="bg-[var(--cor-primaria)] h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    {pedidos.map((p, idx) => (
                      <div key={p.id} className="flex items-center gap-2 text-xs">
                        <span className={`font-bold ${p.status === 'FINALIZADO' ? 'text-green-500' : p.status === 'EM_ROTA' ? 'text-blue-400' : 'text-gray-400'}`}>
                          {idx + 1}.
                        </span>
                        <span className={p.status === 'FINALIZADO' ? 'text-gray-400 line-through' : 'text-gray-600 dark:text-gray-300'}>
                          #{p.numero} · {p.bairro ?? p.endereco_entrega}
                        </span>
                        <div className="ml-auto flex items-center gap-1">
                          <button
                            onClick={() => imprimir({ template: 'VIA_ENTREGADOR', lojaNome, pedido: p, itens: p.itens_pedido })}
                            className="p-1.5 text-gray-400 hover:text-[var(--cor-primaria)] hover:bg-[var(--cor-primaria)]/10 rounded-lg transition-all"
                            title="Imprimir Romaneio"
                          >
                            <Printer size={14} />
                          </button>
                          <button
                            onClick={() => setChatPedido(p)}
                            className="p-1.5 text-gray-400 hover:text-[var(--cor-primaria)] hover:bg-[var(--cor-primaria)]/10 rounded-lg transition-all"
                            title="Abrir chat"
                          >
                            <MessageCircle size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Seção 3: Gestão da Equipe ─── */}
      <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users size={18} className="text-[var(--cor-primaria)]" /> {tDynamic('Minha Equipe de Entrega')}
          </h2>
          <button
            onClick={() => setShowFormEntregador(v => !v)}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--cor-primaria)] px-3 py-2 text-xs font-bold text-white hover:brightness-110 transition-all"
          >
            <UserPlus size={14} /> Adicionar
          </button>
        </div>

        {/* Form de Cadastro */}
        {showFormEntregador && (
          <div className="mb-4 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3 bg-gray-50 dark:bg-gray-950">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Novo Entregador</p>
            {erroEntregador && (
              <p className="text-xs text-red-500 font-medium flex items-center gap-1"><AlertCircle size={14} />{erroEntregador}</p>
            )}
            <input
              type="text" placeholder="Nome completo *" value={novoNome} onChange={e => setNovoNome(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-2.5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--cor-primaria)] dark:text-white"
            />
            <input
              type="tel" placeholder="WhatsApp (para receber o link da rota) *" value={novoTel} onChange={e => setNovoTel(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-2.5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--cor-primaria)] dark:text-white"
            />
            <input
              type="email" placeholder="E-mail (para criar login no app — opcional)" value={novoEmail} onChange={e => setNovoEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-2.5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--cor-primaria)] dark:text-white"
            />
            <select
              value={novoVeiculo} onChange={e => setNovoVeiculo(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-2.5 px-3 text-sm focus:outline-none dark:text-white"
            >
              <option value="moto">Moto</option>
              <option value="bicicleta">Bicicleta</option>
              <option value="carro">Carro</option>
              <option value="a_pe">A Pé</option>
            </select>
            <div className="flex gap-2">
              <button onClick={() => setShowFormEntregador(false)} className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancelar</button>
              <button onClick={salvarEntregador} disabled={salvandoEntregador} className="flex-1 rounded-lg bg-[var(--cor-primaria)] py-2.5 text-sm font-bold text-white hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {salvandoEntregador ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Salvar
              </button>
            </div>
          </div>
        )}

        {/* Lista de entregadores */}
        {entregadores.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">{tDynamic('Nenhum entregador cadastrado. Adicione sua equipe!')}</p>
        ) : (
          <div className="space-y-2">
            {entregadores.map(e => (
              <div key={e.id} className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-800 p-3">
                <div className="w-10 h-10 rounded-full bg-[var(--cor-primaria)]/10 flex items-center justify-center text-[var(--cor-primaria)] font-bold text-sm">
                  {e.nome.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm dark:text-white truncate">{e.nome}</p>
                  <p className="text-xs text-gray-400">{e.telefone} · {e.veiculo ?? 'Moto'}</p>
                </div>
                {!e.user_id && (
                  <span className="text-[10px] font-bold bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded-full border border-amber-500/20 whitespace-nowrap">Sem app</span>
                )}
                {e.user_id && (
                  <span className="text-[10px] font-bold bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded-full border border-green-500/20 whitespace-nowrap">App ativo</span>
                )}
                <button onClick={() => removerEntregador(e.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors p-1">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal de Chat ─── */}
      {chatPedido && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
              <div>
                <p className="font-bold dark:text-white">Chat · Pedido #{chatPedido.numero}</p>
                <p className="text-xs text-gray-400">{chatPedido.identificador_cliente}</p>
              </div>
              <button onClick={() => setChatPedido(null)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {mensagens.length === 0 && <p className="text-center text-sm text-gray-400 py-8">Nenhuma mensagem ainda.</p>}
              {mensagens.map(m => {
                const isLoja = m.remetente_tipo === 'LOJA';
                return (
                  <div key={m.id} className={`flex flex-col ${isLoja ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-gray-400 mb-1">{isLoja ? 'Você (Loja)' : m.remetente_tipo === 'ENTREGADOR' ? 'Entregador' : 'Cliente'}</span>
                    <div className={`px-3.5 py-2 rounded-2xl max-w-[85%] text-sm ${isLoja ? 'bg-[var(--cor-primaria)] text-white rounded-tr-none' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none'}`}>
                      {m.mensagem}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 border-t border-gray-100 dark:border-gray-800 shrink-0">
              <div className="flex gap-2">
                <input
                  type="text" value={msgInput} onChange={e => setMsgInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && enviarChat(msgInput)}
                  placeholder="Mensagem para o cliente/entregador..."
                  className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--cor-primaria)] dark:text-white"
                />
                <button onClick={() => enviarChat(msgInput)} className="rounded-xl bg-[var(--cor-primaria)] p-2.5 text-white hover:brightness-110 transition-all">
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente Principal ────────────────────────────────────────

export default function Entregas() {
  const { lojaId, papel } = useOutletContext<CtxLoja>();
  const [aba, setAba] = useState<'fila' | 'gestao'>(papel === 'admin' ? 'gestao' : 'fila');

  useRealtimeNotifications({ lojaId, contexto: 'ENTREGAS' });

  return (
    <div className="p-4 max-w-4xl mx-auto pb-28">

      {/* Live Tracking Admin — aparece sempre que há entregadores em campo */}
      {papel === 'admin' && <LiveTrackingAdmin lojaId={lojaId} />}

      {/* Painel de Rendimentos e Performance de Entregas por Distância */}
      {papel === 'admin' && <PainelRendimentoEntregas lojaId={lojaId} />}

      {/* Tabs */}
      {papel === 'admin' && (
        <div className="flex gap-2 mb-6 p-1 bg-gray-100 dark:bg-gray-900 rounded-2xl">
          <button
            onClick={() => setAba('gestao')}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all ${aba === 'gestao' ? 'bg-white dark:bg-gray-800 text-[var(--cor-primaria)] shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            <Route size={16} /> Despacho & Equipe
          </button>
          <button
            onClick={() => setAba('fila')}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all ${aba === 'fila' ? 'bg-white dark:bg-gray-800 text-[var(--cor-primaria)] shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            <Bike size={16} /> Fila de Saída
          </button>
        </div>
      )}

      {aba === 'fila' ? (
        <FilaDeEntregas lojaId={lojaId} />
      ) : (
        <GestaoEntregadores lojaId={lojaId} />
      )}
    </div>
  );
}

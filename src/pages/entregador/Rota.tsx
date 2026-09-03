import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { Navigation, MapPin, CheckCircle2, MessageCircle, AlertTriangle, ArrowLeft, Send, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { CtxEntregador } from './EntregadorLayout';
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications';
import { ModalCodigoEntrega } from '../../components/pedidos/ModalCodigoEntrega';
import { despacharNoIfood, ehPedidoIfood, entregaEhDaLoja } from '../../lib/ifood';

import { useI18n } from '../../contexts/I18nContext';
export default function EntregadorRota() {
  const { tDynamic } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const ctx = useOutletContext<CtxEntregador>();

  useRealtimeNotifications({ contexto: 'ROTA', entregadorId: ctx.entregadorId });

  const [rota, setRota] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const watchId = useRef<number | null>(null);

  // Modal de Chat
  const [chatAberto, setChatAberto] = useState(false);
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [pedidoChatAtual, setPedidoChatAtual] = useState<any>(null);

  // Pedido esperando a conferência do código de entrega do iFood.
  const [validandoEntrega, setValidandoEntrega] = useState<any>(null);

  const pararGps = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  };

  const carregar = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('rotas_entrega')
      .select('*, pedidos(*)')
      .eq('id', id)
      .eq('entregador_id', ctx.entregadorId)
      .single();

    if (data) {
      data.pedidos = (data.pedidos || []).sort((a: any, b: any) => (a.ordem_entrega || 0) - (b.ordem_entrega || 0));
      setRota(data);
    }
    setLoading(false);
  };

  const sincronizarPedidoAtivo = async (pedidos: any[], pedidoAtivoId?: string | null) => {
    const ativos = (pedidos || []).filter((p: any) => !['FINALIZADO', 'CANCELADO'].includes(p.status));
    const alvo = pedidoAtivoId ?? ativos[0]?.id;
    if (!alvo) return;

    // A parada que vira EM_ROTA e um despacho de verdade: se o pedido veio do
    // iFood com entrega propria, eles precisam receber o /dispatch. A funcao e
    // idempotente (carimba `ifood_despachado_em`), entao reentrar na rota nao
    // manda o despacho duas vezes. Falha aqui nao trava o entregador: o status
    // local segue, e o gatilho de status tenta de novo por conta.
    const pedidoAlvo = ativos.find((p: any) => p.id === alvo);
    if (pedidoAlvo && ehPedidoIfood(pedidoAlvo) && entregaEhDaLoja(pedidoAlvo)) {
      await despacharNoIfood(alvo);
    }

    await Promise.all(
      ativos.map((p: any) =>
        supabase.from('pedidos').update({ status: p.id === alvo ? 'EM_ROTA' : 'PRONTO' }).eq('id', p.id),
      ),
    );
  };

  useEffect(() => {
    setTimeout(carregar, 0);
    return () => pararGps();
  }, [id]);

  const iniciarGpsParaPedido = (pedidoId: string) => {
    if (!('geolocation' in navigator)) return;
    pararGps();
    watchId.current = navigator.geolocation.watchPosition(
      async (pos) => {
        await supabase.from('localizacao_entregador').upsert({
          pedido_id: pedidoId,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          atualizado_em: new Date().toISOString(),
        });
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );
  };

  useEffect(() => {
    if (rota && rota.status === 'EM_ANDAMENTO') {
      const paradaAtual =
        rota.pedidos.find((p: any) => p.status === 'EM_ROTA')
        || rota.pedidos.find((p: any) => !['FINALIZADO', 'CANCELADO'].includes(p.status));
      if (paradaAtual) {
        if (paradaAtual.status !== 'EM_ROTA') sincronizarPedidoAtivo(rota.pedidos, paradaAtual.id).then(() => carregar());
        iniciarGpsParaPedido(paradaAtual.id);
      } else {
        pararGps();
      }
    }
  }, [rota]);

  // CHAT LOGIC
  useEffect(() => {
    if (!chatAberto || !pedidoChatAtual) return;

    const carregarMensagens = async () => {
      const { data } = await supabase.from('mensagens_pedido').select('*').eq('pedido_id', pedidoChatAtual.id).order('criado_em', { ascending: true });
      if (data) setMensagens(data);
    };
    carregarMensagens();

    const canal = supabase.channel(`chat-${pedidoChatAtual.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens_pedido', filter: `pedido_id=eq.${pedidoChatAtual.id}` }, (payload) => {
        setMensagens((prev) => [...prev, payload.new]);
      })
      .subscribe();

    return () => { supabase.removeChannel(canal); };
  }, [chatAberto, pedidoChatAtual]);

  const enviarMensagem = async (texto: string) => {
    if (!texto.trim()) return;
    setMsgInput('');
    await supabase.from('mensagens_pedido').insert({
      pedido_id: pedidoChatAtual.id,
      remetente_tipo: 'ENTREGADOR',
      mensagem: texto.trim()
    });
  };

  const abrirWaze = (endereco: string, bairro: string, cidade: string) => {
    const query = encodeURIComponent(`${endereco} ${bairro || ''} ${cidade || ''}`);
    window.open(`https://waze.com/ul?q=${query}&navigate=yes`, '_blank');
  };

  const abrirMaps = (endereco: string, bairro: string, cidade: string) => {
    const query = encodeURIComponent(`${endereco} ${bairro || ''} ${cidade || ''}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  /**
   * No pedido do iFood com entrega própria, quem encerra o pedido lá é o código
   * que o cliente informa (verifyDeliveryCode). Marcar FINALIZADO aqui sem
   * passar por ele deixaria o pedido concluído no MiseOn e aberto no iFood —
   * e é justamente esse passo que a etapa 5 da homologação verifica.
   */
  const finalizarEntrega = async (pedido: any) => {
    if (ehPedidoIfood(pedido) && entregaEhDaLoja(pedido)) {
      setValidandoEntrega(pedido);
      return;
    }
    await concluirEntrega(pedido);
  };

  const concluirEntrega = async (pedido: any) => {
    await supabase.from('pedidos').update({ status: 'FINALIZADO' }).eq('id', pedido.id);
    await supabase.from('localizacao_entregador').delete().eq('pedido_id', pedido.id);
    const restantes = (rota?.pedidos || []).filter((p: any) => p.id !== pedido.id && !['FINALIZADO', 'CANCELADO'].includes(p.status));
    if (restantes.length > 0) {
      await sincronizarPedidoAtivo(restantes, restantes[0].id);
    }
    pararGps();
    carregar();
  };

  const finalizarRota = async () => {
    await supabase.from('rotas_entrega').update({ status: 'FINALIZADA', finalizado_em: new Date().toISOString() }).eq('id', rota.id);
    navigate('/entregador');
  };

  if (loading) return <div className="p-8 text-center text-gray-500">{tDynamic('Carregando navegação...')}</div>;
  if (!rota) return <div className="p-8 text-center text-red-500">{tDynamic('Rota não encontrada.')}</div>;

  const pedidosNaoEntregues = rota.pedidos.filter((p: any) => p.status !== 'FINALIZADO');
  const paradaAtual = pedidosNaoEntregues[0]; // Sempre a primeira da lista que falta
  const isTodasEntregues = pedidosNaoEntregues.length === 0;

  return (
    <div className="flex flex-col min-h-[calc(100vh-60px)] relative">
      <ModalCodigoEntrega
        pedido={validandoEntrega}
        tipo="entrega"
        onFechar={() => setValidandoEntrega(null)}
        onValidado={async () => {
          const alvo = validandoEntrega;
          setValidandoEntrega(null);
          if (alvo) await concluirEntrega(alvo);
        }}
      />
      <div className="bg-gray-900 border-b border-gray-800 p-4 sticky top-[60px] z-30 shadow-md">
        <button onClick={() => navigate('/entregador')} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4">
          <ArrowLeft size={16} /> {tDynamic('Voltar ao Dashboard')}
        </button>
        
        {isTodasEntregues ? (
          <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-2xl text-center">
            <CheckCircle2 size={48} className="text-green-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-white mb-1">{tDynamic('Rota Concluída!')}</h2>
            <p className="text-gray-400 text-sm mb-6">{tDynamic('Excelente trabalho. Você finalizou todas as entregas.')}</p>
            <button onClick={finalizarRota} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3.5 rounded-xl transition-colors">
              Encerrar Rota e Retornar
            </button>
          </div>
        ) : (
          <div>
            <h2 className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-2">Parada Atual ({rota.pedidos.length - pedidosNaoEntregues.length + 1} de {rota.pedidos.length})</h2>
            <div className="bg-gray-950 p-4 rounded-2xl border border-orange-500/30 relative overflow-hidden shadow-[0_0_15px_rgba(234,88,12,0.1)]">
              <div className="absolute top-0 right-0 p-2 bg-orange-500 text-white text-xs opacity-90 font-bold rounded-bl-xl">NO GPS</div>
              <p className="font-bold text-white text-lg">#{paradaAtual.numero} - {paradaAtual.identificador_cliente}</p>
              
              <div className="flex items-start gap-2 mt-3 text-gray-300">
                <MapPin size={18} className="shrink-0 mt-0.5 text-red-400" />
                <div>
                  <p className="font-bold text-sm">{paradaAtual.endereco_entrega}{paradaAtual.numero_endereco ? `, ${paradaAtual.numero_endereco}` : ''}</p>
                  <p className="text-xs text-gray-400">{paradaAtual.bairro} {paradaAtual.cidade ? `- ${paradaAtual.cidade}` : ''}</p>
                  {paradaAtual.complemento && <p className="text-xs text-amber-400 mt-1 font-medium bg-amber-400/10 inline-block px-1.5 py-0.5 rounded">Comp: {paradaAtual.complemento}</p>}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button onClick={() => abrirWaze(paradaAtual.endereco_entrega, paradaAtual.bairro, paradaAtual.cidade)} className="bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
                  <Navigation size={14} /> Waze
                </button>
                <button onClick={() => abrirMaps(paradaAtual.endereco_entrega, paradaAtual.bairro, paradaAtual.cidade)} className="bg-green-600 hover:bg-green-500 text-white py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
                  <MapPin size={14} /> Google Maps
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => { setPedidoChatAtual(paradaAtual); setChatAberto(true); }} className="bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
                  <MessageCircle size={14} /> {tDynamic('Falar com Cliente')}
                </button>
                <button onClick={() => finalizarEntrega(paradaAtual)} className="bg-orange-600 hover:bg-orange-500 text-white py-2.5 rounded-xl text-xs font-bold transition-colors shadow-[0_0_15px_rgba(234,88,12,0.3)]">
                  Marcar Entregue
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Próximas Paradas */}
      {!isTodasEntregues && pedidosNaoEntregues.length > 1 && (
        <div className="p-4 flex-1">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{tDynamic('Próximas Paradas')}</h2>
          <div className="space-y-3">
            {pedidosNaoEntregues.slice(1).map((p: any) => (
              <div key={p.id} className="bg-gray-900 border border-gray-800 p-3 rounded-xl flex items-center gap-3 opacity-60">
                <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                  <Clock size={14} className="text-gray-500" />
                </div>
                <div>
                  <p className="font-bold text-white text-sm">#{p.numero} - {p.identificador_cliente}</p>
                  <p className="text-xs text-gray-400">{p.bairro}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
             <AlertTriangle size={16} className="text-blue-400 shrink-0" />
             <p className="text-xs text-blue-300 font-medium leading-tight">{tDynamic('Estes clientes só saberão que você está a caminho quando você finalizar a parada atual. Fique tranquilo!')}</p>
          </div>
        </div>
      )}

      {/* MODAL DE CHAT */}
      {chatAberto && pedidoChatAtual && (
        <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
          <div className="flex items-center gap-3 p-4 border-b border-gray-800 bg-gray-900 shrink-0">
            <button onClick={() => setChatAberto(false)} className="p-2 -ml-2 text-gray-400 hover:text-white rounded-full"><ArrowLeft size={20} /></button>
            <div>
              <p className="font-bold text-white">Chat - Pedido #{pedidoChatAtual.numero}</p>
              <p className="text-xs text-gray-400">{pedidoChatAtual.identificador_cliente}</p>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-950">
            {mensagens.map(m => {
              const isEu = m.remetente_tipo === 'ENTREGADOR';
              return (
                <div key={m.id} className={`flex flex-col ${isEu ? 'items-end' : 'items-start'}`}>
                  <span className="text-xs opacity-90 text-gray-500 mb-1">{isEu ? 'Você' : m.remetente_tipo === 'LOJA' ? 'Restaurante' : 'Cliente'}</span>
                  <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${isEu ? 'bg-orange-600 text-white rounded-tr-none' : m.remetente_tipo === 'LOJA' ? 'bg-blue-600/20 border border-blue-500/30 text-blue-100 rounded-tl-none' : 'bg-gray-800 text-gray-200 rounded-tl-none'}`}>
                    {m.mensagem}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="p-3 bg-gray-900 border-t border-gray-800 shrink-0">
            <div className="flex gap-2 mb-3 overflow-x-auto pb-2 hide-scrollbar">
              <button onClick={() => enviarMensagem("Estou chegando!")} className="shrink-0 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-full text-xs font-medium border border-gray-700 whitespace-nowrap">Estou chegando!</button>
              <button onClick={() => enviarMensagem("Estou na portaria.")} className="shrink-0 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-full text-xs font-medium border border-gray-700 whitespace-nowrap">{tDynamic('Estou na portaria')}</button>
              <button onClick={() => enviarMensagem("Não estou encontrando o endereço, pode me ajudar?")} className="shrink-0 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-full text-xs font-medium border border-gray-700 whitespace-nowrap">{tDynamic('Não acho endereço')}</button>
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={msgInput} 
                onChange={e => setMsgInput(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && enviarMensagem(msgInput)}
                placeholder="Digite uma mensagem..." 
                className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500" 
              />
              <button onClick={() => enviarMensagem(msgInput)} className="bg-orange-600 hover:bg-orange-500 text-white p-3 rounded-xl transition-colors">
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

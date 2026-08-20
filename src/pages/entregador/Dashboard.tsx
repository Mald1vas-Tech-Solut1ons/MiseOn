import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { MapPin, Navigation, CheckCircle2, Clock, Map, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { CtxEntregador } from './EntregadorLayout';
import { fmt } from '../../types';

import { useI18n } from '../../contexts/I18nContext';
export default function EntregadorDashboard() {
  const { tDynamic } = useI18n();
  const navigate = useNavigate();
  const ctx = useOutletContext<CtxEntregador>();
  
  const [configRemuneracao, setConfigRemuneracao] = useState<string>('DESLIGADO');
  const [valorRemuneracao, setValorRemuneracao] = useState(0);
  const [taxaMinima, setTaxaMinima] = useState(5);
  const [raioMinimoKm, setRaioMinimoKm] = useState(5);
  const [taxaKmExcedente, setTaxaKmExcedente] = useState(1.2);

  const [metricas, setMetricas] = useState({
    corridasHoje: 0,
    kmHoje: 0, // soma de pedidos.distancia_km das entregas finalizadas hoje
    tempoMedio: 0,
    pedidosEntregues: 0,
    ganhosHoje: 0,
  });

  const [rotaAtiva, setRotaAtiva] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    setLoading(true);
    
    // 1. Busca configurações da loja (para saber a remuneração)
    const { data: config } = await supabase
      .from('configuracoes_custo')
      .select('tipo_remuneracao_entregador, valor_remuneracao_entregador, entregador_taxa_minima, entregador_raio_minimo_km, entregador_taxa_km_excedente')
      .eq('loja_id', ctx.lojaId)
      .maybeSingle();

    const tipoRem = config?.tipo_remuneracao_entregador || 'DESLIGADO';
    const valRem = Number(config?.valor_remuneracao_entregador || 0);
    const taxaMin = Number(config?.entregador_taxa_minima ?? 5);
    const raioMin = Number(config?.entregador_raio_minimo_km ?? 5);
    const taxaKm = Number(config?.entregador_taxa_km_excedente ?? 1.2);
    setConfigRemuneracao(tipoRem);
    setValorRemuneracao(valRem);
    setTaxaMinima(taxaMin);
    setRaioMinimoKm(raioMin);
    setTaxaKmExcedente(taxaKm);

    // 2. Busca Rota Ativa
    const { data: rota } = await supabase
      .from('rotas_entrega')
      .select('*, pedidos(*)')
      .eq('entregador_id', ctx.entregadorId)
      .in('status', ['PENDENTE', 'EM_ANDAMENTO'])
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (rota) {
      // Ordena pedidos da rota
      rota.pedidos = (rota.pedidos || []).sort((a: any, b: any) => (a.ordem_entrega || 0) - (b.ordem_entrega || 0));
      setRotaAtiva(rota);
    } else {
      setRotaAtiva(null);
    }

    // 3. Busca Métricas de Hoje (Rotas FINALIZADAS hoje)
    const hojeStart = new Date();
    hojeStart.setHours(0, 0, 0, 0);
    
    const { data: rotasHoje } = await supabase
      .from('rotas_entrega')
      .select('id, finalizado_em, criado_em, pedidos(id, status, distancia_km)')
      .eq('entregador_id', ctx.entregadorId)
      .eq('status', 'FINALIZADA')
      .gte('finalizado_em', hojeStart.toISOString());

    if (rotasHoje) {
      const corridas = rotasHoje.length;
      let entregas = 0;
      let somaTempos = 0;
      let somaKm = 0;
      let ganhos = 0;

      rotasHoje.forEach(r => {
        const pedidosFinalizados = (r.pedidos || []).filter((p: any) => p.status === 'FINALIZADO');
        entregas += pedidosFinalizados.length;
        if (r.finalizado_em && r.criado_em) {
          somaTempos += (new Date(r.finalizado_em).getTime() - new Date(r.criado_em).getTime()) / 60000; // minutos
        }

        pedidosFinalizados.forEach((p: any) => {
          const distancia = p.distancia_km != null ? Number(p.distancia_km) : null;
          if (distancia != null) somaKm += distancia;

          if (tipoRem === 'POR_ENTREGA') {
            ganhos += valRem;
          } else if (tipoRem === 'POR_KM') {
            // Regra: taxa mínima cobre o raio mínimo; km rodado além disso
            // é cobrado à parte. Sem distância real (loja sem geolocalização
            // configurada), cai na taxa mínima — nunca inventa km.
            ganhos += distancia == null || distancia <= raioMin
              ? taxaMin
              : taxaMin + taxaKm * (distancia - raioMin);
          }
        });
      });

      setMetricas({
        corridasHoje: corridas,
        kmHoje: Math.round(somaKm * 10) / 10,
        tempoMedio: corridas > 0 ? Math.round(somaTempos / corridas) : 0,
        pedidosEntregues: entregas,
        ganhosHoje: Math.round(ganhos * 100) / 100,
      });
    }

    setLoading(false);
  };

  useEffect(() => { setTimeout(carregar, 0); }, [ctx.entregadorId]);

  const iniciarRota = async () => {
    if (!rotaAtiva) return;
    await supabase.from('rotas_entrega').update({ status: 'EM_ANDAMENTO' }).eq('id', rotaAtiva.id);
    const pedidosOrdenados = [...(rotaAtiva.pedidos || [])].sort((a: any, b: any) => (a.ordem_entrega || 0) - (b.ordem_entrega || 0));
    const primeiroAtivo = pedidosOrdenados.find((p: any) => !['FINALIZADO', 'CANCELADO'].includes(p.status));
    const promessas = pedidosOrdenados
      .filter((p: any) => !['FINALIZADO', 'CANCELADO'].includes(p.status))
      .map((p: any) =>
        supabase.from('pedidos').update({ status: p.id === primeiroAtivo?.id ? 'EM_ROTA' : 'PRONTO' }).eq('id', p.id),
      );
    await Promise.all(promessas);
    carregar();
  };

  return (
    <div className="p-4 space-y-6 pb-20">
      {/* Resumo Financeiro (Condicional) */}
      {(configRemuneracao === 'POR_ENTREGA' || configRemuneracao === 'POR_KM') && (
        <div className="rounded-2xl bg-gradient-to-br from-orange-600 to-orange-800 p-5 text-white shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-orange-200 uppercase tracking-wider">Seus Ganhos (Hoje)</h2>
            <TrendingUp size={20} className="text-orange-300" />
          </div>
          <p className="text-4xl font-black">{fmt(metricas.ganhosHoje)}</p>
          <div className="mt-4 flex gap-4 text-xs font-semibold text-orange-200">
            {configRemuneracao === 'POR_KM' ? (
              <p>Taxa: {fmt(taxaMinima)} até {raioMinimoKm}km <span className="font-normal opacity-80">+ {fmt(taxaKmExcedente)}/km excedente</span></p>
            ) : (
              <p>Taxa Ativa: {fmt(valorRemuneracao)} <span className="font-normal opacity-80">/entrega</span></p>
            )}
          </div>
        </div>
      )}

      {/* Métricas Operacionais Obrigatórias */}
      <div>
        <h2 className="mb-3 text-sm font-bold text-gray-400 uppercase tracking-wider">{tDynamic('Desempenho Diário')}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-gray-900 border border-gray-800 p-4">
            <div className="flex items-center gap-2 mb-2 text-blue-400">
              <Map size={16} />
              <p className="text-xs font-bold uppercase">Corridas</p>
            </div>
            <p className="text-2xl font-black text-white">{metricas.corridasHoje}</p>
            <p className="text-[10px] text-gray-500 font-medium">{metricas.pedidosEntregues} pedidos entregues</p>
          </div>
          
          <div className="rounded-2xl bg-gray-900 border border-gray-800 p-4">
            <div className="flex items-center gap-2 mb-2 text-emerald-400">
              <Navigation size={16} />
              <p className="text-xs font-bold uppercase">Distância</p>
            </div>
            <p className="text-2xl font-black text-white">{metricas.kmHoje} <span className="text-sm text-gray-500 font-bold">km</span></p>
            <p className="text-[10px] text-gray-500 font-medium">Percorridos hoje</p>
          </div>
          
          <div className="rounded-2xl bg-gray-900 border border-gray-800 p-4">
            <div className="flex items-center gap-2 mb-2 text-amber-400">
              <Clock size={16} />
              <p className="text-xs font-bold uppercase">Tempo Méd.</p>
            </div>
            <p className="text-2xl font-black text-white">{metricas.tempoMedio} <span className="text-sm text-gray-500 font-bold">min</span></p>
            <p className="text-[10px] text-gray-500 font-medium">{tDynamic('Por corrida concluída')}</p>
          </div>
          
          <div className="rounded-2xl bg-gray-900 border border-gray-800 p-4 flex flex-col items-center justify-center text-center">
             <button onClick={carregar} disabled={loading} className="p-3 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-400 transition-colors">
               <RefreshCw size={24} className={loading ? 'animate-spin text-orange-500' : ''} />
             </button>
             <p className="text-[10px] font-bold text-gray-500 uppercase mt-2">Atualizar App</p>
          </div>
        </div>
      </div>

      {/* Rota Ativa */}
      <div>
        <h2 className="mb-3 text-sm font-bold text-gray-400 uppercase tracking-wider">{tDynamic('Ação Necessária')}</h2>
        
        {loading ? (
          <div className="rounded-2xl bg-gray-900 border border-gray-800 p-8 flex items-center justify-center">
            <RefreshCw size={24} className="animate-spin text-gray-700" />
          </div>
        ) : rotaAtiva ? (
          <div className="rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden shadow-lg">
            <div className={`p-4 ${rotaAtiva.status === 'PENDENTE' ? 'bg-amber-500/10 border-b border-amber-500/20' : 'bg-green-500/10 border-b border-green-500/20'}`}>
              <div className="flex items-center gap-2">
                {rotaAtiva.status === 'PENDENTE' ? <AlertCircle className="text-amber-500" size={20} /> : <Navigation className="text-green-500" size={20} />}
                <p className="font-bold text-white text-lg">
                  {rotaAtiva.status === 'PENDENTE' ? 'Nova Rota Atribuída' : 'Rota em Andamento'}
                </p>
              </div>
              <p className="text-xs text-gray-400 mt-1 font-medium">
                {rotaAtiva.pedidos?.length || 0} pedido(s) nesta corrida
              </p>
            </div>
            
            <div className="p-4 space-y-3">
              {rotaAtiva.pedidos?.map((p: any, idx: number) => (
                <div key={p.id} className="flex gap-3 bg-gray-950 p-3 rounded-xl border border-gray-800">
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-gray-800 text-gray-400 flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </div>
                    {idx < rotaAtiva.pedidos.length - 1 && <div className="w-0.5 h-full bg-gray-800 my-1" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white">Pedido #{p.numero}</p>
                    <p className="text-xs text-gray-400 font-medium mb-1 line-clamp-1">{p.identificador_cliente}</p>
                    <div className="flex items-start gap-1 mt-2 text-gray-300">
                      <MapPin size={14} className="shrink-0 mt-0.5 text-orange-500" />
                      <p className="text-xs leading-tight">
                        {p.endereco_entrega} {p.bairro ? `- ${p.bairro}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-4 pt-0">
              {rotaAtiva.status === 'PENDENTE' ? (
                <button onClick={iniciarRota} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 rounded-xl shadow-[0_0_15px_rgba(234,88,12,0.3)] transition-colors flex items-center justify-center gap-2">
                  <Navigation size={18} /> Iniciar Rota Agora
                </button>
              ) : (
                <button onClick={() => navigate(`/entregador/rota/${rotaAtiva.id}`)} className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-4 rounded-xl border border-gray-700 transition-colors flex items-center justify-center gap-2">
                  <Map size={18} /> {tDynamic('Acessar Navegação e Entregas')}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-gray-900 border border-gray-800 p-8 flex flex-col items-center justify-center text-center">
            <CheckCircle2 size={48} className="text-gray-700 mb-4" />
            <p className="text-lg font-bold text-gray-300">Nenhuma rota ativa</p>
            <p className="text-sm text-gray-500 mt-1 max-w-[200px]">{tDynamic('Aguarde o restaurante despachar novos pedidos para você.')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

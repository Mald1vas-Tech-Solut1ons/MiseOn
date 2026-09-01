import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  ChefHat, Bike, Store, Maximize, Check, Package, UtensilsCrossed, Trophy, Flame,
  SlidersHorizontal, Settings, Plus, Trash2, ArrowLeft, ArrowRight, RotateCcw, X,
  Clock, BarChart2, AlertCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { type Pedido, type EtapaKDS, type StatusPedido } from '../../types';
import { tocarSom } from '../../lib/som';
import { traduzirErro, type ErroTraduzido } from '../../lib/erros';
import { ErroAmigavel } from '../../components/ui/ErroAmigavel';
import type { CtxLoja } from './AdminLayout';
import { useI18n } from '../../contexts/I18nContext';

// Select principal: inclui adicionais (itens_pedido_opcoes) e estação de preparo do produto
// para separar Cozinha vs Revenda Direta sem depender só de palavras-chave.
const SELECT = 'id, numero, senha, status, tipo_pedido, identificador_cliente, origem, mesa_numero, agendado_para, criado_em, estacao_atual, requer_cozinha, etapa_kds_atual, timestamps_etapas_kds, ' +
  'itens_pedido(id, nome_produto, quantidade, observacao, itens_pedido_opcoes(nome_opcao), produtos(estacao_preparo))';

// Fallback: idêntico ao SELECT, apenas sem as colunas KDS (usado quando a migration Kanban ainda não foi aplicada)
const SELECT_FALLBACK = SELECT.replace(' etapa_kds_atual, timestamps_etapas_kds,', '');

const LIMITE_ATENCAO_MIN = 10;
const LIMITE_ATRASO_MIN = 20;

function minutosDesde(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 60000;
}

function corDoTempo(min: number) {
  if (min >= LIMITE_ATRASO_MIN) return { borda: '#EF4444', texto: '#F87171', pulso: true };
  if (min >= LIMITE_ATENCAO_MIN) return { borda: '#F59E0B', texto: '#FBBF24', pulso: false };
  return { borda: 'rgba(255,255,255,0.12)', texto: '#6C7A96', pulso: false };
}

// Merge que preserva atualizações otimistas recentes: se o estado local tem mais
// timestamps de etapa do que o dado vindo do banco (realtime/polling), mantém o local.
function mesclarPreservandoOtimismo(prev: Pedido[], incoming: Pedido[]): Pedido[] {
  return incoming.map((p) => {
    const local = prev.find((l) => l.id === p.id);
    if (!local) return p;
    const localKeys = Object.keys(local.timestamps_etapas_kds || {}).length;
    const incomingKeys = Object.keys(p.timestamps_etapas_kds || {}).length;
    if (localKeys > incomingKeys) return local;
    return p;
  });
}

interface Operador { user_id: string; nome: string | null }
interface Metricas {
  meta_min: number;
  por_dia: { dia: string; pedidos: number; media_total_min: number; pct_dentro_meta: number }[];
  ranking_operadores: { operador_user_id: string | null; operador_nome: string; pedidos: number; media_min: number }[];
  media_hoje_min: number | null;
  pedidos_hoje: number | null;
}

const PALETA_CORES = [
  '#FC5B24', '#0A5CC4', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#E11D48'
];

const ETAPAS_PADRAO: EtapaKDS[] = [
  { id: 'etapa_fila', nome: 'Fila de Entrada', cor: '#FC5B24', ordem: 0 },
  { id: 'etapa_preparo', nome: 'Em Preparo / Montagem', cor: '#0A5CC4', ordem: 1 },
  { id: 'etapa_pronto', nome: 'Expedição / Pronto', cor: '#10B981', ordem: 2 },
];

export default function KDS() {
  const { tDynamic } = useI18n();
  const { lojaId } = useOutletContext<CtxLoja>();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [antecedenciaMin, setAntecedenciaMin] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [operadorAtivo, setOperadorAtivo] = useState<string | null>(() => localStorage.getItem(`miseon_kds_operador_${lojaId}`));
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [celebrar, setCelebrar] = useState(false);
  const [erroAcao, setErroAcao] = useState<ErroTraduzido | null>(null);

  // Etapas de processo configuráveis pelo restaurante
  const [etapas, setEtapas] = useState<EtapaKDS[]>(() => {
    const salvo = localStorage.getItem(`miseon_kds_etapas_${lojaId}`);
    return salvo ? JSON.parse(salvo) : ETAPAS_PADRAO;
  });

  const [modalConfigAberto, setModalConfigAberto] = useState(false);
  const [modalMetricasAberto, setModalMetricasAberto] = useState(false);
  const [novaEtapaNome, setNovaEtapaNome] = useState('');

  // Carregar etapas salvas no banco de dados da loja
  useEffect(() => {
    supabase.from('lojas').select('agendamento_antecedencia_min, kds_etapas').eq('id', lojaId).single()
      .then(({ data }) => {
        setAntecedenciaMin(data?.agendamento_antecedencia_min ?? 30);
        if (data?.kds_etapas && Array.isArray(data.kds_etapas) && data.kds_etapas.length >= 2) {
          setEtapas(data.kds_etapas);
          localStorage.setItem(`miseon_kds_etapas_${lojaId}`, JSON.stringify(data.kds_etapas));
        }
      });
    supabase.from('usuarios_loja').select('user_id, nome').eq('loja_id', lojaId).in('papel', ['admin', 'operador'])
      .then(({ data }) => setOperadores((data as Operador[]) ?? []));
  }, [lojaId]);

  const salvarEtapas = async (novasEtapas: EtapaKDS[]) => {
    setEtapas(novasEtapas);
    localStorage.setItem(`miseon_kds_etapas_${lojaId}`, JSON.stringify(novasEtapas));
    await supabase.from('lojas').update({ kds_etapas: novasEtapas }).eq('id', lojaId);
  };

  const carregarMetricas = async () => {
    const { data, error } = await supabase.rpc('fn_metricas_cozinha', { p_loja_id: lojaId });
    if (error || !data) return;
    const m = data as Metricas;
    setMetricas((anterior) => {
      if (anterior && m.pedidos_hoje && m.media_hoje_min != null
        && m.media_hoje_min <= m.meta_min && !(anterior.media_hoje_min != null && anterior.media_hoje_min <= anterior.meta_min)) {
        setCelebrar(true);
        setTimeout(() => setCelebrar(false), 4000);
      }
      return m;
    });
  };

  const carregar = async () => {
    const cutoff24h = new Date(Date.now() - 24 * 3600e3).toISOString();

    const { data, error } = await supabase
      .from('pedidos')
      .select(SELECT)
      .eq('loja_id', lojaId)
      .in('status', ['ACEITO', 'PREPARANDO', 'PRONTO'])
      .gte('criado_em', cutoff24h)
      .order('criado_em', { ascending: true });

    if (error) {
      console.error('[KDS] Erro com colunas KDS, tentando query básica:', error.message);

      // Fallback sem colunas KDS (caso não existam ainda no banco)
      const { data: fallback, error: errFb } = await supabase
        .from('pedidos')
        .select(SELECT_FALLBACK)
        .eq('loja_id', lojaId)
        .in('status', ['ACEITO', 'PREPARANDO', 'PRONTO'])
        .gte('criado_em', cutoff24h)
        .order('criado_em', { ascending: true });

      if (errFb) {
        console.error('[KDS] Erro no fallback:', errFb.message);
        return;
      }
      const incomingFb = (fallback as unknown as Pedido[]) ?? [];
      setPedidos((prev) => mesclarPreservandoOtimismo(prev, incomingFb));
      return;
    }

    const incoming = (data as unknown as Pedido[]) ?? [];
    setPedidos((prev) => mesclarPreservandoOtimismo(prev, incoming));
  };

  // Carga imediata assim que a página monta — não espera antecedenciaMin
  useEffect(() => {
    carregar();
  }, [lojaId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime + polling a cada minuto
  useEffect(() => {
    const canal = supabase
      .channel(`kds-${lojaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos', filter: `loja_id=eq.${lojaId}` }, (payload) => {
        if (payload.eventType === 'INSERT') tocarSom();
        carregar();
      })
      .subscribe();
    const timer = setInterval(() => { setTick((t) => t + 1); carregar(); carregarMetricas(); }, 60_000);
    return () => { supabase.removeChannel(canal); clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lojaId]);

  // Carregar métricas depois que antecedenciaMin chegar
  useEffect(() => {
    if (antecedenciaMin === null) return;
    carregarMetricas();
  }, [antecedenciaMin]); // eslint-disable-line react-hooks/exhaustive-deps

  const escolherOperador = (userId: string) => {
    const novo = operadorAtivo === userId ? null : userId;
    setOperadorAtivo(novo);
    if (novo) localStorage.setItem(`miseon_kds_operador_${lojaId}`, novo);
    else localStorage.removeItem(`miseon_kds_operador_${lojaId}`);
  };

  const avancar = async (p: Pedido, etapaIndexAtual: number) => {
    const proxIndex = etapaIndexAtual + 1;
    const proximaEtapa = etapas[proxIndex];

    if (!proximaEtapa) return;

    const ehUltimaEtapa = proxIndex >= etapas.length - 1;
    const novoStatus: StatusPedido = ehUltimaEtapa ? 'PRONTO' : 'PREPARANDO';

    // 1. Atualizar o registro no banco em UMA única chamada atômica
    const tsAtuais = p.timestamps_etapas_kds || {};
    const timestampsAtualizados = { ...tsAtuais, [proximaEtapa.id]: new Date().toISOString() };

    const { error: errUpdate } = await supabase
      .from('pedidos')
      .update({
        status: novoStatus,
        estacao_atual: ehUltimaEtapa ? 'BALCAO' : 'COZINHA',
        etapa_kds_atual: proximaEtapa.id,
        timestamps_etapas_kds: timestampsAtualizados,
      })
      .eq('id', p.id);

    if (errUpdate) {
      console.error('Erro ao atualizar pedido:', errUpdate);
      setErroAcao(traduzirErro(errUpdate));
      return;
    }

    // 2. Regras de negócio do avanço (baixa de estoque, notificações).
    //
    // Isto vivia dentro de um try/catch que registrava um console.warn. Não
    // funcionava: o client do Supabase RESOLVE a promise com `{ error }` em vez
    // de rejeitar, então o catch nunca era alcançado e a falha era descartada em
    // 100% dos casos — o pedido avançava na tela e o estoque não baixava, sem
    // nenhum sinal para o operador. O update acima já foi gravado, então aqui a
    // única coisa correta é avisar quem está na frente do KDS.
    const { error: errRegras } = await supabase.rpc('fn_avancar_status_pedido', {
      p_pedido_id: p.id,
      p_novo_status: novoStatus,
    });

    if (errRegras) {
      console.error('Falha nas regras de avanço do pedido:', errRegras);
      const detalhe = traduzirErro(errRegras);
      setErroAcao({
        ...detalhe,
        titulo: 'Pedido avançou, mas o estoque não baixou',
        explicacao:
          'A etapa foi gravada, porém as regras de estoque e notificação não rodaram. ' +
          `Confira a baixa deste pedido antes de fechar o caixa. ${detalhe.explicacao}`,
      });
      tocarSom();
      return;
    }

    setErroAcao(null);
    tocarSom();

    // 3. Atualização otimista imediata na interface
    setPedidos((prev) =>
      prev.map((item) =>
        item.id === p.id
          ? {
              ...item,
              status: novoStatus,
              etapa_kds_atual: proximaEtapa.id,
              timestamps_etapas_kds: timestampsAtualizados,
            }
          : item
      )
    );

    carregar();
    carregarMetricas();
  };

  // Cálculo de Indicadores de Tempo Médio por Etapa (Gargalo de Produção)
  const metricasPorEtapa = useMemo(() => {
    const acumulado: Record<string, { totalMin: number; qtd: number }> = {};
    for (const e of etapas) {
      acumulado[e.id] = { totalMin: 0, qtd: 0 };
    }

    for (const p of pedidos) {
      const tsMap = p.timestamps_etapas_kds || {};
      for (let i = 0; i < etapas.length; i++) {
        const eAtual = etapas[i];
        const eProx = etapas[i + 1];
        const tsInicio = tsMap[eAtual.id] || (i === 0 ? p.enviado_cozinha_em || p.criado_em : null);
        const tsFim = eProx ? tsMap[eProx.id] : null;

        if (tsInicio) {
          const min = (new Date(tsFim || Date.now()).getTime() - new Date(tsInicio).getTime()) / 60000;
          acumulado[eAtual.id].totalMin += Math.max(0, min);
          acumulado[eAtual.id].qtd += 1;
        }
      }
    }

    const resultado: Record<string, number> = {};
    let maiorGargaloId = '';
    let maiorTempo = 0;

    for (const e of etapas) {
      const datos = acumulado[e.id];
      const media = datos && datos.qtd > 0 ? datos.totalMin / datos.qtd : 0;
      resultado[e.id] = Math.round(media * 10) / 10;
      if (media > maiorTempo) {
        maiorTempo = media;
        maiorGargaloId = e.id;
      }
    }

    return { medias: resultado, gargaloId: maiorGargaloId, tempoGargalo: Math.round(maiorTempo * 10) / 10 };
  }, [pedidos, etapas]);

  // Agregado dos itens a produzir
  const agregado = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const p of pedidos.filter(p => p.status !== 'PRONTO')) {
      for (const i of p.itens_pedido ?? []) {
        if ((i as any).produtos?.estacao_preparo === 'DIRETO') continue;
        mapa.set(i.nome_produto, (mapa.get(i.nome_produto) ?? 0) + i.quantidade);
      }
    }
    return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  }, [pedidos]);

  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  };

  const handleAdicionarEtapa = () => {
    if (!novaEtapaNome.trim()) return;
    // Nova etapa é inserida imediatamente ANTES da última coluna (Expedição/Pronto)
    const indiceInsercao = etapas.length - 1;
    const nova: EtapaKDS = {
      id: `etapa_${Date.now()}`,
      nome: novaEtapaNome.trim(),
      cor: PALETA_CORES[etapas.length % PALETA_CORES.length],
      ordem: indiceInsercao,
    };
    const clone = [...etapas];
    clone.splice(indiceInsercao, 0, nova);
    // Reordenar
    clone.forEach((e, idx) => (e.ordem = idx));
    salvarEtapas(clone);
    setNovaEtapaNome('');
  };

  const handleMoverEtapa = (index: number, direcao: 'esquerda' | 'direita') => {
    if (direcao === 'esquerda' && index === 0) return;
    if (direcao === 'direita' && index === etapas.length - 1) return;
    const clone = [...etapas];
    const targetIdx = direcao === 'esquerda' ? index - 1 : index + 1;
    const temp = clone[index];
    clone[index] = clone[targetIdx];
    clone[targetIdx] = temp;
    clone.forEach((e, idx) => (e.ordem = idx));
    salvarEtapas(clone);
  };

  const handleRemoverEtapa = (id: string) => {
    if (etapas.length <= 2) return;
    salvarEtapas(etapas.filter(e => e.id !== id));
  };

  const Card = ({ p, acaoRotulo, etapaIndex, etapaAtualObj }: { p: Pedido; acaoRotulo: string; etapaIndex: number; etapaAtualObj: EtapaKDS }) => {
    const referencia = p.agendado_para && new Date(p.agendado_para) > new Date(p.criado_em) ? p.agendado_para : p.criado_em;

    // Pedido PRONTO: tempo total fica congelado no momento da conclusão (não continua contando)
    const tsConclusao = p.status === 'PRONTO'
      ? p.devolvido_balcao_em || Object.values(p.timestamps_etapas_kds || {}).sort().pop() || null
      : null;
    const minTotal = tsConclusao
      ? (new Date(tsConclusao).getTime() - new Date(referencia).getTime()) / 60000
      : minutosDesde(referencia);
    
    // Tempo na etapa atual
    const tsEtapaInicio = p.timestamps_etapas_kds?.[etapaAtualObj.id] || (etapaIndex === 0 ? p.enviado_cozinha_em || p.criado_em : null);
    const minNaEtapa = tsEtapaInicio ? minutosDesde(tsEtapaInicio) : minTotal;

    const cor = corDoTempo(minTotal);
    const finalizadoCozinha = p.status === 'PRONTO' || etapaIndex >= etapas.length - 1;

    return (
      <button
        onClick={() => !finalizadoCozinha && avancar(p, etapaIndex)}
        disabled={finalizadoCozinha}
        className="w-full rounded-2xl bg-[#0F172A] p-4 text-left transition active:scale-[0.98] disabled:active:scale-100"
        style={{ border: `2px solid ${finalizadoCozinha ? 'rgba(16,185,129,0.4)' : cor.borda}`, animation: cor.pulso && !finalizadoCozinha ? 'pulse 1.6s infinite' : undefined }}
      >
        <div className="flex items-center justify-between">
          {/* A senha e o que a TV canta e o que esta no papel do cliente. Quem
              aperta PRONTO aqui precisa ver o MESMO numero, senao entrega o
              pedido errado ao conferir com quem chegou no balcao. O #numero
              fica de apoio, para o suporte e o fechamento do dia. */}
          <span className="flex items-baseline gap-2">
            <span className="font-['Sora'] text-2xl font-black text-white">
              {p.senha != null ? p.senha : `#${p.numero}`}
            </span>
            {p.senha != null && (
              <span className="font-['JetBrains_Mono'] text-[11px] font-bold text-slate-500">#{p.numero}</span>
            )}
          </span>

          <div className="text-right">
            <span className="font-['JetBrains_Mono'] text-base font-bold block" style={{ color: cor.texto }}>
              {minTotal >= 0 ? `${Math.floor(minTotal)}min` : `em ${Math.ceil(-minTotal)}min`}
            </span>
            {minNaEtapa > 0 && !finalizadoCozinha && (
              <span className="text-[10px] text-slate-400 flex items-center justify-end gap-1 font-mono">
                <Clock size={10} /> {tDynamic('na etapa:')} {Math.floor(minNaEtapa)}m
              </span>
            )}
          </div>
        </div>

        <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-[#6C7A96]">
          {p.tipo_pedido === 'SALAO'
            ? <UtensilsCrossed size={12} />
            : p.origem === 'balcao' ? <Store size={12} /> : p.tipo_pedido === 'DELIVERY' ? <Bike size={12} /> : <Package size={12} />}
          {p.tipo_pedido === 'SALAO' ? `${tDynamic('MESA')} ${p.mesa_numero ?? '—'}` : p.origem === 'balcao' ? tDynamic('BALCÃO') : p.tipo_pedido === 'DELIVERY' ? tDynamic('DELIVERY') : tDynamic('RETIRADA')} · {p.identificador_cliente}
        </div>

        {/* Separação inteligente: Cozinha vs Revenda Direta */}
        {(() => {
          const palavrasRevenda = ['guaraná', 'guarana', 'coca', 'pepsi', 'fanta', 'sprite', 'suco', 'refrigerante', 'lata', 'cerveja', 'água', 'agua', 'long neck', 'red bull', 'h2oh', 'bebida'];
          const isItemDireto = (item: any) => {
            if (item.produtos?.estacao_preparo === 'DIRETO') return true;
            const nomeLower = (item.nome_produto || '').toLowerCase();
            return palavrasRevenda.some((p) => nomeLower.includes(p));
          };

          const cozinha = p.itens_pedido?.filter((i) => !isItemDireto(i)) || [];
          const direto = p.itens_pedido?.filter((i) => isItemDireto(i)) || [];

          return (
            <div className="mt-3 space-y-3">
              {/* 1. ITENS PARA PREPARAR NA COZINHA */}
              {cozinha.length > 0 && (
                <div className="space-y-2">
                  <span className="font-['JetBrains_Mono'] text-[10px] font-extrabold uppercase tracking-wider text-orange-400">
                    🍳 {tDynamic('Preparo Cozinha')} ({cozinha.length}):
                  </span>
                  {cozinha.map((i) => (
                    <div key={i.id} className="pl-1">
                      <p className="text-[15px] font-extrabold leading-tight text-[#EAF1FB]">
                        <span className="text-orange-400">{i.quantidade}×</span> {i.nome_produto}
                      </p>
                      {i.itens_pedido_opcoes?.map((o, x) => (
                        <p key={x} className="pl-4 text-[12px] text-[#8FA0BC]">+ {o.nome_opcao}</p>
                      ))}
                      {i.observacao && (
                        <p className="pl-4 text-[12px] font-bold text-red-400">⚠ {i.observacao.toUpperCase()}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 2. ITENS DE REVENDA DIRETA / BALCÃO */}
              {direto.length > 0 && (
                <div className="mt-2 rounded-xl border border-slate-700/60 bg-slate-800/40 p-2.5 space-y-1.5">
                  <span className="font-['JetBrains_Mono'] text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Store size={12} className="text-blue-400" /> {tDynamic('Revenda / Balcão')} ({direto.length}):
                  </span>
                  {direto.map((i) => (
                    <div key={i.id} className="flex items-center justify-between text-[12px] text-[#EAF1FB]">
                      <span>
                        <strong className="text-blue-400">{i.quantidade}×</strong> {i.nome_produto}
                      </span>
                      <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {tDynamic('DIRETO')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {finalizadoCozinha ? (
          <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 py-2 text-center text-[12px] font-black uppercase tracking-wider text-emerald-400">
            <Check size={13} /> {tDynamic('Devolvido ao balcão')}
          </div>
        ) : (
          <div className="mt-3 rounded-xl bg-white/5 py-2 text-center text-[12px] font-black uppercase tracking-wider text-white/70 hover:bg-white/10 transition">
            {tDynamic('Toque →')} {tDynamic(acaoRotulo)}
          </div>
        )}
      </button>
    );
  };

  const dentroDaMeta = metricas?.media_hoje_min != null && metricas.media_hoje_min <= metricas.meta_min;
  const corMeta = metricas?.media_hoje_min == null ? '#6C7A96' : dentroDaMeta ? '#34D399' : '#F87171';

  // Filtra pedidos para cada coluna de etapa configurada
  const getPedidosPorEtapa = (etapaIndex: number, etapa: EtapaKDS) => {
    // Última coluna: status PRONTO ou etapa gravada
    if (etapaIndex === etapas.length - 1) {
      return pedidos.filter((p) => {
        if (p.status === 'PRONTO' || p.etapa_kds_atual === etapa.id) return true;
        // Configuração mínima (2 colunas): não há coluna intermediária de fallback,
        // então PREPARANDO com etapa removida da configuração aparece aqui para não sumir do quadro.
        if (etapas.length === 2 && p.status === 'PREPARANDO'
          && p.etapa_kds_atual && !etapas.some((e) => e.id === p.etapa_kds_atual)) return true;
        return false;
      });
    }

    // Coluna 0 (Fila de Entrada):
    // - status ACEITO e (sem etapa gravada, ou etapa = esta)
    // - NUNCA inclui pedidos PREPARANDO (eles já avançaram)
    if (etapaIndex === 0) {
      return pedidos.filter((p) => {
        if (p.status === 'PRONTO') return false;
        if (p.status === 'PREPARANDO') return false; // Já avançou
        if (p.status === 'ACEITO') {
          // Sem etapa: vai para fila
          if (!p.etapa_kds_atual || p.etapa_kds_atual === etapa.id || p.etapa_kds_atual === 'etapa_fila') return true;
          // Se tem etapa diferente (avançou otimisticamente), não exibir aqui
          return false;
        }
        return false;
      });
    }

    // Colunas intermediárias: etapa_kds_atual corresponde OU status PREPARANDO sem etapa específica
    return pedidos.filter((p) => {
      if (p.status === 'PRONTO') return false;
      if (p.etapa_kds_atual === etapa.id) return true;
      // Fallback: PREPARANDO sem etapa, ou cuja etapa gravada foi REMOVIDA da configuração
      // (ficaria invisível no quadro), cai na 1ª coluna intermediária (index 1) — posição
      // imediatamente anterior à próxima etapa válida que ele ainda não alcançou.
      if (etapaIndex === 1 && p.status === 'PREPARANDO') {
        if (!p.etapa_kds_atual) return true;
        const etapaAindaExiste = etapas.some((e) => e.id === p.etapa_kds_atual);
        if (!etapaAindaExiste) return true;
      }
      return false;
    });
  };

  const nomeGargalo = etapas.find(e => e.id === metricasPorEtapa.gargaloId)?.nome;

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col bg-[#070C18] px-4 pt-3 lg:h-screen">
      
      {/* ── Cabeçalho KDS Kanban ── */}
      <div data-tour="tour-kds-header" className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <ChefHat size={22} className="text-orange-500" />
          <h2 className="font-['Sora'] text-xl font-black text-white">{tDynamic('KDS Kanban Cozinha')}</h2>
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_8px_#22c55e]" />
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {etapas.length} {tDynamic('Colunas Trello')}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {metricas && (
            <div className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-bold" style={{ color: corMeta }}>
              <Flame size={13} />
              {metricas.media_hoje_min != null ? `${metricas.media_hoje_min}min ${tDynamic('hoje')}` : tDynamic('sem dados hoje')} · {tDynamic('meta')} {metricas.meta_min}min
            </div>
          )}

          {/* Botão de Indicadores & Métricas por Etapa */}
          <button
            onClick={() => setModalMetricasAberto(true)}
            className="flex items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-400 transition hover:bg-blue-500/20"
          >
            <BarChart2 size={14} /> {tDynamic('Indicadores por Etapa')}
          </button>

          {/* Botão de Personalizar Etapas (Trello Config) */}
          <button
            onClick={() => setModalConfigAberto(true)}
            className="flex items-center gap-1.5 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs font-bold text-orange-400 transition hover:bg-orange-500/20"
          >
            <SlidersHorizontal size={14} /> {tDynamic('Personalizar Etapas')}
          </button>

          <button onClick={fullscreen} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-bold text-white/60 transition hover:text-white">
            <Maximize size={13} /> {tDynamic('Tela cheia')}
          </button>
        </div>
      </div>

      {erroAcao && (
        <div className="mb-3 max-w-2xl">
          <ErroAmigavel erro={erroAcao} onFechar={() => setErroAcao(null)} />
        </div>
      )}

      {/* ── Seletor de operador ── */}
      {operadores.length > 0 && (
        <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
          <span className="shrink-0 font-['JetBrains_Mono'] text-[10px] font-bold uppercase tracking-[0.2em] text-[#6C7A96]">Na cozinha:</span>
          {operadores.map((op, idx) => (
            <button key={op.user_id} onClick={() => escolherOperador(op.user_id)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition ${
                operadorAtivo === op.user_id
                  ? 'border-orange-500 bg-orange-500 text-white'
                  : 'border-white/10 bg-white/5 text-white/60 hover:text-white'
              }`}>
              {op.nome || `Operador ${idx + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* ── Resumo de Gargalo & Fila ── */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {agregado.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2 flex-1">
            <span className="shrink-0 font-['JetBrains_Mono'] text-[10px] font-bold uppercase tracking-[0.2em] text-orange-400">Em produção:</span>
            {agregado.map(([nome, qtd]) => (
              <span key={nome} className="shrink-0 rounded-full bg-white/5 px-3 py-1 text-[12px] font-bold text-[#EAF1FB]">
                <span className="text-orange-400">{qtd}×</span> {nome}
              </span>
            ))}
          </div>
        )}

        {nomeGargalo && metricasPorEtapa.tempoGargalo > 0 && (
          <div className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300">
            <AlertCircle size={14} className="text-amber-400 shrink-0" />
            <span>{tDynamic('Gargalo da Cozinha:')} <b>{nomeGargalo}</b> (média {metricasPorEtapa.tempoGargalo} min)</span>
          </div>
        )}
      </div>

      {/* ── QUADRO KANBAN TRELLO (COLUNAS DINÂMICAS) ── */}
      <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
        {etapas.map((etapa, idx) => {
          const listaPedidos = getPedidosPorEtapa(idx, etapa);
          const proximaEtapaNome = etapas[idx + 1]?.nome || 'Concluir';
          const tempoMedioEtapa = metricasPorEtapa.medias[etapa.id] || 0;

          return (
            <div key={etapa.id} className="flex min-w-[290px] max-w-[340px] flex-1 flex-col rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur-md">
              <div className="mb-2.5 flex items-center justify-between px-2 pt-1 border-b border-white/5 pb-2">
                <div className="flex items-center gap-2 truncate">
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ background: etapa.cor }} />
                  <span className="font-['Sora'] text-sm font-extrabold uppercase tracking-wide text-white truncate">
                    {etapa.nome}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {tempoMedioEtapa > 0 && (
                    <span className="text-[10px] font-mono text-slate-400 bg-white/10 px-2 py-0.5 rounded-full">
                      ~{tempoMedioEtapa}m
                    </span>
                  )}
                  <span className="rounded-full px-2.5 py-0.5 font-['Sora'] text-xs font-black text-white" style={{ background: etapa.cor }}>
                    {listaPedidos.length}
                  </span>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {listaPedidos.map((p) => (
                  <Card key={p.id} p={p} acaoRotulo={proximaEtapaNome} etapaIndex={idx} etapaAtualObj={etapa} />
                ))}
                {listaPedidos.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center text-[13px] text-[#3D4A63]">
                    {tDynamic('Sem pedidos nesta etapa 🎉')}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── MODAL: INDICADORES E MÉTRICAS POR ETAPA ── */}
      {modalMetricasAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-white/15 bg-[#0F172A] p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <BarChart2 className="text-blue-400" size={22} />
                <h3 className="font-['Sora'] text-lg font-bold">{tDynamic('Métricas & Indicadores de Tempo por Etapa')}</h3>
              </div>
              <button onClick={() => setModalMetricasAberto(false)} className="rounded-lg p-1 text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-300">
              {tDynamic('Analise o tempo médio em minutos que os pedidos permanecem em cada processo da sua cozinha para identificar gargalos e otimizar a expedição.')}
            </p>

            <div className="mt-6 space-y-3">
              {etapas.map((e) => {
                const tempo = metricasPorEtapa.medias[e.id] || 0;
                const ehGargalo = metricasPorEtapa.gargaloId === e.id && tempo > 0;

                return (
                  <div key={e.id} className={`rounded-2xl border p-4 transition-all ${ehGargalo ? 'border-amber-500/50 bg-amber-500/10' : 'border-white/10 bg-white/5'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ background: e.cor }} />
                        <span className="font-['Sora'] text-sm font-bold text-white">{e.nome}</span>
                        {ehGargalo && (
                          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-black uppercase text-amber-300">
                            Maior Gargalo
                          </span>
                        )}
                      </div>
                      <span className="font-['JetBrains_Mono'] text-base font-bold text-white">
                        {tempo > 0 ? `${tempo} min` : 'Sem dados'}
                      </span>
                    </div>

                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, (tempo / (metricas?.meta_min || 20)) * 100)}%`,
                          background: e.cor,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 border-t border-white/10 pt-4 text-right">
              <button
                onClick={() => setModalMetricasAberto(false)}
                className="rounded-xl bg-blue-600 px-6 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                Fechar Indicadores
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CONFIGURAR ETAPAS TRELLO (CANBAN CONFIG) ── */}
      {modalConfigAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-white/15 bg-[#0F172A] p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Settings className="text-orange-400" size={20} />
                <h3 className="font-['Sora'] text-lg font-bold">Personalizar Etapas KDS (Estilo Trello)</h3>
              </div>
              <button onClick={() => setModalConfigAberto(false)} className="rounded-lg p-1 text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-300">
              {tDynamic('Crie, renomeie e organize as colunas do seu Kanban de cozinha conforme os processos do seu negócio (ex:')} <b>{tDynamic('Entrada, Chapa, Grelha, Montagem, Forno, Expedição')}</b>).
            </p>

            <div className="mt-5 space-y-3 max-h-60 overflow-y-auto pr-1">
              {etapas.map((e, index) => (
                <div key={e.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="color"
                      value={e.cor}
                      onChange={(evt) => {
                        const clone = [...etapas];
                        clone[index].cor = evt.target.value;
                        salvarEtapas(clone);
                      }}
                      className="h-7 w-7 rounded-lg border-0 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={e.nome}
                      onChange={(evt) => {
                        const clone = [...etapas];
                        clone[index].nome = evt.target.value;
                        salvarEtapas(clone);
                      }}
                      className="flex-1 rounded-xl border border-white/10 bg-white/10 px-3 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMoverEtapa(index, 'esquerda')}
                      disabled={index === 0}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <button
                      onClick={() => handleMoverEtapa(index, 'direita')}
                      disabled={index === etapas.length - 1}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
                    >
                      <ArrowRight size={16} />
                    </button>
                    {etapas.length > 2 && (
                      <button
                        onClick={() => handleRemoverEtapa(e.id)}
                        className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/20"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <input
                type="text"
                placeholder="Nome da nova etapa (ex: Chapa, Forno, Embalagem)..."
                value={novaEtapaNome}
                onChange={(e) => setNovaEtapaNome(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdicionarEtapa()}
                className="flex-1 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-orange-500"
              />
              <button
                onClick={handleAdicionarEtapa}
                className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-orange-600"
              >
                <Plus size={16} /> Adicionar Coluna
              </button>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
              <button
                onClick={() => salvarEtapas(ETAPAS_PADRAO)}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white"
              >
                <RotateCcw size={14} /> {tDynamic('Restaurar Padrão')}
              </button>
              <button
                onClick={() => setModalConfigAberto(false)}
                className="rounded-xl bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-6 py-2 text-sm font-bold text-white shadow-lg"
              >
                Salvar & Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {celebrar && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 text-emerald-300 shadow-2xl backdrop-blur-sm">
          <Trophy size={20} /> <span className="font-['Sora'] text-sm font-black">{tDynamic('Dentro da meta hoje! 🔥')}</span>
        </div>
      )}
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  ChefHat, Bike, Store, Maximize, Minimize, Check, Package, UtensilsCrossed, Trophy, Flame,
  SlidersHorizontal, Settings, Plus, Trash2, ArrowLeft, ArrowRight, RotateCcw, X,
  Clock, BarChart2, AlertCircle, ChevronDown, ChevronRight, LayoutGrid,
  Columns, Archive, Sparkles, MoveRight, ZoomIn, ZoomOut, User, Users
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { type Pedido, type EtapaKDS, type StatusPedido } from '../../types';
import { tocarSom } from '../../lib/som';
import { traduzirErro, type ErroTraduzido } from '../../lib/erros';
import { ErroAmigavel } from '../../components/ui/ErroAmigavel';
import type { CtxLoja } from './AdminLayout';
import { useI18n } from '../../contexts/I18nContext';
import { HorizontalScrollContainer } from '../../components/ui';

// Select principal: inclui adicionais (itens_pedido_opcoes) e estação de preparo do produto
const SELECT = 'id, numero, senha, status, tipo_pedido, identificador_cliente, origem, mesa_numero, agendado_para, criado_em, estacao_atual, requer_cozinha, etapa_kds_atual, timestamps_etapas_kds, ' +
  'itens_pedido(id, nome_produto, quantidade, observacao, itens_pedido_opcoes(nome_opcao), produtos(estacao_preparo))';

const SELECT_FALLBACK = SELECT.replace(' etapa_kds_atual, timestamps_etapas_kds,', '');

const LIMITE_ATENCAO_MIN = 10;
const LIMITE_ATRASO_MIN = 20;

function minutosDesde(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 60000;
}

function corDoTempo(min: number) {
  if (min >= LIMITE_ATRASO_MIN) return { borda: '#EF4444', texto: '#F87171', bgBadge: 'rgba(239, 68, 68, 0.15)', pulso: true };
  if (min >= LIMITE_ATENCAO_MIN) return { borda: '#F59E0B', texto: '#FBBF24', bgBadge: 'rgba(245, 158, 11, 0.15)', pulso: false };
  return { borda: 'rgba(255,255,255,0.12)', texto: '#6C7A96', bgBadge: 'rgba(255, 255, 255, 0.05)', pulso: false };
}

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

interface Operador { user_id: string; nome: string }
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

const OPERADORES_INICIAIS: Operador[] = [
  { user_id: 'op_1', nome: 'Operador 1 (Chapa)' },
  { user_id: 'op_2', nome: 'Operador 2 (Montagem)' },
];

export default function KDS() {
  const { tDynamic } = useI18n();
  const { lojaId } = useOutletContext<CtxLoja>();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [antecedenciaMin, setAntecedenciaMin] = useState<number | null>(null);
  const [, setTick] = useState(0);

  // Lista de Operadores totalmente configuráveis e editáveis
  const [operadores, setOperadores] = useState<Operador[]>(() => {
    const salvo = localStorage.getItem(`miseon_kds_operadores_list_${lojaId}`);
    return salvo ? JSON.parse(salvo) : OPERADORES_INICIAIS;
  });

  const [operadorAtivo, setOperadorAtivo] = useState<string | null>(() => localStorage.getItem(`miseon_kds_operador_${lojaId}`));
  const [filtroOperadorVisualizacao, setFiltroOperadorVisualizacao] = useState<string>('TODOS');
  
  // Atribuições individuais de comanda por operador (pedidoId -> operadorUserId)
  const [atribuicoesPedidos, setAtribuicoesPedidos] = useState<Record<string, string>>(() => {
    const salvo = localStorage.getItem(`miseon_kds_atribuicoes_${lojaId}`);
    return salvo ? JSON.parse(salvo) : {};
  });

  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [celebrar, setCelebrar] = useState(false);
  const [erroAcao, setErroAcao] = useState<ErroTraduzido | null>(null);
  const [filtroEstacao, setFiltroEstacao] = useState<'TODAS' | 'COZINHA' | 'BAR'>('TODAS');
  const [emFullscreen, setEmFullscreen] = useState(false);

  // Zoom da Célula/Quadro (Zoom de 70% a 150%)
  const [nivelZoom, setNivelZoom] = useState<number>(() => {
    const salvo = localStorage.getItem(`miseon_kds_zoom_${lojaId}`);
    return salvo ? Number(salvo) : 100;
  });

  // Modos de Layout KDS: ORGANICO, GRADE, KANBAN_TRELLO
  const [modoLayout, setModoLayout] = useState<'ORGANICO' | 'GRADE' | 'KANBAN_TRELLO'>(() => {
    return (localStorage.getItem(`miseon_kds_modo_${lojaId}`) as any) || 'ORGANICO';
  });

  const [colunasRecolhidas, setColunasRecolhidas] = useState<Record<string, boolean>>({});
  const [densidadeCards, setDensidadeCards] = useState<'COMPACTO' | 'PADRAO' | 'DETALHADO'>(() => {
    return (localStorage.getItem(`miseon_kds_densidade_${lojaId}`) as any) || 'PADRAO';
  });

  const [cardsExpandidos, setCardsExpandidos] = useState<Record<string, boolean>>({});
  const [modalConcluidosAberto, setModalConcluidosAberto] = useState(false);
  const [pedidosArquivadosIds, setPedidosArquivadosIds] = useState<Set<string>>(() => new Set());
  const [draggedPedidoId, setDraggedPedidoId] = useState<string | null>(null);
  const [dragOverEtapaId, setDragOverEtapaId] = useState<string | null>(null);

  const [etapas, setEtapas] = useState<EtapaKDS[]>(() => {
    const salvo = localStorage.getItem(`miseon_kds_etapas_${lojaId}`);
    return salvo ? JSON.parse(salvo) : ETAPAS_PADRAO;
  });

  const [modalConfigAberto, setModalConfigAberto] = useState(false);
  const [modalMetricasAberto, setModalMetricasAberto] = useState(false);
  const [novaEtapaNome, setNovaEtapaNome] = useState('');
  const [novoOperadorNome, setNovoOperadorNome] = useState('');

  // Salvar Operadores no banco/localStorage
  const salvarOperadores = (novosOperadores: Operador[]) => {
    setOperadores(novosOperadores);
    localStorage.setItem(`miseon_kds_operadores_list_${lojaId}`, JSON.stringify(novosOperadores));
  };

  const handleAdicionarOperador = () => {
    if (!novoOperadorNome.trim()) return;
    const novo: Operador = {
      user_id: `op_${Date.now()}`,
      nome: novoOperadorNome.trim()
    };
    const lista = [...operadores, novo];
    salvarOperadores(lista);
    setNovoOperadorNome('');
  };

  const handleRemoverOperador = (userId: string) => {
    if (operadores.length <= 1) return;
    const lista = operadores.filter(o => o.user_id !== userId);
    salvarOperadores(lista);
    if (operadorAtivo === userId) setOperadorAtivo(null);
  };

  const atribuirPedidoAOperador = (pedidoId: string, opUserId: string | null) => {
    setAtribuicoesPedidos(prev => {
      const copy = { ...prev };
      if (opUserId) copy[pedidoId] = opUserId;
      else delete copy[pedidoId];
      localStorage.setItem(`miseon_kds_atribuicoes_${lojaId}`, JSON.stringify(copy));
      return copy;
    });
  };

  // Salvar preferências de tela
  const alterarZoom = (delta: number) => {
    setNivelZoom(prev => {
      const novo = Math.min(150, Math.max(70, prev + delta));
      localStorage.setItem(`miseon_kds_zoom_${lojaId}`, String(novo));
      return novo;
    });
  };

  const resetarZoom = () => {
    setNivelZoom(100);
    localStorage.setItem(`miseon_kds_zoom_${lojaId}`, '100');
  };

  const alterarModoLayout = (modo: 'ORGANICO' | 'GRADE' | 'KANBAN_TRELLO') => {
    setModoLayout(modo);
    localStorage.setItem(`miseon_kds_modo_${lojaId}`, modo);
  };

  const alterarDensidadeCards = (densidade: 'COMPACTO' | 'PADRAO' | 'DETALHADO') => {
    setDensidadeCards(densidade);
    localStorage.setItem(`miseon_kds_densidade_${lojaId}`, densidade);
  };

  const toggleColunaRecolhida = (etapaId: string) => {
    setColunasRecolhidas(prev => ({ ...prev, [etapaId]: !prev[etapaId] }));
  };

  const toggleCardExpandido = (pedidoId: string) => {
    setCardsExpandidos(prev => ({ ...prev, [pedidoId]: !prev[pedidoId] }));
  };

  const arquivarPedido = (pedidoId: string) => {
    setPedidosArquivadosIds(prev => new Set([...prev, pedidoId]));
  };

  const desarquivarPedido = (pedidoId: string) => {
    setPedidosArquivadosIds(prev => {
      const copy = new Set(prev);
      copy.delete(pedidoId);
      return copy;
    });
  };

  // Carregar dados de lojas e operadores do banco (se cadastrados)
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
      .then(({ data }) => {
        if (data && data.length > 0) {
          const vindosDoBanco = data.map(u => ({ user_id: u.user_id, nome: u.nome || 'Operador' }));
          setOperadores(prev => {
            // Mescla sem duplicar
            const idsExistentes = new Set(prev.map(p => p.user_id));
            const novos = vindosDoBanco.filter(v => !idsExistentes.has(v.user_id));
            return [...prev, ...novos];
          });
        }
      });
  }, [lojaId]);

  // Alternar Fullscreen Imersivo Total + Browser requestFullscreen
  const toggleFullscreen = useCallback(() => {
    const proxState = !emFullscreen;
    setEmFullscreen(proxState);

    try {
      if (proxState) {
        const docEl = document.documentElement as any;
        if (docEl.requestFullscreen) {
          docEl.requestFullscreen().catch(() => {});
        } else if (docEl.webkitRequestFullscreen) {
          docEl.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        }
      }
    } catch (e) {
      console.warn('Erro ao alternar API fullscreen:', e);
    }
  }, [emFullscreen]);

  // Atalho de Teclado F11 para Tela Cheia Imersiva
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setEmFullscreen(isFs);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

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
      const { data: fallback, error: errFb } = await supabase
        .from('pedidos')
        .select(SELECT_FALLBACK)
        .eq('loja_id', lojaId)
        .in('status', ['ACEITO', 'PREPARANDO', 'PRONTO'])
        .gte('criado_em', cutoff24h)
        .order('criado_em', { ascending: true });

      if (errFb) return;
      const incomingFb = (fallback as unknown as Pedido[]) ?? [];
      setPedidos((prev) => mesclarPreservandoOtimismo(prev, incomingFb));
      return;
    }

    const incoming = (data as unknown as Pedido[]) ?? [];
    setPedidos((prev) => mesclarPreservandoOtimismo(prev, incoming));
  };

  useEffect(() => {
    carregar();
  }, [lojaId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const moverParaEtapa = async (p: Pedido, alvoIndex: number) => {
    const proximaEtapa = etapas[alvoIndex];
    if (!proximaEtapa) return;

    const ehUltimaEtapa = alvoIndex >= etapas.length - 1;
    const novoStatus: StatusPedido = ehUltimaEtapa ? 'PRONTO' : 'PREPARANDO';

    const tsAtuais = p.timestamps_etapas_kds || {};
    const timestampsAtualizados = {
      ...tsAtuais,
      [proximaEtapa.id]: new Date().toISOString(),
      ...(operadorAtivo ? { [`operador_${proximaEtapa.id}`]: operadorAtivo } : {})
    };

    // Auto-atribuir ao operador ativo se o pedido ainda não tiver responsável
    if (operadorAtivo && !atribuicoesPedidos[p.id]) {
      atribuirPedidoAOperador(p.id, operadorAtivo);
    }

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
      setErroAcao(traduzirErro(errUpdate));
      return;
    }

    const { error: errRegras } = await supabase.rpc('fn_avancar_status_pedido', {
      p_pedido_id: p.id,
      p_novo_status: novoStatus,
      ...(operadorAtivo ? { p_operador_user_id: operadorAtivo } : {}),
    });

    if (errRegras) {
      const detalhe = traduzirErro(errRegras);
      setErroAcao({
        ...detalhe,
        titulo: tDynamic('Pedido avançou, mas o estoque não baixou'),
        explicacao: tDynamic('A etapa foi gravada, porém as regras de estoque e notificação não rodaram. ') + `${detalhe.explicacao}`,
      });
      tocarSom();
      return;
    }

    setErroAcao(null);
    tocarSom();

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

  const avancar = async (p: Pedido, etapaIndexAtual: number) => {
    await moverParaEtapa(p, etapaIndexAtual + 1);
  };

  const handleDragStart = (e: React.DragEvent, p: Pedido) => {
    e.dataTransfer.setData('text/plain', p.id);
    setDraggedPedidoId(p.id);
  };

  const handleDragOver = (e: React.DragEvent, etapaId: string) => {
    e.preventDefault();
    if (dragOverEtapaId !== etapaId) setDragOverEtapaId(etapaId);
  };

  const handleDragLeave = () => {
    setDragOverEtapaId(null);
  };

  const handleDrop = async (e: React.DragEvent, alvoIndex: number, _etapaAlvo: EtapaKDS) => {
    e.preventDefault();
    setDragOverEtapaId(null);
    const pedidoId = e.dataTransfer.getData('text/plain') || draggedPedidoId;
    setDraggedPedidoId(null);

    if (!pedidoId) return;
    const p = pedidos.find(item => item.id === pedidoId);
    if (!p) return;

    await moverParaEtapa(p, alvoIndex);
  };

  const metricasPorEtapa = useMemo(() => {
    const acumulado: Record<string, { totalMin: number; qtd: number }> = {};
    for (const e of etapas) acumulado[e.id] = { totalMin: 0, qtd: 0 };

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

  const agregado = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const p of pedidos.filter(p => p.status !== 'PRONTO' && !pedidosArquivadosIds.has(p.id))) {
      for (const i of p.itens_pedido ?? []) {
        if ((i as any).produtos?.estacao_preparo === 'DIRETO') continue;
        mapa.set(i.nome_produto, (mapa.get(i.nome_produto) ?? 0) + i.quantidade);
      }
    }
    return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  }, [pedidos, pedidosArquivadosIds]);

  const handleAdicionarEtapa = () => {
    if (!novaEtapaNome.trim()) return;
    const indiceInsercao = etapas.length - 1;
    const nova: EtapaKDS = {
      id: `etapa_${Date.now()}`,
      nome: novaEtapaNome.trim(),
      cor: PALETA_CORES[etapas.length % PALETA_CORES.length],
      ordem: indiceInsercao,
    };
    const clone = [...etapas];
    clone.splice(indiceInsercao, 0, nova);
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

  // Filtra pedidos para cada coluna de etapa configurada, incluindo o filtro por Operador
  const getPedidosPorEtapa = (etapaIndex: number, etapa: EtapaKDS) => {
    const filtrarPorOperador = (p: Pedido) => {
      if (filtroOperadorVisualizacao === 'TODOS') return true;
      if (filtroOperadorVisualizacao === 'MEUS') return atribuicoesPedidos[p.id] === operadorAtivo;
      return atribuicoesPedidos[p.id] === filtroOperadorVisualizacao;
    };

    if (etapaIndex === etapas.length - 1) {
      return pedidos.filter((p) => {
        if (!filtrarPorOperador(p)) return false;
        if (pedidosArquivadosIds.has(p.id)) return false;
        if (p.status === 'PRONTO' || p.etapa_kds_atual === etapa.id) return true;
        if (etapas.length === 2 && p.status === 'PREPARANDO'
          && p.etapa_kds_atual && !etapas.some((e) => e.id === p.etapa_kds_atual)) return true;
        return false;
      });
    }

    if (etapaIndex === 0) {
      return pedidos.filter((p) => {
        if (!filtrarPorOperador(p)) return false;
        if (pedidosArquivadosIds.has(p.id)) return false;
        if (p.status === 'PRONTO') return false;
        if (p.status === 'PREPARANDO') return false;
        if (p.status === 'ACEITO') {
          if (!p.etapa_kds_atual || p.etapa_kds_atual === etapa.id || p.etapa_kds_atual === 'etapa_fila') return true;
          return false;
        }
        return false;
      });
    }

    return pedidos.filter((p) => {
      if (!filtrarPorOperador(p)) return false;
      if (pedidosArquivadosIds.has(p.id)) return false;
      if (p.status === 'PRONTO') return false;
      if (p.etapa_kds_atual === etapa.id) return true;
      if (etapaIndex === 1 && p.status === 'PREPARANDO') {
        if (!p.etapa_kds_atual) return true;
        const etapaAindaExiste = etapas.some((e) => e.id === p.etapa_kds_atual);
        if (!etapaAindaExiste) return true;
      }
      return false;
    });
  };

  const pedidosArquivadosList = useMemo(() => {
    return pedidos.filter(p => pedidosArquivadosIds.has(p.id) || (p.status === 'PRONTO' && !pedidosArquivadosIds.has(p.id)));
  }, [pedidos, pedidosArquivadosIds]);

  // Card do Pedido com Seletor de Atribuição de Operador
  const Card = ({ p, acaoRotulo, etapaIndex, etapaAtualObj }: { p: Pedido; acaoRotulo: string; etapaIndex: number; etapaAtualObj: EtapaKDS }) => {
    const referencia = p.agendado_para && new Date(p.agendado_para) > new Date(p.criado_em) ? p.agendado_para : p.criado_em;

    const tsConclusao = p.status === 'PRONTO'
      ? p.devolvido_balcao_em || Object.values(p.timestamps_etapas_kds || {}).sort().pop() || null
      : null;
    const minTotal = tsConclusao
      ? (new Date(tsConclusao).getTime() - new Date(referencia).getTime()) / 60000
      : minutosDesde(referencia);

    const tsEtapaInicio = p.timestamps_etapas_kds?.[etapaAtualObj.id] || (etapaIndex === 0 ? p.enviado_cozinha_em || p.criado_em : null);
    const minNaEtapa = tsEtapaInicio ? minutosDesde(tsEtapaInicio) : minTotal;

    const cor = corDoTempo(minTotal);
    const finalizadoCozinha = p.status === 'PRONTO' || etapaIndex >= etapas.length - 1;
    const expandido = cardsExpandidos[p.id] || densidadeCards === 'DETALHADO';
    const ehCompacto = densidadeCards === 'COMPACTO' && !expandido;

    const opAtribuidoId = atribuicoesPedidos[p.id];
    const opAtribuidoNome = operadores.find(o => o.user_id === opAtribuidoId)?.nome;

    return (
      <div
        draggable={!finalizadoCozinha}
        onDragStart={(e) => handleDragStart(e, p)}
        className={`group relative w-full rounded-2xl bg-[#0F172A]/90 p-3.5 text-left backdrop-blur-md transition-all duration-300 hover:shadow-xl hover:shadow-black/40 ${
          draggedPedidoId === p.id ? 'opacity-40 scale-95 border-dashed border-orange-500' : ''
        }`}
        style={{
          border: `2px solid ${finalizadoCozinha ? 'rgba(16,185,129,0.4)' : cor.borda}`,
          animation: cor.pulso && !finalizadoCozinha ? 'pulse 1.6s infinite' : undefined,
          boxShadow: cor.pulso && !finalizadoCozinha ? `0 0 15px ${cor.borda}40` : undefined,
        }}
      >
        <div onClick={() => toggleCardExpandido(p.id)} className="cursor-pointer select-none">
          <div className="flex items-center justify-between">
            <span className="flex items-baseline gap-2">
              <span className="font-['Sora'] text-2xl font-black text-white group-hover:text-orange-400 transition">
                {p.senha != null ? p.senha : `#${p.numero}`}
              </span>
              {p.senha != null && (
                <span className="font-['JetBrains_Mono'] text-xs opacity-90 font-bold text-slate-400">#{p.numero}</span>
              )}
            </span>

            <div className="flex items-center gap-2">
              <div
                className="px-2.5 py-1 rounded-xl font-['JetBrains_Mono'] text-xs font-bold flex items-center gap-1 shadow-sm"
                style={{ color: cor.texto, background: cor.bgBadge, border: `1px solid ${cor.borda}` }}
              >
                <Clock size={12} />
                {minTotal >= 0 ? `${Math.floor(minTotal)}m` : `em ${Math.ceil(-minTotal)}m`}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); toggleCardExpandido(p.id); }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                {expandido ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            </div>
          </div>

          <div className="mt-1 flex items-center justify-between text-xs font-semibold text-[#8FA0BC]">
            <div className="flex items-center gap-1.5 truncate">
              {p.tipo_pedido === 'SALAO'
                ? <UtensilsCrossed size={12} className="text-orange-400" />
                : p.origem === 'balcao' ? <Store size={12} className="text-blue-400" /> : p.tipo_pedido === 'DELIVERY' ? <Bike size={12} className="text-emerald-400" /> : <Package size={12} className="text-purple-400" />}
              <span className="truncate">
                {p.tipo_pedido === 'SALAO' ? `${tDynamic('MESA')} ${p.mesa_numero ?? '—'}` : p.origem === 'balcao' ? tDynamic('BALCÃO') : p.tipo_pedido === 'DELIVERY' ? tDynamic('DELIVERY') : tDynamic('RETIRADA')} · {p.identificador_cliente}
              </span>
            </div>

            {minNaEtapa > 0 && !finalizadoCozinha && (
              <span className="text-[11px] opacity-80 text-slate-400 font-mono shrink-0">
                {tDynamic('na etapa:')} {Math.floor(minNaEtapa)}m
              </span>
            )}
          </div>

          {/* SELETOR DE ATRIBUIÇÃO DE OPERADOR NO CARD */}
          <div onClick={(e) => e.stopPropagation()} className="mt-2 flex items-center justify-between border-t border-white/5 pt-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-300">
              <User size={13} className={opAtribuidoId ? 'text-orange-400' : 'text-slate-500'} />
              <select
                title={opAtribuidoNome ? `${tDynamic('Atribuído a:')} ${opAtribuidoNome}` : tDynamic('Sem operador atribuído')}
                value={opAtribuidoId || ''}
                onChange={(evt) => atribuirPedidoAOperador(p.id, evt.target.value || null)}
                className="bg-white/5 text-xs font-bold text-slate-200 rounded-lg px-2 py-0.5 border border-white/10 focus:outline-none focus:border-orange-500"
              >
                <option value="" className="bg-[#0F172A] text-slate-400">Sem operador atribuído</option>
                {operadores.map(op => (
                  <option key={op.user_id} value={op.user_id} className="bg-[#0F172A] text-white">
                    {op.nome}
                  </option>
                ))}
              </select>
            </div>

            {operadorAtivo && opAtribuidoId !== operadorAtivo && !finalizadoCozinha && (
              <button
                onClick={() => atribuirPedidoAOperador(p.id, operadorAtivo)}
                className="text-[10px] font-bold uppercase tracking-wider text-orange-400 hover:text-orange-300 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-md transition"
              >
                Assumir comanda
              </button>
            )}
          </div>
        </div>

        {ehCompacto && (
          <div onClick={() => toggleCardExpandido(p.id)} className="mt-2 flex flex-wrap items-center gap-1 cursor-pointer">
            <span className="rounded-md bg-orange-500/20 px-2 py-0.5 text-xs font-bold text-orange-300 border border-orange-500/30">
              {p.itens_pedido?.reduce((acc, i) => acc + i.quantidade, 0) ?? 0} {tDynamic('itens')}
            </span>
            <span className="text-xs text-slate-300 font-medium truncate max-w-[200px]">
              {p.itens_pedido?.map(i => `${i.quantidade}x ${i.nome_produto}`).join(', ')}
            </span>
          </div>
        )}

        {!ehCompacto && (() => {
          const palavrasBar = ['drink', 'coquetel', 'caipirinha', 'chopp', 'gin', 'vodka', 'whisky', 'vinho', 'mojito', 'margarita', 'caipiroska', 'batida'];
          const palavrasRevenda = ['guaraná', 'guarana', 'coca', 'pepsi', 'fanta', 'sprite', 'suco', 'refrigerante', 'lata', 'cerveja', 'água', 'agua', 'long neck', 'red bull', 'h2oh'];

          const isItemBar = (item: any) => {
            if (item.produtos?.estacao_preparo === 'BAR') return true;
            const nomeLower = (item.nome_produto || '').toLowerCase();
            return palavrasBar.some((p) => nomeLower.includes(p));
          };

          const isItemDireto = (item: any) => {
            if (item.produtos?.estacao_preparo === 'DIRETO') return true;
            if (isItemBar(item)) return false;
            const nomeLower = (item.nome_produto || '').toLowerCase();
            return palavrasRevenda.some((p) => nomeLower.includes(p));
          };

          const bar = p.itens_pedido?.filter((i) => isItemBar(i)) || [];
          const cozinha = p.itens_pedido?.filter((i) => !isItemBar(i) && !isItemDireto(i)) || [];
          const direto = p.itens_pedido?.filter((i) => isItemDireto(i)) || [];

          if (filtroEstacao === 'COZINHA' && cozinha.length === 0) return null;
          if (filtroEstacao === 'BAR' && bar.length === 0) return null;

          return (
            <div className="mt-3 space-y-2.5 border-t border-white/5 pt-2.5">
              {(filtroEstacao === 'TODAS' || filtroEstacao === 'COZINHA') && cozinha.length > 0 && (
                <div className="space-y-1.5">
                  <span className="font-['JetBrains_Mono'] text-[11px] opacity-90 font-extrabold uppercase tracking-wider text-orange-400 flex items-center gap-1">
                    🍳 {tDynamic('Preparo Cozinha')} ({cozinha.length})
                  </span>
                  {cozinha.map((i) => (
                    <div key={i.id} className="pl-1">
                      <p className="text-[14px] font-extrabold leading-tight text-[#EAF1FB]">
                        <span className="text-orange-400 font-mono">{i.quantidade}×</span> {i.nome_produto}
                      </p>
                      {i.itens_pedido_opcoes?.map((o, x) => (
                        <p key={x} className="pl-3.5 text-[12px] text-[#8FA0BC]">+ {o.nome_opcao}</p>
                      ))}
                      {i.observacao && (
                        <p className="pl-3.5 text-[12px] font-bold text-red-400 bg-red-500/10 rounded px-1.5 py-0.5 mt-0.5 border border-red-500/20 inline-block">
                          ⚠ {i.observacao.toUpperCase()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {(filtroEstacao === 'TODAS' || filtroEstacao === 'BAR') && bar.length > 0 && (
                <div className="space-y-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 p-2">
                  <span className="font-['JetBrains_Mono'] text-[11px] opacity-90 font-extrabold uppercase tracking-wider text-purple-400 flex items-center gap-1">
                    🍹 {tDynamic('Bar & Drinks')} ({bar.length})
                  </span>
                  {bar.map((i) => (
                    <div key={i.id} className="pl-1">
                      <p className="text-[13px] font-extrabold leading-tight text-purple-200">
                        <span className="text-purple-400 font-mono">{i.quantidade}×</span> {i.nome_produto}
                      </p>
                      {i.itens_pedido_opcoes?.map((o, x) => (
                        <p key={x} className="pl-3.5 text-[11px] text-purple-300">+ {o.nome_opcao}</p>
                      ))}
                      {i.observacao && (
                        <p className="pl-3.5 text-[11px] font-bold text-amber-300">⚠ {i.observacao.toUpperCase()}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {filtroEstacao === 'TODAS' && direto.length > 0 && (
                <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-2 space-y-1">
                  <span className="font-['JetBrains_Mono'] text-[11px] opacity-90 font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Store size={11} className="text-blue-400" /> {tDynamic('Revenda / Balcão')} ({direto.length})
                  </span>
                  {direto.map((i) => (
                    <div key={i.id} className="flex items-center justify-between text-[12px] text-[#EAF1FB]">
                      <span>
                        <strong className="text-blue-400 font-mono">{i.quantidade}×</strong> {i.nome_produto}
                      </span>
                      <span className="text-[10px] opacity-80 font-mono px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {tDynamic('DIRETO')}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {expandido && (
                <div className="mt-3 rounded-xl bg-black/40 p-2.5 text-xs text-slate-300 space-y-1 border border-white/5 font-mono">
                  <p className="flex justify-between">
                    <span>{tDynamic('Criado em:')}</span>
                    <span className="text-white font-bold">{new Date(p.criado_em).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </p>
                  {p.timestamps_etapas_kds && Object.entries(p.timestamps_etapas_kds).map(([etId, ts]) => {
                    const nomeEtapa = etapas.find(e => e.id === etId)?.nome || etId;
                    return (
                      <p key={etId} className="flex justify-between text-slate-400">
                        <span>{nomeEtapa}:</span>
                        <span>{new Date(ts as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </p>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        <div className="mt-3 flex items-center gap-2">
          {!finalizadoCozinha ? (
            <button
              onClick={() => avancar(p, etapaIndex)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 py-2.5 px-3 text-xs font-black uppercase tracking-wider text-slate-950 shadow-md shadow-orange-500/20 transition active:scale-[0.97] hover:brightness-110"
            >
              <span>{tDynamic(acaoRotulo)}</span>
              <MoveRight size={14} className="stroke-[3]" />
            </button>
          ) : (
            <div className="flex-1 flex items-center justify-between gap-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 py-2 px-3 text-xs font-bold text-emerald-400">
              <span className="flex items-center gap-1">
                <Check size={14} /> {tDynamic('Concluído')}
              </span>
              <button
                onClick={() => arquivarPedido(p.id)}
                className="px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-[11px] font-extrabold uppercase transition"
              >
                {tDynamic('Tirar do Fluxo')}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const dentroDaMeta = metricas?.media_hoje_min != null && metricas.media_hoje_min <= metricas.meta_min;
  const corMeta = metricas?.media_hoje_min == null ? '#6C7A96' : dentroDaMeta ? '#34D399' : '#F87171';
  const nomeGargalo = etapas.find(e => e.id === metricasPorEtapa.gargaloId)?.nome;

  return (
    <div className={`flex flex-col bg-[#070C18] transition-all duration-300 ${
      emFullscreen
        ? 'fixed inset-0 z-[9999] h-screen w-screen p-3 lg:p-4 overflow-hidden'
        : 'min-h-screen px-3 pt-3 lg:px-4'
    }`}>
      
      {/* ── Cabeçalho KDS Kanban ── */}
      <div data-tour="tour-kds-header" className="mb-3 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-slate-950 shadow-lg shadow-orange-500/30">
            <ChefHat size={22} className="stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-['Sora'] text-xl font-black tracking-tight text-white">{tDynamic('KDS Kanban Cozinha')}</h2>
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_10px_#22c55e]" />
            </div>
            <p className="text-xs text-slate-400 font-medium">{etapas.length} {tDynamic('etapas configuradas')} · {pedidos.length} {tDynamic('pedidos ativos')}</p>
          </div>
        </div>

        {/* SELETORES DE MODO DE LAYOUT, DENSIDADE E ZOOM DA CÉLULA */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro de Visão por Operador */}
          <div className="flex items-center gap-1 rounded-xl bg-black/40 border border-white/10 p-1">
            <span className="text-[11px] text-slate-400 px-2 font-bold flex items-center gap-1">
              <Users size={12} /> Fluxo:
            </span>
            <select
              value={filtroOperadorVisualizacao}
              onChange={(e) => setFiltroOperadorVisualizacao(e.target.value)}
              className="bg-white/10 text-xs font-bold text-white rounded-lg px-2 py-1 border border-white/10 focus:outline-none focus:border-orange-500"
            >
              <option value="TODOS" className="bg-[#0F172A]">Todos os Operadores</option>
              {operadorAtivo && <option value="MEUS" className="bg-[#0F172A] text-orange-400">Apenas Meus Pedidos</option>}
              {operadores.map(o => (
                <option key={o.user_id} value={o.user_id} className="bg-[#0F172A]">
                  {o.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Controle de Zoom de Célula Estilo Trello Pro / Miro Board */}
          <div className="flex items-center gap-1 rounded-xl bg-black/40 border border-white/10 p-1">
            <button
              onClick={() => alterarZoom(-10)}
              title={tDynamic('Reduzir Zoom das Células (-10%)')}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <ZoomOut size={14} />
            </button>
            <button
              onClick={resetarZoom}
              title={tDynamic('Resetar Zoom para 100%')}
              className="px-2 py-0.5 rounded-md font-mono text-xs font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 transition"
            >
              {nivelZoom}%
            </button>
            <button
              onClick={() => alterarZoom(+10)}
              title={tDynamic('Aumentar Zoom das Células (+10%)')}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <ZoomIn size={14} />
            </button>
          </div>

          {/* Alternador de Modo de Layout: Orgânico | Grade | Kanban Trello */}
          <div className="flex items-center gap-1 rounded-xl bg-black/40 border border-white/10 p-1">
            <button
              onClick={() => alterarModoLayout('ORGANICO')}
              title={tDynamic('Layout Orgânico (Auto-collapse e largura flexível)')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                modoLayout === 'ORGANICO'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles size={13} /> {tDynamic('Orgânico')}
            </button>
            <button
              onClick={() => alterarModoLayout('GRADE')}
              title={tDynamic('Modo Grade (Otimizado para Tablet e Telas Compactas)')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                modoLayout === 'GRADE'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid size={13} /> {tDynamic('Grade')}
            </button>
            <button
              onClick={() => alterarModoLayout('KANBAN_TRELLO')}
              title={tDynamic('Modo Trello (Colunas Fixas Clássicas)')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                modoLayout === 'KANBAN_TRELLO'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Columns size={13} /> {tDynamic('Trello')}
            </button>
          </div>

          {/* Alternador de Densidade dos Cards */}
          <div className="hidden sm:flex items-center gap-1 rounded-xl bg-black/40 border border-white/10 p-1">
            <button
              onClick={() => alterarDensidadeCards('COMPACTO')}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition ${
                densidadeCards === 'COMPACTO' ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {tDynamic('Compacto')}
            </button>
            <button
              onClick={() => alterarDensidadeCards('PADRAO')}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition ${
                densidadeCards === 'PADRAO' ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {tDynamic('Padrão')}
            </button>
            <button
              onClick={() => alterarDensidadeCards('DETALHADO')}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition ${
                densidadeCards === 'DETALHADO' ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {tDynamic('Detalhado')}
            </button>
          </div>

          {/* Seletor de Estação: Todas vs Cozinha vs Bar */}
          <div className="flex items-center gap-1 rounded-xl bg-black/40 border border-white/10 p-1">
            <button
              onClick={() => setFiltroEstacao('TODAS')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                filtroEstacao === 'TODAS' ? 'bg-orange-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              {tDynamic('Todas')}
            </button>
            <button
              onClick={() => setFiltroEstacao('COZINHA')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                filtroEstacao === 'COZINHA' ? 'bg-orange-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              🍳 {tDynamic('Cozinha')}
            </button>
            <button
              onClick={() => setFiltroEstacao('BAR')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                filtroEstacao === 'BAR' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              🍹 {tDynamic('Bar')}
            </button>
          </div>

          {/* Gaveta de Concluídos */}
          <button
            onClick={() => setModalConcluidosAberto(true)}
            className="relative flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/20"
          >
            <Archive size={14} /> {tDynamic('Concluídos')}
            {pedidosArquivadosList.length > 0 && (
              <span className="ml-1 rounded-full bg-emerald-500 px-1.5 py-0.2 text-[10px] font-extrabold text-slate-950">
                {pedidosArquivadosList.length}
              </span>
            )}
          </button>

          {metricas && (
            <div className="hidden md:flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-bold" style={{ color: corMeta }}>
              <Flame size={13} />
              {metricas.media_hoje_min != null ? `${metricas.media_hoje_min}min ${tDynamic('hoje')}` : tDynamic('sem dados')} · {tDynamic('meta')} {metricas.meta_min}min
            </div>
          )}

          <button
            onClick={() => setModalMetricasAberto(true)}
            className="flex items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-400 transition hover:bg-blue-500/20"
          >
            <BarChart2 size={14} /> {tDynamic('Indicadores')}
          </button>

          <button
            onClick={() => setModalConfigAberto(true)}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:text-white hover:bg-white/10"
          >
            <SlidersHorizontal size={14} /> {tDynamic('Configurar')}
          </button>

          {/* Botão de Tela Cheia Imersiva (Atalho F11) */}
          <button
            onClick={toggleFullscreen}
            title={tDynamic('Tela cheia imersiva (F11)')}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-extrabold transition shadow-md ${
              emFullscreen
                ? 'border-orange-500 bg-orange-500 text-slate-950 shadow-orange-500/30 animate-pulse'
                : 'border-white/10 bg-white/5 text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            {emFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
            <span>{emFullscreen ? tDynamic('Sair da Tela Cheia (F11)') : tDynamic('Tela Cheia (F11)')}</span>
          </button>
        </div>
      </div>

      {erroAcao && (
        <div className="mb-3 max-w-2xl shrink-0">
          <ErroAmigavel erro={erroAcao} onFechar={() => setErroAcao(null)} />
        </div>
      )}

      {/* ── Seletor de operador ── */}
      <div className="mb-3 flex items-center gap-2 overflow-hidden shrink-0">
        <span className="shrink-0 font-['JetBrains_Mono'] text-xs opacity-90 font-bold uppercase tracking-[0.2em] text-[#6C7A96]">{tDynamic('Na cozinha:')}</span>
        <HorizontalScrollContainer className="flex-1 min-w-0 pb-1" showGradients={false}>
          {operadores.map((op) => (
            <button key={op.user_id} onClick={() => escolherOperador(op.user_id)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition flex items-center gap-1.5 ${
                operadorAtivo === op.user_id
                  ? 'border-orange-500 bg-orange-500 text-slate-950 font-black shadow-md'
                  : 'border-white/10 bg-white/5 text-white/60 hover:text-white'
              }`}>
              <User size={12} />
              {op.nome}
            </button>
          ))}
        </HorizontalScrollContainer>
      </div>

      {/* ── Resumo de Gargalo & Fila ── */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {agregado.length > 0 && (
          <div className="flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2 flex-1 overflow-hidden">
            <span className="shrink-0 font-['JetBrains_Mono'] text-xs opacity-90 font-bold uppercase tracking-[0.2em] text-orange-400">{tDynamic('Em produção:')}</span>
            <HorizontalScrollContainer className="flex-1 min-w-0" showGradients={false}>
              {agregado.map(([nome, qtd]) => (
                <span key={nome} className="shrink-0 rounded-full bg-white/5 px-3 py-1 text-[12px] font-bold text-[#EAF1FB]">
                  <span className="text-orange-400 font-mono">{qtd}×</span> {nome}
                </span>
              ))}
            </HorizontalScrollContainer>
          </div>
        )}

        {nomeGargalo && metricasPorEtapa.tempoGargalo > 0 && (
          <div className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300 shrink-0">
            <AlertCircle size={14} className="text-amber-400 shrink-0" />
            <span>{tDynamic('Gargalo da Cozinha:')} <b>{nomeGargalo}</b> ({tDynamic('média')} {metricasPorEtapa.tempoGargalo}m)</span>
          </div>
        )}
      </div>

      {/* ── QUADRO KANBAN ORGÂNICO COM ZOOM E SETAS DE NAVEGAÇÃO ── */}
      <div className="flex-1 min-h-0 overflow-hidden" style={{ zoom: `${nivelZoom}%` }}>
        {modoLayout === 'GRADE' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 overflow-y-auto h-full pb-4">
            {etapas.map((etapa, idx) => {
              const listaPedidos = getPedidosPorEtapa(idx, etapa);
              const proximaEtapaNome = etapas[idx + 1]?.nome || tDynamic('Concluir');
              const tempoMedioEtapa = metricasPorEtapa.medias[etapa.id] || 0;
              const isDragTarget = dragOverEtapaId === etapa.id;

              return (
                <div
                  key={etapa.id}
                  onDragOver={(e) => handleDragOver(e, etapa.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, idx, etapa)}
                  className={`flex flex-col rounded-2xl border p-3 backdrop-blur-md transition-all duration-300 ${
                    isDragTarget
                      ? 'border-orange-500 bg-orange-500/10 shadow-[0_0_25px_rgba(252,91,36,0.3)] ring-2 ring-orange-500/40'
                      : 'border-white/10 bg-white/5'
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between border-b border-white/5 pb-2.5 px-1">
                    <div className="flex items-center gap-2 truncate">
                      <span className="h-3.5 w-3.5 rounded-full shrink-0 shadow-md" style={{ background: etapa.cor }} />
                      <span className="font-['Sora'] text-sm font-extrabold uppercase tracking-wide text-white truncate">
                        {etapa.nome}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {tempoMedioEtapa > 0 && (
                        <span className="text-[11px] font-mono text-slate-400 bg-white/10 px-2 py-0.5 rounded-full">
                          ~{tempoMedioEtapa}m
                        </span>
                      )}
                      <span className="rounded-full px-2.5 py-0.5 font-['Sora'] text-xs font-black text-white shadow-sm" style={{ background: etapa.cor }}>
                        {listaPedidos.length}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3 overflow-y-auto pr-0.5">
                    {listaPedidos.map((p) => (
                      <Card key={p.id} p={p} acaoRotulo={proximaEtapaNome} etapaIndex={idx} etapaAtualObj={etapa} />
                    ))}
                    {listaPedidos.length === 0 && (
                      <div className="flex h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 text-center text-xs text-slate-500">
                        <Sparkles size={20} className="mb-2 text-slate-600 opacity-60" />
                        <span>{tDynamic('Nenhum pedido nesta etapa 🎉')}</span>
                        <span className="text-[11px] text-slate-600 mt-1">{tDynamic('Arraste um pedido para cá')}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <HorizontalScrollContainer className="h-full pb-4" contentClassName="items-stretch h-full gap-3.5">
            {etapas.map((etapa, idx) => {
              const listaPedidos = getPedidosPorEtapa(idx, etapa);
              const proximaEtapaNome = etapas[idx + 1]?.nome || tDynamic('Concluir');
              const tempoMedioEtapa = metricasPorEtapa.medias[etapa.id] || 0;

              const estaRecolhida = modoLayout === 'ORGANICO'
                ? (colunasRecolhidas[etapa.id] ?? (listaPedidos.length === 0))
                : !!colunasRecolhidas[etapa.id];

              const isDragTarget = dragOverEtapaId === etapa.id;

              if (estaRecolhida) {
                return (
                  <div
                    key={etapa.id}
                    onDragOver={(e) => handleDragOver(e, etapa.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, idx, etapa)}
                    onClick={() => toggleColunaRecolhida(etapa.id)}
                    className={`flex w-14 shrink-0 cursor-pointer flex-col items-center justify-between rounded-2xl border p-2 text-center backdrop-blur-md transition-all duration-300 hover:bg-white/10 ${
                      isDragTarget ? 'border-orange-500 bg-orange-500/20 shadow-[0_0_20px_rgba(252,91,36,0.4)]' : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2 pt-2">
                      <span className="h-3 w-3 rounded-full shadow-sm" style={{ background: etapa.cor }} />
                      <span className="rounded-full px-2 py-0.5 font-['Sora'] text-xs font-black text-white" style={{ background: etapa.cor }}>
                        {listaPedidos.length}
                      </span>
                    </div>

                    <div className="my-auto rotate-180 py-4 font-['Sora'] text-xs font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap [writing-mode:vertical-lr]">
                      {etapa.nome}
                    </div>

                    <ChevronRight size={16} className="text-slate-400 pb-2" />
                  </div>
                );
              }

              const styleLargura = modoLayout === 'ORGANICO'
                ? { flex: `${Math.max(1, listaPedidos.length + 1)} 1 0%`, minWidth: '280px', maxWidth: '440px' }
                : { minWidth: '310px', maxWidth: '340px', flex: '1' };

              return (
                <div
                  key={etapa.id}
                  style={styleLargura}
                  onDragOver={(e) => handleDragOver(e, etapa.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, idx, etapa)}
                  className={`flex flex-col rounded-2xl border p-3 backdrop-blur-md transition-all duration-300 ${
                    isDragTarget
                      ? 'border-orange-500 bg-orange-500/10 shadow-[0_0_25px_rgba(252,91,36,0.3)] ring-2 ring-orange-500/40'
                      : 'border-white/10 bg-white/5'
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between border-b border-white/5 pb-2.5 px-1">
                    <div className="flex items-center gap-2 truncate">
                      <span className="h-3.5 w-3.5 rounded-full shrink-0 shadow-md" style={{ background: etapa.cor }} />
                      <span className="font-['Sora'] text-sm font-extrabold uppercase tracking-wide text-white truncate">
                        {etapa.nome}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {tempoMedioEtapa > 0 && (
                        <span className="text-[11px] font-mono text-slate-400 bg-white/10 px-2 py-0.5 rounded-full">
                          ~{tempoMedioEtapa}m
                        </span>
                      )}
                      <span className="rounded-full px-2.5 py-0.5 font-['Sora'] text-xs font-black text-white shadow-sm" style={{ background: etapa.cor }}>
                        {listaPedidos.length}
                      </span>
                      <button
                        onClick={() => toggleColunaRecolhida(etapa.id)}
                        title={tDynamic('Recolher coluna')}
                        className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition ml-1"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3 overflow-y-auto pr-0.5">
                    {listaPedidos.map((p) => (
                      <Card key={p.id} p={p} acaoRotulo={proximaEtapaNome} etapaIndex={idx} etapaAtualObj={etapa} />
                    ))}

                    {listaPedidos.length === 0 && (
                      <div className="flex h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 text-center text-xs text-slate-500">
                        <Sparkles size={20} className="mb-2 text-slate-600 opacity-60" />
                        <span>{tDynamic('Nenhum pedido nesta etapa 🎉')}</span>
                        <span className="text-[11px] text-slate-600 mt-1">{tDynamic('Arraste um pedido para cá')}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </HorizontalScrollContainer>
        )}
      </div>

      {/* ── MODAL: GAVETA DE CONCLUÍDOS / TIRADOS DO FLUXO ── */}
      {modalConcluidosAberto && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-2xl rounded-3xl border border-white/15 bg-[#0F172A] p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Archive className="text-emerald-400" size={22} />
                <div>
                  <h3 className="font-['Sora'] text-lg font-bold">{tDynamic('Gaveta de Concluídos / Expedição')}</h3>
                  <p className="text-xs text-slate-400">{tDynamic('Pedidos finalizados e tirados do fluxo principal de produção.')}</p>
                </div>
              </div>
              <button onClick={() => setModalConcluidosAberto(false)} className="rounded-lg p-1 text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              {pedidosArquivadosList.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <div className="space-y-1">
                    <span className="font-['Sora'] text-lg font-black text-white">
                      {p.senha != null ? `${tDynamic('Senha')} ${p.senha}` : `${tDynamic('Pedido')} #${p.numero}`}
                    </span>
                    <p className="text-xs text-slate-300">
                      {p.tipo_pedido === 'SALAO' ? `${tDynamic('Mesa')} ${p.mesa_numero}` : p.origem} · {p.identificador_cliente}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {p.itens_pedido?.map(i => `${i.quantidade}x ${i.nome_produto}`).join(', ')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                      {tDynamic('Entregue')}
                    </span>
                    {pedidosArquivadosIds.has(p.id) && (
                      <button
                        onClick={() => desarquivarPedido(p.id)}
                        className="rounded-xl border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition"
                      >
                        {tDynamic('Voltar ao Fluxo')}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {pedidosArquivadosList.length === 0 && (
                <div className="py-12 text-center text-sm text-slate-500">
                  {tDynamic('Nenhum pedido finalizado na gaveta ainda.')}
                </div>
              )}
            </div>

            <div className="mt-6 border-t border-white/10 pt-4 text-right">
              <button
                onClick={() => setModalConcluidosAberto(false)}
                className="rounded-xl bg-slate-800 px-6 py-2 text-sm font-bold text-white hover:bg-slate-700"
              >
                {tDynamic('Fechar Gaveta')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: INDICADORES E MÉTRICAS POR ETAPA ── */}
      {modalMetricasAberto && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-white/15 bg-[#0F172A] p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <BarChart2 className="text-blue-400" size={22} />
                <h3 className="font-['Sora'] text-lg font-bold">{tDynamic('Métricas & Indicadores por Etapa')}</h3>
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
                          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs opacity-90 font-black uppercase text-amber-300">
                            {tDynamic('Maior Gargalo')}
                          </span>
                        )}
                      </div>
                      <span className="font-['JetBrains_Mono'] text-base font-bold text-white">
                        {tempo > 0 ? `${tempo} min` : tDynamic('Sem dados')}
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
                className="rounded-xl bg-blue-600 px-6 py-2 text-sm font-bold text-white transition hover:bg-blue-700 font-extrabold"
              >
                {tDynamic('Fechar Indicadores')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CONFIGURAR ETAPAS E OPERADORES DO KDS ── */}
      {modalConfigAberto && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-white/15 bg-[#0F172A] p-6 text-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Settings className="text-orange-400" size={20} />
                <h3 className="font-['Sora'] text-lg font-bold">{tDynamic('Configurações KDS (Etapas & Operadores)')}</h3>
              </div>
              <button onClick={() => setModalConfigAberto(false)} className="rounded-lg p-1 text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            {/* SEÇÃO 1: NOMES DE OPERADORES CONFIGURÁVEIS */}
            <div className="mt-4 border-b border-white/10 pb-5">
              <h4 className="font-['Sora'] text-sm font-extrabold text-orange-400 flex items-center gap-1.5">
                <Users size={16} /> {tDynamic('Operadores da Cozinha (Editar Nomes)')}
              </h4>
              <p className="mt-1 text-xs text-slate-300">
                {tDynamic('Cadastre e edite os nomes dos responsáveis pelas bancadas da sua cozinha (ex: "Rafael - Chapa", "Lucas - Bar", "Maria - Expedição").')}
              </p>

              <div className="mt-3 space-y-2 max-h-40 overflow-y-auto pr-1">
                {operadores.map((op, idx) => (
                  <div key={op.user_id} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-2.5">
                    <div className="flex items-center gap-2 flex-1">
                      <User size={15} className="text-orange-400" />
                      <input
                        type="text"
                        value={op.nome}
                        onChange={(e) => {
                          const clone = [...operadores];
                          clone[idx].nome = e.target.value;
                          salvarOperadores(clone);
                        }}
                        className="flex-1 rounded-lg border border-white/10 bg-white/10 px-3 py-1 text-sm font-bold text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    {operadores.length > 1 && (
                      <button
                        onClick={() => handleRemoverOperador(op.user_id)}
                        className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  placeholder={tDynamic('Novo operador (ex: Carlos - Salgados)...')}
                  value={novoOperadorNome}
                  onChange={(e) => setNovoOperadorNome(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdicionarOperador()}
                  className="flex-1 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-orange-500"
                />
                <button
                  onClick={handleAdicionarOperador}
                  className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-orange-600 font-extrabold"
                >
                  <Plus size={16} /> {tDynamic('Cadastrar')}
                </button>
              </div>
            </div>

            {/* SEÇÃO 2: COLUNAS/ETAPAS TRELLO */}
            <div className="mt-4">
              <h4 className="font-['Sora'] text-sm font-extrabold text-orange-400 flex items-center gap-1.5">
                <Columns size={16} /> {tDynamic('Etapas do Kanban (Colunas)')}
              </h4>
              <p className="mt-1 text-xs text-slate-300">
                {tDynamic('Crie e ordene as colunas de produção.')}
              </p>

              <div className="mt-3 space-y-2.5 max-h-48 overflow-y-auto pr-1">
                {etapas.map((e, index) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-2.5">
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

              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  placeholder={tDynamic('Nome da nova etapa...')}
                  value={novaEtapaNome}
                  onChange={(e) => setNovaEtapaNome(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdicionarEtapa()}
                  className="flex-1 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-orange-500"
                />
                <button
                  onClick={handleAdicionarEtapa}
                  className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-orange-600 font-extrabold"
                >
                  <Plus size={16} /> {tDynamic('Adicionar')}
                </button>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
              <button
                onClick={() => { salvarEtapas(ETAPAS_PADRAO); salvarOperadores(OPERADORES_INICIAIS); }}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white"
              >
                <RotateCcw size={14} /> {tDynamic('Restaurar Padrões')}
              </button>
              <button
                onClick={() => setModalConfigAberto(false)}
                className="rounded-xl bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-6 py-2 text-sm font-bold text-white shadow-lg font-extrabold"
              >
                {tDynamic('Salvar & Fechar')}
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

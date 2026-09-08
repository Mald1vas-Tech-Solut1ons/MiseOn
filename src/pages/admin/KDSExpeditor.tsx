import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Archive, Check, ChefHat, PartyPopper } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { KdsEstacao, KdsTicket } from '../../types';
import { tocarSom } from '../../lib/som';
import type { CtxLoja } from './AdminLayout';
import { useI18n } from '../../contexts/I18nContext';
import MiseOnLoader from '../../components/MiseOnLoader';

interface PedidoResumo {
  id: string;
  numero: number;
  mesa_numero: number | null;
  tipo_pedido: string;
  identificador_cliente: string | null;
  senha: number | null;
  status: string;
}

interface TicketComPedido extends KdsTicket {
  pedidos: PedidoResumo | null;
  kds_estacoes: { nome: string; cor: string } | null;
}

const SELECT =
  'id, pedido_id, loja_id, estacao_id, workflow_id, itens, etapa_atual_idx, status, iniciado_em, concluido_em, criado_em, ' +
  'pedidos(id, numero, mesa_numero, tipo_pedido, identificador_cliente, senha, status), ' +
  'kds_estacoes(nome, cor)';

function identificacaoPedido(p: PedidoResumo | null): string {
  if (!p) return '—';
  if (p.tipo_pedido === 'SALAO' && p.mesa_numero) return `Mesa ${p.mesa_numero}`;
  if (p.senha) return `Senha ${p.senha}`;
  return p.identificador_cliente || `Pedido #${p.numero}`;
}

export default function KDSExpeditor() {
  const { tDynamic } = useI18n();
  const nav = useNavigate();
  const { lojaId } = useOutletContext<CtxLoja>();

  const [estacoes, setEstacoes] = useState<KdsEstacao[]>([]);
  const [tickets, setTickets] = useState<TicketComPedido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [arquivados, setArquivados] = useState<Set<string>>(() => {
    const salvo = localStorage.getItem(`miseon_kds_expeditor_arquivados_${lojaId}`);
    return new Set(salvo ? JSON.parse(salvo) : []);
  });

  const carregar = useCallback(async () => {
    const [{ data: ests }, { data: tks }] = await Promise.all([
      supabase.from('kds_estacoes').select('*').eq('loja_id', lojaId).eq('ativo', true).order('ordem'),
      supabase
        .from('kds_tickets')
        .select(SELECT)
        .eq('loja_id', lojaId)
        .order('criado_em', { ascending: true }),
    ]);
    setEstacoes((ests as KdsEstacao[]) ?? []);
    setTickets((tks as unknown as TicketComPedido[]) ?? []);
    setCarregando(false);
  }, [lojaId]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const canal = supabase
      .channel(`kds-expeditor-${lojaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kds_tickets', filter: `loja_id=eq.${lojaId}` }, (payload) => {
        if (payload.eventType === 'UPDATE' && (payload.new as any)?.status === 'PRONTO') tocarSom();
        carregar();
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [lojaId, carregar]);

  const pedidosAgrupados = useMemo(() => {
    const grupos = new Map<string, TicketComPedido[]>();
    for (const t of tickets) {
      if (!t.pedidos || ['FINALIZADO', 'CANCELADO'].includes(t.pedidos.status)) continue;
      if (arquivados.has(t.pedido_id)) continue;
      const lista = grupos.get(t.pedido_id) ?? [];
      lista.push(t);
      grupos.set(t.pedido_id, lista);
    }
    return Array.from(grupos.entries())
      .map(([pedidoId, tks]) => ({
        pedidoId,
        pedido: tks[0].pedidos!,
        tickets: tks,
        completo: tks.every((t) => t.status === 'PRONTO'),
        criadoEm: tks.reduce((min, t) => (t.criado_em < min ? t.criado_em : min), tks[0].criado_em),
      }))
      .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  }, [tickets, arquivados]);

  const arquivar = (pedidoId: string) => {
    setArquivados((prev) => {
      const novo = new Set(prev).add(pedidoId);
      localStorage.setItem(`miseon_kds_expeditor_arquivados_${lojaId}`, JSON.stringify([...novo]));
      return novo;
    });
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-24">
        <MiseOnLoader status={tDynamic('Carregando expeditor...')} rows={2} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 pb-24 max-w-7xl mx-auto">
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-6 text-white mb-6 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-white/10 p-4 rounded-full"><PartyPopper size={32} /></div>
          <div>
            <h1 className="text-2xl font-black">{tDynamic('Expeditor')}</h1>
            <p className="text-white/70 text-sm font-medium">{tDynamic('Acompanha a sincronização de todas as estações por pedido')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {estacoes.map((e) => (
            <button
              key={e.id}
              onClick={() => nav(`/admin/kds/estacao/${e.id}`)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-white shadow-md hover:scale-[1.03] transition-transform"
              style={{ backgroundColor: e.cor }}
            >
              <ChefHat size={16} /> {e.nome}
            </button>
          ))}
        </div>
      </div>

      {pedidosAgrupados.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
          <Check size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-semibold">{tDynamic('Nenhum pedido em produção.')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {pedidosAgrupados.map(({ pedidoId, pedido, tickets: tks, completo }) => (
            <div
              key={pedidoId}
              className={`rounded-2xl border-2 overflow-hidden shadow-md bg-white dark:bg-gray-900 transition-all ${
                completo ? 'border-green-400 shadow-green-500/20' : 'border-gray-100 dark:border-gray-800'
              }`}
              style={completo ? { animation: 'mo-pulso-pronto 1.6s ease-in-out infinite' } : undefined}
            >
              <div className={`px-5 py-3 flex items-center justify-between ${completo ? 'bg-green-500 text-white' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
                <span className={`font-black text-lg ${!completo ? 'dark:text-gray-100' : ''}`}>{identificacaoPedido(pedido)}</span>
                {completo && <Check size={20} />}
              </div>

              <div className="p-5 space-y-2.5">
                {tks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-semibold dark:text-gray-200">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.kds_estacoes?.cor || '#999' }} />
                      {t.kds_estacoes?.nome || '—'}
                    </span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded-full text-xs ${
                        t.status === 'PRONTO'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : t.status === 'PREPARANDO'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {t.status === 'PRONTO' ? tDynamic('Pronto') : t.status === 'PREPARANDO' ? tDynamic('Preparando') : tDynamic('Aguardando')}
                    </span>
                  </div>
                ))}

                {completo && (
                  <button
                    onClick={() => arquivar(pedidoId)}
                    className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-black text-sm text-white bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/25 transition-all hover:scale-[1.02]"
                  >
                    <Archive size={16} /> {tDynamic('Entregar')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes mo-pulso-pronto {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
        }
      `}</style>
    </div>
  );
}

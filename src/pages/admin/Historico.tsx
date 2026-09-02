import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Pedido, StatusPedido, fmt } from '../../types';
import type { CtxLoja } from './AdminLayout';
import { Timer } from 'lucide-react';
import MiseOnLoader from '../../components/MiseOnLoader';

import { useI18n } from '../../contexts/I18nContext';
const STATUS_LABEL: Record<StatusPedido, string> = {
  NOVO: 'Recebido', ACEITO: 'Aceito', PREPARANDO: 'Preparando',
  PRONTO: 'Pronto', EM_ROTA: 'Em rota', FINALIZADO: 'Entregue', CANCELADO: 'Cancelado',
};
const STATUS_COR: Record<StatusPedido, string> = {
  NOVO: 'bg-amber-100 text-amber-700', ACEITO: 'bg-blue-100 text-blue-700', PREPARANDO: 'bg-indigo-100 text-indigo-700',
  PRONTO: 'bg-purple-100 text-purple-700', EM_ROTA: 'bg-cyan-100 text-cyan-700',
  FINALIZADO: 'bg-green-100 text-green-700', CANCELADO: 'bg-red-100 text-red-600',
};

export default function Historico() {
  const { tDynamic } = useI18n();
  const { lojaId } = useOutletContext<CtxLoja>();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<StatusPedido | ''>('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [tmp, setTmp] = useState<number | null>(null);

  const carregarTMP = async () => {
    // Busca historico das ultimas 24h
    const hj = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data } = await supabase.from('historico_pedidos')
      .select('pedido_id, status, criado_em, pedidos!inner(loja_id)')
      .eq('pedidos.loja_id', lojaId)
      .in('status', ['ACEITO', 'PRONTO'])
      .gte('criado_em', hj);
    
    if (!data) return;
    const grupos: Record<string, any> = {};
    data.forEach((d: any) => {
      if (!grupos[d.pedido_id]) grupos[d.pedido_id] = {};
      grupos[d.pedido_id][d.status] = new Date(d.criado_em).getTime();
    });
    let soma = 0, qtd = 0;
    Object.values(grupos).forEach((g) => {
      if (g.ACEITO && g.PRONTO && g.PRONTO > g.ACEITO) {
        soma += (g.PRONTO - g.ACEITO);
        qtd++;
      }
    });
    setTmp(qtd > 0 ? Math.round(soma / qtd / 60000) : null);
  };

  const carregar = async () => {
    setCarregando(true);
    let q = supabase.from('pedidos').select('*, itens_pedido(*), pagamentos(metodo, status, valor_pago)')
      .eq('loja_id', lojaId).order('criado_em', { ascending: false }).limit(300);
    if (status) q = q.eq('status', status);
    if (de) q = q.gte('criado_em', new Date(de).toISOString());
    if (ate) q = q.lte('criado_em', new Date(new Date(ate).getTime() + 86399999).toISOString());
    const { data } = await q;
    setPedidos((data as Pedido[]) ?? []);
    setCarregando(false);
  };
  useEffect(() => {
    setTimeout(() => {
      carregar();
      carregarTMP();
    }, 0);
  }, [lojaId, status, de, ate]);

  const visiveis = pedidos.filter((p) =>
    !busca || p.identificador_cliente?.toLowerCase().includes(busca.toLowerCase()) || String(p.numero).includes(busca));

  const totalPeriodo = visiveis.filter((p) => p.status !== 'CANCELADO').reduce((s, p) => s + Number(p.valor_total), 0);

  return (
    <div className="p-4">
      <h2 className="mb-3 font-bold">{tDynamic('Histórico de pedidos')}</h2>

      <div className="mb-4 flex items-center justify-between rounded-2xl bg-white dark:bg-gray-900 dark:border-gray-800 p-4 shadow-sm">
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{tDynamic('Tempo Médio de Preparo (24h)')}</p>
          <p className="text-xl font-bold text-gray-800 dark:text-gray-100">
            {tmp !== null ? `${tmp} min` : '--'}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
          <Timer size={20} />
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-xl bg-white dark:bg-gray-900 dark:border-gray-800 px-3 py-2 shadow-sm">
        <Search size={16} className="text-gray-400" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou número…"
          className="w-full bg-transparent text-sm outline-none" />
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <input value={de} onChange={(e) => setDe(e.target.value)} type="date" className="rounded-xl border p-2 text-xs" />
        <input value={ate} onChange={(e) => setAte(e.target.value)} type="date" className="rounded-xl border p-2 text-xs" />
        <select value={status} onChange={(e) => setStatus(e.target.value as StatusPedido | '')} className="rounded-xl border p-2 text-xs">
          <option value="">Todo status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">{visiveis.length} pedido(s) · faturamento no filtro: <b className="text-gray-700">{fmt(totalPeriodo)}</b></p>

      {carregando ? (
        <div className="flex h-64 items-center justify-center">
          <MiseOnLoader status="Carregando histórico de pedidos..." rows={2} />
        </div>
      ) : (
        <div className="space-y-2">
          {visiveis.map((p) => (
            <div key={p.id} className="rounded-xl bg-white dark:bg-gray-900 dark:border-gray-800 p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold">#{p.numero}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COR[p.status]}`}>{STATUS_LABEL[p.status]}</span>
              </div>
              <p className="text-sm">{p.identificador_cliente} · {p.telefone_contato}</p>
              <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
                <span>{new Date(p.criado_em).toLocaleString('pt-BR')} · {p.itens_pedido?.length ?? 0} item(ns)</span>
                <span className="font-bold text-gray-700 dark:text-gray-200">{fmt(Number(p.valor_total))}</span>
              </div>
            </div>
          ))}
          {visiveis.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Nenhum pedido encontrado.</p>}
        </div>
      )}
    </div>
  );
}

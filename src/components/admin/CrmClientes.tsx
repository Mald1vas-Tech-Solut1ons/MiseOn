import React, { useState } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import {
  Users as UsersIcon, TrendingUp as TrendingUpIcon, MessageSquare as MessageSquareIcon,
  Gift as GiftIcon, Search as SearchIcon, Send as SendIcon, CheckCircle2
} from 'lucide-react';

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  totalPedidos: number;
  ltv: number;
  ultimoPedidoDias: number;
  categoria: 'VIP' | 'Frequente' | 'Em Risco' | 'Inativo' | 'Novo';
  cashbackAcumulado: number;
}

const CLIENTES_MOCK: Cliente[] = [
  { id: '1', nome: 'Carlos Eduardo Silva', telefone: '11987654321', totalPedidos: 18, ltv: 1420.50, ultimoPedidoDias: 3, categoria: 'VIP', cashbackAcumulado: 71.02 },
  { id: '2', nome: 'Mariana Costa', telefone: '11976543210', totalPedidos: 12, ltv: 890.00, ultimoPedidoDias: 8, categoria: 'Frequente', cashbackAcumulado: 44.50 },
  { id: '3', nome: 'Roberto Almeida', telefone: '11965432109', totalPedidos: 7, ltv: 450.20, ultimoPedidoDias: 22, categoria: 'Em Risco', cashbackAcumulado: 22.51 },
  { id: '4', nome: 'Fernanda Lima', telefone: '11954321098', totalPedidos: 2, ltv: 120.00, ultimoPedidoDias: 48, categoria: 'Inativo', cashbackAcumulado: 6.00 },
  { id: '5', nome: 'Lucas Oliveira', telefone: '11943210987', totalPedidos: 1, ltv: 75.00, ultimoPedidoDias: 1, categoria: 'Novo', cashbackAcumulado: 3.75 },
];

export default function CrmClientes() {
  const { tDynamic } = useI18n();
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODOS');
  const [taxaCashback, setTaxaCashback] = useState<number>(5);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  const clientesFiltrados = CLIENTES_MOCK.filter((c) => {
    const bateBusca = c.nome.toLowerCase().includes(busca.toLowerCase()) || c.telefone.includes(busca);
    const bateCat = filtroCategoria === 'TODOS' || c.categoria === filtroCategoria;
    return bateBusca && bateCat;
  });

  const totalVips = CLIENTES_MOCK.filter((c) => c.categoria === 'VIP').length;
  const totalEmRisco = CLIENTES_MOCK.filter((c) => c.categoria === 'Em Risco').length;
  const ltvMedio = (CLIENTES_MOCK.reduce((acc, c) => acc + c.ltv, 0) / CLIENTES_MOCK.length).toFixed(2);

  const dispararCampanhaWhatsApp = (cliente: Cliente, tipo: 'retorno' | 'vip' | 'aniversario') => {
    let msg = '';
    if (tipo === 'retorno') {
      msg = `Olá ${cliente.nome}! Sentimos sua falta aqui no restaurante! 🍔 Temos um cupom especial de 15% OFF para o seu próximo pedido: VOLTA15. Peça agora: https://miseon.app.br`;
    } else if (tipo === 'vip') {
      msg = `Olá ${cliente.nome}! Você é um cliente VIP e tem R$ ${cliente.cashbackAcumulado.toFixed(2)} acumulados de cashback para resgatar! Peça agora: https://miseon.app.br`;
    } else {
      msg = `Parabéns ${cliente.nome}! 🎉 Feliz aniversário! Preparamos um presente especial para você em nosso cardápio: https://miseon.app.br`;
    }

    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/55${cliente.telefone}?text=${encoded}`, '_blank');
    setMensagemSucesso(`Mensagem preparada no WhatsApp para ${cliente.nome}!`);
    setTimeout(() => setMensagemSucesso(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* ══════════ 1. HEADER & MÉTRICAS RFM ══════════ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-['Sora'] text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UsersIcon className="text-[#FC5B24]" size={22} />
            {tDynamic('CRM & Engenharia de Clientes (LTV & RFM)')}
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {tDynamic('Segmentação inteligente por frequência e valor monetário com campanhas de retenção no WhatsApp.')}
          </p>
        </div>
      </div>

      {mensagemSucesso && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs font-bold text-emerald-400">
          <CheckCircle2 size={16} /> {mensagemSucesso}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <span className="text-[11px] font-bold text-gray-400">{tDynamic('LTV Médio por Cliente')}</span>
          <p className="mt-1 font-['Sora'] text-xl font-bold text-gray-900 dark:text-white">R$ {ltvMedio}</p>
          <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-0.5 mt-1">
            <TrendingUpIcon size={12} /> +14.2% este mês
          </span>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <span className="text-[11px] font-bold text-gray-400">Clientes VIPs</span>
          <p className="mt-1 font-['Sora'] text-xl font-bold text-[#FC5B24]">{totalVips}</p>
          <span className="text-[10px] text-slate-400 mt-1 block">{tDynamic('Frequência e ticket alto')}</span>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <span className="text-[11px] font-bold text-gray-400">{tDynamic('Clientes em Risco')}</span>
          <p className="mt-1 font-['Sora'] text-xl font-bold text-amber-500">{totalEmRisco}</p>
          <span className="text-[10px] text-amber-400 font-semibold mt-1 block">{tDynamic('Inativos há +15 dias')}</span>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <span className="text-[11px] font-bold text-gray-400">{tDynamic('Programa de Cashback')}</span>
          <p className="mt-1 font-['Sora'] text-xl font-bold text-emerald-500">{taxaCashback}%</p>
          <span className="text-[10px] text-slate-400 mt-1 block">{tDynamic('Devolvido no cardápio')}</span>
        </div>
      </div>

      {/* ══════════ 2. CONFIGURAÇÃO DE CASHBACK ══════════ */}
      <div className="rounded-2xl border border-orange-500/20 bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FC5B24] text-white">
              <GiftIcon size={20} />
            </div>
            <div>
              <h3 className="font-['Sora'] text-sm font-bold text-gray-900 dark:text-white">
                {tDynamic('Fidelização Nativa via Cashback')}
              </h3>
              <p className="text-xs text-gray-600 dark:text-slate-300">
                {tDynamic('Cada pedido concluído gera saldo de volta para o cliente usar na próxima compra, aumentando o LTV e o retorno orgânico.')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-700 dark:text-slate-200">{tDynamic('Taxa de Cashback:')}</span>
            <select
              value={taxaCashback}
              onChange={(e) => setTaxaCashback(Number(e.target.value))}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-900 outline-none dark:border-white/10 dark:bg-[#070C18] dark:text-white"
            >
              <option value={3}>3% de volta</option>
              <option value={5}>5% de volta (Recomendado)</option>
              <option value={7}>7% de volta</option>
              <option value={10}>10% de volta</option>
            </select>
          </div>
        </div>
      </div>

      {/* ══════════ 3. FILTROS & TABELA DE CLIENTES ══════════ */}
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          {/* Busca */}
          <div className="relative flex-1 max-w-md">
            <SearchIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou telefone do cliente..."
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-xs font-medium text-gray-900 outline-none focus:border-[#FC5B24] dark:border-white/10 dark:bg-[#070C18] dark:text-white"
            />
          </div>

          {/* Categorias */}
          <div className="flex flex-wrap items-center gap-1.5">
            {['TODOS', 'VIP', 'Frequente', 'Em Risco', 'Inativo', 'Novo'].map((cat) => (
              <button
                key={cat}
                onClick={() => setFiltroCategoria(cat)}
                className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
                  filtroCategoria === cat
                    ? 'bg-[#FC5B24] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-gray-200 text-[11px] uppercase tracking-wider text-slate-400 dark:border-white/10">
              <tr>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Categoria RFM</th>
                <th className="py-3 px-4">Pedidos</th>
                <th className="py-3 px-4">LTV Acumulado</th>
                <th className="py-3 px-4">Último Pedido</th>
                <th className="py-3 px-4">Cashback</th>
                <th className="py-3 px-4 text-right">Ação WhatsApp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-medium">
              {clientesFiltrados.map((cliente) => (
                <tr key={cliente.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5">
                  <td className="py-3 px-4">
                    <p className="font-bold text-gray-900 dark:text-white">{cliente.nome}</p>
                    <p className="text-[11px] text-slate-400">{cliente.telefone}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                      cliente.categoria === 'VIP' ? 'bg-orange-500/10 text-[#FC5B24]' :
                      cliente.categoria === 'Frequente' ? 'bg-blue-500/10 text-blue-500' :
                      cliente.categoria === 'Em Risco' ? 'bg-amber-500/10 text-amber-500' :
                      cliente.categoria === 'Novo' ? 'bg-emerald-500/10 text-emerald-500' :
                      'bg-gray-500/10 text-gray-500'
                    }`}>
                      {cliente.categoria}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-900 dark:text-white font-bold">{cliente.totalPedidos}</td>
                  <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">
                    R$ {cliente.ltv.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {cliente.ultimoPedidoDias === 1 ? 'Ontem' : `há ${cliente.ultimoPedidoDias} dias`}
                  </td>
                  <td className="py-3 px-4 font-bold text-orange-500">
                    R$ {cliente.cashbackAcumulado.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {cliente.categoria === 'Em Risco' || cliente.categoria === 'Inativo' ? (
                        <button
                          onClick={() => dispararCampanhaWhatsApp(cliente, 'retorno')}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-500 hover:bg-amber-500/20"
                        >
                          <SendIcon size={12} /> Resgatar
                        </button>
                      ) : (
                        <button
                          onClick={() => dispararCampanhaWhatsApp(cliente, 'vip')}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-500 hover:bg-emerald-500/20"
                        >
                          <MessageSquareIcon size={12} /> WhatsApp
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

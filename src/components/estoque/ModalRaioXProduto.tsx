import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { fmt, Insumo } from '../../types';
import { X, TrendingUp, TrendingDown, ListOrdered, AlertTriangle, Info, Truck, Award } from 'lucide-react';
import MiseOnLoader from '../MiseOnLoader';
import { HistoricoPreco, historicoPrecos } from '../../lib/compras';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

import { useI18n } from '../../contexts/I18nContext';
interface Props {
  insumo: Insumo;
  onClose: () => void;
}

export default function ModalRaioXProduto({ insumo, onClose }: Props) {
  const { tDynamic } = useI18n();
  const [lotes, setLotes] = useState<any[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<any[]>([]);
  const [compras, setCompras] = useState<HistoricoPreco[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let atual = true;
    const carregar = async () => {
      setLoading(true);

      const [resLotes, resMovs, resCompras] = await Promise.all([
        supabase.from('lotes_estoque')
          .select('*')
          .eq('insumo_id', insumo.id)
          .gt('quantidade_restante', 0)
          .order('criado_em', { ascending: true }),
        supabase.from('movimentacoes_estoque')
          .select('*')
          .eq('insumo_id', insumo.id)
          .order('criado_em', { ascending: false })
          .limit(100),
        historicoPrecos(insumo.id).catch(() => [] as HistoricoPreco[]),
      ]);

      if (!atual) return;
      setLotes(resLotes.data || []);
      setMovimentacoes(resMovs.data || []);
      setCompras(resCompras);
      setLoading(false);
    };

    carregar();
    return () => { atual = false; };
  }, [insumo.id]);

  const chartData = useMemo(() => {
    // Pegar as movimentacoes de ENTRADA, de tras para frente (cronologica)
    const entradas = [...movimentacoes].filter(m => m.tipo === 'ENTRADA').reverse();
    return entradas.map(e => {
      let unit = 0;
      if (e.custo_total > 0 && e.quantidade > 0) {
        unit = Number(e.custo_total) / Number(e.quantidade);
      }
      return {
        dataRaw: new Date(e.criado_em),
        data: new Date(e.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
        custoUnitario: unit,
        isZero: unit === 0
      };
    }).filter(e => !e.isZero); // Filtra os de custo zerado do grafico para não distorcer a linha
  }, [movimentacoes]);

  // Onde comprar melhor: agrupa as compras por fornecedor + marca e normaliza
  // pelo custo da unidade-base. Comparar "R$ 30 a caixa" com "R$ 4 o quilo" só
  // faz sentido depois dessa normalização.
  const origens = useMemo(() => {
    const mapa = new Map<string, {
      fornecedor: string; marca: string | null; compras: number;
      custoMedio: number; ultimo: number; ultimaData: string;
    }>();
    for (const c of compras) {
      const chave = `${c.fornecedor_nome ?? '—'}|${c.marca ?? ''}`;
      const atual = mapa.get(chave);
      const custo = Number(c.custo_unitario_base);
      if (!atual) {
        mapa.set(chave, {
          fornecedor: c.fornecedor_nome ?? 'Sem fornecedor',
          marca: c.marca ?? null,
          compras: 1, custoMedio: custo, ultimo: custo, ultimaData: c.recebido_em,
        });
      } else {
        atual.custoMedio = (atual.custoMedio * atual.compras + custo) / (atual.compras + 1);
        atual.compras += 1;
        // A lista vem ordenada do mais recente para o mais antigo.
        if (c.recebido_em > atual.ultimaData) { atual.ultimo = custo; atual.ultimaData = c.recebido_em; }
      }
    }
    return [...mapa.values()].sort((a, b) => a.custoMedio - b.custoMedio);
  }, [compras]);

  const ultimoCustoValido = chartData.length > 0 ? chartData[chartData.length - 1].custoUnitario : 0;
  const penultimoCustoValido = chartData.length > 1 ? chartData[chartData.length - 2].custoUnitario : 0;
  
  let tendencia = null;
  if (ultimoCustoValido && penultimoCustoValido) {
    if (ultimoCustoValido > penultimoCustoValido) tendencia = 'up';
    else if (ultimoCustoValido < penultimoCustoValido) tendencia = 'down';
    else tendencia = 'stable';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <div className="flex flex-col w-full max-w-4xl max-h-[90vh] bg-gray-50 dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header Premium */}
        <div className="shrink-0 flex items-center justify-between bg-white dark:bg-gray-900 px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <span className="text-purple-600 dark:text-purple-400">Raio-X:</span> {insumo.nome}
            </h2>
            <p className="text-xs text-gray-500 font-medium mt-0.5">Estoque atual: {Number(insumo.quantidade_atual).toLocaleString('pt-BR')} {insumo.unidade_medida}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-300 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 hide-scrollbar">
          {loading ? (
             <div className="flex h-64 items-center justify-center"><MiseOnLoader status="Coletando dados..." rows={2} /></div>
          ) : (
            <>
              {/* Painel de Indicadores (KPIs) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-center">
                  <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-1">{tDynamic('Último Custo Pago')}</p>
                  <div className="flex items-end gap-3">
                    <span className="text-3xl font-black text-gray-900 dark:text-gray-100">
                      {ultimoCustoValido > 0 ? fmt(ultimoCustoValido) : 'Sem Custo'}
                    </span>
                    <span className="text-sm text-gray-500 pb-1">/ {insumo.unidade_medida}</span>
                  </div>
                  {tendencia && (
                    <p className={`text-xs mt-2 font-bold flex items-center gap-1 ${tendencia === 'up' ? 'text-red-500' : tendencia === 'down' ? 'text-emerald-500' : 'text-gray-500'}`}>
                      {tendencia === 'up' ? <TrendingUp size={14} /> : tendencia === 'down' ? <TrendingDown size={14} /> : null}
                      {tendencia === 'up' ? 'Mais caro que a penúltima compra' : tendencia === 'down' ? 'Mais barato que a penúltima compra' : 'Preço estável'}
                    </p>
                  )}
                </div>
                
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                  <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-3">{tDynamic('Lotes Físicos Ativos')}</p>
                  {lotes.length === 0 ? (
                    <p className="text-sm font-medium text-gray-400">Nenhum lote ativo.</p>
                  ) : (
                    <div className="space-y-2 max-h-24 overflow-y-auto hide-scrollbar pr-2">
                      {lotes.map(lote => {
                         const validade = lote.vence_em ? new Date(lote.vence_em + 'T00:00:00') : null;
                         const vencido = validade && validade < new Date();
                         const venceEmBreve = validade && (validade.getTime() - new Date().getTime()) / (1000 * 3600 * 24) <= 7;

                         return (
                           <div key={lote.id} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg">
                             <div className="font-semibold text-gray-700 dark:text-gray-300">
                               {Number(lote.quantidade_restante).toLocaleString('pt-BR')} {insumo.unidade_medida}
                               {lote.lote_fornecedor && <span className="ml-2 px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-[9px] uppercase">Ref: {lote.lote_fornecedor}</span>}
                             </div>
                             {validade ? (
                               <div className={`font-bold flex items-center gap-1 ${vencido ? 'text-red-500' : venceEmBreve ? 'text-amber-500' : 'text-gray-500'}`}>
                                 {(vencido || venceEmBreve) && <AlertTriangle size={12} />}
                                 {validade.toLocaleDateString('pt-BR')}
                               </div>
                             ) : (
                               <span className="text-gray-400 text-[10px] uppercase">S/ Validade</span>
                             )}
                           </div>
                         );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* De quem comprar: o histórico virando decisão */}
              {origens.length > 0 && (
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100">
                    <Truck size={16} className="text-emerald-500" /> {tDynamic('Onde você compra melhor')}
                  </h3>
                  <div className="space-y-2">
                    {origens.map((o, idx) => {
                      const maisCaro = origens[origens.length - 1].custoMedio;
                      const economia = maisCaro > 0 ? (1 - o.custoMedio / maisCaro) * 100 : 0;
                      return (
                        <div key={`${o.fornecedor}-${o.marca}`}
                          className={`flex items-center justify-between gap-3 rounded-xl p-3 ${
                            idx === 0 && origens.length > 1
                              ? 'border border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-900/10'
                              : 'bg-gray-50 dark:bg-gray-800/50'}`}>
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 text-sm font-bold text-gray-800 dark:text-gray-200">
                              {idx === 0 && origens.length > 1 && <Award size={13} className="shrink-0 text-emerald-500" />}
                              {o.fornecedor}
                              {o.marca && <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[9px] font-bold uppercase text-gray-600 dark:bg-gray-700 dark:text-gray-300">{o.marca}</span>}
                            </p>
                            <p className="mt-0.5 text-[10px] text-gray-400">
                              {o.compras} {o.compras === 1 ? 'compra' : 'compras'} · última em{' '}
                              {new Date(o.ultimaData).toLocaleDateString('pt-BR')} a {fmt(o.ultimo)}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-black text-gray-900 dark:text-gray-100">{fmt(o.custoMedio)}</p>
                            <p className="text-[10px] text-gray-400">média / {insumo.unidade_medida}</p>
                            {idx === 0 && economia > 1 && (
                              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                −{economia.toFixed(0)}% vs o mais caro
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Gráfico de Custos */}
              <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                 <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <TrendingUp size={16} className="text-purple-500" /> {tDynamic('Evolução de Custo de Compra')}
                 </h3>
                 <div className="h-48 w-full">
                   {chartData.length < 2 ? (
                     <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                        <Info size={24} className="mb-2 opacity-50" />
                        <p className="text-xs font-medium">{tDynamic('Dados insuficientes para gerar o gráfico.')}</p>
                        <p className="text-[10px]">{tDynamic('Registre mais de uma compra com custo para ver a inflação.')}</p>
                     </div>
                   ) : (
                     <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.3} />
                          <XAxis dataKey="data" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                          <YAxis tickFormatter={(val) => `R$ ${val}`} tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                          <RechartsTooltip 
                            formatter={(value: any) => [fmt(Number(value)), 'Custo Unitário']}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                            labelStyle={{ color: '#6B7280', fontSize: '12px', fontWeight: 'bold' }}
                          />
                          <Line type="monotone" dataKey="custoUnitario" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                        </LineChart>
                     </ResponsiveContainer>
                   )}
                 </div>
              </div>

              {/* Tabela de Extrato / Movimentacoes */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 dark:border-gray-800">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <ListOrdered size={16} className="text-blue-500" /> {tDynamic('Extrato Completo de Movimentações')}
                  </h3>
                </div>
                <div className="overflow-x-auto hide-scrollbar max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="py-2.5 px-5">Data</th>
                        <th className="py-2.5 px-5">Tipo</th>
                        <th className="py-2.5 px-5">Qtd</th>
                        <th className="py-2.5 px-5">Custo Ref.</th>
                        <th className="py-2.5 px-5">Motivo / Lote</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimentacoes.length === 0 ? (
                        <tr><td colSpan={5} className="py-6 text-center text-gray-400">{tDynamic('Nenhuma movimentação registrada.')}</td></tr>
                      ) : movimentacoes.map((mov) => {
                         const unit = mov.custo_total > 0 && mov.quantidade > 0 ? Number(mov.custo_total) / Number(mov.quantidade) : 0;
                         const isEntrada = mov.tipo === 'ENTRADA';
                         const isSaida = mov.tipo === 'SAIDA_VENDA' || mov.tipo === 'SAIDA_PRODUCAO' || mov.tipo === 'SAIDA_KDS';
                         const isPerda = mov.tipo === 'PERDA';

                         let colorText = 'text-gray-600 dark:text-gray-300';
                         if (isEntrada) colorText = 'text-emerald-600 dark:text-emerald-400 font-bold';
                         if (isSaida) colorText = 'text-blue-600 dark:text-blue-400';
                         if (isPerda) colorText = 'text-red-600 dark:text-red-400';

                         return (
                          <tr key={mov.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                            <td className="py-3 px-5 text-gray-500 dark:text-gray-400">
                              {new Date(mov.criado_em).toLocaleDateString('pt-BR')} <span className="text-[10px] opacity-70">{new Date(mov.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                            </td>
                            <td className="py-3 px-5">
                               <span className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold ${
                                  isEntrada ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' : 
                                  isSaida ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' : 
                                  isPerda ? 'bg-red-100 text-red-700 dark:bg-red-900/30' : 
                                  'bg-gray-100 text-gray-700 dark:bg-gray-800'
                               }`}>
                                 {mov.tipo.replace('_', ' ')}
                               </span>
                            </td>
                            <td className={`py-3 px-5 ${colorText}`}>
                              {isEntrada ? '+' : '-'}{Number(mov.quantidade).toLocaleString('pt-BR')} {insumo.unidade_medida}
                            </td>
                            <td className="py-3 px-5 font-medium text-gray-600 dark:text-gray-400">
                              {isEntrada ? (
                                unit > 0 ? fmt(unit) : <span className="text-[10px] italic text-gray-400 font-normal">Sem custo reg.</span>
                              ) : '-'}
                            </td>
                            <td className="py-3 px-5 text-gray-500 dark:text-gray-400">
                              <span className="block truncate max-w-[150px]">{mov.motivo || '-'}</span>
                              {mov.lote_fornecedor && <span className="text-[10px] bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded mt-1 inline-block">L: {mov.lote_fornecedor}</span>}
                            </td>
                          </tr>
                         );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

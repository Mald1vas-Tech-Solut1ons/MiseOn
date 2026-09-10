import { useEffect, useMemo, useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Flame, ChefHat, AlertTriangle, CheckCircle2, Printer, Minus, Plus,
  PackageCheck, PackageX, Loader2, Sparkles, ClipboardList, Timer, Play, Check
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Insumo, Loja, fmt } from '../../types';
import type { CtxLoja } from './AdminLayout';
import { imprimir } from '../../lib/print';
import { UNIDADES } from '../../lib/unidades';
import MiseOnLoader from '../../components/MiseOnLoader';
import EstoquePreparos from './EstoquePreparos';
import ModoPreparo from '../../components/producao/ModoPreparo';

import { useI18n } from '../../contexts/I18nContext';
type Ficha = {
  insumo_id: string;
  /** Bruto na unidade de estoque — é o que sai do estoque e vira custo. */
  quantidade: number;
  /** Líquido após o pré-preparo. Nulo = sem perda declarada. */
  quantidade_liquida: number | null;
  tecnica_codigo: string | null;
};

const custoUnit = (i?: Insumo) =>
  i && Number(i.qtd_embalagem) > 0 ? Number(i.preco_embalagem) / Number(i.qtd_embalagem) : 0;

/**
 * Espelha fn_rendimento_na_unidade_do_preparo: rendimento_padrao_kg está em kg
 * e só vale quando o preparo é medido em massa (kg -> ml exigiria densidade,
 * que ninguém declarou). Precisa bater com a RPC, senão a tela promete uma
 * quantidade e o estoque recebe outra.
 */
const rendimentoDoLote = (p: Insumo): number => {
  const unidade = UNIDADES.find(u => u.codigo === p.unidade_medida);
  const emKg = Number(p.rendimento_padrao_kg ?? 0);
  if (emKg > 0 && unidade?.grandeza === 'massa' && unidade.fatorBase) {
    return emKg / unidade.fatorBase;
  }
  return Number(p.rendimento_porcoes || 0) || 1;
};

// --- Subcomponente: Card da Ordem de Serviço (OS) com Timer e Etiqueta ---
function OSCard({
  p,
  pendente,
  loja,
  insumoById,
  onProduzir
}: {
  p: Insumo;
  pendente: boolean;
  loja: Loja | null;
  insumoById: Map<string, Insumo>;
  onProduzir: (p: Insumo, qtdLotes: number, segundos?: number, segundosFogo?: number) => Promise<void>;
}) {
  const { tDynamic } = useI18n();
  const [qtdLotes, setQtdLotes] = useState(() => {
    const rend = rendimentoDoLote(p);
    const deficit = Number(p.estoque_minimo) - Number(p.quantidade_atual);
    return deficit <= 0 ? 1 : Math.max(1, Math.ceil(deficit / rend));
  });

  const [status, setStatus] = useState<'PENDENTE' | 'ANDAMENTO' | 'CONCLUIDA'>('PENDENTE');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isProduzindo, setIsProduzindo] = useState(false);
  const [modalFuroAberto, setModalFuroAberto] = useState(false);
  const [modoAberto, setModoAberto] = useState(false);

  // Meta dados gerados ao concluir
  const [dadosFinais, setDadosFinais] = useState<{
    dataFab: string;
    dataValidade: string | null;
    osNum: number;
    tempoFormatado: string;
  } | null>(null);

  // Analisa custo e disponibilidade
  const { itens, custo, podeProduzir, rendimento } = useMemo(() => {
    const ficha: Ficha[] = ((p as any).fichas_preparos || []).map((f: any) => ({
      insumo_id: f.insumo_id,
      quantidade: Number(f.quantidade),
      quantidade_liquida: f.quantidade_liquida == null ? null : Number(f.quantidade_liquida),
      tecnica_codigo: f.tecnica_codigo ?? null,
    }));
    const itens = ficha.map(f => {
      const ins = insumoById.get(f.insumo_id);
      const necessario = f.quantidade * qtdLotes;
      const disponivel = Number(ins?.quantidade_atual ?? 0);
      return {
        ins,
        necessario,
        disponivel,
        ok: disponivel >= necessario,
        liquido: f.quantidade_liquida == null ? null : f.quantidade_liquida * qtdLotes,
        tecnica: f.tecnica_codigo,
      };
    });
    const custo = itens.reduce((s, it) => s + custoUnit(it.ins) * it.necessario, 0);
    const podeProduzir = itens.length > 0 && itens.every(it => it.ok);
    const rendimento = rendimentoDoLote(p) * qtdLotes;
    return { itens, custo, podeProduzir, rendimento };
  }, [p, qtdLotes, insumoById]);

  const semFicha = itens.length === 0;

  // Timer loop
  useEffect(() => {
    let interval: any;
    if (status === 'ANDAMENTO' && startTime) {
      interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status, startTime]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleIniciar = () => {
    if (semFicha) return;
    if (!podeProduzir) {
      setModalFuroAberto(true);
      return;
    }
    // A OS deixa de ser um cronometro solto e vira o Modo de Preparo: mise en
    // place conferida, roteiro passo a passo e tempo real da bancada.
    if (status !== 'ANDAMENTO') {
      setStatus('ANDAMENTO');
      setStartTime(Date.now());
      setElapsed(0);
    }
    setModoAberto(true);
  };

  const handleFinalizar = async (segundos?: number, segundosFogo?: number) => {
    setIsProduzindo(true);

    // Calcula datas
    const agora = new Date();
    const dataFab = agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR').slice(0,5);
    
    const validadeHoras = Number(p.validade_horas || 0);
    const dataValidade = validadeHoras > 0
      ? new Date(agora.getTime() + validadeHoras * 3600e3).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
      : null;
    
    const osNum = Number(agora.toTimeString().slice(0, 5).replace(':', ''));
    const tempoFormatado = formatTime(segundos ?? elapsed);

    try {
      await onProduzir(p, qtdLotes, segundos, segundosFogo);
      setDadosFinais({ dataFab, dataValidade, osNum, tempoFormatado });
      setModoAberto(false);
      setStatus('CONCLUIDA');
    } finally {
      setIsProduzindo(false);
    }
  };

  const handleImprimirEtiqueta = () => {
    if (!dadosFinais) return;
    imprimir({
      template: 'ETIQUETA_VALIDADE',
      lojaNome: loja?.nome || 'MiseOn',
      loja,
      osData: {
        numero: dadosFinais.osNum,
        preparo: p,
        quantidadeLotes: qtdLotes,
        rendimentoTotal: `${rendimento} ${p.unidade_medida}`,
        ingredientes: itens.map((it) => ({
          nome: it.ins?.nome ?? '—',
          qtd: it.necessario,
          unidade: it.ins?.unidade_medida ?? '',
          ok: it.ok,
        })),
        dataFab: dadosFinais.dataFab,
        dataValidade: dadosFinais.dataValidade,
        responsavel: 'Cozinha',
      },
    });
  };

  const handleImprimirOS = () => {
    imprimir({
      template: 'OS_PRODUCAO',
      lojaNome: loja?.nome || 'MiseOn',
      loja,
      osData: {
        numero: dadosFinais?.osNum || Number(new Date().toTimeString().slice(0, 5).replace(':', '')),
        preparo: p,
        quantidadeLotes: qtdLotes,
        rendimentoTotal: `${rendimento} ${p.unidade_medida}`,
        ingredientes: itens.map((it) => ({
          nome: it.ins?.nome ?? '—',
          qtd: it.necessario,
          unidade: it.ins?.unidade_medida ?? '',
          ok: it.ok,
        })),
      },
    });
  };

  // Se concluída, exibe painel de sucesso e emissão de etiqueta
  if (status === 'CONCLUIDA' && dadosFinais) {
    return (
      <div className="rounded-2xl border border-green-200 dark:border-green-900/40 bg-green-50 dark:bg-green-900/10 shadow-md">
        <div className="p-6 text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white mb-2 shadow-lg shadow-green-500/30">
            <Check size={24} strokeWidth={3} />
          </div>
          <div>
            <h3 className="text-xl font-black text-green-700 dark:text-green-400">{tDynamic('Produção Concluída!')}</h3>
            <p className="text-sm font-medium text-green-600/80 dark:text-green-500/80">
              {rendimento} {p.unidade_medida} de {p.nome} enviados para o estoque.
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-green-100 dark:border-green-800 text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-medium">OS / Lote:</span>
              <span className="font-bold">#{dadosFinais.osNum}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-medium">{tDynamic('Tempo de Preparo:')}</span>
              <span className="font-bold">{dadosFinais.tempoFormatado}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-medium">Fabricação:</span>
              <span className="font-bold">{dadosFinais.dataFab}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-medium">Validade:</span>
              <span className={`font-bold ${dadosFinais.dataValidade ? 'text-red-500' : 'text-gray-400'}`}>{dadosFinais.dataValidade ?? 'não controlada'}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={handleImprimirOS}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl font-bold text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <Printer size={16} /> Imprimir OS
            </button>
            <button type="button" onClick={handleImprimirEtiqueta}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-black text-sm text-white bg-green-500 shadow-lg shadow-green-500/25 hover:scale-[1.02] transition-all">
              <Printer size={16} /> Imprimir Etiqueta
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pendente ou Em andamento
  const emAndamento = status === 'ANDAMENTO';

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${
      emAndamento 
        ? 'border-blue-300 dark:border-blue-700 shadow-lg shadow-blue-500/20 bg-white dark:bg-gray-900 ring-4 ring-blue-500/10'
        : pendente
          ? 'border-orange-200 dark:border-orange-900/40 bg-white dark:bg-gray-900 shadow-md shadow-orange-500/5'
          : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900'
    }`}>
      {/* Faixa de status */}
      <div className={`flex items-center justify-between px-5 py-3 ${
        emAndamento ? 'bg-blue-600 text-white' :
        pendente ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white' : 'bg-gray-50 dark:bg-gray-800/50'
      }`}>
        <div className="flex items-center gap-2">
          {emAndamento 
            ? <Timer size={18} className="animate-pulse" />
            : pendente
              ? <AlertTriangle size={18} />
              : <CheckCircle2 size={18} className="text-green-500" />}
          <span className={`font-black text-sm uppercase tracking-wide ${!emAndamento && !pendente ? 'text-gray-500 dark:text-gray-400' : ''}`}>
            {emAndamento ? `Em Produção — ${formatTime(elapsed)}` : pendente ? 'OS Sugerida' : 'Estoque em dia'}
          </span>
        </div>
        {!emAndamento && (
          <span className={`text-xs font-bold ${pendente ? 'text-orange-50' : 'text-gray-400'}`}>
            {Number(p.quantidade_atual)} / {Number(p.estoque_minimo)} {p.unidade_medida}
          </span>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black dark:text-gray-100">{p.nome}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              1 lote = <b>{rendimentoDoLote(p)} {p.unidade_medida}</b>
            </p>
          </div>
          
          {/* Stepper de lotes (desativado se em andamento) */}
          <div className={`flex items-center gap-2 shrink-0 ${emAndamento ? 'opacity-50 pointer-events-none' : ''}`}>
            <button type="button" onClick={() => setQtdLotes(Math.max(1, qtdLotes - 1))}
              className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              <Minus size={16} />
            </button>
            <div className="text-center w-14">
              <span className="text-2xl font-black text-orange-600 dark:text-orange-500 leading-none">{qtdLotes}</span>
              <span className="block text-xs opacity-80 uppercase font-bold text-gray-400">lotes</span>
            </div>
            <button type="button" onClick={() => setQtdLotes(qtdLotes + 1)}
              className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Checklist de insumos */}
        <div className="mt-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 p-3 border border-gray-100 dark:border-gray-800">
          <p className="text-xs opacity-90 uppercase font-black text-gray-400 mb-2">{tDynamic('Checklist de Manufatura')}</p>
          {semFicha ? (
            <p className="text-xs text-gray-400 py-1">{tDynamic('Sem ficha técnica cadastrada.')}</p>
          ) : (
            <ul className="space-y-1.5">
              {itens.map((it, idx) => (
                <li key={idx} className="flex items-center justify-between text-sm">
                  {/* min-w-0 + truncate no nome e shrink-0 na quantidade: nome de
                      insumo longo espremia a coluna "necessario / disponivel" ate
                      ela quebrar em duas linhas no celular. */}
                  <span className="flex min-w-0 items-center gap-1.5">
                    {it.ok
                      ? <PackageCheck size={15} className="text-green-500 shrink-0" />
                      : <PackageX size={15} className="text-red-500 shrink-0" />}
                    <span className="truncate font-medium text-gray-700 dark:text-gray-300">{it.ins?.nome ?? '—'}</span>
                  </span>
                  <span className={`shrink-0 pl-2 font-bold tabular-nums ${it.ok ? 'text-gray-600 dark:text-gray-400' : 'text-red-500'}`}>
                    {it.necessario} / {it.disponivel} {it.ins?.unidade_medida}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 pt-3 border-t border-gray-200/70 dark:border-gray-700/50 flex items-center justify-between text-sm">
            <span className="font-bold text-gray-500 dark:text-gray-400">Renderá <span className="text-green-600">+{rendimento} {p.unidade_medida}</span></span>
            <span className="font-bold text-gray-500 dark:text-gray-400">Custo Ref: {fmt(custo)}</span>
          </div>
        </div>

        {!podeProduzir && !semFicha && (
          <div className="mt-3 flex items-start gap-2 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 p-2 rounded-lg border border-red-100 dark:border-red-900/50">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" /> 
            <p>{tDynamic('Falta matéria-prima para esta OS. O MiseOn preserva o saldo e pede uma entrada ou ajuste auditável antes de iniciar.')}</p>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {!emAndamento ? (
            <>
              <button type="button" onClick={handleImprimirOS}
                className="flex items-center justify-center px-4 py-3 rounded-xl font-bold text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                <Printer size={16} />
              </button>
              <button type="button" onClick={handleIniciar} disabled={semFicha}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-black text-sm text-white transition-all shadow-lg hover:scale-[1.02] ${
                  semFicha ? 'cursor-not-allowed bg-gray-400 shadow-none' : podeProduzir
                    ? 'bg-blue-600 shadow-blue-500/25'
                    : 'bg-red-600 shadow-red-500/25'
                }`}>
                <Play size={16} /> {semFicha ? 'Complete a ficha' : podeProduzir ? 'Iniciar Produção' : 'Estoque insuficiente'}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setModoAberto(true)} disabled={isProduzindo}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-black text-sm text-white bg-gradient-to-r from-orange-500 to-red-500 shadow-lg shadow-orange-500/25 hover:scale-[1.02] transition-all disabled:opacity-40 disabled:hover:scale-100 disabled:shadow-none">
              {isProduzindo ? <><Loader2 size={16} className="animate-spin" /> Finalizando…</> : <><Play size={16} /> {tDynamic('Retomar modo de preparo')}</>}
            </button>
          )}
        </div>
      </div>

      {modoAberto && (
        <ModoPreparo
          preparo={p}
          qtdLotes={qtdLotes}
          rendimento={rendimento}
          custo={custo}
          itens={itens}
          onConcluir={handleFinalizar}
          onFechar={() => setModoAberto(false)}
        />
      )}

      {/* MODAL DE FURO DE ESTOQUE */}
      {modalFuroAberto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 animate-in fade-in" onClick={() => setModalFuroAberto(false)}>
          {/* max-h + rolagem: a lista de itens em falta cresce com a ficha tecnica.
              Numa OS com muitos insumos faltando o botao "Entendi" saia da tela. */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md max-h-[85dvh] overflow-y-auto p-6 shadow-2xl border border-red-500/30" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-500">
              <AlertTriangle size={32} />
              <h3 className="font-black text-xl">{tDynamic('Estoque insuficiente')}</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 leading-relaxed">
              {tDynamic('O sistema aponta que a cozinha não tem insumos brutos suficientes. Na vida real, isso significa que seu')} <b>estoque físico divergiu do digital</b> (ex: uma compra de emergência não foi dada a entrada).
            </p>
            
            <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-3 mb-5 border border-red-100 dark:border-red-900/30">
              <p className="text-xs opacity-90 font-black uppercase text-red-800 dark:text-red-400 mb-2 tracking-wider">{tDynamic('Itens que precisam de reposição')}</p>
              <div className="space-y-2">
                {itens.filter(i => !i.ok).map(i => {
                  const saldoApos = Number(i.ins?.quantidade_atual) - i.necessario;
                  return (
                    <div key={i.ins?.id} className="flex justify-between items-center gap-2 text-sm">
                      <span className="min-w-0 truncate font-semibold text-gray-800 dark:text-gray-200">{i.ins?.nome}</span>
                      <span className="shrink-0 font-bold text-red-600 dark:text-red-400 tabular-nums">
                        {Number(i.ins?.quantidade_atual)} ➔ <span className="bg-red-100 dark:bg-red-900/50 px-1.5 py-0.5 rounded">{saldoApos}</span> {i.ins?.unidade_medida}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <p className="text-sm font-medium mb-6 text-gray-700 dark:text-gray-300">{tDynamic('A OS não foi iniciada. Registre a compra emergencial ou faça um ajuste de inventário auditável antes de produzir.')}</p>
            
            <div className="flex gap-3">
              <button type="button" onClick={() => setModalFuroAberto(false)} className="flex-1 py-3.5 font-black text-white bg-red-600 rounded-xl hover:bg-red-700 shadow-lg shadow-red-600/30 transition-transform hover:scale-[1.02]">
                Entendi, corrigir estoque
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// --- Main Component ---
export default function KDSProducao() {
  const { tDynamic } = useI18n();
  const { lojaId, segmento_negocio, modulos_ativos } = useOutletContext<CtxLoja>();
  const isBuffet = segmento_negocio === 'SELF_SERVICE' || modulos_ativos?.balanca === true;
  const [aba, setAba] = useState<'ordens' | 'fichas'>('ordens');
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loja, setLoja] = useState<Loja | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from('insumos')
      .select('*, fichas_preparos!fichas_preparos_preparo_id_fkey(*)')
      .eq('loja_id', lojaId)
      .order('nome');
    setInsumos((data as Insumo[]) ?? []);
    setCarregando(false);
  }, [lojaId]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    supabase.from('lojas').select('*').eq('id', lojaId).single()
      .then(({ data }) => setLoja((data as Loja) ?? null));
  }, [lojaId]);

  const preparos = useMemo(() => insumos.filter(i => i.is_preparo && i.ativo), [insumos]);
  const insumoById = useMemo(() => {
    const m = new Map<string, Insumo>();
    insumos.forEach(i => m.set(i.id, i));
    return m;
  }, [insumos]);

  const ordenados = useMemo(() => {
    return [...preparos].sort((a, b) => {
      const fa = Number(a.quantidade_atual) - Number(a.estoque_minimo);
      const fb = Number(b.quantidade_atual) - Number(b.estoque_minimo);
      return fa - fb;
    });
  }, [preparos]);

  const pendentes = ordenados.filter(p => Number(p.quantidade_atual) < Number(p.estoque_minimo));
  const emDia = ordenados.filter(p => Number(p.quantidade_atual) >= Number(p.estoque_minimo));

  const handleProduzir = async (p: Insumo, qtdLotes: number, segundos?: number, segundosFogo?: number) => {
    try {
      // A OS inteira e uma unica transacao no banco: consumo PEPS, entrada do
      // resultado, custo e lote de producao caminham juntos ou nada muda.
      const { error } = await supabase.rpc('fn_produzir_preparo', {
        p_preparo_id: p.id,
        p_multiplicador: qtdLotes,
        p_segundos_totais: segundos ?? null,
        p_segundos_fogo: segundosFogo ?? null,
      });
      if (error) throw error;

      await carregar();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Erro ao registrar a produção no banco de dados.');
      throw e;
    }
  };

  return (
    <div className="print:hidden p-4 sm:p-6 pb-24 animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-6xl mx-auto">
      <div data-tour="tour-producao-header" className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-orange-950 to-orange-700 rounded-3xl p-6 text-white mb-5 shadow-xl shadow-orange-500/15 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-orange-400/20 blur-3xl" />
        <div className="flex items-center gap-4">
          <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm ring-1 ring-white/15"><ChefHat size={32} /></div>
          <div>
            <p className="mb-1 text-xs font-black uppercase tracking-[0.18em] text-orange-300">{tDynamic('Central operacional')}</p>
            <h2 className="text-2xl font-black">{tDynamic('Produção & Manipulações')}</h2>
            <p className="text-orange-100/80 text-sm mt-1 font-medium max-w-2xl">
              {tDynamic('Da matéria-prima ao item pronto: ficha, ordem de produção, tempo, custo PEPS, validade e etiqueta no mesmo fluxo.')}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1.5 shadow-inner dark:bg-gray-800">
        <button type="button" onClick={() => setAba('ordens')} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition-all ${aba === 'ordens' ? 'bg-white text-orange-600 shadow-md dark:bg-gray-900 dark:text-orange-400' : 'text-gray-500'}`}><Flame size={17}/> {tDynamic('Ordens & bancada')}</button>
        <button type="button" data-tour="tour-producao-aba-fichas" onClick={() => setAba('fichas')} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition-all ${aba === 'fichas' ? 'bg-white text-orange-600 shadow-md dark:bg-gray-900 dark:text-orange-400' : 'text-gray-500'}`}><ClipboardList size={17}/> {tDynamic('Fichas & manipulações')}</button>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-20">
          <MiseOnLoader status="Carregando ordens de produção..." rows={2} />
        </div>
      ) : aba === 'fichas' ? (
        <EstoquePreparos lojaId={lojaId} insumosTotais={insumos} onUpdate={carregar} isBuffet={isBuffet} somenteCadastro />
      ) : preparos.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
          <ClipboardList size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-semibold">{tDynamic('Nenhum preparo cadastrado ainda.')}</p>
          <p className="text-sm mt-1">{tDynamic('Crie uma ficha de manipulação para gerar ordens de produção.')}</p>
          <button type="button" onClick={() => setAba('fichas')} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-500/20 hover:bg-orange-600"><Plus size={16}/> {tDynamic('Criar primeira ficha')}</button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Fila de Ordens de Serviço Críticas */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-orange-500 text-white text-xs font-black">{pendentes.length}</span>
              <h3 className="font-black text-xl text-gray-800 dark:text-gray-100">{tDynamic('Ordens Críticas Pendentes')}</h3>
            </div>
            
            {pendentes.length === 0 ? (
              <div className="rounded-2xl border border-green-200 dark:border-green-900/30 bg-green-50 dark:bg-green-900/10 p-6 flex items-center gap-4">
                <div className="bg-green-100 dark:bg-green-800/50 p-3 rounded-full text-green-500">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <p className="font-black text-lg text-green-700 dark:text-green-400">Cozinha 100% abastecida!</p>
                  <p className="text-sm font-medium text-green-600/80 dark:text-green-500/80 mt-0.5">{tDynamic('Todos os preparos e molhos estão com saldo superior à margem de segurança configurada.')}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                {pendentes.map(p => (
                  <OSCard 
                    key={p.id} p={p} pendente={true} 
                    loja={loja} insumoById={insumoById} onProduzir={handleProduzir} 
                  />
                ))}
              </div>
            )}
          </div>

          {/* Produção Sob Demanda */}
          {emDia.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4 pt-6 border-t border-gray-100 dark:border-gray-800">
                <Sparkles size={18} className="text-gray-400" />
                <h3 className="font-black text-lg text-gray-400 dark:text-gray-500">Produzir Lotes Extras (Sob Demanda)</h3>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                {emDia.map(p => (
                  <OSCard 
                    key={p.id} p={p} pendente={false} 
                    loja={loja} insumoById={insumoById} onProduzir={handleProduzir} 
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

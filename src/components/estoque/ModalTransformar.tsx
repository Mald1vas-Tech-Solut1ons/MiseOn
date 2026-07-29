/**
 * Monta e desmonta.
 *
 * DESMONTE é a operação que falta na maioria dos sistemas de food service:
 * compra-se o frango inteiro e usa-se peito, coxa e carcaça — três itens com
 * preço, ficha e giro diferentes. Sem isso, ou o lojista lança tudo à mão (e o
 * custo vira chute), ou finge que o frango é um insumo só (e a ficha mente).
 *
 * A regra que a tela torna visível: o custo que SAI da origem, apurado pelo
 * PEPS dos lotes reais, é exatamente o que se distribui entre os destinos. O
 * peso existe porque 1 kg de filé não vale o que vale 1 kg de carcaça.
 */

import { useEffect, useMemo, useState } from 'react';
import { X, Loader2, Scissors, Package, Plus, Trash2, AlertTriangle, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Insumo, fmt } from '../../types';
import SeletorQuantidade from './SeletorQuantidade';
import { ValorQuantidade, fatorDe, qtdBase, valorInicial } from '../../lib/conversaoEntrada';
import { transformarEstoque, LadoTransformacao } from '../../lib/compras';

interface Props {
  lojaId: string;
  insumos: Insumo[];
  /** Insumo que abriu o modal — vira a origem do desmonte. */
  inicial?: Insumo | null;
  onFechar: () => void;
  onSucesso: (msg: string) => void;
}

interface Linha {
  key: string;
  insumoId: string;
  valor: ValorQuantidade;
  peso: string;
}

export default function ModalTransformar({ lojaId, insumos, inicial, onFechar, onSucesso }: Props) {
  const [tipo, setTipo] = useState<'DESMONTE' | 'MONTAGEM'>('DESMONTE');
  const [custos, setCustos] = useState<Record<string, number>>({});
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const porId = useMemo(() => new Map(insumos.map(i => [i.id, i])), [insumos]);
  const primeiro = inicial ?? insumos[0];

  const novaLinha = (insumoId: string): Linha => {
    const ins = porId.get(insumoId);
    return {
      key: Math.random().toString(36).slice(2),
      insumoId,
      valor: ins ? valorInicial(ins) : { qtd: '', unidade: 'un', fatorNovo: '' },
      peso: '',
    };
  };

  const [origens, setOrigens] = useState<Linha[]>(() => primeiro ? [novaLinha(primeiro.id)] : []);
  const [destinos, setDestinos] = useState<Linha[]>(() => {
    const outro = insumos.find(i => i.id !== primeiro?.id);
    return outro ? [novaLinha(outro.id)] : [];
  });

  // Custo médio dos lotes vivos: é o valor que o PEPS realmente vai consumir,
  // não o preço da última compra que está no cadastro.
  useEffect(() => {
    supabase.from('vw_insumo_giro').select('insumo_id, custo_unitario').eq('loja_id', lojaId)
      .then(({ data }) => {
        const mapa: Record<string, number> = {};
        for (const r of (data ?? []) as { insumo_id: string; custo_unitario: number }[]) {
          mapa[r.insumo_id] = Number(r.custo_unitario) || 0;
        }
        setCustos(mapa);
      });
  }, [lojaId]);

  const alvoDe = (l: Linha) => {
    const i = porId.get(l.insumoId);
    return { unidade_medida: i?.unidade_medida ?? 'un', detalhes_rendimento: i?.detalhes_rendimento };
  };

  const custoEstimado = origens.reduce((acc, l) => {
    const base = qtdBase(alvoDe(l), l.valor);
    return acc + base * (custos[l.insumoId] ?? 0);
  }, 0);

  const pesoTotal = destinos.reduce((acc, l) => {
    const base = qtdBase(alvoDe(l), l.valor);
    return acc + (Number(l.peso) || base);
  }, 0);

  const atualizar = (lado: 'o' | 'd', key: string, patch: Partial<Linha>) => {
    const set = lado === 'o' ? setOrigens : setDestinos;
    set(ls => ls.map(l => {
      if (l.key !== key) return l;
      const proximo = { ...l, ...patch };
      // Trocar o insumo troca a unidade-base: recomeçar a conversão evita
      // herdar um fator que era do item anterior.
      if (patch.insumoId && patch.insumoId !== l.insumoId) {
        const ins = porId.get(patch.insumoId);
        proximo.valor = ins ? valorInicial(ins, l.valor.qtd) : l.valor;
      }
      return proximo;
    }));
  };

  const remover = (lado: 'o' | 'd', key: string) =>
    (lado === 'o' ? setOrigens : setDestinos)(ls => ls.filter(l => l.key !== key));

  const montarPayload = (linhas: Linha[], comPeso: boolean): LadoTransformacao[] | string => {
    const saida: LadoTransformacao[] = [];
    for (const l of linhas) {
      const alvo = alvoDe(l);
      const fator = fatorDe(alvo, l.valor);
      const nome = porId.get(l.insumoId)?.nome ?? 'item';
      if (!(Number(l.valor.qtd) > 0)) return `Informe a quantidade de "${nome}".`;
      if (fator <= 0) return `Informe quanto 1 ${l.valor.unidade} rende em ${alvo.unidade_medida} para "${nome}".`;
      saida.push({
        insumo_id: l.insumoId,
        qtd: Number(l.valor.qtd),
        unidade: l.valor.unidade,
        fator,
        ...(comPeso && Number(l.peso) > 0 ? { peso: Number(l.peso) } : {}),
      });
    }
    return saida;
  };

  const confirmar = async () => {
    setErro(null);
    if (origens.length === 0 || destinos.length === 0) {
      setErro('Precisa de pelo menos uma origem e um destino.');
      return;
    }
    const o = montarPayload(origens, false);
    if (typeof o === 'string') return setErro(o);
    const d = montarPayload(destinos, true);
    if (typeof d === 'string') return setErro(d);

    const conflito = o.find(x => d.some(y => y.insumo_id === x.insumo_id));
    if (conflito) {
      setErro(`"${porId.get(conflito.insumo_id)?.nome}" está na origem e no destino — isso não transforma nada.`);
      return;
    }

    setSalvando(true);
    try {
      const r = await transformarEstoque(lojaId, tipo, o, d, obs || undefined);
      onSucesso(
        `${tipo === 'DESMONTE' ? 'Desmonte' : 'Montagem'} registrado: ${fmt(r.custo_consumido)} ` +
        `distribuídos entre ${r.destinos} ${r.destinos === 1 ? 'item' : 'itens'}.`,
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível registrar a transformação.');
    } finally {
      setSalvando(false);
    }
  };

  const renderLado = (lado: 'o' | 'd', linhas: Linha[]) => (
    <div className="space-y-2">
      {linhas.map(l => {
        const alvo = alvoDe(l);
        const ins = porId.get(l.insumoId);
        const base = qtdBase(alvo, l.valor);
        const peso = Number(l.peso) || base;
        const fatia = lado === 'd' && pesoTotal > 0 ? (peso / pesoTotal) : 0;
        const saldo = Number(ins?.quantidade_atual) || 0;
        const semSaldo = lado === 'o' && base > saldo;

        return (
          <div key={l.key} className={`rounded-xl border p-3 ${semSaldo ? 'border-red-300 dark:border-red-800/60' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-900`}>
            <div className="mb-2 flex items-center gap-2">
              <select value={l.insumoId} onChange={e => atualizar(lado, l.key, { insumoId: e.target.value })}
                className="min-w-0 flex-1 rounded-lg border border-gray-300 p-2 text-sm focus:border-[var(--cor-primaria)] focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                {insumos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
              </select>
              {linhas.length > 1 && (
                <button onClick={() => remover(lado, l.key)}
                  className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">
                  <Trash2 size={15} />
                </button>
              )}
            </div>

            <div className={lado === 'd' ? 'grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]' : ''}>
              <SeletorQuantidade alvo={alvo} valor={l.valor}
                onChange={v => atualizar(lado, l.key, { valor: v })} />
              {lado === 'd' && (
                <label className="block sm:w-28">
                  <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">Peso do custo</span>
                  <input type="number" min="0" step="any" placeholder="auto"
                    className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    value={l.peso} onChange={e => atualizar(lado, l.key, { peso: e.target.value })} />
                </label>
              )}
            </div>

            {lado === 'o' && (
              <p className={`mt-1.5 text-[10px] ${semSaldo ? 'font-bold text-red-500' : 'text-gray-400'}`}>
                {semSaldo
                  ? `Só tem ${saldo.toLocaleString('pt-BR')} ${alvo.unidade_medida} em estoque`
                  : `Estoque: ${saldo.toLocaleString('pt-BR')} ${alvo.unidade_medida} · consome ${fmt(base * (custos[l.insumoId] ?? 0))}`}
              </p>
            )}
            {lado === 'd' && base > 0 && custoEstimado > 0 && (
              <p className="mt-1.5 text-[10px] text-gray-400">
                Fica com <b className="text-emerald-600 dark:text-emerald-400">{fmt(custoEstimado * fatia)}</b>
                {' '}({(fatia * 100).toFixed(0)}%) · {fmt((custoEstimado * fatia) / base)} por {alvo.unidade_medida}
              </p>
            )}
          </div>
        );
      })}

      <button onClick={() => (lado === 'o' ? setOrigens : setDestinos)(ls => [...ls, novaLinha(insumos[0]?.id ?? '')])}
        className="flex items-center gap-1 text-[11px] font-bold text-blue-600 transition-colors hover:underline dark:text-blue-400">
        <Plus size={12} /> Adicionar {lado === 'o' ? 'origem' : 'destino'}
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onFechar}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-2xl dark:border-gray-800 dark:bg-gray-950" onClick={e => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black text-gray-900 dark:text-gray-100">
              {tipo === 'DESMONTE' ? <Scissors size={18} className="text-orange-500" /> : <Package size={18} className="text-blue-500" />}
              {tipo === 'DESMONTE' ? 'Desmontar insumo' : 'Montar insumo'}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {tipo === 'DESMONTE'
                ? 'Um item vira vários — o custo segue junto, rateado.'
                : 'Vários itens viram um — o custo se soma no resultado.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
              <button onClick={() => setTipo('DESMONTE')}
                className={`rounded px-3 py-1.5 text-xs font-bold transition-colors ${tipo === 'DESMONTE' ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100' : 'text-gray-500'}`}>
                Desmontar
              </button>
              <button onClick={() => setTipo('MONTAGEM')}
                className={`rounded px-3 py-1.5 text-xs font-bold transition-colors ${tipo === 'MONTAGEM' ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100' : 'text-gray-500'}`}>
                Montar
              </button>
            </div>
            <button onClick={onFechar} className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6 hide-scrollbar">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
              Sai do estoque
            </p>
            {renderLado('o', origens)}
          </div>

          <div className="flex items-center justify-center gap-2 text-gray-300 dark:text-gray-700">
            <div className="h-px flex-1 bg-current" />
            <ArrowRight size={18} />
            <div className="h-px flex-1 bg-current" />
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Entra no estoque
            </p>
            {renderLado('d', destinos)}
            <p className="mt-2 text-[10px] text-gray-400">
              O <b>peso do custo</b> distribui o valor entre as partes. Deixe em branco para ratear pela
              quantidade — use quando as partes valem o mesmo por unidade.
            </p>
          </div>

          <label className="block">
            <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Observação</span>
            <input placeholder="Ex: desossa da manhã"
              className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-[var(--cor-primaria)] focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              value={obs} onChange={e => setObs(e.target.value)} />
          </label>

          {erro && (
            <p className="flex items-start gap-1.5 rounded-lg bg-red-50 p-2 text-xs font-medium text-red-600 dark:bg-red-900/20 dark:text-red-400">
              <AlertTriangle size={14} className="mt-px shrink-0" /> {erro}
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-100 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Custo que muda de lugar</p>
              <p className="text-2xl font-black text-gray-900 dark:text-gray-100">{fmt(custoEstimado)}</p>
              <p className="text-[10px] text-gray-400">estimado — o valor final vem do PEPS dos lotes</p>
            </div>
            <button onClick={confirmar} disabled={salvando}
              className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--cor-primaria)] px-8 py-3.5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100">
              {salvando ? <><Loader2 size={16} className="animate-spin" /> Registrando...</>
                        : <>{tipo === 'DESMONTE' ? <Scissors size={16} /> : <Package size={16} />} Confirmar</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

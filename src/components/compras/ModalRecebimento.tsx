/**
 * Conferência de recebimento.
 *
 * A tela é desenhada em torno de uma pergunta: o que EU PEDI e o que DE FATO
 * CHEGOU? Por isso cada item mostra o pedido congelado à esquerda e os campos
 * do que chegou à direita — e a divergência entre os dois aparece na hora, sem
 * julgamento. Veio menos, veio de outra marca, veio outro produto, veio mais
 * caro: tudo é fato registrável, nada é erro bloqueado.
 *
 * O salvamento inteiro roda numa RPC transacional; se algo falhar, nada entra.
 */

import { useEffect, useMemo, useState } from 'react';
import { X, Loader2, PackageCheck, AlertTriangle, Ban, RotateCcw, Info, Barcode, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fmt, Insumo } from '../../types';
import MiseOnLoader from '../MiseOnLoader';
import SeletorQuantidade from '../estoque/SeletorQuantidade';
import { ValorQuantidade, fatorDe, qtdBase, valorInicial } from '../../lib/conversaoEntrada';
import { useI18n } from '../../contexts/I18nContext';
import {
  CompraItem, CompraResumo, ItemRecebimento, carregarItens, receberCompra,
} from '../../lib/compras';

interface Props {
  compra: CompraResumo;
  insumos: Insumo[];
  onFechar: () => void;
  onSucesso: (msg: string) => void;
}

interface Conferencia {
  valor: ValorQuantidade;
  preco: string;
  marca: string;
  lote: string;
  vence: string;
  naoVeio: boolean;
  substituto: string;
  gtin: string;
}

type StatusNutricao = 'ocioso' | 'buscando' | 'encontrado' | 'nao_encontrado';

export default function ModalRecebimento({ compra, insumos, onFechar, onSucesso }: Props) {
  const { tDynamic } = useI18n();
  const [itens, setItens] = useState<CompraItem[]>([]);
  const [conf, setConf] = useState<Record<string, Conferencia>>({});
  const [nota, setNota] = useState(compra.numero_nota ?? '');
  const [dataReceb, setDataReceb] = useState(new Date().toISOString().slice(0, 10));
  const [frete, setFrete] = useState(String(compra.frete || ''));
  const [desconto, setDesconto] = useState(String(compra.desconto || ''));
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // NUT-09: captura de GTIN na conferência — a nutrição chega junto do
  // recebimento, sem o lojista perceber que fez trabalho de cadastro nutricional.
  const [statusNutricao, setStatusNutricao] = useState<Record<string, StatusNutricao>>({});

  const porId = useMemo(() => new Map(insumos.map(i => [i.id, i])), [insumos]);

  useEffect(() => {
    let vivo = true;
    carregarItens(compra.id).then(lista => {
      if (!vivo) return;
      setItens(lista);
      // Pré-preenche com o que foi pedido: o caso comum é a entrega bater, e
      // conferir deve custar um olhar, não uma redigitação.
      const inicial: Record<string, Conferencia> = {};
      for (const it of lista) {
        inicial[it.id] = {
          valor: {
            qtd: String(it.qtd_pedida),
            unidade: it.unidade_pedida,
            fatorNovo: String(it.fator_pedida),
          },
          preco: it.preco_unitario_previsto
            ? String(Number(it.preco_unitario_previsto) * Number(it.qtd_pedida))
            : '',
          marca: it.marca ?? '',
          lote: it.lote_fornecedor ?? '',
          vence: it.vence_em ?? '',
          naoVeio: false,
          substituto: '',
          gtin: porId.get(it.insumo_id)?.gtin ?? '',
        };
      }
      setConf(inicial);
      setCarregando(false);
    }).catch(e => { if (vivo) { setErro(e.message); setCarregando(false); } });
    return () => { vivo = false; };
  }, [compra.id, porId]);

  const alvoDe = (it: CompraItem, c?: Conferencia) => {
    const subst = c?.substituto ? porId.get(c.substituto) : undefined;
    const ins = subst ?? porId.get(it.insumo_id);
    return {
      unidade_medida: ins?.unidade_medida ?? it.unidade_pedida,
      detalhes_rendimento: ins?.detalhes_rendimento,
    };
  };

  const totalPago = itens.reduce((acc, it) => {
    const c = conf[it.id];
    if (!c || c.naoVeio) return acc;
    return acc + (Number(c.preco) || 0);
  }, 0) + (Number(frete) || 0) - (Number(desconto) || 0);

  const totalPrevisto = Number(compra.total_previsto) || 0;
  const diferenca = totalPago - totalPrevisto;

  const atualizar = (id: string, patch: Partial<Conferencia>) =>
    setConf(c => ({ ...c, [id]: { ...c[id], ...patch } }));

  /**
   * NUT-09: ao digitar/escanear o código de barras na conferência, o insumo
   * aprende o GTIN (se ainda não tinha) e a nutrição é buscada em segundo
   * plano — o lojista só está conferindo a compra, não sabe que também
   * cadastrou nutrição (§5.1 ① do PLANO-NUTRICIONAL).
   */
  const aprenderGtin = async (itemId: string, insumoId: string, gtinDigitado: string) => {
    const gtinLimpo = gtinDigitado.replace(/\D/g, '');
    if (gtinLimpo.length < 8) return;
    if (porId.get(insumoId)?.gtin === gtinLimpo) return; // já sabíamos, nada a fazer

    setStatusNutricao(s => ({ ...s, [itemId]: 'buscando' }));
    const { data, error } = await supabase.functions.invoke('nutricao-ean', {
      body: { insumo_id: insumoId, gtin: gtinLimpo },
    });
    setStatusNutricao(s => ({ ...s, [itemId]: (!error && data?.encontrado) ? 'encontrado' : 'nao_encontrado' }));
  };

  const confirmar = async () => {
    setErro(null);
    const payload: ItemRecebimento[] = [];

    for (const it of itens) {
      const c = conf[it.id];
      if (!c) continue;
      if (c.naoVeio) {
        payload.push({ item_id: it.id, qtd: 0, unidade: it.unidade_pedida, fator: it.fator_pedida });
        continue;
      }
      const alvo = alvoDe(it, c);
      const fator = fatorDe(alvo, c.valor);
      const nome = porId.get(it.insumo_id)?.nome ?? 'item';
      if (Number(c.valor.qtd) > 0 && fator <= 0) {
        setErro(`Informe quanto 1 ${c.valor.unidade} rende em ${alvo.unidade_medida} para "${nome}".`);
        return;
      }
      payload.push({
        item_id: it.id,
        qtd: Number(c.valor.qtd) || 0,
        unidade: c.valor.unidade,
        fator,
        preco_total: Number(c.preco) || null,
        marca: c.marca || null,
        lote: c.lote || null,
        vence_em: c.vence || null,
        insumo_recebido_id: c.substituto || null,
      });
    }

    setSalvando(true);
    try {
      const r = await receberCompra(compra.id, payload, {
        numero_nota: nota || null,
        recebido_em: new Date(dataReceb + 'T12:00:00').toISOString(),
        frete: Number(frete) || 0,
        desconto: Number(desconto) || 0,
      });
      onSucesso(
        `${r.itens_recebidos} ${r.itens_recebidos === 1 ? 'item entrou' : 'itens entraram'} no estoque` +
        (r.itens_divergentes > 0 ? ` · ${r.itens_divergentes} com divergência` : '') +
        (r.itens_pendentes > 0 ? ` · ${r.itens_pendentes} ainda a chegar` : ''),
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível registrar o recebimento.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onFechar}>
      <div className="flex w-full max-w-4xl max-h-[92vh] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-2xl dark:border-gray-800 dark:bg-gray-950" onClick={e => e.stopPropagation()}>

        <div className="shrink-0 border-b border-gray-100 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black text-gray-900 dark:text-gray-100">
                <PackageCheck size={20} className="text-emerald-500" /> Conferir Recebimento
              </h2>
              <p className="mt-0.5 text-xs font-medium text-gray-500">
                {compra.fornecedor_nome ?? 'Sem fornecedor'} · pedido de{' '}
                {new Date(compra.data_pedido + 'T12:00:00').toLocaleDateString('pt-BR')}
              </p>
            </div>
            <button onClick={onFechar} className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800">
              <X size={20} />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="block">
              <span className="text-xs opacity-95 font-semibold text-gray-600 dark:text-gray-400">Nota fiscal</span>
              <input className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-[var(--cor-primaria)] focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                placeholder="Ex: 12345" value={nota} onChange={e => setNota(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs opacity-95 font-semibold text-gray-600 dark:text-gray-400">{tDynamic('Data da entrega')}</span>
              <input type="date" className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-[var(--cor-primaria)] focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                value={dataReceb} onChange={e => setDataReceb(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs opacity-95 font-semibold text-gray-600 dark:text-gray-400">Frete R$</span>
              <input type="number" step="any" className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-[var(--cor-primaria)] focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                placeholder="0,00" value={frete} onChange={e => setFrete(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs opacity-95 font-semibold text-gray-600 dark:text-gray-400">Desconto R$</span>
              <input type="number" step="any" className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-[var(--cor-primaria)] focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                placeholder="0,00" value={desconto} onChange={e => setDesconto(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4 hide-scrollbar sm:p-6">
          {carregando ? (
            <div className="flex h-48 items-center justify-center"><MiseOnLoader status="Abrindo o pedido..." rows={2} /></div>
          ) : itens.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">{tDynamic('Este pedido não tem itens.')}</p>
          ) : itens.map(it => {
            const c = conf[it.id];
            if (!c) return null;
            const insumo = porId.get(it.insumo_id);
            const alvo = alvoDe(it, c);
            const base = qtdBase(alvo, c.valor);
            const basePedida = Number(it.qtd_pedida) * Number(it.fator_pedida);
            const falta = !c.naoVeio && base > 0 && base < basePedida * 0.999;
            const sobra = !c.naoVeio && base > basePedida * 1.001;
            const precoPrevisto = Number(it.preco_unitario_previsto) * Number(it.qtd_pedida);
            const caro = Number(c.preco) > 0 && precoPrevisto > 0 && Number(c.preco) > precoPrevisto * 1.05;

            return (
              <div key={it.id} className={`rounded-2xl border bg-white p-4 shadow-sm transition-colors dark:bg-gray-900 ${
                c.naoVeio ? 'border-red-200 opacity-60 dark:border-red-900/40'
                : falta ? 'border-amber-300 dark:border-amber-700/50'
                : 'border-gray-100 dark:border-gray-800'}`}>

                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{insumo?.nome ?? 'Insumo'}</p>
                    <p className="mt-0.5 text-xs opacity-95 text-gray-500 dark:text-gray-400">
                      Pedido: <b>{Number(it.qtd_pedida).toLocaleString('pt-BR')} {it.unidade_pedida}</b>
                      {it.preco_unitario_previsto ? ` · previsto ${fmt(precoPrevisto)}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => atualizar(it.id, { naoVeio: !c.naoVeio })}
                    className={`flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs opacity-95 font-bold transition-colors ${
                      c.naoVeio
                        ? 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400'
                        : 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-900/20'}`}>
                    {c.naoVeio ? <><RotateCcw size={12} /> Desfazer</> : <><Ban size={12} /> Não veio</>}
                  </button>
                </div>

                {!c.naoVeio && (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <span className="mb-1 block text-xs opacity-95 font-semibold text-gray-600 dark:text-gray-400">Chegou</span>
                        <SeletorQuantidade
                          alvo={alvo} valor={c.valor}
                          onChange={v => atualizar(it.id, { valor: v })}
                        />
                      </div>
                      <label className="block">
                        <span className="mb-1 block text-xs opacity-95 font-semibold text-gray-600 dark:text-gray-400">Total pago R$</span>
                        <input type="number" step="any" placeholder="0,00"
                          className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-[var(--cor-primaria)] focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                          value={c.preco} onChange={e => atualizar(it.id, { preco: e.target.value })} />
                        {Number(c.preco) > 0 && base > 0 && (
                          <span className="mt-1 block text-xs opacity-90 text-gray-500 dark:text-gray-400">
                            {fmt(Number(c.preco) / base)} por {alvo.unidade_medida}
                          </span>
                        )}
                      </label>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <label className="block">
                        <span className="mb-1 block text-xs opacity-95 font-semibold text-gray-600 dark:text-gray-400">Marca</span>
                        <input placeholder="Ex: Sadia"
                          className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-[var(--cor-primaria)] focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                          value={c.marca} onChange={e => atualizar(it.id, { marca: e.target.value })} />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs opacity-95 font-semibold text-gray-600 dark:text-gray-400">Lote</span>
                        <input placeholder="Opcional"
                          className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-[var(--cor-primaria)] focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                          value={c.lote} onChange={e => atualizar(it.id, { lote: e.target.value })} />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs opacity-95 font-semibold text-gray-600 dark:text-gray-400">Validade</span>
                        <input type="date"
                          className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-[var(--cor-primaria)] focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                          value={c.vence} onChange={e => atualizar(it.id, { vence: e.target.value })} />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs opacity-95 font-semibold text-gray-600 dark:text-gray-400">Veio outro item?</span>
                        <select
                          className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-[var(--cor-primaria)] focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                          value={c.substituto}
                          onChange={e => {
                            const novo = e.target.value;
                            const ins = novo ? porId.get(novo) : porId.get(it.insumo_id);
                            // Trocar o insumo troca a unidade-base: recomeçar a
                            // conversão evita herdar um fator do item anterior.
                            atualizar(it.id, {
                              substituto: novo,
                              valor: ins ? valorInicial(ins, c.valor.qtd) : c.valor,
                            });
                          }}>
                          <option value="">{tDynamic('Não, veio o pedido')}</option>
                          {insumos.filter(i => i.id !== it.insumo_id && !i.is_preparo).map(i => (
                            <option key={i.id} value={i.id}>{i.nome}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="mt-3">
                      <label className="block max-w-xs">
                        <span className="mb-1 flex items-center gap-1 text-xs opacity-95 font-semibold text-gray-600 dark:text-gray-400">
                          <Barcode size={12} /> {tDynamic('Código de barras (opcional)')}
                        </span>
                        <input placeholder="Escaneie ou digite o EAN"
                          inputMode="numeric"
                          className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-[var(--cor-primaria)] focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                          value={c.gtin}
                          onChange={e => atualizar(it.id, { gtin: e.target.value })}
                          onBlur={() => aprenderGtin(it.id, c.substituto || it.insumo_id, c.gtin)}
                        />
                      </label>
                      {statusNutricao[it.id] === 'buscando' && (
                        <p className="mt-1 text-xs opacity-90 text-gray-400">{tDynamic('Buscando informação nutricional…')}</p>
                      )}
                      {statusNutricao[it.id] === 'encontrado' && (
                        <p className="mt-1 flex items-center gap-1 text-xs opacity-90 font-semibold text-emerald-600 dark:text-emerald-400">
                          <Sparkles size={11} /> {tDynamic('Nutrição encontrada — revise em Estoque › Nutrição')}
                        </p>
                      )}
                      {statusNutricao[it.id] === 'nao_encontrado' && (
                        <p className="mt-1 text-xs opacity-90 text-gray-400">{tDynamic('Sem nutrição na base para este código — dá para fotografar o rótulo depois.')}</p>
                      )}
                    </div>

                    {(falta || sobra || caro) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {falta && (
                          <span className="flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs opacity-90 font-bold text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                            <AlertTriangle size={11} /> Veio {(100 - (base / basePedida) * 100).toFixed(0)}% menos que o pedido
                          </span>
                        )}
                        {sobra && (
                          <span className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs opacity-90 font-bold text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                            <Info size={11} /> {tDynamic('Veio acima do pedido')}
                          </span>
                        )}
                        {caro && (
                          <span className="flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-xs opacity-90 font-bold text-red-700 dark:bg-red-900/20 dark:text-red-400">
                            <AlertTriangle size={11} /> {((Number(c.preco) / precoPrevisto - 1) * 100).toFixed(0)}% mais caro que o previsto
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="shrink-0 border-t border-gray-100 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
          {erro && (
            <p className="mb-3 flex items-start gap-1.5 rounded-lg bg-red-50 p-2 text-xs font-medium text-red-600 dark:bg-red-900/20 dark:text-red-400">
              <AlertTriangle size={14} className="mt-px shrink-0" /> {erro}
            </p>
          )}
          <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex gap-6">
              <div>
                <p className="text-xs opacity-90 font-bold uppercase tracking-wider text-gray-400">Previsto</p>
                <p className="text-sm font-bold text-gray-500 dark:text-gray-400">{fmt(totalPrevisto)}</p>
              </div>
              <div>
                <p className="text-xs opacity-90 font-bold uppercase tracking-wider text-gray-400">Pago</p>
                <p className="text-2xl font-black text-gray-900 dark:text-gray-100">{fmt(totalPago)}</p>
              </div>
              {Math.abs(diferenca) > 0.01 && totalPrevisto > 0 && (
                <div>
                  <p className="text-xs opacity-90 font-bold uppercase tracking-wider text-gray-400">Diferença</p>
                  <p className={`text-sm font-bold ${diferenca > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                    {diferenca > 0 ? '+' : ''}{fmt(diferenca)}
                  </p>
                </div>
              )}
            </div>
            <button onClick={confirmar} disabled={salvando || carregando}
              className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--cor-primaria)] px-8 py-3.5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100">
              {salvando ? <><Loader2 size={16} className="animate-spin" /> Registrando...</> : <><PackageCheck size={16} /> {tDynamic('Dar entrada no estoque')}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

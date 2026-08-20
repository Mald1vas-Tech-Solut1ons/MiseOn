/**
 * Inventário — a contagem física ganha da planilha.
 *
 * O ponto que faltava: contar na unidade em que o item ESTÁ NA PRATELEIRA.
 * Ninguém conta 540 dentes de alho; conta 3 cabeças. O sistema converte, apura
 * a diferença e a precifica — sobra abre lote novo, falta consome PEPS e vira
 * custo, para que "sumiu" tenha um valor em reais e não só um susto.
 *
 * Só os itens preenchidos são ajustados: inventário parcial (uma prateleira,
 * uma categoria) é o que de fato acontece na operação.
 */

import { useMemo, useState } from 'react';
import { X, Loader2, ClipboardCheck, Search, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Insumo, fmt } from '../../types';
import SeletorQuantidade from './SeletorQuantidade';
import { ValorQuantidade, fatorDe, qtdBase, valorInicial } from '../../lib/conversaoEntrada';
import { ajustarInventario } from '../../lib/compras';

import { useI18n } from '../../contexts/I18nContext';
interface Props {
  insumos: Insumo[];
  onFechar: () => void;
  onSucesso: (msg: string) => void;
}

export default function ModalInventario({ insumos, onFechar, onSucesso }: Props) {
  const { tDynamic } = useI18n();
  const [busca, setBusca] = useState('');
  const [contagem, setContagem] = useState<Record<string, ValorQuantidade>>({});
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const norm = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const lista = useMemo(() => {
    const t = norm(busca.trim());
    return insumos.filter(i => !i.is_preparo && (!t || norm(i.nome).includes(t)));
  }, [insumos, busca]);

  // Só entra no lote quem foi contado — deixar em branco significa "não contei",
  // e não "tem zero". A diferença entre as duas coisas é o estoque inteiro.
  const preenchidos = Object.entries(contagem).filter(([, v]) => v.qtd !== '' && Number(v.qtd) >= 0);

  const valorOf = (i: Insumo) => contagem[i.id] ?? valorInicial(i);

  const aplicar = async () => {
    if (preenchidos.length === 0 || salvando) return;
    setErro(null);
    setSalvando(true);
    let ajustados = 0, iguais = 0;
    try {
      for (const [insumoId, valor] of preenchidos) {
        const insumo = insumos.find(i => i.id === insumoId);
        if (!insumo) continue;
        const fator = fatorDe(insumo, valor);
        if (fator <= 0) {
          setErro(`Informe quanto 1 ${valor.unidade} rende em ${insumo.unidade_medida} para "${insumo.nome}".`);
          setSalvando(false);
          return;
        }
        const r = await ajustarInventario(insumoId, Number(valor.qtd), valor.unidade, fator, obs || undefined);
        if (Math.abs(Number(r.diferenca)) > 0) ajustados++; else iguais++;
      }
      onSucesso(
        `Inventário aplicado: ${ajustados} ${ajustados === 1 ? 'item ajustado' : 'itens ajustados'}` +
        (iguais > 0 ? `, ${iguais} já ${iguais === 1 ? 'batia' : 'batiam'} com o sistema` : '') + '.',
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível aplicar a contagem.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onFechar}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-2xl dark:border-gray-800 dark:bg-gray-950" onClick={e => e.stopPropagation()}>
        <div className="shrink-0 border-b border-gray-100 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-black text-gray-900 dark:text-gray-100">
                <ClipboardCheck size={18} className="text-purple-500" /> Inventário
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                {tDynamic('Conte na unidade que estiver na mão — cabeça, caixa, quilo. O sistema converte.')}
              </p>
            </div>
            <button onClick={onFechar} className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800">
              <X size={20} />
            </button>
          </div>
          <div className="relative mt-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar insumo..."
              className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-[var(--cor-primaria)] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
          </div>
        </div>

        <div className="flex-1 divide-y divide-gray-100 overflow-y-auto hide-scrollbar dark:divide-gray-800">
          {lista.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">Nenhum insumo encontrado.</p>
          ) : lista.map(i => {
            const valor = valorOf(i);
            const contado = valor.qtd !== '' ? qtdBase(i, valor) : null;
            const saldo = Number(i.quantidade_atual) || 0;
            const dif = contado != null ? contado - saldo : null;
            const custoUnit = Number(i.qtd_embalagem) > 0 ? Number(i.preco_embalagem) / Number(i.qtd_embalagem) : 0;

            return (
              <div key={i.id} className="flex flex-col gap-3 bg-white p-4 dark:bg-gray-900 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{i.nome}</p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    Sistema diz: <b>{saldo.toLocaleString('pt-BR')} {i.unidade_medida}</b>
                  </p>
                  {dif != null && Math.abs(dif) > 1e-6 && (
                    <p className={`mt-1 flex items-center gap-1 text-[11px] font-bold ${dif > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {dif > 0 ? '+' : ''}{dif.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {i.unidade_medida}
                      {custoUnit > 0 && <span className="font-medium text-gray-400">({fmt(Math.abs(dif) * custoUnit)} {dif > 0 ? 'a mais' : 'de perda'})</span>}
                    </p>
                  )}
                  {dif != null && Math.abs(dif) <= 1e-6 && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-gray-400">
                      <CheckCircle2 size={11} /> bate com o sistema
                    </p>
                  )}
                </div>
                <div className="sm:w-64">
                  <SeletorQuantidade alvo={i} valor={valor} compacto
                    onChange={v => setContagem(c => ({ ...c, [i.id]: v }))} />
                </div>
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <input placeholder="Observação (ex: contagem de segunda)"
              className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-[var(--cor-primaria)] focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 sm:max-w-xs"
              value={obs} onChange={e => setObs(e.target.value)} />
            <button onClick={aplicar} disabled={salvando || preenchidos.length === 0}
              className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[var(--cor-primaria)] px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100">
              {salvando ? <><Loader2 size={16} className="animate-spin" /> Aplicando...</>
                        : <><ClipboardCheck size={16} /> Aplicar contagem ({preenchidos.length})</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

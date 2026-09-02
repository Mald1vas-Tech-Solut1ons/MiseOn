import { useState } from 'react';
import { X, Plus, Minus, AlertTriangle } from 'lucide-react';
import { fmt, fmtQtd, type Produto, type Opcao } from '../../types';
import type { NutricaoProduto } from '../../lib/nutricao';

export function ModalOpcoes({ produto, nutricao, onConfirmar, onFechar }: {
  produto: Produto;
  /** Alergênicos do prato, para o atendente responder na hora. */
  nutricao?: NutricaoProduto;
  onConfirmar: (opcoes: Opcao[], qtd: number, obs: string) => void;
  onFechar: () => void;
}) {
  const isPeso = produto.tipo_venda === 'POR_PESO';
  const [selecionadas, setSelecionadas] = useState<Opcao[]>([]);
  const [qtd, setQtd] = useState(isPeso ? 0.350 : 1);
  const [obs, setObs] = useState('');

  const grupos = (produto.grupos_opcoes ?? []).filter((g) => (g.opcoes ?? []).some((o) => o.disponivel));

  const alternar = (grupo: { id: string; max_escolhas: number }, opcao: Opcao) => {
    setSelecionadas((sel) => {
      const doGrupo = sel.filter((o) => o.grupo_id === grupo.id);
      const jaTem = sel.some((o) => o.id === opcao.id);
      if (jaTem) return sel.filter((o) => o.id !== opcao.id);
      if (grupo.max_escolhas === 1) return [...sel.filter((o) => o.grupo_id !== grupo.id), opcao];
      if (doGrupo.length >= grupo.max_escolhas) return sel;
      return [...sel, opcao];
    });
  };

  const faltandoObrigatorio = grupos.some((g) =>
    g.min_escolhas > 0 && selecionadas.filter((o) => o.grupo_id === g.id).length < g.min_escolhas) || (isPeso && qtd <= 0);

  const precoBaseUnit = isPeso ? Number(produto.preco_por_quilo || 0) : Number(produto.preco);
  const total = (precoBaseUnit * qtd) + selecionadas.reduce((s, o) => s + Number(o.preco_adicional), 0) * (isPeso ? 1 : qtd);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onFechar}>
      <div className="flex max-h-[88vh] w-full max-w-md flex-col rounded-3xl bg-white shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div>
            <h3 className="text-base font-black dark:text-gray-100">{produto.nome}</h3>
            <p className="text-xs text-gray-400">
              {isPeso ? `${fmt(Number(produto.preco_por_quilo || 0))}/kg` : `${fmt(Number(produto.preco))} base`}
            </p>
          </div>
          <button onClick={onFechar} className="text-gray-400"><X size={20} /></button>
        </div>

        {/* Quem pergunta "tem leite?" pergunta no balcão, para uma pessoa. Ela
            precisa da resposta na tela, não no cardápio do cliente. */}
        {((nutricao?.alergenos_contem?.length ?? 0) > 0 || (nutricao?.alergenos_pode_conter?.length ?? 0) > 0) && (
          <div className="mx-5 mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-800/60 dark:bg-amber-950/30">
            <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>
                {(nutricao?.alergenos_contem?.length ?? 0) > 0 && (
                  <strong className="font-bold">Contém {nutricao!.alergenos_contem.join(', ').toLowerCase()}. </strong>
                )}
                {(nutricao?.alergenos_pode_conter?.length ?? 0) > 0 && (
                  <>Pode conter {nutricao!.alergenos_pode_conter.join(', ').toLowerCase()}. </>
                )}
                <span className="opacity-80">{'Lista do que foi avaliado — ausência não é garantia.'}</span>
              </span>
            </p>
          </div>
        )}

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {isPeso && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">⚖️ Peso da balança (Kg):</span>
                <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">{fmtQtd(qtd, 'POR_PESO')}</span>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-2">
                {[0.250, 0.350, 0.500, 0.750, 1.000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setQtd(preset)}
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                      qtd === preset
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-emerald-800 border border-emerald-200 dark:bg-gray-800 dark:text-emerald-300 dark:border-emerald-800'
                    }`}
                  >
                    {preset < 1 ? `${preset * 1000}g` : `${preset}kg`}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Em gramas:</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={Math.round(qtd * 1000)}
                  onChange={(e) => {
                    const g = Math.max(0, Number(e.target.value || 0));
                    setQtd(g / 1000);
                  }}
                  placeholder="Ex: 350"
                  className="w-24 rounded-lg border border-emerald-300 bg-white p-1.5 text-xs font-bold outline-none dark:border-emerald-800 dark:bg-gray-800 dark:text-gray-100"
                />
                <span className="text-xs font-bold text-gray-500">g</span>
              </div>
            </div>
          )}

          {grupos.map((g) => (
            <div key={g.id}>
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {g.nome} {g.min_escolhas > 0 && <span className="text-red-500">*</span>}
                <span className="ml-1 font-semibold normal-case text-gray-400">
                  ({g.max_escolhas === 1 ? 'escolha 1' : `até ${g.max_escolhas}`})
                </span>
              </p>
              <div className="space-y-1.5">
                {(g.opcoes ?? []).filter((o) => o.disponivel).map((o) => {
                  const marcada = selecionadas.some((s) => s.id === o.id);
                  return (
                    <button key={o.id} onClick={() => alternar(g, o)}
                      className={`flex w-full items-center justify-between rounded-xl border-2 px-3 py-2.5 text-left text-sm transition ${marcada ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/5' : 'border-gray-200 dark:border-gray-700'}`}>
                      <span className={`font-semibold ${marcada ? 'text-[var(--cor-primaria)]' : 'text-gray-700 dark:text-gray-200'}`}>{o.nome}</span>
                      <span className="text-xs font-bold text-gray-400">{Number(o.preco_adicional) > 0 ? `+${fmt(Number(o.preco_adicional))}` : 'grátis'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação (ex: sem cebola)"
            className="w-full rounded-xl border border-gray-200 p-2.5 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
        </div>

        <div className="flex items-center gap-3 border-t border-gray-100 p-4 dark:border-gray-800">
          {!isPeso && (
            <div className="flex items-center gap-2">
              <button onClick={() => setQtd((q) => Math.max(1, q - 1))} className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 font-black dark:bg-gray-800"><Minus size={14} /></button>
              <span className="w-6 text-center font-black dark:text-gray-100">{qtd}</span>
              <button onClick={() => setQtd((q) => q + 1)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 font-black dark:bg-gray-800"><Plus size={14} /></button>
            </div>
          )}
          <button onClick={() => onConfirmar(selecionadas, qtd, obs)} disabled={faltandoObrigatorio}
            className="flex-1 rounded-2xl bg-[var(--cor-primaria)] py-3.5 text-sm font-black text-white disabled:opacity-40">
            Adicionar {fmt(total)}
          </button>
        </div>
      </div>
    </div>
  );
}

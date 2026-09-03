import { useMemo, useState } from 'react';
import { AlertTriangle, Apple, ChevronDown, CircleDashed, CircleCheck, CircleAlert } from 'lucide-react';
import { useI18n } from '../../contexts/I18nContext';

export interface CoberturaProduto {
  produto_id: string;
  produto: string;
  disponivel: boolean;
  status: 'COMPLETO' | 'PARCIAL' | 'SEM_DADOS';
  publicavel: boolean;
  itens_total: number;
  itens_com_dado: number;
  massa_servida_g: number;
  alergenos_contem: string[];
  atributos: string[];
  alertas: Array<{ codigo: string; detalhe: string }>;
  faltantes: Array<{ insumo_id: string; nome: string; motivo: string }>;
}

/**
 * O semáforo da nutrição do cardápio.
 *
 * A regra que rege esta tela: **a lacuna é uma tarefa, nunca um erro**. Não
 * existe "dados insuficientes" aqui — existe "faltam o pão brioche e o queijo
 * cheddar, e ao resolvê-los 4 pratos passam a publicar".
 *
 * O ranking de insumos pendentes é ordenado por quantos pratos cada um
 * destrava, porque é assim que o lojista gasta menos tempo para o maior efeito.
 */
export default function PainelNutricaoCardapio({ cobertura }: { cobertura: CoberturaProduto[] }) {
  const { tDynamic } = useI18n();
  const [aberto, setAberto] = useState(false);

  const { publicando, ativos, pendentes, comAlerta, ranking } = useMemo(() => {
    const ativos = cobertura.filter((c) => c.disponivel);
    const publicando = ativos.filter((c) => c.publicavel);
    const pendentes = ativos.filter((c) => !c.publicavel);
    const comAlerta = ativos.filter((c) => (c.alertas?.length ?? 0) > 0);

    // Quantos pratos cada insumo pendente destrava.
    const mapa = new Map<string, { nome: string; motivo: string; pratos: string[] }>();
    for (const c of pendentes) {
      for (const f of c.faltantes ?? []) {
        const atual = mapa.get(f.insumo_id) ?? { nome: f.nome, motivo: f.motivo, pratos: [] };
        atual.pratos.push(c.produto);
        mapa.set(f.insumo_id, atual);
      }
    }
    const ranking = [...mapa.values()].sort((a, b) => b.pratos.length - a.pratos.length);

    return { publicando, ativos, pendentes, comAlerta, ranking };
  }, [cobertura]);

  if (!ativos.length) return null;

  const pct = Math.round((publicando.length / ativos.length) * 100);
  const tudoPronto = pendentes.length === 0 && comAlerta.length === 0;

  return (
    <div className="mb-3 rounded-2xl border bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-bold dark:text-gray-100">
            <Apple size={15} className="text-emerald-600" />
            {tDynamic('Nutrição do cardápio')}
            <span className={`rounded-full px-2 py-0.5 text-xs opacity-90 font-black ${
              tudoPronto
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
            }`}>
              {publicando.length}/{ativos.length} publicando
            </span>
          </p>
          <p className="mt-0.5 text-xs opacity-95 text-gray-500 dark:text-gray-400">
            {tudoPronto
              ? 'Todos os pratos disponíveis exibem tabela nutricional no cardápio.'
              : `${pendentes.length} ${pendentes.length === 1 ? 'prato ainda não exibe' : 'pratos ainda não exibem'} tabela${comAlerta.length ? ` · ${comAlerta.length} com valor suspeito` : ''}.`}
          </p>
        </div>
        <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Pratos publicando tabela nutricional"
        />
      </div>

      {aberto && (
        <div className="mt-3 space-y-3 border-t border-gray-100 pt-3 dark:border-gray-800">
          {ranking.length > 0 && (
            <div>
              <p className="text-xs opacity-95 font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {tDynamic('Resolva primeiro — ordenado pelo que destrava mais')}
              </p>
              <ul className="mt-1.5 space-y-1">
                {ranking.slice(0, 6).map((r) => (
                  <li key={r.nome} className="flex items-start justify-between gap-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs opacity-95 dark:bg-amber-950/20">
                    <span className="min-w-0 text-amber-900 dark:text-amber-200">
                      <strong className="font-bold">{r.nome}</strong> — {r.motivo}
                    </span>
                    <span className="shrink-0 font-bold text-amber-800 dark:text-amber-300">
                      +{r.pratos.length} {r.pratos.length === 1 ? 'prato' : 'pratos'}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs opacity-90 text-gray-500 dark:text-gray-400">
                {tDynamic('Cadastre a nutrição em Estoque → botão da maçã no insumo. Código de barras ou foto do rótulo resolvem em segundos.')}
              </p>
            </div>
          )}

          {comAlerta.length > 0 && (
            <div>
              <p className="text-xs opacity-95 font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
                {tDynamic('Valores que precisam de conferência')}
              </p>
              <ul className="mt-1.5 space-y-1">
                {comAlerta.map((c) => (
                  <li key={c.produto_id} className="flex items-start gap-1.5 text-xs opacity-95 text-red-700 dark:text-red-300">
                    <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                    <span><strong className="font-bold">{c.produto}</strong> — {c.alertas[0].detalhe}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-xs opacity-95 font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {tDynamic('Prato a prato')}
            </p>
            <ul className="mt-1.5 divide-y divide-gray-100 dark:divide-gray-800">
              {ativos.map((c) => (
                <li key={c.produto_id} className="flex items-center justify-between gap-2 py-1.5 text-xs opacity-95">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {c.publicavel ? (
                      <CircleCheck size={13} className="shrink-0 text-emerald-600" />
                    ) : c.status === 'SEM_DADOS' ? (
                      <CircleDashed size={13} className="shrink-0 text-gray-400" />
                    ) : (
                      <CircleAlert size={13} className="shrink-0 text-amber-500" />
                    )}
                    <span className="truncate dark:text-gray-200">{c.produto}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-gray-500 dark:text-gray-400">
                    {c.itens_total > 0 ? `${c.itens_com_dado}/${c.itens_total} itens` : 'sem ficha'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

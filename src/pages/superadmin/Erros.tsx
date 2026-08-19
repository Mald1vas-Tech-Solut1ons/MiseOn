import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, RefreshCw, CheckCircle2, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/**
 * Painel de erros de produção.
 *
 * Existe porque o projeto não tinha nenhuma captura de erro — defeito só
 * aparecia quando o lojista ligava. Aqui os erros chegam agrupados por
 * impressão digital + hora, então uma tela quebrada aparece como UMA linha
 * com contador alto, e não como mil linhas iguais.
 */

interface ErroApp {
  id: string;
  origem: string;
  contexto: string | null;
  mensagem: string;
  stack: string | null;
  url: string | null;
  user_agent: string | null;
  loja_id: string | null;
  ocorrencias: number;
  visto_em: string;
  criado_em: string;
  resolvido: boolean;
  lojas?: { nome: string; slug: string } | null;
}

export default function Erros() {
  const [erros, setErros] = useState<ErroApp[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarResolvidos, setMostrarResolvidos] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    let q = supabase
      .from('erros_aplicacao')
      .select('*, lojas(nome, slug)')
      .order('visto_em', { ascending: false })
      .limit(200);
    if (!mostrarResolvidos) q = q.eq('resolvido', false);
    const { data } = await q;
    setErros((data ?? []) as ErroApp[]);
    setCarregando(false);
  }, [mostrarResolvidos]);

  useEffect(() => { carregar(); }, [carregar]);

  const marcarResolvido = async (id: string) => {
    await supabase.from('erros_aplicacao').update({ resolvido: true }).eq('id', id);
    carregar();
  };

  const totalOcorrencias = erros.reduce((s, e) => s + e.ocorrencias, 0);
  const lojasAfetadas = new Set(erros.map((e) => e.loja_id).filter(Boolean)).size;

  const quando = (iso: string) => {
    const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `${min} min atrás`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h atrás`;
    return `${Math.floor(h / 24)}d atrás`;
  };

  return (
    <div className="text-white">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-['Sora'] text-2xl font-black tracking-tight">Erros em produção</h1>
          <p className="mt-1 text-sm text-slate-400">
            {erros.length} tipo(s) · {totalOcorrencias} ocorrência(s)
            {lojasAfetadas > 0 && ` · ${lojasAfetadas} loja(s) afetada(s)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMostrarResolvidos((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/10"
          >
            <Filter size={14} /> {mostrarResolvidos ? 'Ocultar resolvidos' : 'Mostrar resolvidos'}
          </button>
          <button
            onClick={carregar}
            className="inline-flex items-center gap-2 rounded-xl bg-[#FC5B24] px-3 py-2 text-xs font-black text-white hover:brightness-110"
          >
            <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>
      </div>

      {carregando && erros.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">Carregando…</p>
      ) : erros.length === 0 ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 py-12 text-center">
          <CheckCircle2 size={32} className="mx-auto mb-3 text-emerald-400" />
          <p className="font-bold text-emerald-400">Nenhum erro em aberto</p>
          <p className="mt-1 text-xs text-slate-400">
            A captura roda em todas as telas. Silêncio aqui é boa notícia.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10">
          {erros.map((e) => (
            <div key={e.id} className="bg-[#0B1020] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <button
                  onClick={() => setExpandido(expandido === e.id ? null : e.id)}
                  className="flex-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <AlertTriangle size={14} className="shrink-0 text-amber-400" />
                    <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      {e.origem}
                    </span>
                    {e.contexto && (
                      <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                        {e.contexto}
                      </span>
                    )}
                    {e.ocorrencias > 1 && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-black text-amber-400">
                        {e.ocorrencias}×
                      </span>
                    )}
                    {e.lojas?.nome && (
                      <span className="text-[11px] text-slate-500">{e.lojas.nome}</span>
                    )}
                  </div>
                  <p className="mt-1.5 break-words font-mono text-sm text-slate-200">{e.mensagem}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{quando(e.visto_em)}</p>
                </button>

                {!e.resolvido && (
                  <button
                    onClick={() => marcarResolvido(e.id)}
                    className="shrink-0 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold text-emerald-400 hover:bg-emerald-500/20"
                  >
                    Marcar resolvido
                  </button>
                )}
              </div>

              {expandido === e.id && (
                <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                  {e.url && (
                    <p className="break-all font-mono text-[11px] text-slate-400">URL: {e.url}</p>
                  )}
                  {e.user_agent && (
                    <p className="break-all font-mono text-[11px] text-slate-500">{e.user_agent}</p>
                  )}
                  {e.stack && (
                    <pre className="overflow-x-auto rounded-xl bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-slate-400">
{e.stack}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState, useCallback, useMemo } from 'react';
import { AlertTriangle, RefreshCw, CheckCircle2, Flame, RotateCcw, Moon, Zap, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../contexts/I18nContext';

/**
 * Painel de erros de produção, por FAMÍLIA.
 *
 * A tabela guarda uma linha por impressão × hora. Lida crua (como era até
 * 22/09/2026), ela mostrava o mesmo defeito em várias linhas — o erro de
 * deploy virava uma linha por tela e por hash de arquivo —, erro de 18 dias
 * com cara de atual e ruído de terceiro misturado com defeito nosso.
 *
 * Agora `fn_superadmin_erros` agrupa por família (mensagem sem URL, hash e
 * número), classifica (nosso / deploy / terceiro) e dá o ESTADO:
 *   pico     → ≥5 ocorrências na última hora ou ≥3 pessoas: olhe agora;
 *   voltou   → apareceu depois de marcado resolvido: a correção não pegou;
 *   ativo    → visto nas últimas 24h;
 *   dormente → sem aparecer há mais de 24h (7 dias sem voltar = resolve sozinho).
 */

type Familia = {
  familia: string; categoria: 'nosso' | 'deploy' | 'terceiro';
  estado: 'pico' | 'voltou' | 'ativo' | 'dormente' | 'resolvido';
  origem: string; telas: string | null; qtd_telas: number;
  mensagem: string; stack: string | null; url: string | null; user_agent: string | null;
  ocorrencias: number; ocorrencias_24h: number; ocorrencias_1h: number;
  pessoas: number; pessoas_1h: number; lojas: number; lojas_nomes: string | null;
  primeiro_visto: string; ultimo_visto: string;
  resolvido_em: string | null; resolvido_por: string | null; motivo_ruido: string | null;
};

type Filtro = 'abertos' | 'nosso' | 'deploy' | 'terceiro' | 'resolvidos';

const PESO: Record<Familia['estado'], number> = { pico: 0, voltou: 1, ativo: 2, dormente: 3, resolvido: 4 };

export default function Erros() {
  const { tDynamic } = useI18n();
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('abertos');
  const [expandido, setExpandido] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro('');
    const { data, error } = await supabase.rpc('fn_superadmin_erros', { p_dias: 30 });
    if (error) setErro(error.message);
    setFamilias((data ?? []) as Familia[]);
    setCarregando(false);
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  // Painel aberto na parede: relê sozinho a cada minuto.
  useEffect(() => {
    const t = setInterval(() => { void carregar(); }, 60000);
    return () => clearInterval(t);
  }, [carregar]);

  const resolver = async (familia: string) => {
    const { error } = await supabase.rpc('fn_superadmin_resolver_erro', { p_familia: familia });
    if (error) { setErro(error.message); return; }
    void carregar();
  };

  const abertos = familias.filter((f) => f.estado !== 'resolvido');
  const visiveis = useMemo(() => {
    const lista = filtro === 'resolvidos' ? familias.filter((f) => f.estado === 'resolvido')
      : filtro === 'abertos' ? abertos.filter((f) => f.categoria !== 'terceiro')
        : abertos.filter((f) => f.categoria === filtro);
    return [...lista].sort((a, b) => PESO[a.estado] - PESO[b.estado]
      || new Date(b.ultimo_visto).getTime() - new Date(a.ultimo_visto).getTime());
  }, [familias, abertos, filtro]);

  const alarmes = abertos.filter((f) => f.estado === 'pico' || f.estado === 'voltou');
  const conta = (c: Familia['categoria']) => abertos.filter((f) => f.categoria === c).length;

  const quando = (iso: string | null) => {
    if (!iso) return '—';
    const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return tDynamic('agora');
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h} h`;
    return `${Math.floor(h / 24)} d`;
  };

  const selo = (f: Familia) => {
    const base = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-black';
    if (f.estado === 'pico') return <span className={`${base} bg-red-500/20 text-red-300`}><Flame size={12} /> {tDynamic('Pico agora')}</span>;
    if (f.estado === 'voltou') return <span className={`${base} bg-fuchsia-500/20 text-fuchsia-300`}><RotateCcw size={12} /> {tDynamic('Voltou depois de resolvido')}</span>;
    if (f.estado === 'ativo') return <span className={`${base} bg-amber-500/15 text-amber-300`}><Zap size={12} /> {tDynamic('Ativo (24h)')}</span>;
    if (f.estado === 'dormente') return <span className={`${base} bg-white/10 text-slate-400`}><Moon size={12} /> {tDynamic('Dormente')}</span>;
    return <span className={`${base} bg-emerald-500/15 text-emerald-300`}><CheckCircle2 size={12} /> {f.resolvido_por === 'auto' ? tDynamic('Resolvido (sem voltar em 7 dias)') : tDynamic('Resolvido')}</span>;
  };

  const rotuloCategoria: Record<Familia['categoria'], string> = {
    nosso: tDynamic('Nosso'), deploy: tDynamic('Deploy com aba aberta'), terceiro: tDynamic('Terceiro'),
  };

  const abas: { id: Filtro; rotulo: string; qtd: number }[] = [
    { id: 'abertos', rotulo: tDynamic('Abertos'), qtd: abertos.filter((f) => f.categoria !== 'terceiro').length },
    { id: 'nosso', rotulo: tDynamic('Nossos'), qtd: conta('nosso') },
    { id: 'deploy', rotulo: tDynamic('Deploy'), qtd: conta('deploy') },
    { id: 'terceiro', rotulo: tDynamic('Ruído de terceiros'), qtd: conta('terceiro') },
    { id: 'resolvidos', rotulo: tDynamic('Resolvidos'), qtd: familias.length - abertos.length },
  ];

  return (
    <div className="text-white">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-['Sora'] text-2xl font-black tracking-tight">{tDynamic('Erros em produção')}</h1>
          <p className="mt-1 text-sm text-slate-400">{tDynamic('Agrupados por família nos últimos 30 dias. O mesmo defeito em várias telas ou deploys é uma linha só.')}</p>
        </div>
        <button type="button" onClick={carregar}
          className="inline-flex items-center gap-2 rounded-xl bg-[#FC5B24] px-3 py-2 text-xs font-black text-white hover:brightness-110">
          <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} /> {tDynamic('Atualizar')}
        </button>
      </div>

      {erro && <p role="alert" className="mb-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{erro}</p>}

      {alarmes.length > 0 && (
        <div className="mb-5 rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
          <p className="flex items-center gap-2 font-black text-red-300"><Flame size={16} /> {alarmes.length} {tDynamic('família(s) pedindo atenção agora')}</p>
          <p className="mt-1 text-xs text-red-200/80">{tDynamic('Pico: muitas ocorrências ou várias pessoas na última hora. Voltou: apareceu de novo depois de marcado como resolvido.')}</p>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {abas.map((a) => (
          <button key={a.id} type="button" onClick={() => setFiltro(a.id)}
            className={`rounded-xl px-3 py-2 text-xs font-bold ${filtro === a.id ? 'bg-white text-slate-900' : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}>
            {a.rotulo} <span className="opacity-60">{a.qtd}</span>
          </button>
        ))}
      </div>

      {carregando && familias.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">{tDynamic('Carregando…')}</p>
      ) : visiveis.length === 0 ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 py-12 text-center">
          <CheckCircle2 size={32} className="mx-auto mb-3 text-emerald-400" />
          <p className="font-bold text-emerald-400">{tDynamic('Nenhum erro em aberto')}</p>
          <p className="mt-1 text-xs text-slate-400">{tDynamic('A captura roda em todas as telas. Silêncio aqui é boa notícia.')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10">
          {visiveis.map((f) => (
            <div key={f.familia} className="bg-[#0B1020] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <button type="button" onClick={() => setExpandido(expandido === f.familia ? null : f.familia)} className="flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    {selo(f)}
                    <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-xs font-bold text-slate-300">
                      {f.categoria === 'deploy' ? <Package size={12} /> : <AlertTriangle size={12} />} {rotuloCategoria[f.categoria]}
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-black text-slate-200">{f.ocorrencias}×</span>
                    {f.ocorrencias_24h > 0 && <span className="text-xs text-amber-300">{f.ocorrencias_24h} {tDynamic('nas últimas 24h')}</span>}
                  </div>
                  <p className="mt-1.5 break-words font-mono text-sm text-slate-200">{f.mensagem}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {tDynamic('Última vez há')} {quando(f.ultimo_visto)} · {tDynamic('primeira há')} {quando(f.primeiro_visto)}
                    {' · '}{f.pessoas} {tDynamic('pessoa(s)')} · {f.qtd_telas} {tDynamic('tela(s)')}
                    {f.lojas_nomes ? ` · ${f.lojas_nomes}` : ''}
                  </p>
                  {f.motivo_ruido && <p className="mt-1 text-xs text-slate-400">{f.motivo_ruido}</p>}
                  {f.categoria === 'deploy' && (
                    <p className="mt-1 text-xs text-slate-400">{tDynamic('Aba aberta durante uma publicação pediu um arquivo que já não existe. Desde 22/09 a tela recarrega sozinha uma vez; se continuar aparecendo depois disso, é defeito.')}</p>
                  )}
                </button>
                {f.estado !== 'resolvido' && (
                  <button type="button" onClick={() => resolver(f.familia)}
                    className="shrink-0 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20">
                    {tDynamic('Marcar resolvido')}
                  </button>
                )}
              </div>

              {expandido === f.familia && (
                <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                  {f.telas && <p className="break-all font-mono text-xs text-slate-400">{tDynamic('Telas')}: {f.telas}</p>}
                  {f.url && <p className="break-all font-mono text-xs text-slate-400">URL: {f.url}</p>}
                  {f.user_agent && <p className="break-all font-mono text-xs text-slate-500">{f.user_agent}</p>}
                  {f.stack && (
                    <pre className="overflow-x-auto rounded-xl bg-black/40 p-3 font-mono text-xs leading-relaxed text-slate-400">{f.stack}</pre>
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X, ChevronLeft, ChevronRight, ChefHat, Timer, Play, Pause, RotateCcw,
  Trophy, CheckCircle2, Circle, PackageCheck, PackageX, Loader2, ListChecks, Flame, Scissors, Scale,
} from 'lucide-react';
import { Insumo, PassoPreparo, fmt } from '../../types';
import { useI18n } from '../../contexts/I18nContext';
import { Tecnica, carregarTecnicas } from '../../lib/producao/tecnicas';

export interface ItemMiseEnPlace {
  ins?: Insumo;
  /** Bruto a retirar do estoque. */
  necessario: number;
  disponivel: number;
  ok: boolean;
  /** Líquido esperado após o pré-preparo. Nulo = sem perda declarada. */
  liquido?: number | null;
  tecnica?: string | null;
}

interface Props {
  preparo: Insumo;
  qtdLotes: number;
  rendimento: number;
  custo: number;
  itens: ItemMiseEnPlace[];
  /**
   * Recebe o tempo total da OS, quantos segundos o fogo/forno ficou ligado e o
   * quanto saiu de verdade (nulo = a equipe não pesou o lote pronto). Deve
   * lançar se a produção falhar.
   */
  onConcluir: (segundos: number, segundosFogo: number, quantidadeReal: number | null) => Promise<void>;
  onFechar: () => void;
}

const formatarRelogio = (segundos: number) => {
  const s = Math.max(0, Math.floor(segundos));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

/**
 * Bipe curto pelo WebAudio. Sem arquivo de áudio: a cozinha precisa de aviso
 * sonoro quando o timer fecha, mas o PWA não deve carregar asset por isso.
 * Falha em silêncio quando o navegador bloqueia áudio sem gesto do usuário.
 */
function tocarBipe() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.62);
    osc.onended = () => ctx.close().catch(() => {});
  } catch {
    /* som é conforto, nunca requisito da OS */
  }
}

export default function ModoPreparo({
  preparo, qtdLotes, rendimento, custo, itens, onConcluir, onFechar,
}: Props) {
  const { tDynamic } = useI18n();
  const [tecnicas, setTecnicas] = useState<Tecnica[]>([]);
  useEffect(() => { carregarTecnicas().then(setTecnicas); }, []);

  const passos: PassoPreparo[] = useMemo(() => {
    const bruto = preparo.modo_preparo;
    return Array.isArray(bruto)
      ? bruto.filter(p => p && typeof p.texto === 'string' && p.texto.trim())
      : [];
  }, [preparo.modo_preparo]);

  // Índice 0 é sempre o mise en place; os passos do roteiro vêm depois.
  const totalTelas = passos.length + 1;
  const [indice, setIndice] = useState(0);
  const [concluidos, setConcluidos] = useState<Set<number>>(new Set());
  const [conferidos, setConferidos] = useState<Set<string>>(new Set());
  const [produzindo, setProduzindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Quanto saiu de verdade. Vazio = a equipe não pesou; vale o previsto pela
  // ficha. Dizer que entraram 3 L quando saíram 2,4 é estoque fantasma.
  const [rendimentoReal, setRendimentoReal] = useState('');

  // Cronômetro global da OS: começa junto com a tela e é o tempo que vai para
  // a etiqueta. Independe dos timers de cada etapa.
  const inicioRef = useRef(Date.now());
  const [decorrido, setDecorrido] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setDecorrido(Math.floor((Date.now() - inicioRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const passoAtual = indice > 0 ? passos[indice - 1] : null;
  const minutosPasso = Number(passoAtual?.minutos ?? 0);

  const [restante, setRestante] = useState(0);
  const [rodando, setRodando] = useState(false);
  // Só conta enquanto o timer de uma etapa marcada como fogo/forno está
  // rodando: é medição de chama, não tempo de bancada.
  const segundosFogoRef = useRef(0);
  useEffect(() => {
    setRestante(minutosPasso > 0 ? minutosPasso * 60 : 0);
    setRodando(false);
  }, [indice, minutosPasso]);

  useEffect(() => {
    if (!rodando || restante <= 0) return;
    const emFogo = passoAtual?.fogo === true;
    const id = window.setInterval(() => {
      if (emFogo) segundosFogoRef.current += 1;
      setRestante(atual => {
        if (atual <= 1) {
          window.clearInterval(id);
          setRodando(false);
          tocarBipe();
          return 0;
        }
        return atual - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [rodando, restante, passoAtual]);

  const faltamConferir = itens.filter(i => !conferidos.has(i.ins?.id ?? '')).length;
  const miseEnPlaceOk = indice > 0 || faltamConferir === 0;
  const ultimaTela = indice === totalTelas - 1;
  const progresso = (concluidos.size / totalTelas) * 100;

  const avancar = useCallback(() => {
    setConcluidos(atual => new Set(atual).add(indice));
    if (indice < totalTelas - 1) setIndice(indice + 1);
  }, [indice, totalTelas]);

  const finalizar = async () => {
    setProduzindo(true);
    setErro(null);
    try {
      setConcluidos(atual => new Set(atual).add(indice));
      const real = Number(String(rendimentoReal).replace(',', '.'));
      await onConcluir(
        decorrido,
        segundosFogoRef.current,
        Number.isFinite(real) && real > 0 ? real : null,
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível concluir a produção.');
      setProduzindo(false);
    }
  };

  const conferirTudo = () => setConferidos(new Set(itens.map(i => i.ins?.id ?? '')));

  /** O corte que a ficha manda fazer, por extenso, para a equipe na bancada. */
  const rotuloTecnica = (codigo?: string | null) =>
    codigo ? tecnicas.find(t => t.codigo === codigo)?.rotulo ?? null : null;

  const realInformado = Number(String(rendimentoReal).replace(',', '.'));
  const desvioPct = Number.isFinite(realInformado) && realInformado > 0 && rendimento > 0
    ? ((realInformado - rendimento) / rendimento) * 100
    : null;

  const tempoTotalPasso = minutosPasso * 60;
  const progressoTimer = tempoTotalPasso > 0 ? ((tempoTotalPasso - restante) / tempoTotalPasso) * 100 : 0;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 p-0 backdrop-blur-sm sm:p-4">
      <div className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-gray-950 sm:h-[92vh] sm:rounded-3xl">

        {/* Cabeçalho */}
        <div className="z-10 flex shrink-0 items-center justify-between gap-3 bg-gradient-to-r from-orange-600 to-red-600 px-5 py-4 text-white">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-2xl bg-white/15 p-2.5 ring-1 ring-white/20"><ChefHat size={22} /></div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-200">{tDynamic('Modo de preparo')}</p>
              <h2 className="truncate text-lg font-black leading-tight">{preparo.nome}</h2>
              <p className="text-xs font-semibold text-orange-100/90">{qtdLotes} {qtdLotes === 1 ? tDynamic('lote') : tDynamic('lotes')} · +{rendimento} {preparo.unidade_medida}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden rounded-xl bg-black/20 px-3 py-2 text-right sm:block">
              <p className="text-[10px] font-black uppercase tracking-wider text-orange-200">{tDynamic('Tempo da OS')}</p>
              <p className="tabular-nums text-lg font-black leading-none">{formatarRelogio(decorrido)}</p>
            </div>
            <button type="button" onClick={onFechar} title={tDynamic('Sair sem produzir')} className="rounded-full p-2 transition-colors hover:bg-white/20"><X size={22} /></button>
          </div>
        </div>

        {/* Progresso global */}
        <div className="h-2 w-full shrink-0 bg-gray-200 dark:bg-gray-800">
          <div className="h-full bg-emerald-500 transition-all duration-500 ease-out" style={{ width: `${progresso}%` }} />
        </div>

        {/* Conteúdo */}
        <div className="relative flex-1 overflow-y-auto bg-gray-50 p-5 dark:bg-gray-900 sm:p-8">
          <div className="mx-auto w-full max-w-xl">

            <div className="mb-6 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-xs font-black uppercase tracking-wider text-gray-600 shadow-sm dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
                {indice === 0
                  ? <><ListChecks size={14} className="text-orange-500" /> {tDynamic('Mise en place')}</>
                  : <>{tDynamic('Passo')} {indice} {tDynamic('de')} {passos.length}</>}
              </span>
            </div>

            {indice === 0 ? (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h3 className="mb-1 text-center text-2xl font-black text-gray-900 dark:text-gray-100">{tDynamic('Separe e confira a matéria-prima')}</h3>
                <p className="mb-6 text-center text-sm text-gray-500">{tDynamic('A baixa no estoque só acontece ao concluir a OS, com o custo real do lote consumido.')}</p>

                <div className="space-y-2">
                  {itens.map((it, i) => {
                    const id = it.ins?.id ?? String(i);
                    const conferido = conferidos.has(id);
                    return (
                      <button type="button"
                        key={id}
                        onClick={() => setConferidos(atual => {
                          const proximo = new Set(atual);
                          if (proximo.has(id)) proximo.delete(id); else proximo.add(id);
                          return proximo;
                        })}
                        className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all ${
                          conferido
                            ? 'border-emerald-300 bg-emerald-50 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20'
                            : 'border-gray-200 bg-white hover:border-orange-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-950'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          {conferido
                            ? <CheckCircle2 size={22} className="shrink-0 text-emerald-500" />
                            : <Circle size={22} className="shrink-0 text-gray-300 dark:text-gray-700" />}
                          <span className="min-w-0">
                            <span className={`block truncate font-bold ${conferido ? 'text-emerald-800 dark:text-emerald-300' : 'text-gray-800 dark:text-gray-200'}`}>{it.ins?.nome ?? '—'}</span>
                            {rotuloTecnica(it.tecnica) && (
                              <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                                <Scissors size={10} /> {rotuloTecnica(it.tecnica)}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-xs font-semibold text-gray-400">
                              {it.ok ? <PackageCheck size={12} className="text-emerald-500" /> : <PackageX size={12} className="text-red-500" />}
                              {tDynamic('Em estoque')}: {it.disponivel} {it.ins?.unidade_medida}
                            </span>
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className={`block tabular-nums text-lg font-black ${it.ok ? 'text-gray-700 dark:text-gray-200' : 'text-red-500'}`}>
                            {it.necessario} <span className="text-xs font-bold text-gray-400">{it.ins?.unidade_medida}</span>
                          </span>
                          {it.liquido != null && it.liquido < it.necessario && (
                            <span className="block text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                              → {it.liquido.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} {tDynamic('limpo')}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {faltamConferir > 0 && (
                  <button type="button" onClick={conferirTudo} className="mt-3 w-full rounded-xl bg-gray-100 py-2.5 text-xs font-black uppercase tracking-wider text-gray-500 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700">
                    {tDynamic('Conferi tudo')} ({faltamConferir})
                  </button>
                )}

                <div className="mt-5 flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 text-sm dark:border-gray-800 dark:bg-gray-950">
                  <span className="font-bold text-gray-500">{tDynamic('Custo de referência')}</span>
                  <span className="text-lg font-black text-gray-800 dark:text-gray-100">{fmt(custo)}</span>
                </div>

                {passos.length === 0 && (
                  <p className="mt-5 rounded-2xl border border-dashed border-gray-300 p-4 text-center text-xs font-medium leading-relaxed text-gray-400 dark:border-gray-700">
                    {tDynamic('Esta ficha não tem roteiro de preparo. Adicione as etapas na ficha para a equipe seguir o passo a passo com tempo cronometrado.')}
                  </p>
                )}
              </div>
            ) : (
              <div key={indice} className="animate-in fade-in slide-in-from-right-4 duration-300">
                <h3 className="mb-8 text-center text-2xl font-medium leading-relaxed text-gray-800 dark:text-gray-100 sm:text-3xl">
                  {passoAtual?.texto}
                </h3>

                {minutosPasso > 0 ? (
                  <div className="rounded-3xl border border-gray-100 bg-white p-6 text-center shadow-md dark:border-gray-800 dark:bg-gray-950">
                    <div className="mb-2 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider text-orange-500">
                      {passoAtual?.fogo
                        ? <><Flame size={14} /> {tDynamic('Fogo/forno — conta como gás')}</>
                        : <><Timer size={14} /> {tDynamic('Tempo sugerido')}</>}
                    </div>
                    <div className={`mb-4 tabular-nums text-6xl font-black tracking-tight ${restante === 0 ? 'text-emerald-500' : 'text-gray-800 dark:text-gray-100'}`}>
                      {formatarRelogio(restante)}
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <button type="button"
                        onClick={() => setRodando(r => !r)}
                        disabled={restante === 0}
                        className={`flex items-center gap-2 rounded-full px-6 py-2.5 font-black transition-all disabled:opacity-40 ${
                          rodando
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-orange-500 text-white shadow-lg shadow-orange-500/30 hover:bg-orange-600'
                        }`}
                      >
                        {rodando ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                        {rodando ? tDynamic('Pausar') : tDynamic('Iniciar')}
                      </button>
                      <button type="button"
                        onClick={() => { setRodando(false); setRestante(tempoTotalPasso); }}
                        title={tDynamic('Reiniciar timer')}
                        className="rounded-full p-2.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                      >
                        <RotateCcw size={20} />
                      </button>
                    </div>
                    <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div className="h-full bg-orange-500 transition-all duration-1000 ease-linear" style={{ width: `${progressoTimer}%` }} />
                    </div>
                  </div>
                ) : (
                  <p className="flex items-center justify-center gap-2 py-4 text-sm text-gray-400">
                    <CheckCircle2 size={16} /> {tDynamic('Etapa sem tempo cronometrado')}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="pointer-events-none absolute bottom-4 right-4 text-gray-900/5 dark:text-white/5">
            <ChefHat size={120} />
          </div>
        </div>

        {ultimaTela && (
          <div className="shrink-0 border-t border-gray-200 bg-amber-50 px-4 py-3 dark:border-gray-800 dark:bg-amber-950/20 sm:px-5">
            <div className="mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-amber-800 dark:text-amber-400">
                  <Scale size={13} /> {tDynamic('Quanto saiu de verdade?')}
                </p>
                <p className="text-[11px] leading-snug text-amber-700/80 dark:text-amber-500/80">
                  {tDynamic('A ficha prevê')} <b>{rendimento} {preparo.unidade_medida}</b>.{' '}
                  {tDynamic('Cozinhar concentra ou hidrata — pese o lote pronto e o estoque entra com o número real.')}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="flex overflow-hidden rounded-xl border border-amber-300 bg-white dark:border-amber-900/50 dark:bg-gray-950">
                  <input
                    value={rendimentoReal}
                    onChange={e => setRendimentoReal(e.target.value)}
                    type="number" min="0" step="any"
                    placeholder={String(rendimento)}
                    disabled={produzindo}
                    className="w-24 bg-transparent p-2 text-center text-lg font-black tabular-nums outline-none dark:text-gray-100"
                  />
                  <span className="flex items-center bg-amber-100 px-2 text-xs font-black text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    {preparo.unidade_medida}
                  </span>
                </div>
                {desvioPct != null && (
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-black ${
                    Math.abs(desvioPct) < 5
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-amber-200 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200'
                  }`}>
                    {desvioPct > 0 ? '+' : ''}{desvioPct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Rodapé de navegação */}
        <div className="shrink-0 border-t border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950 sm:p-5">
          {erro && (
            <p className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">{erro}</p>
          )}
          <div className="flex items-center justify-between gap-3">
            <button type="button"
              onClick={() => setIndice(i => Math.max(0, i - 1))}
              disabled={indice === 0 || produzindo}
              className="flex items-center gap-2 rounded-xl px-4 py-3 font-bold text-gray-600 transition-all hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent dark:text-gray-300 dark:hover:bg-gray-800 dark:disabled:text-gray-700 sm:px-6"
            >
              <ChevronLeft size={20} /> {tDynamic('Anterior')}
            </button>

            <span className="tabular-nums text-sm font-black text-gray-400 sm:hidden">{formatarRelogio(decorrido)}</span>

            {ultimaTela ? (
              <button type="button"
                onClick={finalizar}
                disabled={produzindo || !miseEnPlaceOk}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 font-black text-white shadow-lg shadow-emerald-500/30 transition-all hover:scale-[1.03] hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 sm:px-8"
              >
                {produzindo
                  ? <><Loader2 size={20} className="animate-spin" /> {tDynamic('Concluindo…')}</>
                  : <><Trophy size={20} /> {tDynamic('Concluir OS & Etiquetar')}</>}
              </button>
            ) : (
              <button type="button"
                onClick={avancar}
                disabled={!miseEnPlaceOk}
                className="flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3 font-black text-white shadow-lg shadow-orange-500/30 transition-all hover:scale-[1.03] hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 sm:px-8"
              >
                {indice === 0 ? tDynamic('Começar preparo') : tDynamic('Próximo')} <ChevronRight size={20} />
              </button>
            )}
          </div>
          {indice === 0 && faltamConferir > 0 && (
            <p className="mt-2 text-center text-xs font-semibold text-gray-400">{tDynamic('Confira cada item da mise en place para liberar o preparo.')}</p>
          )}
        </div>
      </div>
    </div>
  );
}

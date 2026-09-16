import { useEffect, useRef } from 'react';
import { ADSENSE_CLIENTE, ADSENSE_SLOTS, type PosicaoAnuncio, type FilaAdSense } from '../lib/adsense';
import { useI18n } from '../contexts/I18nContext';

/**
 * Uma área de anúncio do blog.
 *
 * Três decisões de desenho que valem a pena registrar:
 *
 * 1. RÓTULO. Anúncio identificado como anúncio é exigência do AdSense e é o
 *    que separa publicidade de conteúdo aos olhos de quem lê. As únicas
 *    palavras permitidas pela política são "Publicidade" ou "Anúncio".
 *
 * 2. ALTURA RESERVADA. O anúncio chega depois do texto. Sem altura reservada
 *    ele empurra o parágrafo que a pessoa está lendo para fora da tela — e o
 *    Google cobra isso no Core Web Vitals (CLS), que é sinal de busca. Cada
 *    posição reserva a altura mínima do formato que vai receber.
 *
 * 3. QUANDO NÃO PREENCHE. O AdSense marca `data-ad-status="unfilled"` no
 *    bloco que voltou vazio; a regra em index.css colapsa esse bloco, para
 *    não sobrar um buraco no meio do artigo.
 */

const ALTURA_MINIMA: Record<PosicaoAnuncio, number> = {
  artigoMeio: 280,
  artigoFim: 280,
  hub: 100,
};

type JanelaComAds = Window & { adsbygoogle?: FilaAdSense };

interface AdSlotProps {
  posicao: PosicaoAnuncio;
  className?: string;
}

export default function AdSlot({ posicao, className = '' }: AdSlotProps) {
  const { tDynamic } = useI18n();
  const slot = ADSENSE_SLOTS[posicao];
  const jaEmpurrado = useRef(false);

  useEffect(() => {
    if (!slot || jaEmpurrado.current) return;
    // StrictMode monta o efeito duas vezes em desenvolvimento, e o AdSense
    // reclama ("already have ads in them") se o mesmo <ins> for empurrado
    // duas vezes.
    jaEmpurrado.current = true;
    try {
      const w = window as JanelaComAds;
      w.adsbygoogle = w.adsbygoogle ?? ([] as unknown as FilaAdSense);
      w.adsbygoogle.push({});
    } catch (err) {
      console.warn('[AdSlot] anúncio não carregou:', err);
    }
  }, [slot]);

  // Sem unidade cadastrada: em produção, nada (ver ADSENSE_SLOTS). Em
  // desenvolvimento, a moldura que mostra onde o anúncio vai cair.
  if (!slot) {
    if (import.meta.env.PROD) return null;
    return (
      <aside className={`my-10 ${className}`} aria-hidden="true">
        <div
          className="flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50/60 px-4 text-center dark:border-white/15 dark:bg-white/5"
          style={{ minHeight: ALTURA_MINIMA[posicao] }}
        >
          <span className="font-['JetBrains_Mono'] text-[10px] uppercase tracking-[0.25em] text-gray-400 dark:text-slate-500">
            {tDynamic('Espaço de anúncio')} · {posicao}
          </span>
          <span className="max-w-xs text-xs text-gray-400 dark:text-slate-500">
            {tDynamic('Cole o ID da unidade em ADSENSE_SLOTS (src/lib/adsense.ts) para ligar.')}
          </span>
        </div>
      </aside>
    );
  }

  const fluido = posicao === 'artigoMeio';

  return (
    <aside className={`my-10 ${className}`}>
      <div className="mb-2 flex items-center gap-3">
        <span className="font-['JetBrains_Mono'] text-[10px] uppercase tracking-[0.25em] text-gray-400 dark:text-slate-500">
          {tDynamic('Publicidade')}
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-gray-200 to-transparent dark:from-white/10" />
      </div>
      <ins
        className="adsbygoogle block overflow-hidden rounded-2xl"
        style={{ display: 'block', minHeight: ALTURA_MINIMA[posicao] }}
        data-ad-client={ADSENSE_CLIENTE}
        data-ad-slot={slot}
        {...(fluido
          ? { 'data-ad-format': 'fluid', 'data-ad-layout': 'in-article' }
          : { 'data-ad-format': 'auto', 'data-full-width-responsive': 'true' })}
      />
    </aside>
  );
}

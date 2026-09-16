import { useEffect, useState } from 'react';
import { ShieldOff, RefreshCw, X } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import { ADSENSE_SCRIPT_ID, type FilaAdSense } from '../lib/adsense';

/**
 * Pede — pede, não exige — que o leitor libere o blog no bloqueador.
 *
 * O QUE ESTE COMPONENTE NÃO FAZ, DE PROPÓSITO:
 * não esconde o artigo, não abre modal por cima do texto e não volta a
 * aparecer depois de dispensado. Muro de adblock derruba tempo de página,
 * irrita quem veio ler e é lido pelo Google como conteúdo indisponível. O
 * conteúdo continua aberto; o aviso é um pedido, e some quando a pessoa diz
 * que não.
 *
 * COMO A DETECÇÃO FUNCIONA (duas provas independentes):
 *  1. a isca — um <div> com as classes que as listas de filtro derrubam
 *     ("adsbox", "ad-banner"…). Se a altura dele zera, alguém escondeu;
 *  2. o loader — o `adsbygoogle.js` do <head> não marcou `loaded` depois do
 *     prazo, sinal de que o pedido de rede foi barrado.
 * Uma só prova erra: a isca dá falso positivo com CSS estranho, e o loader
 * demora em rede ruim. Exigir as duas evita acusar quem não bloqueou nada.
 */

const CHAVE_DISPENSA = 'miseon_aviso_adblock_dispensado_ate';
const DIAS_DE_SILENCIO = 7;
const PRAZO_DO_LOADER_MS = 2600;

type JanelaComAds = Window & { adsbygoogle?: FilaAdSense };

function dispensadoAgora(): boolean {
  try {
    const ate = localStorage.getItem(CHAVE_DISPENSA);
    return !!ate && Number(ate) > Date.now();
  } catch {
    // localStorage bloqueado (janela anônima, cookies barrados): sem memória
    // da dispensa, o mais educado é não insistir.
    return true;
  }
}

function detectarBloqueio(): Promise<boolean> {
  return new Promise((resolve) => {
    const isca = document.createElement('div');
    isca.className = 'adsbox ad-banner ad-placement pub_300x250 text-ad';
    isca.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:12px;height:12px;pointer-events:none;';
    isca.innerHTML = '&nbsp;';
    document.body.appendChild(isca);

    window.setTimeout(() => {
      const estilo = window.getComputedStyle(isca);
      const iscaSumiu =
        isca.offsetHeight === 0 ||
        isca.clientHeight === 0 ||
        estilo.display === 'none' ||
        estilo.visibility === 'hidden';
      isca.remove();

      const w = window as JanelaComAds;
      const loaderNoHtml = !!document.getElementById(ADSENSE_SCRIPT_ID);
      const loaderSubiu = w.adsbygoogle?.loaded === true;

      resolve(iscaSumiu && loaderNoHtml && !loaderSubiu);
    }, PRAZO_DO_LOADER_MS);
  });
}

export default function AvisoBloqueadorAnuncios() {
  const { tDynamic } = useI18n();
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (dispensadoAgora()) return;

    let vivo = true;
    detectarBloqueio().then((bloqueado) => {
      if (vivo && bloqueado) setVisivel(true);
    });

    return () => {
      vivo = false;
    };
  }, []);

  if (!visivel) return null;

  const dispensar = () => {
    try {
      localStorage.setItem(CHAVE_DISPENSA, String(Date.now() + DIAS_DE_SILENCIO * 86400_000));
    } catch {
      /* sem localStorage o aviso volta na próxima visita; não é motivo para falhar */
    }
    setVisivel(false);
  };

  return (
    <aside className="my-10 overflow-hidden rounded-3xl border border-[#FC5B24]/30 bg-gradient-to-br from-[#FFF4EF] to-white shadow-sm dark:border-[#FC5B24]/25 dark:from-[#1A0E07] dark:to-[#0B1120]">
      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-8">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FC5B24]/12 text-[#FC5B24]">
          <ShieldOff size={26} />
        </div>

        <div className="flex-1 space-y-1.5">
          <h3 className="font-['Sora'] text-base font-bold text-gray-900 dark:text-white">
            {tDynamic('Seu bloqueador está ligado por aqui')}
          </h3>
          <p className="text-sm leading-relaxed text-gray-600 dark:text-slate-300">
            {tDynamic('O conteúdo deste blog é aberto: sem cadastro, sem assinatura, sem paywall. Quem paga a conta é o anúncio. Se este texto te serviu, liberar o miseon.app.br na sua lista ajuda o próximo a sair.')}
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:w-44">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-5 py-2.5 text-xs font-bold text-white shadow-md transition hover:brightness-110"
          >
            <RefreshCw size={14} />
            {tDynamic('Já liberei, recarregar')}
          </button>
          <button
            type="button"
            onClick={dispensar}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 px-5 py-2.5 text-xs font-semibold text-gray-500 transition hover:bg-gray-50 dark:border-white/15 dark:text-slate-400 dark:hover:bg-white/5"
          >
            <X size={14} />
            {tDynamic('Agora não')}
          </button>
        </div>
      </div>
    </aside>
  );
}

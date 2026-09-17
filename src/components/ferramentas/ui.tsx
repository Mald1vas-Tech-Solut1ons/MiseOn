import { useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Share2, Lock } from 'lucide-react';
import { ROTULOS } from '../../data/ferramentasData';
import { useTxt } from './useTxt';
import { zap } from '../landing/zap';
import MiseOnLogo from '../MiseOnLogo';
import LanguageToggle from '../LanguageToggle';

const inputCls =
  'w-full rounded-xl border border-gray-300 bg-white px-3.5 py-3 text-base font-semibold text-gray-900 outline-none transition focus:border-[#FC5B24] focus:ring-2 focus:ring-[#FC5B24]/20 dark:border-white/15 dark:bg-[#0B1120] dark:text-white';

export function Campo({
  rotulo,
  valor,
  onChange,
  dica,
  sufixo,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  dica?: string;
  sufixo?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-slate-200">
        {rotulo}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} ${sufixo ? 'pr-10' : ''}`}
        />
        {sufixo && (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
            {sufixo}
          </span>
        )}
      </div>
      {dica && <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{dica}</p>}
    </div>
  );
}

export function Numero({ rotulo, valor, destaque = false, nota }: { rotulo: string; valor: string; destaque?: boolean; nota?: ReactNode }) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        destaque
          ? 'border-[#FC5B24]/40 bg-[#FC5B24]/10'
          : 'border-gray-200 bg-white dark:border-white/10 dark:bg-white/5'
      }`}
    >
      <p className="font-['JetBrains_Mono'] text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">{rotulo}</p>
      <p className={`mt-1 font-['Sora'] font-extrabold ${destaque ? 'text-3xl text-[#FC5B24]' : 'text-2xl text-gray-900 dark:text-white'}`}>
        {valor}
      </p>
      {nota && <div className="mt-1 text-xs font-semibold text-gray-600 dark:text-slate-300">{nota}</div>}
    </div>
  );
}

/** Painel de resultado: mostra o motivo quando a conta não fecha. */
export function PainelResultado({ motivo, vazio, children }: { motivo?: string; vazio: boolean; children: ReactNode }) {
  const tx = useTxt();
  return (
    <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5 dark:border-white/10 dark:bg-[#0B1120]/60" aria-live="polite">
      <p className="mb-3 font-['JetBrains_Mono'] text-xs font-bold uppercase tracking-widest text-[#0A5CC4] dark:text-[#6B9EFF]">
        {tx(ROTULOS.resultado)}
      </p>
      {vazio ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">{tx(ROTULOS.preenchaParaVer)}</p>
      ) : motivo ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm font-semibold text-amber-800 dark:text-amber-300">{motivo}</p>
      ) : (
        <div className="grid gap-3">{children}</div>
      )}
      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-slate-500">
        <Lock size={12} /> {tx(ROTULOS.avisoCalculo)}
      </p>
    </div>
  );
}

/**
 * Compartilhar o resultado com o sócio ou o contador — é assim que a
 * ferramenta viaja sem anúncio. O link volta para a própria página.
 */
export function BotaoCompartilhar({ texto, path }: { texto: string; path: string }) {
  const tx = useTxt();
  const url = `https://wa.me/?text=${encodeURIComponent(`${texto}\n\nhttps://miseon.app.br${path}`)}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/50 px-4 py-2.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-500/10 dark:text-emerald-400"
    >
      <Share2 size={16} /> {tx(ROTULOS.enviarResultado)}
    </a>
  );
}

export function CtaMiseOn({ mensagemWhatsapp }: { mensagemWhatsapp: string }) {
  const tx = useTxt();
  return (
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#004198] via-[#0A5CC4] to-[#070C18] p-6 text-white shadow-xl sm:p-10">
      <h2 className="font-['Sora'] text-2xl font-extrabold sm:text-3xl">{tx(ROTULOS.ctaTitulo)}</h2>
      <p className="mt-3 max-w-2xl text-sm text-[#EAF1FB]/90 sm:text-base">{tx(ROTULOS.ctaTexto)}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <a
          href={zap(mensagemWhatsapp)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FC5B24] px-6 py-3.5 text-sm font-bold text-white shadow-lg transition hover:brightness-110"
        >
          <MessageCircle size={18} /> {tx(ROTULOS.ctaWhatsapp)}
        </a>
        <Link
          to="/cadastre-se"
          className="inline-flex items-center justify-center rounded-xl border border-white/30 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10"
        >
          {tx(ROTULOS.ctaTeste)}
        </Link>
      </div>
    </section>
  );
}

export function NavFerramentas() {
  const tx = useTxt();
  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-gray-200/70 bg-white/90 backdrop-blur-xl dark:border-white/10 dark:bg-[#070C18]/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" aria-label="MiseOn">
          <MiseOnLogo size={120} />
        </Link>
        <div className="flex items-center gap-3 text-sm font-semibold sm:gap-4">
          <Link to="/ferramentas" className="hidden text-gray-600 hover:text-gray-900 sm:inline dark:text-slate-300 dark:hover:text-white">
            {tx(ROTULOS.ferramentas)}
          </Link>
          <Link to="/blog" className="hidden text-gray-600 hover:text-gray-900 sm:inline dark:text-slate-300 dark:hover:text-white">
            Blog
          </Link>
          <LanguageToggle variant="pill" />
          <Link to="/cadastre-se" className="rounded-full bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-4 py-2 text-xs font-bold text-white shadow-md">
            {tx(ROTULOS.ctaTeste)}
          </Link>
        </div>
      </div>
    </nav>
  );
}

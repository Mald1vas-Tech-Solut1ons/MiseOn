import { useState } from 'react';
import { Cast, CheckCircle2, Copy, ExternalLink, LoaderCircle, Unplug } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { type CastDisplayMode, useGoogleCast } from '../../lib/googleCast';
import { useI18n } from '../../contexts/I18nContext';

const ROTULOS: Record<CastDisplayMode, string> = {
  auto: 'TV automática',
  cardapio: 'Cardápio 4K',
  senhas: 'Painel de senhas',
};

type Props = {
  criarUrl: (modo: CastDisplayMode) => string;
  tokenDisponivel: boolean;
};

export function CastTvControl({ criarUrl, tokenDisponivel }: Props) {
  const { tDynamic } = useI18n();
  const toast = useToast();
  const [modo, setModo] = useState<CastDisplayMode>('auto');
  const [copiado, setCopiado] = useState(false);
  const url = criarUrl(modo);
  const cast = useGoogleCast(url, modo);

  const ocupado = ['conectando', 'reconectando', 'desconectando'].includes(cast.estado);
  const conectado = cast.estado === 'conectado' || cast.estado === 'reconectando';
  const status = ({
    indisponivel: 'Cast indisponível',
    desconectado: 'Desconectado',
    conectando: 'Conectando…',
    conectado: 'Conectado',
    reconectando: 'Reconectando…',
    desconectando: 'Desconectando…',
    erro: 'Falha na conexão',
  } as const)[cast.estado];

  const copiarFallback = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
      toast('Link seguro da TV copiado', 'sucesso');
    } catch {
      toast('Não foi possível copiar. Abra o painel e copie o endereço.', 'erro');
    }
  };

  const transmitir = async () => {
    try {
      await cast.transmitir();
      toast(`${ROTULOS[modo]} transmitido para a TV`, 'sucesso');
    } catch {
      // O hook preserva a causa para a mensagem de estado; cancelamento é silencioso.
    }
  };

  return (
    <section className="mt-3 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3" aria-labelledby="cast-tv-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="cast-tv-title" className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-100">
            <Cast size={17} className="text-sky-600" /> {tDynamic('Transmitir para TV')}
          </h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {tDynamic('Escolha o conteúdo e selecione um Google Cast compatível na mesma rede.')}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
          conectado
            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
            : cast.estado === 'erro'
              ? 'bg-red-500/15 text-red-700 dark:text-red-300'
              : 'bg-gray-500/10 text-gray-600 dark:text-gray-300'
        }`}>
          {ocupado && <LoaderCircle size={13} className="animate-spin" />}
          {cast.estado === 'conectado' && <CheckCircle2 size={13} />}
          {status}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(Object.keys(ROTULOS) as CastDisplayMode[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setModo(item)}
            aria-pressed={modo === item}
            className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
              modo === item
                ? 'border-sky-600 bg-sky-600 text-white'
                : 'border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
            }`}
          >
            {ROTULOS[item]}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {!conectado ? (
          <button
            type="button"
            onClick={transmitir}
            disabled={!cast.appIdConfigurado || !tokenDisponivel || ocupado}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {ocupado ? <LoaderCircle size={15} className="animate-spin" /> : <Cast size={15} />}
            {cast.estado === 'reconectando' ? 'Reconectando…' : 'Escolher TV e transmitir'}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={transmitir}
              disabled={ocupado}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              <Cast size={15} /> {tDynamic('Atualizar conteúdo na TV')}
            </button>
            <button
              type="button"
              onClick={cast.parar}
              disabled={ocupado}
              className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-500/10 disabled:opacity-50"
            >
              <Unplug size={15} /> {tDynamic('Parar transmissão')}
            </button>
          </>
        )}
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 dark:border-gray-700 dark:text-gray-300"
        >
          <ExternalLink size={15} /> {tDynamic('Abrir no navegador')}
        </a>
        <button
          type="button"
          onClick={copiarFallback}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 dark:border-gray-700 dark:text-gray-300"
        >
          {copiado ? <CheckCircle2 size={15} className="text-emerald-600" /> : <Copy size={15} />}
          {copiado ? 'Link copiado' : 'Copiar link'}
        </button>
      </div>

      {!cast.appIdConfigurado && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
          {tDynamic('Cast ainda não foi configurado neste ambiente. Use “Abrir no navegador” ou “Copiar link”.')}
        </p>
      )}
      {!tokenDisponivel && (
        <p className="mt-2 text-xs text-red-700 dark:text-red-300">
          {tDynamic('Gere a credencial da TV antes de transmitir. Nenhuma sessão administrativa é enviada ao aparelho.')}
        </p>
      )}
      {cast.erro && <p className="mt-2 text-xs text-red-700 dark:text-red-300">{cast.erro}</p>}
      <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
        {tDynamic('A TV recebe apenas o link público protegido do painel; seu login do MiseOn não é compartilhado.')}
      </p>
    </section>
  );
}

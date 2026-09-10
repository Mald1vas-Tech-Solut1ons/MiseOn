import { useEffect, useRef, useState } from 'react';
import { Cast, LoaderCircle, ShieldCheck } from 'lucide-react';
import { MISEON_CAST_NAMESPACE, validarUrlPainelRecebida, type CastDisplayMessage } from '../lib/googleCast';
import { useI18n } from '../contexts/I18nContext';

type ReceiverContext = {
  addCustomMessageListener(namespace: string, listener: (event: { data?: unknown; senderId?: string }) => void): void;
  removeCustomMessageListener(namespace: string, listener: (event: { data?: unknown; senderId?: string }) => void): void;
  sendCustomMessage(namespace: string, senderId: string | undefined, data: object): void;
  setApplicationState(statusText: string): void;
  start(options?: { disableIdleTimeout?: boolean }): void;
};

type ReceiverWindow = Window & {
  cast?: { framework?: { CastReceiverContext: { getInstance(): ReceiverContext } } };
};

const STORAGE_KEY = 'miseon_cast_display_url';

function lerMensagem(data: unknown): CastDisplayMessage | null {
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    if (!parsed || typeof parsed !== 'object') return null;
    const message = parsed as Partial<CastDisplayMessage>;
    if (message.type !== 'LOAD_DISPLAY' || typeof message.url !== 'string') return null;
    if (!['auto', 'cardapio', 'senhas'].includes(message.mode ?? '')) return null;
    return message as CastDisplayMessage;
  } catch {
    return null;
  }
}

export default function CastReceiver() {
  const { tDynamic } = useI18n();
  const [painelUrl, setPainelUrl] = useState<string | null>(() => {
    const salva = localStorage.getItem(STORAGE_KEY);
    return salva ? validarUrlPainelRecebida(salva, window.location.origin) : null;
  });
  const [estado, setEstado] = useState<'iniciando' | 'pronto' | 'erro'>('iniciando');
  const [mensagem, setMensagem] = useState('Preparando o receptor MiseOn…');
  const possuiPainelInicial = useRef(!!painelUrl);

  useEffect(() => {
    let ativo = true;
    let context: ReceiverContext | null = null;
    let listener: ((event: { data?: unknown; senderId?: string }) => void) | null = null;

    const iniciar = () => {
      if (!ativo) return;
      const framework = (window as ReceiverWindow).cast?.framework;
      if (!framework) {
        setEstado('erro');
        setMensagem('Este navegador não é um receptor Google Cast.');
        return;
      }
      context = framework.CastReceiverContext.getInstance();
      listener = (event) => {
        const payload = lerMensagem(event.data);
        const urlSegura = payload ? validarUrlPainelRecebida(payload.url, window.location.origin) : null;
        if (!payload || !urlSegura) {
          context?.sendCustomMessage(MISEON_CAST_NAMESPACE, event.senderId, {
            type: 'DISPLAY_ERROR',
            message: 'Link de painel inválido ou sem credencial.',
          });
          return;
        }
        localStorage.setItem(STORAGE_KEY, urlSegura);
        setPainelUrl(urlSegura);
        setEstado('pronto');
        setMensagem('Painel MiseOn conectado');
        context?.setApplicationState('Painel MiseOn conectado');
        context?.sendCustomMessage(MISEON_CAST_NAMESPACE, event.senderId, {
          type: 'DISPLAY_READY',
          mode: payload.mode,
        });
      };
      context.addCustomMessageListener(MISEON_CAST_NAMESPACE, listener);
      context.start({ disableIdleTimeout: true });
      setEstado('pronto');
      setMensagem(possuiPainelInicial.current ? 'Restaurando o último painel…' : 'Escolha esta TV no MiseOn');
      context.setApplicationState('Receptor MiseOn pronto');
    };

    const existente = document.querySelector<HTMLScriptElement>('script[data-miseon-cast-receiver]');
    if ((window as ReceiverWindow).cast?.framework) iniciar();
    else if (existente) existente.addEventListener('load', iniciar, { once: true });
    else {
      const script = document.createElement('script');
      script.src = 'https://www.gstatic.com/cast/sdk/libs/caf_receiver/v3/cast_receiver_framework.js';
      script.async = true;
      script.dataset.miseonCastReceiver = 'true';
      script.addEventListener('load', iniciar, { once: true });
      script.addEventListener('error', () => {
        if (!ativo) return;
        setEstado('erro');
        setMensagem('Não foi possível carregar o receptor Google Cast.');
      }, { once: true });
      document.head.appendChild(script);
    }

    return () => {
      ativo = false;
      if (context && listener) context.removeCustomMessageListener(MISEON_CAST_NAMESPACE, listener);
    };
  }, []);

  if (painelUrl) {
    return (
      <main className="h-screen w-screen overflow-hidden bg-black">
        <iframe
          key={painelUrl}
          src={painelUrl}
          title="Painel de TV MiseOn"
          className="h-full w-full border-0"
          allow="autoplay"
        />
      </main>
    );
  }

  return (
    <main className="flex h-screen w-screen items-center justify-center bg-slate-950 p-10 text-white">
      <div className="max-w-xl text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-sky-500/15 text-sky-400">
          {estado === 'iniciando' ? <LoaderCircle size={48} className="animate-spin" /> : <Cast size={48} />}
        </div>
        <h1 className="mt-8 text-4xl font-black">MiseOn na TV</h1>
        <p className="mt-3 text-xl text-slate-300">{mensagem}</p>
        <p className="mt-8 inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm text-slate-400">
          <ShieldCheck size={17} /> {tDynamic('Este receptor nunca recebe o login administrativo.')}
        </p>
      </div>
    </main>
  );
}

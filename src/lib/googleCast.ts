import { useCallback, useEffect, useRef, useState } from 'react';

export const MISEON_CAST_NAMESPACE = 'urn:x-cast:com.miseon.display';

export type CastDisplayMode = 'auto' | 'cardapio' | 'senhas';
export type CastConnectionState =
  | 'indisponivel'
  | 'desconectado'
  | 'conectando'
  | 'conectado'
  | 'reconectando'
  | 'desconectando'
  | 'erro';

export type CastDisplayMessage = {
  type: 'LOAD_DISPLAY';
  url: string;
  mode: CastDisplayMode;
  sentAt: string;
};

type CastSession = {
  sendMessage(namespace: string, data: object | string): Promise<unknown>;
};

type CastContext = {
  addEventListener(type: string, listener: (event: { sessionState?: string }) => void): void;
  removeEventListener(type: string, listener: (event: { sessionState?: string }) => void): void;
  endCurrentSession(stopCasting: boolean): void;
  getCurrentSession(): CastSession | null;
  getSessionState(): string;
  requestSession(): Promise<unknown>;
  setOptions(options: { receiverApplicationId: string; autoJoinPolicy?: string }): void;
};

type CastWindow = Window & {
  __onGCastApiAvailable?: (available: boolean, errorInfo?: unknown) => void;
  cast?: {
    framework?: {
      CastContext: { getInstance(): CastContext };
      CastContextEventType: { SESSION_STATE_CHANGED: string };
    };
  };
  chrome?: {
    cast?: {
      AutoJoinPolicy?: { ORIGIN_SCOPED: string };
    };
  };
};

let senderSdkPromise: Promise<void> | null = null;

function carregarSenderSdk(): Promise<void> {
  if (senderSdkPromise) return senderSdkPromise;

  senderSdkPromise = new Promise((resolve, reject) => {
    const castWindow = window as CastWindow;
    if (castWindow.cast?.framework) {
      resolve();
      return;
    }

    const callbackAnterior = castWindow.__onGCastApiAvailable;
    castWindow.__onGCastApiAvailable = (available, errorInfo) => {
      callbackAnterior?.(available, errorInfo);
      if (available) resolve();
      else reject(new Error(`Google Cast indisponível${errorInfo ? `: ${String(errorInfo)}` : ''}`));
    };

    const existente = document.querySelector<HTMLScriptElement>('script[data-miseon-cast-sender]');
    if (existente) return;

    const script = document.createElement('script');
    script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
    script.async = true;
    script.dataset.miseonCastSender = 'true';
    script.onerror = () => reject(new Error('Não foi possível carregar o Google Cast.'));
    document.head.appendChild(script);
  });

  return senderSdkPromise;
}

export function criarMensagemDisplay(url: string, mode: CastDisplayMode): CastDisplayMessage {
  return { type: 'LOAD_DISPLAY', url, mode, sentAt: new Date().toISOString() };
}

/** Aceita somente o painel público desta mesma origem, com credencial e modo explícitos. */
export function validarUrlPainelRecebida(rawUrl: string, receiverOrigin: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.origin !== receiverOrigin) return null;
    if (!/^\/tv\/[^/]+$/.test(url.pathname)) return null;
    if (!url.searchParams.get('token')) return null;
    if (!['auto', 'cardapio', 'senhas'].includes(url.searchParams.get('modo') ?? '')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function mapearEstadoSessao(sessionState: string | undefined): CastConnectionState {
  switch (sessionState) {
    case 'SESSION_STARTING': return 'conectando';
    case 'SESSION_STARTED': return 'conectado';
    case 'SESSION_RESUMED': return 'reconectando';
    case 'SESSION_ENDING': return 'desconectando';
    case 'SESSION_START_FAILED': return 'erro';
    default: return 'desconectado';
  }
}

export function useGoogleCast(displayUrl: string, mode: CastDisplayMode) {
  const appId = (import.meta.env.VITE_GOOGLE_CAST_APP_ID ?? '').trim();
  const [estado, setEstado] = useState<CastConnectionState>(appId ? 'desconectado' : 'indisponivel');
  const [erro, setErro] = useState<string | null>(null);
  const contextRef = useRef<CastContext | null>(null);
  const latestRef = useRef({ displayUrl, mode });
  latestRef.current = { displayUrl, mode };

  const enviarPainel = useCallback(async (session?: CastSession | null) => {
    const atual = latestRef.current;
    if (!atual.displayUrl) throw new Error('O link seguro da TV ainda não está disponível.');
    const sessao = session ?? contextRef.current?.getCurrentSession();
    if (!sessao) throw new Error('Nenhuma TV está conectada.');
    await sessao.sendMessage(MISEON_CAST_NAMESPACE, criarMensagemDisplay(atual.displayUrl, atual.mode));
  }, []);

  useEffect(() => {
    if (!appId) {
      setEstado('indisponivel');
      return;
    }

    let ativo = true;
    let context: CastContext | null = null;
    let eventType = '';
    const aoMudarSessao = (event: { sessionState?: string }) => {
      if (!ativo) return;
      const proximo = mapearEstadoSessao(event.sessionState);
      setEstado(proximo);
      // Uma sessão retomada precisa receber novamente o display. Na criação,
      // `transmitir` já envia depois que o seletor resolve; evitar mensagem dupla.
      if (event.sessionState === 'SESSION_RESUMED') {
        void enviarPainel(context?.getCurrentSession()).then(
          () => ativo && setEstado('conectado'),
          (cause) => {
            if (!ativo) return;
            setEstado('erro');
            setErro(cause instanceof Error ? cause.message : 'Não foi possível abrir o painel na TV.');
          },
        );
      }
    };

    void carregarSenderSdk().then(() => {
      if (!ativo) return;
      const castWindow = window as CastWindow;
      const framework = castWindow.cast?.framework;
      if (!framework) throw new Error('Google Cast não está disponível neste navegador.');
      context = framework.CastContext.getInstance();
      contextRef.current = context;
      context.setOptions({
        receiverApplicationId: appId,
        autoJoinPolicy: castWindow.chrome?.cast?.AutoJoinPolicy?.ORIGIN_SCOPED,
      });
      eventType = framework.CastContextEventType.SESSION_STATE_CHANGED;
      context.addEventListener(eventType, aoMudarSessao);
      setEstado(mapearEstadoSessao(context.getSessionState()));
    }).catch((cause) => {
      if (!ativo) return;
      setEstado('indisponivel');
      setErro(cause instanceof Error ? cause.message : 'Google Cast indisponível.');
    });

    return () => {
      ativo = false;
      if (context && eventType) context.removeEventListener(eventType, aoMudarSessao);
    };
  }, [appId, enviarPainel]);

  const transmitir = useCallback(async () => {
    const context = contextRef.current;
    if (!context) throw new Error('Google Cast ainda não está pronto.');
    setErro(null);
    setEstado(context.getCurrentSession() ? 'conectado' : 'conectando');
    try {
      if (!context.getCurrentSession()) await context.requestSession();
      await enviarPainel(context.getCurrentSession());
      setEstado('conectado');
    } catch (cause) {
      setEstado(context.getCurrentSession() ? 'conectado' : 'desconectado');
      const mensagem = cause instanceof Error ? cause.message : String(cause);
      // Cancelar o seletor de dispositivos não é falha operacional.
      if (!/cancel/i.test(mensagem)) setErro(mensagem || 'Não foi possível transmitir para a TV.');
      throw cause;
    }
  }, [enviarPainel]);

  const parar = useCallback(() => {
    const context = contextRef.current;
    if (!context) return;
    setEstado('desconectando');
    context.endCurrentSession(true);
  }, []);

  return { appIdConfigurado: !!appId, estado, erro, transmitir, parar };
}

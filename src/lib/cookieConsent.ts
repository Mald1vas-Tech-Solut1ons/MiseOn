/**
 * Módulo de Gestão de Consentimento de Cookies (LGPD - Lei nº 13.709/2018 & GDPR)
 *
 * Categorias:
 * - Essenciais: Autenticação, carrinho, tema e segurança (sempre ativas/obrigatórias).
 * - Analíticos: Estatísticas de navegação, relatórios de tráfego (Google Analytics 4).
 * - Marketing: Rastreamento de conversões e campanhas (Meta Pixel / Facebook Ads).
 */

export type TipoConsentimento = 'indefinido' | 'aceito_todos' | 'apenas_essenciais' | 'personalizado';

export interface PreferenciasCookies {
  essenciais: true;
  analiticos: boolean;
  marketing: boolean;
}

export interface EstadoConsentimento {
  tipo: TipoConsentimento;
  preferencias: PreferenciasCookies;
  atualizadoEm: string;
}

export const STORAGE_KEY = 'miseon_cookie_consent_v1';
export const EVENT_COOKIE_UPDATED = 'miseon:cookie-consent-updated';
export const EVENT_OPEN_COOKIE_MANAGER = 'miseon:abrir-gerenciador-cookies';

const PREFERENCIAS_PADRAO: PreferenciasCookies = {
  essenciais: true,
  analiticos: false,
  marketing: false,
};

/**
 * Recupera o estado atual de consentimento do localStorage.
 * Se ainda não respondeu, retorna `tipo: 'indefinido'`.
 */
export function obterConsentimento(): EstadoConsentimento {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        tipo: 'indefinido',
        preferencias: { ...PREFERENCIAS_PADRAO },
        atualizadoEm: '',
      };
    }

    const parsed = JSON.parse(raw) as Partial<EstadoConsentimento>;
    return {
      tipo: parsed.tipo ?? 'indefinido',
      preferencias: {
        essenciais: true,
        analiticos: Boolean(parsed.preferencias?.analiticos),
        marketing: Boolean(parsed.preferencias?.marketing),
      },
      atualizadoEm: parsed.atualizadoEm ?? new Date().toISOString(),
    };
  } catch {
    return {
      tipo: 'indefinido',
      preferencias: { ...PREFERENCIAS_PADRAO },
      atualizadoEm: '',
    };
  }
}

/**
 * Salva o estado de consentimento e notifica os listeners na aplicação em tempo real.
 */
export function salvarConsentimento(
  tipo: TipoConsentimento,
  preferencias: { analiticos?: boolean; marketing?: boolean }
): EstadoConsentimento {
  const estado: EstadoConsentimento = {
    tipo,
    preferencias: {
      essenciais: true,
      analiticos: Boolean(preferencias.analiticos),
      marketing: Boolean(preferencias.marketing),
    },
    atualizadoEm: new Date().toISOString(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
  } catch (err) {
    console.warn('[cookieConsent] Falha ao persistir no localStorage:', err);
  }

  // Notifica o app via CustomEvent nativo
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_COOKIE_UPDATED, { detail: estado }));
  }

  return estado;
}

/**
 * Atalho: Aceitar todas as categorias (Essenciais + Analíticos + Marketing).
 */
export function aceitarTodos(): EstadoConsentimento {
  return salvarConsentimento('aceito_todos', { analiticos: true, marketing: true });
}

/**
 * Atalho: Aceitar apenas cookies essenciais (Recusa Analíticos e Marketing).
 */
export function aceitarApenasEssenciais(): EstadoConsentimento {
  return salvarConsentimento('apenas_essenciais', { analiticos: false, marketing: false });
}

/**
 * Verifica se uma determinada categoria possui permissão do usuário.
 */
export function temPermissao(tipo: 'analiticos' | 'marketing'): boolean {
  const estado = obterConsentimento();
  if (estado.tipo === 'indefinido') return false;
  return Boolean(estado.preferencias[tipo]);
}

/**
 * Dispara evento global para reabrir o gerenciador de consentimento.
 */
export function abrirGerenciadorCookies() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_OPEN_COOKIE_MANAGER));
  }
}

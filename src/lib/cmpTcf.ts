/**
 * Ponte com a CMP certificada do Google (IAB TCF v2).
 *
 * PARA QUE ISTO EXISTE:
 * Quem serve anúncio para o Espaço Econômico Europeu, Reino Unido ou Suíça
 * precisa colher consentimento por uma plataforma certificada pelo Google —
 * sem ela, o Google simplesmente para de servir anúncio para esse tráfego. A
 * mensagem é publicada no painel (AdSense → Privacidade e mensagens →
 * Mensagem de consentimento do EEE e do Reino Unido) e chega pelo mesmo
 * script do AdSense; não há tag nova para colar.
 *
 * O QUE ESTE ARQUIVO RESOLVE:
 * o visitante europeu veria DOIS diálogos de cookie — o da CMP do Google e o
 * nosso banner de LGPD, que nasceu para o visitante brasileiro. Quando a CMP
 * está na página ela tem a vez: o nosso banner se cala e apenas ESCUTA a
 * decisão, traduzindo-a para o consentimento interno. Assim o mesmo clique
 * vale para os dois mundos e ninguém responde a mesma pergunta duas vezes.
 *
 * Fora do EEE/UK/CH a CMP nem aparece, `__tcfapi` não existe e o nosso banner
 * segue sendo o único — que é o caso de praticamente todo o tráfego do
 * MiseOn.
 *
 * Números de finalidade do TCF que usamos (a lista é fixa, do IAB):
 *   1 — armazenar e acessar informação no dispositivo (pré-requisito)
 *   3 — criar perfil para publicidade personalizada
 *   4 — usar perfil para escolher publicidade personalizada
 *   8 — medir o desempenho do conteúdo (é o que o GA4 faz aqui)
 */

interface DadosTcf {
  eventStatus?: string;
  gdprApplies?: boolean;
  purpose?: { consents?: Record<number, boolean> };
}

type ApiTcf = (
  comando: string,
  versao: number,
  retorno: (dados: DadosTcf, sucesso: boolean) => void,
) => void;

type JanelaComTcf = Window & { __tcfapi?: ApiTcf };

/** A CMP está nesta página? (só fica true no tráfego em que ela é exigida) */
export function existeCmpTcf(): boolean {
  return typeof (window as JanelaComTcf).__tcfapi === 'function';
}

export interface DecisaoCmp {
  analiticos: boolean;
  marketing: boolean;
  /** `false` enquanto a pessoa ainda não respondeu a mensagem. */
  respondido: boolean;
}

/**
 * Escuta a decisão da CMP. Devolve a função de cancelamento.
 *
 * `tcloaded` chega quando já havia decisão guardada de uma visita anterior;
 * `useractioncomplete`, no clique de agora. Os dois interessam — o segundo é
 * o que muda a tela na hora.
 */
export function escutarCmpTcf(aoDecidir: (decisao: DecisaoCmp) => void): () => void {
  const api = (window as JanelaComTcf).__tcfapi;
  if (typeof api !== 'function') return () => {};

  let ativo = true;

  api('addEventListener', 2, (dados, sucesso) => {
    if (!ativo || !sucesso || !dados) return;
    if (dados.eventStatus !== 'tcloaded' && dados.eventStatus !== 'useractioncomplete') return;

    const consentimentos = dados.purpose?.consents ?? {};
    const podeArmazenar = consentimentos[1] === true;

    aoDecidir({
      marketing: podeArmazenar && consentimentos[3] === true && consentimentos[4] === true,
      analiticos: podeArmazenar && consentimentos[8] === true,
      respondido: dados.eventStatus === 'useractioncomplete' || Object.keys(consentimentos).length > 0,
    });
  });

  return () => {
    ativo = false;
  };
}

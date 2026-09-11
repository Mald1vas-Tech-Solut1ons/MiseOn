/**
 * Condições comerciais do MiseOn Kiosk.
 *
 * Fonte ÚNICA do preço. O Kiosk aparece na home, na landing de
 * autoatendimento e no painel do lojista — com o número escrito em cada tela,
 * bastaria um reajuste para o site anunciar um valor e a proposta cobrar
 * outro, e quem descobre isso é o cliente, no pior momento.
 *
 * VALOR PROVISÓRIO (11/09/2026): definido antes da reunião de custos com a
 * Bravus e sujeito a mudança. Enquanto for provisório, a tela diz "a partir
 * de" — prometer preço fechado que ainda não existe é o tipo de detalhe que
 * custa a confiança na primeira renegociação.
 */
export const KIOSK_COMERCIAL = {
  /** Mensalidade com o totem em comodato (o aparelho continua da MiseOn). */
  mensalidadeComodato: 600,

  /** O preço ainda não passou pela reunião de custos. */
  provisorio: true,

  /**
   * Compra do aparelho: ainda não há tabela. Não inventar número — "sob
   * consulta" é honesto; um valor chutado vira expectativa que depois se
   * quebra.
   */
  compraDisponivel: false,
} as const;

/** "R$ 600" — sem centavos, que é como preço de plano se escreve. */
export const kioskMensalidadeFormatada = (): string =>
  KIOSK_COMERCIAL.mensalidadeComodato.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

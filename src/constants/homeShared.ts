/**
 * Constantes e utilitários compartilhados entre os módulos da Home.
 */
export const WHATSAPP_VENDAS = '5511919889233';
export const zap = (msg: string) => `https://wa.me/${WHATSAPP_VENDAS}?text=${encodeURIComponent(msg)}`;

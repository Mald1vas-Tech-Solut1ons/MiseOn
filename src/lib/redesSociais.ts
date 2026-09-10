/**
 * Link de rede social da loja — o que o lojista digita vira endereço válido.
 *
 * POR QUE ISTO EXISTE: ninguém cola URL canônica. O dono da loja digita
 * "@natureba", "natureba", "instagram.com/natureba", "www.instagram.com/
 * natureba/?hl=pt-br" ou o link inteiro que copiou do próprio app, com
 * `?igsh=` grudado. Se o sistema guardar isso cru e jogar num href, metade dos
 * botões leva para lugar nenhum — e o lojista descobre pelo cliente.
 *
 * A normalização acontece na LEITURA, não na gravação: o que ele digitou fica
 * guardado como digitou (é o que ele reconhece quando volta na tela), e a
 * vitrine resolve para o endereço final. Assim uma regra melhor amanhã
 * conserta os cadastros de ontem sem migração de dados.
 */

export type RedeSocial = 'instagram' | 'tiktok' | 'facebook';

const BASE: Record<RedeSocial, string> = {
  instagram: 'https://instagram.com/',
  tiktok: 'https://tiktok.com/@',
  facebook: 'https://facebook.com/',
};

/** Domínios que já são a própria rede — aí o texto é a URL, não o usuário. */
const DOMINIO: Record<RedeSocial, RegExp> = {
  instagram: /(^|\.)instagram\.com$/i,
  tiktok: /(^|\.)tiktok\.com$/i,
  facebook: /(^|\.)(facebook\.com|fb\.com|fb\.me)$/i,
};

/** Tira o ruído que vem colado do app: rastreio, âncora, barra final. */
function limparCaminho(caminho: string): string {
  return caminho.replace(/^\/+/, '').replace(/\/+$/, '');
}

/**
 * Devolve o endereço final para abrir, ou `null` quando não dá para montar um
 * link honesto. `null` é resposta válida: melhor não mostrar o botão do que
 * mostrar um que erra.
 */
export function urlDaRede(rede: RedeSocial, bruto: string | null | undefined): string | null {
  const texto = (bruto ?? '').trim();
  if (!texto) return null;

  // Já veio como endereço (com ou sem protocolo).
  if (/^(https?:\/\/|www\.)/i.test(texto) || /\.[a-z]{2,}\//i.test(texto)) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(texto) ? texto : `https://${texto}`);
    } catch {
      return null;
    }
    // Endereço de OUTRA rede colado no campo errado: não corrige em silêncio.
    if (!DOMINIO[rede].test(url.hostname)) return null;
    const caminho = limparCaminho(url.pathname);
    if (!caminho) return null;
    // Query string dessas redes é rastreio (igsh, mibextid, _t/_r): não serve
    // para achar o perfil e ainda vaza de onde a pessoa veio.
    return `https://${url.hostname.replace(/^www\./i, '')}/${caminho}`;
  }

  // Veio o usuário: "@natureba" ou "natureba".
  const usuario = texto.replace(/^@+/, '').trim();
  if (!/^[A-Za-z0-9._-]{1,60}$/.test(usuario)) return null;
  return `${BASE[rede]}${usuario}`;
}

/** Rótulo curto para mostrar ao lado do ícone: sempre o arroba. */
export function arrobaDaRede(rede: RedeSocial, bruto: string | null | undefined): string | null {
  const url = urlDaRede(rede, bruto);
  if (!url) return null;
  const ultimo = url.split('/').filter(Boolean).pop() ?? '';
  const limpo = ultimo.replace(/^@+/, '');
  return limpo ? `@${limpo}` : null;
}

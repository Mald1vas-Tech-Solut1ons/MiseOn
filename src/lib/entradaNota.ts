/**
 * Entende o que o lojista colou ou digitou para consultar a nota.
 *
 * ─── O PROBLEMA ───────────────────────────────────────────────────────────
 * O campo era um textarea que só sabia responder duas coisas: "é URL" ou "não
 * é URL". Quem digitava a chave do jeito que ela vem IMPRESSA no cupom —
 * "3526 0801 1575 ..." em blocos de quatro — recebia uma recusa seca depois de
 * digitar 44 dígitos à mão. Quem colava do WhatsApp trazia junto quebra de
 * linha e caractere invisível, e o endereço não abria. Quem colava sem o
 * "https://" também não passava.
 *
 * Digitar 44 dígitos e ouvir "não entendi" é o tipo de atrito que faz o lojista
 * fechar o app e nunca mais tentar importar nota. Por isso aqui tudo é aceito
 * primeiro e classificado depois — e cada classificação sabe dizer o que dá
 * para fazer com ela.
 *
 * ─── O QUE A SEFAZ EXIGE (e por que a chave sozinha não basta) ─────────────
 * A consulta pública exige o hash do QR Code, um HMAC calculado com o CSC do
 * emitente. Ele não é derivável da chave: 44 dígitos digitados corretamente
 * ainda assim não abrem a nota. Isso não é limitação nossa e não adianta
 * insistir — mas o sistema PODE dizer isso na hora certa, com a chave já
 * reconhecida na tela, e oferecer a leitura pela foto do papel.
 */

/** Zero-width e afins que WhatsApp, Notes e PDF grudam no texto copiado. */
const INVISIVEIS = /[\u200B-\u200F\u2060\uFEFF\u00AD\u180E]/g;

export type TipoEntradaNota =
  /** URL do QR completa, com o código de segurança: dá para consultar. */
  | 'url_qr'
  /** Endereço da SEFAZ sem o hash — o da consulta impressa, com captcha. */
  | 'url_sem_hash'
  /** Só a chave de acesso (44 dígitos), em qualquer formatação. */
  | 'chave'
  /** Não deu para reconhecer nada. */
  | 'desconhecido';

export interface EntradaNota {
  tipo: TipoEntradaNota;
  /** URL pronta para a consulta — só existe em `url_qr`. */
  url?: string;
  /** Chave de 44 dígitos, quando encontrada em qualquer das formas. */
  chave?: string;
  /** UF deduzida dos dois primeiros dígitos da chave. */
  uf?: string;
  /** Frase curta para a tela mostrar enquanto a pessoa digita. */
  descricao: string;
  /** `true` quando dá para seguir pela SEFAZ agora. */
  podeConsultar: boolean;
}

const UFS: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL',
  '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP', '41': 'PR',
  '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
};

export function ufDaChave(chave: string): string | undefined {
  return UFS[chave.slice(0, 2)];
}

/**
 * Tira do texto tudo que só atrapalha: espaço em excesso, quebra de linha,
 * caractere invisível, aspas que o app de origem colou junto.
 */
function limpar(bruto: string): string {
  return (bruto ?? '')
    .replace(INVISIVEIS, '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .replace(/^["'<]+|["'>]+$/g, '')
    .trim();
}

/**
 * Acha a chave de 44 dígitos mesmo espalhada em blocos.
 *
 * O cupom imprime a chave em grupos de quatro, e é assim que ela é digitada.
 * Procurar `\d{44}` seguidos nunca acharia isso — por isso a busca acontece
 * sobre a sequência de dígitos, com a formatação descartada.
 */
export function extrairChaveDeTexto(texto: string): string | undefined {
  const direta = texto.match(/\b\d{44}\b/)?.[0];
  if (direta) return direta;

  const soDigitos = texto.replace(/\D/g, '');
  if (soDigitos.length === 44) return soDigitos;
  // Texto com a chave no meio ("Chave de acesso: 3526 ... Protocolo: 1234").
  if (soDigitos.length > 44) {
    const inicio = soDigitos.search(/(?:11|12|13|14|15|16|17|21|22|23|24|25|26|27|28|29|31|32|33|35|41|42|43|50|51|52|53)\d{42}/);
    if (inicio >= 0) return soDigitos.slice(inicio, inicio + 44);
  }
  return undefined;
}

/** O `p=` da URL do QR: chave|versão|ambiente|idCSC|hash. */
function partesDoParametroP(texto: string): string[] | null {
  const bruto = texto.match(/[?&]p=([^&\s"']+)/i)?.[1] ?? texto.match(/^p=([^&\s"']+)/i)?.[1];
  if (!bruto) return null;
  let decodificado = bruto;
  try {
    decodificado = decodeURIComponent(bruto);
  } catch {
    /* já vem decodificado ou tem % solto: segue com o original */
  }
  return decodificado.split('|');
}

/**
 * Classifica o que foi colado ou digitado.
 *
 * Aceita, e reconhece corretamente: a URL do QR inteira; a mesma URL sem
 * "https://"; só o trecho "p=..."; a URL com os separadores em %7C; a chave em
 * blocos de quatro como vem impressa; a chave dentro de uma frase; e o
 * endereço da consulta por chave, que não serve para a consulta automática.
 */
export function interpretarEntradaNota(bruto: string): EntradaNota {
  const texto = limpar(bruto);
  if (!texto) {
    return { tipo: 'desconhecido', descricao: 'Cole aqui o endereço do QR Code ou a chave da nota.', podeConsultar: false };
  }

  const partes = partesDoParametroP(texto);
  const chave = extrairChaveDeTexto(partes?.[0] ?? texto) ?? extrairChaveDeTexto(texto);
  const uf = chave ? ufDaChave(chave) : undefined;

  // Com "p=" e hash preenchido: é a URL do QR, a única que a SEFAZ atende.
  if (partes && partes.length >= 4 && partes[partes.length - 1]?.trim()) {
    // Sem protocolo o fetch não sai do lugar; e quem cola do WhatsApp quase
    // nunca traz o "https://" junto.
    let url = texto;
    if (!/^https?:\/\//i.test(url)) {
      url = /^p=/i.test(url)
        ? `https://www.nfce.fazenda.sp.gov.br/qrcode?${url}`
        : `https://${url.replace(/^\/+/, '')}`;
    }
    return {
      tipo: 'url_qr',
      url: url.replace(/\s+/g, ''),
      chave,
      uf,
      descricao: uf
        ? `Endereço do QR Code reconhecido — nota de ${uf}.`
        : 'Endereço do QR Code reconhecido.',
      podeConsultar: true,
    };
  }

  if (chave) {
    return {
      tipo: /https?:\/\/|fazenda\.|nfce|nfe/i.test(texto) ? 'url_sem_hash' : 'chave',
      chave,
      uf,
      descricao: uf
        ? `Chave de ${uf} reconhecida, mas falta o código de segurança que só existe dentro do QR Code.`
        : 'Chave reconhecida, mas falta o código de segurança que só existe dentro do QR Code.',
      podeConsultar: false,
    };
  }

  if (/https?:\/\/|fazenda\.|nfce|nfe/i.test(texto)) {
    return {
      tipo: 'url_sem_hash',
      descricao: 'Esse é o endereço da consulta por digitação, que pede captcha — não é o conteúdo do QR Code.',
      podeConsultar: false,
    };
  }

  const digitos = texto.replace(/\D/g, '').length;
  return {
    tipo: 'desconhecido',
    descricao: digitos > 0
      ? `Faltam dígitos para uma chave de nota fiscal (${digitos} de 44).`
      : 'Não reconheci isto como endereço de QR Code nem como chave de nota.',
    podeConsultar: false,
  };
}

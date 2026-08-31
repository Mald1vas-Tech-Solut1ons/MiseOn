/**
 * Preparo das fotos do cupom antes de mandar para a leitura por IA.
 *
 * ─── POR QUE NÃO MANDAR A FOTO CRUA ───────────────────────────────────────
 * Uma foto de celular moderno tem 3 a 8 MB. Em base64 ela cresce mais um
 * terço, e o cupom de mercado costuma precisar de 2 a 4 fotos para caber
 * inteiro. Isso estoura o limite de corpo da Edge Function e, no 4G da rua —
 * que é onde o lojista está quando acabou de comprar —, o upload demora tanto
 * que ele desiste antes de terminar.
 *
 * ─── POR QUE 1600 px E NÃO MENOS ──────────────────────────────────────────
 * Cupom é impressão de matriz em papel térmico: letra pequena, contraste
 * fraco. Abaixo de ~1600 px de largura a IA começa a confundir 8 com 6 e a
 * perder a coluna de quantidade — e um erro de leitura aqui vira estoque
 * errado, que é pior que não importar. 1600 px mantém o texto legível e
 * derruba o arquivo para algumas centenas de KB.
 */

/** Largura máxima enviada. Altura acompanha, preservando a proporção. */
const LARGURA_MAX = 1600;
/** JPEG a 0,85: o ruído de compressão ainda não come o traço da fonte. */
const QUALIDADE = 0.85;
/** Teto de segurança do corpo da requisição, somando todas as fotos. */
export const LIMITE_TOTAL_BYTES = 12 * 1024 * 1024;
export const MAX_FOTOS = 6;

export interface FotosPreparadas {
  /** Base64 puro, sem o prefixo `data:` — é o que a API do Gemini recebe. */
  base64: string[];
  mime: string;
  /** Tamanho total aproximado, para a tela avisar antes de tentar enviar. */
  bytes: number;
}

function carregarImagem(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não consegui abrir esta imagem.'));
    };
    img.src = url;
  });
}

/** Redimensiona e recodifica uma foto, devolvendo base64 sem o prefixo data:. */
async function prepararUma(arquivo: File): Promise<string> {
  const img = await carregarImagem(arquivo);
  const escala = Math.min(1, LARGURA_MAX / (img.naturalWidth || LARGURA_MAX));

  const canvas = document.createElement('canvas');
  canvas.width = Math.round((img.naturalWidth || LARGURA_MAX) * escala);
  canvas.height = Math.round((img.naturalHeight || LARGURA_MAX) * escala);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Este navegador não conseguiu processar a imagem.');
  // Fundo branco: PNG com transparência viraria preto no JPEG e apagaria o
  // texto do cupom.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL('image/jpeg', QUALIDADE);
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

/**
 * Prepara as fotos escolhidas pelo lojista para a leitura por IA.
 *
 * Falha cedo e com motivo: mandar 8 fotos ou 30 MB para o servidor só para
 * receber um erro genérico depois é o tipo de espera que faz desistir.
 */
export async function prepararFotosCupom(arquivos: File[]): Promise<FotosPreparadas> {
  if (arquivos.length === 0) throw new Error('Escolha ao menos uma foto do cupom.');
  if (arquivos.length > MAX_FOTOS) {
    throw new Error(`Máximo de ${MAX_FOTOS} fotos por cupom. Fotografe o papel em menos pedaços.`);
  }

  const base64 = await Promise.all(arquivos.map(prepararUma));
  // base64 carrega 4 caracteres para cada 3 bytes.
  const bytes = base64.reduce((acc, b) => acc + Math.ceil((b.length * 3) / 4), 0);

  if (bytes > LIMITE_TOTAL_BYTES) {
    throw new Error('As fotos ficaram grandes demais juntas. Envie o cupom em menos partes.');
  }

  return { base64, mime: 'image/jpeg', bytes };
}

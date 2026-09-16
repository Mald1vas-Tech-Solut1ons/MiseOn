// Gera as capas fotográficas dos artigos do blog com o Gemini.
//
//   node scripts/gerar-capas-ia.mjs                 todas as que faltam
//   node scripts/gerar-capas-ia.mjs loja-lotada     só essa
//   node scripts/gerar-capas-ia.mjs --refazer       regera mesmo se já existe
//
// As capas do blog são fotografia de cena real de food service — foi assim
// que as primeiras foram feitas e é o padrão da casa. Cada artigo tem a sua:
// capa repetida entre matérias faz o hub parecer um site de conteúdo
// reciclado.
//
// DUAS REGRAS QUE VALEM PARA TODO PROMPT AQUI:
//  • nada de texto na imagem. Modelo de imagem escreve palavra torta, e
//    letra torta em capa de artigo destrói a credibilidade do texto;
//  • cena brasileira de verdade — balcão, vitrine, self-service, motoboy.
//    Foto de cozinha de revista americana não se parece com o cliente.
//
// A marca entra depois, por scripts/aplicar-marca-capa.mjs, que carimba o
// lockup oficial num canto. Assim a foto vem do Gemini e a marca vem de
// public/, sem o modelo tentar desenhar um logo.
import { writeFile, access } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const MODELO = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image';
const OUT = path.resolve('public/blog-covers');

const ESTILO = [
  'Professional editorial photography for a business article.',
  'Real Brazilian food service scene, natural documentary feel, not stock-photo posed.',
  'Warm practical lighting, shallow depth of field, 35mm lens look, cinematic color grading.',
  'Absolutely NO text, NO letters, NO numbers, NO logos, NO signage, NO watermarks anywhere in the image.',
  'No distorted hands, no extra fingers, no warped faces.',
].join(' ');

const CAPAS = {
  'loja-lotada': {
    arquivo: 'loja-lotada-divida-enorme-cover',
    cena:
      'A busy Brazilian bakery counter at peak hour seen from behind the service line: a long queue of customers waiting, staff in aprons moving fast, glass display case full of breads and pastries glowing. In the foreground, slightly out of focus, the owner stands at the register holding a thick stack of supplier invoices, shoulders tense, looking down at the papers instead of at the crowd. The contrast between the full store and the worried owner is the whole point of the frame.',
  },
  'calculadora-vazamento': {
    arquivo: 'calculadora-vazamento-cover',
    cena:
      'Close-up of a stainless steel restaurant prep counter at the end of service: a digital kitchen scale, trimmed meat scraps on a cutting board, a half-used package of cheese, and a small puddle of sauce. Beside them, a clipboard with a blank inventory sheet and a pen. Cold blue window light from the left mixing with warm kitchen light. The frame should feel like quiet, ordinary, everyday waste — nothing dramatic.',
  },
  'delivery-que-da-dinheiro': {
    arquivo: 'delivery-margem-por-canal-cover',
    cena:
      'A Brazilian delivery kitchen pass at night: rows of sealed takeout containers in paper bags lined up on a stainless counter, each with a blank label, a tablet propped up showing an order queue as abstract colored blocks, and a motorcycle courier in a red jacket blurred in the background reaching for a thermal bag. Warm kitchen light against the cool blue night outside the door.',
  },
  'site-que-parece-amador': {
    arquivo: 'presenca-digital-restaurante-cover',
    cena:
      'A customer sitting at a small restaurant table at night holding a smartphone, the screen glowing on their face, hesitating before ordering. The phone screen shows only abstract blurred shapes of an interface, no readable text. Empty plate and a glass of beer on the table, restaurant warm and busy but softly out of focus behind. The mood is hesitation at the moment of deciding to buy.',
  },
  'padaria-onde-esta-o-lucro': {
    arquivo: 'padaria-onde-esta-o-lucro-cover',
    cena:
      'Early morning in a Brazilian neighborhood bakery: a baker in a white apron pulling a tray of golden French rolls from the oven, steam rising, while in the same frame the display shelf holds packaged industrial products and bottled drinks. Soft dawn light through the front window. The frame contrasts what the bakery MAKES with what it merely RESELLS.',
  },
  'buffet-por-outro-angulo': {
    arquivo: 'buffet-engenharia-do-balcao-cover',
    cena:
      'A Brazilian self-service buffet line at lunch rush shot from a low angle along the counter: gleaming stainless steel gastronorm pans with rice, beans, farofa, grilled meat and colorful salads, heat lamps glowing above, a customer plate being filled in the foreground and a scale at the end of the line slightly out of focus. Busy, appetizing and orderly.',
  },
};

function lerChave() {
  // A chave vive no .env.local (é a mesma do app). Nada é impresso.
  const env = readFileSync(path.resolve('.env.local'), 'utf8');
  const achado = env.match(/VITE_GEMINI_API_KEY\s*=\s*(.+)/);
  const chave = (achado?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
  if (!chave) throw new Error('VITE_GEMINI_API_KEY não encontrada em .env.local');
  return chave;
}

async function existe(arquivo) {
  try {
    await access(arquivo);
    return true;
  } catch {
    return false;
  }
}

async function gerar(chave, cena) {
  const resposta = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${chave}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${cena}\n\n${ESTILO}` }] }],
        generationConfig: {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio: '16:9' },
        },
      }),
    },
  );

  const corpo = await resposta.json();
  if (!resposta.ok) {
    throw new Error(`${resposta.status} ${JSON.stringify(corpo.error ?? corpo).slice(0, 300)}`);
  }

  const partes = corpo.candidates?.[0]?.content?.parts ?? [];
  const imagem = partes.find((p) => p.inlineData?.data);
  if (!imagem) {
    const motivo = corpo.candidates?.[0]?.finishReason ?? 'sem imagem na resposta';
    throw new Error(`o modelo não devolveu imagem (${motivo})`);
  }
  return Buffer.from(imagem.inlineData.data, 'base64');
}

const args = process.argv.slice(2);
const refazer = args.includes('--refazer');
const filtro = args.find((a) => !a.startsWith('--'));
const chaves = filtro ? Object.keys(CAPAS).filter((k) => k.startsWith(filtro)) : Object.keys(CAPAS);

if (!chaves.length) {
  console.error(`nenhuma capa casa com "${filtro}". Disponíveis: ${Object.keys(CAPAS).join(', ')}`);
  process.exit(1);
}

// Sem cota na chave? --prompts imprime o texto de cada capa para colar no
// app do Gemini (ou no AI Studio) e salvar o arquivo com o nome indicado.
if (args.includes('--prompts')) {
  for (const nome of chaves) {
    const { arquivo, cena } = CAPAS[nome];
    console.log(`
===== ${arquivo}.jpg =====`);
    console.log(`${cena}

${ESTILO}`);
  }
  console.log(`
Salve cada imagem em public/blog-covers/ com o nome do cabeçalho.`);
  process.exit(0);
}

const chave = lerChave();
console.log(`Gerando com ${MODELO}...`);

for (const nome of chaves) {
  const { arquivo, cena } = CAPAS[nome];
  const destino = path.join(OUT, `${arquivo}.jpg`);

  if (!refazer && (await existe(destino))) {
    console.log(`  · ${arquivo}.jpg já existe (use --refazer para trocar)`);
    continue;
  }

  try {
    const png = await gerar(chave, cena);
    await writeFile(destino, png);
    console.log(`  ✓ ${arquivo}.jpg  (${Math.round(png.length / 1024)} KB)`);
  } catch (err) {
    console.error(`  ✗ ${arquivo}: ${err.message}`);
    process.exitCode = 1;
  }
}

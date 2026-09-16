// Monta Reels 1080x1920 a partir dos ativos que ja existem no repositorio:
// gravacoes de tela largas viram cartao sobre fundo da marca, com legenda
// queimada. Nada aqui depende do Supabase — roda com o banco fora do ar.
//
//   node scripts/gerar-reels.mjs            monta todos
//   node scripts/gerar-reels.mjs palavras   monta so esse
//
// Saida: output/marketing/reels/<nome>.mp4
import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const RAIZ = process.cwd();
const OUT = path.resolve('output/marketing/reels');
const TMP = path.resolve('output/marketing/reels/.tmp');
const FONTE_TIT = path.resolve('output/marketing/fonts/Sora-static.ttf');
const VIDEO = path.resolve('output/marketing/ativos/video');
const BRAND = path.resolve('public/brand');

// Tokens oficiais — public/MiseOn brand identity/entrega.
const NAVY = '0x004198';
const LARANJA = 'FC5B24';

function ff(args) {
  return new Promise((ok, falha) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' });
    p.on('close', (c) => (c === 0 ? ok() : falha(new Error('ffmpeg saiu com ' + c))));
  });
}

// ffmpeg no Windows exige escapar ':' e '\' dentro de filtros, e o drawtext
// ainda quebra em apostrofo. Passar o texto por arquivo evita os tres.
function legenda(texto, y, tamanho, cor) {
  const t = texto.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\u2019");
  return `drawtext=fontfile='${FONTE_TIT.replace(/\\/g, '/').replace(':', '\\:')}':`
    + `text='${t}':fontcolor=${cor}:fontsize=${tamanho}:`
    + `x=(w-text_w)/2:y=${y}:line_spacing=12:box=0`;
}

/**
 * Um plano: recorte de um video largo, encaixado em 1080x1920 sobre o fundo
 * da marca, com titulo em cima e rotulo embaixo. A area segura do Reels e
 * respeitada: nada de texto nos 250px do topo nem nos 350px da base.
 */
async function plano({ arquivo, inicio, duracao, titulo, rotulo, saida }) {
  const filtro = [
    `[0:v]trim=start=${inicio}:duration=${duracao},setpts=PTS-STARTPTS,`
      + `scale=1016:-2,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:${NAVY}[v]`,
    `color=c=${NAVY}:s=1080x1920:d=${duracao}[bg]`,
    `[bg][v]overlay=0:0,`
      + legenda(titulo, 430, 62, '0xFFFFFF')
      + (rotulo ? ',' + legenda(rotulo, 1400, 40, '0x' + LARANJA) : '')
      + '[out]',
  ].join(';');

  await ff(['-i', arquivo, '-filter_complex', filtro, '-map', '[out]',
    '-r', '30', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium',
    '-pix_fmt', 'yuv420p', '-an', '-y', saida]);
}

/** Cartela parada (PNG 1080x1920) virando plano de video. */
async function cartela({ png, duracao, saida }) {
  await ff(['-loop', '1', '-i', png, '-t', String(duracao),
    '-vf', 'scale=1080:1920,zoompan=z=\'min(zoom+0.0008,1.06)\':d=1:s=1080x1920:fps=30',
    '-r', '30', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium',
    '-pix_fmt', 'yuv420p', '-an', '-y', saida]);
}

/** Ativo de video pronto, reenquadrado para 9x16. */
async function ativo({ arquivo, inicio, duracao, saida, modo = 'cobrir' }) {
  const vf = modo === 'cobrir'
    ? 'scale=1080:-2,crop=1080:1920:(iw-1080)/2:(ih-1920)/2'
    : `scale=1080:-2,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:${NAVY}`;
  const args = ['-i', arquivo];
  if (inicio) args.unshift('-ss', String(inicio));
  await ff([...args, '-t', String(duracao), '-vf', vf,
    '-r', '30', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium',
    '-pix_fmt', 'yuv420p', '-an', '-y', saida]);
}

// ── os Reels ──────────────────────────────────────────────────────────
// Cada plano cita a fonte no proprio repositorio. O trecho do Case1 entre
// 0:28 e 0:34 mostra a loja Natureba e NAO pode ser usado: e o cadastro
// preparado para a visita comercial, nao e material de divulgacao.
const CASE = path.join(BRAND, 'MiseOn Case1.mp4');
const VINHETA = path.join(VIDEO, 'vinheta-miseon-sem-marca.mp4');
const ASSINATURA = path.join(VIDEO, 'assinatura-final-9x16.mp4');

const REELS = {
  // Nasce do E07 "Pelas palavras". A prova ao vivo — a busca do Google
  // encontrando o cardapio — ja existe gravada no Case1.
  palavras: [
    { tipo: 'plano', arquivo: CASE, inicio: 14.0, duracao: 2.2,
      titulo: 'Na rua o cliente acha\na loja pelo endereço.', rotulo: 'O QUADRO DE PREÇOS' },
    { tipo: 'plano', arquivo: CASE, inicio: 16.6, duracao: 2.4,
      titulo: 'Na internet,\nninguém te acha.', rotulo: '' },
    { tipo: 'ativo', arquivo: VINHETA, inicio: 2.4, duracao: 2.2, modo: 'caber' },
    { tipo: 'cartela', png: 'L06-02.png', duracao: 2.4 },
    { tipo: 'plano', arquivo: CASE, inicio: 48.6, duracao: 1.9,
      titulo: 'Ele acha\npelas palavras.', rotulo: 'BUSCA REAL, SEM MONTAGEM' },
    { tipo: 'plano', arquivo: CASE, inicio: 50.9, duracao: 2.2,
      titulo: 'E o prato aparece,\nnão só a loja.', rotulo: '' },
    { tipo: 'plano', arquivo: CASE, inicio: 34.6, duracao: 4.0,
      titulo: 'Nome, descrição\ne adicional em cada um.', rotulo: 'O QUE O GOOGLE LÊ' },
    { tipo: 'cartela', png: 'L06-03.png', duracao: 3.0 },
    { tipo: 'plano', arquivo: CASE, inicio: 53.9, duracao: 2.6,
      titulo: '30 dias grátis,\nsem cartão.', rotulo: 'MISEON.APP.BR' },
    { tipo: 'ativo', arquivo: ASSINATURA, duracao: 2.5, modo: 'cobrir' },
  ],
};

async function montar(nome) {
  const planos = REELS[nome];
  await mkdir(TMP, { recursive: true });
  const pedacos = [];
  for (let i = 0; i < planos.length; i++) {
    const p = planos[i];
    const saida = path.join(TMP, `${nome}-${String(i).padStart(2, '0')}.mp4`);
    if (p.tipo === 'plano') await plano({ ...p, saida });
    else if (p.tipo === 'cartela') {
      await cartela({ png: path.resolve('output/marketing/cartelas', p.png), duracao: p.duracao, saida });
    } else await ativo({ ...p, saida });
    pedacos.push(saida);
    console.log(`  ${i + 1}/${planos.length}  ${path.basename(saida)}`);
  }

  const lista = path.join(TMP, `${nome}.txt`);
  const { writeFile } = await import('node:fs/promises');
  await writeFile(lista, pedacos.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
  const final = path.join(OUT, `${nome}.mp4`);
  await ff(['-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', '-y', final]);
  console.log(`\n${final}`);
  return final;
}

const alvo = process.argv[2];
const nomes = alvo ? [alvo] : Object.keys(REELS);
await mkdir(OUT, { recursive: true });
for (const n of nomes) {
  if (!REELS[n]) { console.error(`reels "${n}" nao existe`); process.exit(1); }
  console.log(`\n${n}`);
  await montar(n);
}
await rm(TMP, { recursive: true, force: true });

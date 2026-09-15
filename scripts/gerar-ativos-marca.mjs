// Gera os ativos de marca em vídeo (vinheta, assinatura e transições).
//
// Render quadro a quadro no Chrome (scripts/ativos/motor.html) e codificação
// com ffmpeg. Determinístico: o tempo é parâmetro, não animação de CSS, então
// o mesmo frame sai igual em qualquer máquina.
//
// Saída em output/marketing/ativos/video/, em três formatos:
//   .mov  — ProRes 4444 com alfa. É o que importa no CapCut desktop, Premiere
//           e DaVinci quando a transição precisa ficar POR CIMA do vídeo.
//   .webm — VP9 com alfa, mais leve, para editores web.
//   .mp4  — sem alfa, achatado. Vai ENTRE dois clipes, não por cima.
//
// Uso:  node scripts/gerar-ativos-marca.mjs
import puppeteer from 'puppeteer';
import { mkdir, rm, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const RAIZ   = path.resolve('output/marketing/ativos');
const VIDEO  = path.join(RAIZ, 'video');
const TMP    = path.join(RAIZ, '.frames');
const FPS    = 30;

const VERTICAL   = { w: 1080, h: 1920, sufixo: '9x16' };
const HORIZONTAL = { w: 1920, h: 1080, sufixo: '16x9' };

const PLANO = [
  { nome: 'vinheta-abertura',   formatos: [VERTICAL, HORIZONTAL] },
  { nome: 'assinatura-final',   formatos: [VERTICAL, HORIZONTAL] },
  { nome: 'transicao-corte',    formatos: [VERTICAL, HORIZONTAL] },
  { nome: 'transicao-barras',   formatos: [VERTICAL] },
  { nome: 'transicao-seta',     formatos: [VERTICAL] },
];

const rodar = (cmd, args) => new Promise((ok, erro) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  p.stderr.on('data', (d) => { stderr += d; });
  p.on('close', (code) => code === 0 ? ok() : erro(new Error(`${cmd} saiu ${code}\n${stderr.slice(-800)}`)));
});

await mkdir(VIDEO, { recursive: true });

const navegador = await puppeteer.launch({
  headless: 'new', executablePath: CHROME,
  args: ['--no-sandbox', '--force-device-scale-factor=1', '--hide-scrollbars'],
});
const motorUrl = pathToFileURL(path.resolve('scripts/ativos/motor.html')).href;

let feitos = 0;
for (const { nome, formatos } of PLANO) {
  for (const fmt of formatos) {
    const page = await navegador.newPage();
    await page.setViewport({ width: fmt.w, height: fmt.h, deviceScaleFactor: 1 });
    await page.goto(motorUrl, { waitUntil: 'networkidle0' });

    const dur = await page.evaluate((n, w, h) => window.MISEON.montar(n, w, h), nome, fmt.w, fmt.h);
    const comAlfa = await page.evaluate((n) => window.MISEON.temAlfa(n), nome);
    const total = Math.round(dur * FPS);

    await rm(TMP, { recursive: true, force: true });
    await mkdir(TMP, { recursive: true });

    const alvo = await page.$('#c');
    for (let i = 0; i < total; i++) {
      await page.evaluate((n, t) => window.MISEON.quadro(n, t), nome, i / FPS);
      await alvo.screenshot({
        path: path.join(TMP, String(i).padStart(4, '0') + '.png'),
        omitBackground: comAlfa,
      });
    }
    await page.close();

    const base = `${nome}-${fmt.sufixo}`;
    const entrada = ['-y', '-framerate', String(FPS), '-i', path.join(TMP, '%04d.png')];

    if (comAlfa) {
      // ProRes 4444: o formato que qualquer editor sério abre com alfa intacto.
      await rodar('ffmpeg', [...entrada, '-c:v', 'prores_ks', '-profile:v', '4444',
        '-pix_fmt', 'yuva444p10le', path.join(VIDEO, base + '.mov')]);
      await rodar('ffmpeg', [...entrada, '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p',
        '-b:v', '0', '-crf', '28', '-row-mt', '1', path.join(VIDEO, base + '.webm')]);
      // Versão achatada sobre o azul da marca, para quem não tem alfa.
      await rodar('ffmpeg', ['-y', '-f', 'lavfi', '-i', `color=c=0x004098:s=${fmt.w}x${fmt.h}:r=${FPS}`,
        '-framerate', String(FPS), '-i', path.join(TMP, '%04d.png'),
        '-filter_complex', '[0:v][1:v]overlay=shortest=1,format=yuv420p',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
        path.join(VIDEO, base + '.mp4')]);
    } else {
      await rodar('ffmpeg', [...entrada, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
        '-pix_fmt', 'yuv420p', path.join(VIDEO, base + '.mp4')]);
    }

    console.log(`  ${base}  ${total} quadros  ${dur.toFixed(2)}s${comAlfa ? '  (alfa)' : ''}`);
    feitos++;
  }
}

await rm(TMP, { recursive: true, force: true });
await navegador.close();
console.log(`\n${feitos} ativos em ${VIDEO}`);
console.log((await readdir(VIDEO)).sort().join('\n'));

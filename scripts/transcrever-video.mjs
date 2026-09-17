// Transcreve um vídeo (ou uma pasta deles) para virar apuração de matéria.
//
//   node scripts/transcrever-video.mjs "C:/Users/rafae/Video"
//   node scripts/transcrever-video.mjs "C:/Users/rafae/Video/aula.mp4"
//
// POR QUE ISTO EXISTE:
// matéria de blog escrita a partir do TÍTULO de um vídeo vira tese genérica —
// cinco artigos que poderiam ter sido escritos sem assistir a nada. A mesma
// matéria escrita a partir do que a reportagem realmente mostra tem
// personagem, número e caso. A diferença entre as duas versões foi exatamente
// esta: ouvir antes de escrever.
//
// O que sai: um .txt ao lado do vídeo, com a transcrição integral e uma seção
// "=== PONTOS ===" com tese, argumentos, números citados, casos e conselhos.
// Esse arquivo é APURAÇÃO, não texto publicável: os números pertencem à fonte
// e precisam ser atribuídos a ela na matéria.
//
// Requisitos: ffmpeg no PATH e VITE_GEMINI_API_KEY no .env.local.
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Modelos caducam sem aviso (já aconteceu neste projeto), por isso a cascata.
const MODELOS = [
  'gemini-flash-latest',
  'gemini-3.5-transcribe',
  'gemini-3.6-flash',
  'gemini-flash-lite-latest',
];

const PROMPT = `Transcreva este áudio em português do Brasil, integralmente e com fidelidade.

Depois da transcrição, escreva uma seção "=== PONTOS ===" com:
- a tese central em uma frase
- os argumentos principais, na ordem em que aparecem
- todo número, percentual, valor em reais ou prazo citado (marque se foi dito como estimativa)
- exemplos concretos de lojas, casos ou situações citados
- conselhos práticos dados ao dono de restaurante

Não invente nada que não esteja no áudio.`;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function lerChave() {
  const env = readFileSync(path.resolve('.env.local'), 'utf8');
  const chave = (env.match(/VITE_GEMINI_API_KEY\s*=\s*(.+)/)?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
  if (!chave) throw new Error('VITE_GEMINI_API_KEY não encontrada em .env.local');
  return chave;
}

/**
 * Áudio mono de 16 kHz a 24 kbps.
 *
 * O envio é inline (base64), e o limite prático da requisição é o que
 * derruba a conexão antes da cota: com o vídeo em 48 kbps um arquivo de 13
 * minutos estourava com ECONNRESET. A 24 kbps a voz continua perfeitamente
 * inteligível para transcrição e o arquivo cabe.
 */
function extrairAudio(video, destino) {
  const r = spawnSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-i', video,
    '-vn', '-ac', '1', '-ar', '16000', '-b:a', '24k', destino], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg falhou: ${String(r.stderr).slice(0, 200)}`);
}

async function transcrever(chave, arquivoMp3) {
  const audio = readFileSync(arquivoMp3).toString('base64');
  let ultimoErro = '';

  for (let volta = 0; volta < 3; volta++) {
    for (const modelo of MODELOS) {
      try {
        const resposta = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${chave}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: PROMPT }, { inlineData: { mimeType: 'audio/mp3', data: audio } }] }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 16000 },
            }),
          },
        );
        const corpo = await resposta.json();
        if (!resposta.ok) {
          ultimoErro = `${modelo} ${resposta.status} ${String(corpo.error?.message ?? '').slice(0, 70)}`;
          continue;
        }
        const texto = (corpo.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
        if (texto) return { texto, modelo };
        ultimoErro = `${modelo} sem texto (${corpo.candidates?.[0]?.finishReason ?? '?'})`;
      } catch (err) {
        ultimoErro = `${modelo} ${String(err.message).slice(0, 70)}`;
      }
    }
    // 503 de modelo sobrecarregado é comum e passa sozinho.
    await espera(8000 * (volta + 1));
  }
  throw new Error(ultimoErro || 'não transcreveu');
}

const alvo = process.argv[2];
if (!alvo || !existsSync(alvo)) {
  console.error('uso: node scripts/transcrever-video.mjs <arquivo.mp4 | pasta>');
  process.exit(1);
}

const videos = statSync(alvo).isDirectory()
  ? readdirSync(alvo).filter((f) => /\.(mp4|mov|mkv|webm|m4v)$/i.test(f)).map((f) => path.join(alvo, f))
  : [alvo];

if (!videos.length) {
  console.error(`nenhum vídeo em ${alvo}`);
  process.exit(1);
}

const chave = lerChave();
const temporaria = mkdtempSync(path.join(tmpdir(), 'miseon-transcricao-'));

for (const video of videos) {
  const nome = path.basename(video, path.extname(video));
  const destino = path.join(path.dirname(video), `${nome}.txt`);
  if (existsSync(destino)) {
    console.log(`  · ${nome}: já transcrito`);
    continue;
  }

  process.stdout.write(`  ${nome}... `);
  try {
    const mp3 = path.join(temporaria, `${nome}.mp3`);
    extrairAudio(video, mp3);
    const { texto, modelo } = await transcrever(chave, mp3);
    writeFileSync(destino, texto, 'utf8');
    console.log(`${texto.length} caracteres [${modelo}]`);
  } catch (err) {
    console.log(`FALHOU — ${err.message}`);
    process.exitCode = 1;
  }
}

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Todo vídeo que o código serve estático precisa estar VERSIONADO.
 *
 * Existir na pasta public/ não basta, e foi assim que /videos e /depoimentos
 * passaram a registrar "The element has no supported sources" em produção: o
 * .gitignore ignora `*.mp4` e libera um punhado de arquivos por exceção
 * nominal. `public/MiseOn brand identity/videoIntro1.mp4` ficou de fora da
 * lista, nunca foi commitado, e a Vercel — que publica a partir do repositório
 * — nunca o teve. Na máquina de quem escreveu o código o vídeo tocava.
 *
 * O erro ainda chega disfarçado: o rewrite "/(.*)" → "/app" do vercel.json
 * devolve o HTML do SPA com status 200 para caminho inexistente. O <video>
 * recebe uma página web onde esperava vídeo e diz apenas que não há fonte
 * suportada — nunca "404". Medido em 22/09/2026: a resposta de produção vinha
 * com `content-type: text/html` e 35 KB.
 *
 * Por isso a conferência aqui é contra o índice do git, não contra o disco.
 */

const RAIZ = process.cwd();
const EXTENSOES = /\.(mp4|webm|mov|ogv)$/i;

const versionados = new Set(
  execFileSync('git', ['ls-files', 'public'], { cwd: RAIZ, encoding: 'utf-8' })
    .split('\n')
    .map((linha) => linha.trim())
    .filter(Boolean),
);

function arquivosDeCodigo(dir: string, acumulado: string[] = []): string[] {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const alvo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) arquivosDeCodigo(alvo, acumulado);
    else if (/\.(ts|tsx)$/.test(entrada.name) && !/\.test\.tsx?$/.test(entrada.name)) {
      acumulado.push(alvo);
    }
  }
  return acumulado;
}

/** Caminhos absolutos de mídia citados em literais de string dentro de src/. */
function midiasCitadas() {
  const achados: { caminho: string; arquivo: string }[] = [];
  for (const arquivo of arquivosDeCodigo(path.join(RAIZ, 'src'))) {
    const conteudo = readFileSync(arquivo, 'utf-8');
    for (const [, bruto] of conteudo.matchAll(/['"`](\/[^'"`\s)]+?\.(?:mp4|webm|mov|ogv))['"`]/gi)) {
      achados.push({
        caminho: decodeURIComponent(bruto.split('?')[0]),
        arquivo: path.relative(RAIZ, arquivo).replace(/\\/g, '/'),
      });
    }
  }
  return achados;
}

describe('mídia servida estática', () => {
  const citadas = midiasCitadas();

  it('encontra as referências de vídeo do código', () => {
    // Se a varredura parar de achar nada, o teste vira decoração silenciosa.
    expect(citadas.length).toBeGreaterThan(0);
    expect(citadas.every((m) => EXTENSOES.test(m.caminho))).toBe(true);
  });

  it('todo vídeo citado está versionado e portanto é publicado', () => {
    const ausentes = citadas
      .filter((m) => !versionados.has(`public${m.caminho}`))
      .map((m) => `${m.caminho} (citado em ${m.arquivo})`);

    expect(ausentes, 'vídeo citado no código mas fora do git — em produção o <video> recebe HTML e não toca').toEqual([]);
  });
});

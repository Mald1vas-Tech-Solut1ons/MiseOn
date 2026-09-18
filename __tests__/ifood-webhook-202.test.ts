import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Guarda de regressão: o webhook do iFood responde 202, nunca 200.
 *
 * Por que um teste que lê o arquivo em vez de exercitar o handler: o módulo
 * chama `serve()` no topo, então importar o arquivo levantaria um servidor.
 * O que precisa ser travado aqui é textual de qualquer forma — foi uma
 * reversão de texto que causou o estrago.
 *
 * A história: `e660c91` (01/09/2026) corrigiu o endpoint para `202 Accepted`,
 * porque é a resposta 202 que gera o heartbeat de presença do iFood — 200 não
 * gera nenhum, e healthcheck com erro reincidente por 72h DESATIVA o webhook,
 * que é pedido não chegando na cozinha.
 *
 * Duas noites depois, `711b294` — um commit de UI, sobre screenshots de telas
 * nos cards de nicho — trouxe a linha de volta para 200. O comentário longo
 * explicando "202, NUNCA 200" continuou lá, intacto, mentindo por duas
 * semanas. Só foi visto em 18/09 porque os logs de produção mostraram os
 * healthchecks saindo com 200.
 *
 * Comentário não segura código. Este teste segura.
 */
const fonte = readFileSync(
  new URL('../supabase/functions/ifood-webhook/index.ts', import.meta.url),
  'utf8',
);

describe('webhook do iFood — a resposta que gera heartbeat', () => {
  it('a resposta de aceite é 202, e não 200', () => {
    const linha = fonte.split('\n').find((l) => l.includes('const aceito ='));
    expect(linha, 'a função `aceito` sumiu do webhook — o teste precisa ser revisto').toBeDefined();
    expect(linha).toContain('202');
    expect(linha).not.toContain('200');
  });

  it('o healthcheck responde pelo caminho de aceite, antes de qualquer trabalho', () => {
    // Sem isto, o keepalive passaria por rate limit/banco e qualquer
    // indisponibilidade nossa viraria merchant fora do ar no iFood.
    expect(fonte).toMatch(/if \(isHealthcheck\) return aceito\(\);/);
  });

  it('nenhum caminho do webhook devolve 200', () => {
    const respostas200 = fonte
      .split('\n')
      .map((l, i) => ({ n: i + 1, l }))
      .filter(({ l }) => /new Response\([^)]*status:\s*200/.test(l));
    expect(
      respostas200,
      `caminhos respondendo 200: ${respostas200.map((r) => r.n).join(', ')}`,
    ).toHaveLength(0);
  });
});

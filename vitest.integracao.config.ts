import { defineConfig } from 'vitest/config';

/**
 * Configuração das suítes de INTEGRAÇÃO — que têm um alvo diferente do resto.
 *
 * ─── A DECISÃO DE ALVO ─────────────────────────────────────────────────────
 * Estas suítes falam com um Postgres de verdade. Havia três caminhos:
 *
 *   1. Supabase local (Docker). Descartado: não há Docker nem CLI nesta
 *      máquina, e foi por isso que as suítes ficaram BLOCKED desde 10/09/2026
 *      — ou seja, o caminho "certo no papel" custou meses de zero prova.
 *   2. Branch do Supabase. Descartado por ora: é recurso pago, e o projeto
 *      ainda está no plano free.
 *   3. O banco de produção, MAS escrevendo só em LOJA DESCARTÁVEL criada e
 *      apagada por cada arquivo de teste. É o caminho adotado.
 *
 * O que torna (3) aceitável não é otimismo, é o confinamento:
 * `__tests__/integration/loja-descartavel.ts` cria a loja com slug
 * `qa-descartavel-…`, e `exigirDescartavel()` RECUSA qualquer id que não tenha
 * nascido ali. O padrão anterior — `lojas.limit(1)`, "a primeira que vier" —
 * podia cair na loja do cliente real e escrever pedido, usuário e estoque
 * dentro dela. Esse é o risco que sumiu.
 *
 * ─── POR QUE TIMEOUT MAIOR ─────────────────────────────────────────────────
 * O padrão do Vitest é 5s, dimensionado para teste que não sai do processo.
 * Aqui cada asserção é uma ida e volta pela internet até o Supabase; a suíte de
 * PEPS faz dezenas delas num teste só e estourava 5s sem nada estar errado no
 * produto. Timeout curto contra recurso remoto não pega bug: fabrica vermelho
 * que ninguém investiga.
 */
export default defineConfig({
  test: {
    include: ['__tests__/integration/**/*.test.ts'],
    // Carrega .env.local em process.env: sem isto a integração só roda se
    // alguém lembrar de exportar três variáveis à mão — e suíte que depende de
    // ritual é suíte que não roda.
    setupFiles: ['./__tests__/integration/carregar-env.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Sequencial: os arquivos criam e apagam loja, usuário e movimentação no
    // MESMO banco. Em paralelo, o custo é disputa por limite de conexão e
    // falha intermitente que parece bug de produto.
    fileParallelism: false,
  },
});

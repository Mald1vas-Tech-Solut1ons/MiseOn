/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import istanbul from 'vite-plugin-istanbul';

export default defineConfig({
  test: {
    // Worktrees do Claude Code vivem dentro do repo e carregam uma CÓPIA da
    // suite inteira. Sem esta exclusão o `vitest run` executa cada teste duas
    // vezes — a segunda contra código defasado — e o vermelho resultante não
    // diz nada sobre o commit em andamento.
    exclude: ['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.claude/**'],
  },
  plugins: [
    react(),
    tailwindcss(),
    // Instrumentação de cobertura, ligada por CYPRESS_COVERAGE=true.
    //
    // Antes: `requireEnv: false` e sem `forceBuildInstrument`. Esse par não
    // instrumentava nada no `vite build` — o plugin só age em `serve` a menos
    // que `forceBuildInstrument` esteja ligado. Como o E2E roda contra
    // `vite preview` (bundle buildado), a cobertura NUNCA foi coletada: daí o
    // aviso "has no coverage information" e o `|| true` no `nyc
    // check-coverage`, que deixava o gate de 80% puramente decorativo.
    //
    // O nome da env é CYPRESS_COVERAGE e não VITE_COVERAGE: com
    // `cypress: true`, é essa que o plugin lê (dist/index.mjs, configResolved).
    //
    // Produção e `npm run dev` continuam sem contador — só o job de E2E liga.
    istanbul({
      cypress: true,
      requireEnv: true,
      forceBuildInstrument: process.env.CYPRESS_COVERAGE === 'true',
    }),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'MiseOn — Sistema Inteligente para sua Cozinha',
        short_name: 'MiseOn',
        description: 'Cardápio digital, pedidos, entrega e estoque',
        theme_color: '#1e40af',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5_000_000,

        // CACHE VELHO SERVINDO PAGINA QUEBRADA — corrigido em 10/09/2026.
        //
        // O service worker precacheia o index.html e o devolve em qualquer
        // navegacao. Quando um deploy troca os hashes dos bundles, o HTML
        // guardado continua apontando para arquivos que nao existem mais: a
        // pagina abre como texto cru, sem CSS e sem JS. Foi assim que o painel
        // apareceu quebrado enquanto os cinco assets respondiam 200 no
        // servidor — o problema nunca esteve em producao, e sim no cache.
        //
        // `cleanupOutdatedCaches` apaga o precache da versao anterior em vez
        // de deixar duas geracoes convivendo.
        cleanupOutdatedCaches: true,

        // E o painel do lojista sai do fallback offline. Ele nao e conteudo
        // publico que vale servir desatualizado: e a ferramenta de trabalho de
        // quem esta com a loja aberta. Melhor uma tela de sem-conexao honesta
        // do que um shell antigo que abre pela metade e faz o dono achar que o
        // sistema caiu. O cardapio do cliente continua com fallback, porque la
        // funcionar offline vale mais.
        navigateFallbackDenylist: [/^\/admin/, /^\/superadmin/, /^\/entregador/],
      },
    }),
  ],
  build: {
    // Aviso de chunk grande apenas como informativo (Vercel não bloqueia por isso)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        /**
         * Só três buckets manuais, e por um motivo: cache.
         *
         * O catch-all `return 'vendor-libs'` que existia aqui jogava recharts,
         * leaflet, three e todo o resto num único chunk de 1,77 MB. Como esse
         * chunk é compartilhado por mais de uma entrada, o Vite o promovia a
         * `modulepreload` no index.html — ou seja, o cliente que só abre o
         * cardápio baixava o Three.js que existe apenas para EstoqueRastreio3D
         * (admin). O splitting por rota (60 `lazy()`) era anulado no vendor.
         *
         * Sem o catch-all, o Rollup resolve sozinho: dependência importada por
         * um único chunk lazy vai PARA DENTRO dele; dependência compartilhada
         * vira chunk comum carregado sob demanda, não no boot. Os três buckets
         * abaixo continuam manuais porque são usados em toda rota e mudam de
         * versão raramente — separá-los preserva o cache no CDN entre deploys.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          // Extrai o nome exato do pacote (funciona com scoped como @supabase/*)
          const segments = id.split('node_modules/');
          const afterNM  = segments[segments.length - 1];
          const pkg = afterNM.startsWith('@')
            ? afterNM.split('/').slice(0, 2).join('/')
            : afterNM.split('/')[0];

          // React core + router → chunk estável, TTL de cache longo no CDN Vercel
          if (['react', 'react-dom', 'react-router', 'react-router-dom', 'scheduler'].includes(pkg)) {
            return 'vendor-react';
          }
          // Supabase → presente em toda rota, atualizado raramente
          if (pkg.startsWith('@supabase')) {
            return 'vendor-supabase';
          }
          // Ícones → usados em toda tela, sem imports cruzados, cache independente
          if (pkg === 'lucide-react') {
            return 'vendor-icons';
          }
          // Todo o resto: decisão do Rollup, que sabe quem é lazy e quem não é.
          return undefined;
        },
      },
    },
  },
});


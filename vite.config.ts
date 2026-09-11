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
      // ── O SERVICE WORKER SAI DE CENA ──────────────────────────────────────
      //
      // `selfDestroying` publica um service worker cuja única função é se
      // desinstalar e apagar os caches que a versão anterior deixou. Quem já
      // tem o antigo instalado se cura sozinho no próximo acesso; quem não
      // tem, nunca mais instala.
      //
      // POR QUE CHEGAMOS AQUI. O SW anterior respondia toda navegação com um
      // `index.html` de precache. A cada deploy os hashes dos bundles mudam, o
      // HTML guardado passa a apontar para arquivos que não existem, e a
      // página abre crua — sem CSS e sem JS. Trocar a estratégia para
      // NetworkFirst corrigiu o comportamento NOVO, mas não alcançava quem já
      // estava com o SW velho preso, por causa disto:
      //
      //     GET /sw.js -> Cache-Control: public, max-age=14400
      //
      // São 4 horas de cache de navegador no arquivo do próprio service
      // worker. O `vercel.json` pede `max-age=0, must-revalidate`; quem
      // sobrepõe é o Cloudflare que está na frente (Browser Cache TTL padrão
      // de 4h). Ou seja: a correção existia e não chegava — e a página
      // quebrada não executa o JS que pediria a atualização. Armadilha
      // fechada dos dois lados.
      //
      // O que a PWA entregava aqui era instalabilidade e leitura offline do
      // cardápio. O que ela custava era o site abrir quebrado a cada deploy,
      // inclusive para cliente. Não é troca que se defenda antes do primeiro
      // cliente pagante. Para voltar depois: remover esta linha, e ANTES
      // ajustar o Cloudflare para "Respect Existing Headers", senão a mesma
      // armadilha se arma de novo.
      selfDestroying: true,
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

        // ── A NAVEGACAO VOLTA A FALAR COM A REDE ──────────────────────────
        //
        // `cleanupOutdatedCaches` nao resolveu, e agora esta medido o porque.
        // O sw.js publicado continha:
        //
        //   registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")))
        //
        // Isso responde TODA navegacao com o index.html do precache, sem
        // tocar na rede. Duas consequencias:
        //
        //   1. Deploy novo troca os hashes dos bundles. O HTML guardado
        //      continua apontando para /assets/index-<hash antigo>.js, que nao
        //      existe mais: 404 nos scripts, nada hidrata, e a tela mostra so
        //      o markup estatico. Foi exatamente o que aconteceu em 11/09/2026
        //      — servidor respondendo 200 em todos os assets e a pagina abrindo
        //      crua, exigindo Ctrl+F5 a cada acesso.
        //   2. Mesmo funcionando, /lanchepaulista recebia o index.html da RAIZ
        //      e jogava fora o HTML pre-renderizado daquela rota — que existe
        //      justamente para o primeiro paint e para o buscador.
        //
        // `NetworkFirst` conserta os dois: a rede manda, e o cache guarda o
        // HTML CERTO DE CADA ROTA, usado so quando nao ha conexao. O deploy
        // novo passa a aparecer sozinho, sem recarga forcada.
        navigateFallback: null,
        runtimeCaching: [
          {
            // O painel do lojista nunca sai do cache: e ferramenta de trabalho
            // de quem esta com a loja aberta, e um shell antigo faz o dono
            // achar que o sistema caiu. Sem conexao, erro honesto.
            urlPattern: ({ request, url }: { request: Request; url: URL }) =>
              request.mode === 'navigate'
              && /^\/(admin|superadmin|entregador)/.test(url.pathname),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ request }: { request: Request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-de-navegacao',
              // Conexao ruim de salao nao pode travar a tela: passou disso,
              // serve o que ja foi visto daquela rota.
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
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


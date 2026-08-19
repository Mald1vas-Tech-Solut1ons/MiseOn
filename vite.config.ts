import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import istanbul from 'vite-plugin-istanbul';

export default defineConfig({
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


import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import istanbul from 'vite-plugin-istanbul';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    istanbul({
      cypress: true,
      requireEnv: false,
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
         * Estratégia de code-splitting por domínio de responsabilidade:
         *  • vendor-react    → React core (estável, cache longo)
         *  • vendor-supabase → Supabase JS (tamanho fixo)
         *  • vendor-charts   → Recharts (pesado, raramente atualizado)
         *  • vendor-maps     → Leaflet + react-leaflet (só carrega na tela de Entregas)
         *  • vendor-canvas   → Konva + react-konva (só no editor de mesas)
         *  • vendor-editor   → react-filerobot-image-editor (só no cardápio)
         *  • vendor-misc     → Restante de dependências externas
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
          // Supabase → atualizado raramente, isolado para não contaminar outros chunks
          if (pkg.startsWith('@supabase')) {
            return 'vendor-supabase';
          }
          // Ícones → grande mas puro (sem imports cruzados), cache independente
          if (pkg === 'lucide-react') {
            return 'vendor-icons';
          }
          // Todos os demais vendor (recharts, leaflet, konva, filerobot, d3…)
          // em um único bucket para evitar qualquer referência circular entre eles.
          return 'vendor-libs';
        },
      },
    },
  },
});


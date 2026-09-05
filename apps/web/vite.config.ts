import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: { port: 3001 },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Virtual Doctor',
        short_name: 'VDoctor',
        description: 'Voice-first AI doctor with human review',
        display: 'standalone',
        background_color: '#5F7CC4',
        theme_color: '#414FA0',
        start_url: '/patient',
        scope: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell precached at build time; consult/queue traffic never cached.
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'script' || request.destination === 'style',
            handler: 'CacheFirst',
            options: { cacheName: 'hashed-assets' },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // One chunk per module: patient and doctor download in isolation.
        manualChunks(id) {
          if (id.includes('src/modules/patient')) return 'patient';
          if (id.includes('src/modules/doctor')) return 'doctor';
          return undefined;
        },
      },
    },
  },
});

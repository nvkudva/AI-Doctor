import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Supabase's public surface, by path prefix. Everything a consult, a review
// queue, a draft, a prescription, a lab or an appointment travels over lives
// under one of these — see the NetworkOnly rule below.
const SUPABASE_API = /\/(rest|rpc|functions|auth|realtime|storage)\/v\d+\//;

export default defineConfig({
  server: { port: 3001 },
  plugins: [
    react(),
    VitePWA({
      // 'prompt', not 'autoUpdate': a silent reload mid-consult would lose the
      // turn in flight. AppShell's toast calls the updateSW() main.tsx handed
      // it, which is what actually promotes the waiting worker — a bare
      // location.reload() leaves the new build waiting until every tab closes.
      registerType: 'prompt',
      // The plugin already precaches the manifest and every icon it lists;
      // these two are referenced only from index.html, so they need naming.
      includeAssets: ['icons/favicon-32.png', 'icons/apple-touch-icon.png'],
      manifest: {
        // `id` is what the browser keys the installed app by. Pinning it means
        // a later change to start_url updates the existing install instead of
        // creating a second one beside it.
        id: '/',
        name: 'AI Doctor',
        short_name: 'AI Doctor',
        description: 'Voice-first AI doctor with human review',
        lang: 'en',
        dir: 'ltr',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        // Not 'portrait': one install is both a phone consult and a desk
        // review at 1440x900, and locking the desk to portrait breaks it.
        orientation: 'any',
        categories: ['medical', 'health'],
        // Matches index.html's pre-paint ground, so the splash does not flash
        // a different colour before the shell paints.
        background_color: '#CDB6EC',
        theme_color: '#CDB6EC',
        // '/', not '/patient': the two modules have different entry points and
        // the launcher does not know who is launching. RoleLanding reads the
        // restored session and sends a patient to /patient and a doctor to
        // /doctor; hard-coding /patient makes every installed doctor launch
        // into a role guard and bounce back out of it.
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
        // Both form factors must be present or Chrome shows the plain one-line
        // install bar instead of the rich install dialog.
        screenshots: [
          {
            src: 'screenshots/patient-narrow.png',
            sizes: '430x932',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Describe how you feel and get a plan a doctor has approved',
          },
          {
            src: 'screenshots/doctor-wide.png',
            sizes: '1440x900',
            type: 'image/png',
            form_factor: 'wide',
            label: 'The review desk: every AI draft waits for a doctor',
          },
        ],
      },
      workbox: {
        // Build output only. Images, the manifest and the manifest's icons are
        // added by the plugin; sweeping them up here too put six duplicate
        // entries in the precache list. The ~1 MB of install-dialog
        // screenshots stay out entirely — the browser fetches those once, and
        // the app itself never renders them.
        globPatterns: ['**/*.{js,css,html}'],
        // Offline navigation to /patient/labs or /doctor/case/… serves the
        // precached shell, which then says it is offline. It never serves
        // clinical content: the data behind those routes is in no cache.
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // FIRST, and non-negotiable: clinical data is never cached. Consult
          // turns, the review queue, drafts, prescriptions, labs, appointments
          // and every auth call go to the network or fail loudly. A doctor
          // reading a stale queue, or a patient shown a stale plan, is a
          // safety failure; a cache miss is not. The rule this replaces
          // matched /api/, which is a path this app never calls.
          {
            urlPattern: ({ url }) => SUPABASE_API.test(url.pathname),
            handler: 'NetworkOnly',
          },
          // Same-origin build output only. The precache manifest already holds
          // this build's chunks; this catches a lazy chunk requested after the
          // manifest was written, and must not match a cross-origin script.
          {
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && (request.destination === 'script' || request.destination === 'style'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'vd-assets',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && (request.destination === 'image' || request.destination === 'font'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'vd-static',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Only third-party code is placed by hand. Naming the two module
        // directories instead made Rollup walk the patient module's dependency
        // graph into the `patient` chunk — React Router, the Supabase SDK and
        // all of lib/ui landed there, so the doctor chunk imported the 396 kB
        // patient chunk and patient CSS sat on every first paint. The two
        // modules are already dynamic imports (shell/routes.tsx), so Rollup
        // splits them, and everything shared, on its own and correctly.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@supabase') || id.includes('iceberg-js')) return 'vendor-supabase';
          if (id.includes('react-router')) return 'vendor-router';
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'vendor-react';
          return undefined;
        },
      },
    },
  },
});

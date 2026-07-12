import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Atelier · Digital Wardrobe',
        short_name: 'Atelier',
        description: 'Your private digital wardrobe.',
        theme_color: '#1c1917',
        background_color: '#F7F5F2',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icon.svg',             sizes: 'any',     type: 'image/svg+xml', purpose: 'any maskable' },
          { src: '/icon-192.png',         sizes: '192x192', type: 'image/png',     purpose: 'any maskable' },
          { src: '/icon-512.png',         sizes: '512x512', type: 'image/png',     purpose: 'any maskable' },
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp}'],
        // Firebase reserves /__/* for auth handler + init config + reserved
        // service worker paths. Without this denylist, the SW intercepts
        // navigation to /__/auth/handler (Google Sign-In OAuth callback)
        // and serves cached index.html instead — popup loops back to the
        // app's login screen. Same applies to /__/firebase/init.json.
        // Reference: https://firebase.google.com/docs/hosting/reserved-urls
        navigateFallbackDenylist: [
          /^\/__\//,
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'firebase-storage-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
});

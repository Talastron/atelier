import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Build identity, resolved once here and inlined into the bundle via `define`
// below. Both helpers swallow their errors: git may be absent (a tarball
// checkout, a shallow clone, a CI image without it) and a missing SHA must
// degrade to "unknown" rather than fail the build.
function gitShortSha() {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

// Hosting deploys run from a local machine (see the `deploy` script in
// package.json), so building from a tree with uncommitted work is a real
// possibility. This is what lets the running app admit that: the stamp gets a
// trailing '+' when the bundle contains changes that exist in no commit.
function gitTreeIsDirty() {
  try {
    return (
      execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim().length > 0
    );
  } catch {
    return false;
  }
}

export default defineConfig({
  define: {
    __BUILD_SHA__: JSON.stringify(gitShortSha()),
    __BUILD_DIRTY__: JSON.stringify(gitTreeIsDirty()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt', not 'autoUpdate': the app should not swap its own code out
      // from under someone mid-session. UpdatePrompt.jsx surfaces the waiting
      // worker and lets the wearer choose the moment. The trade-off is that
      // someone who never accepts stays on old code — which is why the prompt
      // reappears every session rather than being dismissible for good.
      registerType: 'prompt',
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

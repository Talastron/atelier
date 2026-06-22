// apps/marketing/astro.config.mjs
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://myatelier.style',
  integrations: [
    react(),
    mdx(),
    // Auto-generates sitemap.xml + sitemap-index.xml at build time, includes
    // every discovered page (journal posts via getStaticPaths too). Pointed
    // at by /robots.txt. /preview is excluded as an internal demo route.
    sitemap({
      filter: (page) => !page.includes('/preview'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});

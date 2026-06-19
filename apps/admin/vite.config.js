// apps/admin/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Port 5174 — leave 5173 for the wardrobe app dev server so both
    // can run simultaneously during development.
    port: 5174,
  },
  build: {
    target: 'es2020',
  },
});

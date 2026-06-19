import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['functions/**/*.ts'],
      exclude: ['functions/**/*.test.ts'],
    },
  },
  // Alias so tests import production code via `@functions/lib/foo.ts` instead
  // of the awkward `../../../functions/lib/foo.ts`. Keeps test files readable
  // and decouples them from depth-in-tree changes.
  resolve: {
    alias: {
      '@functions': resolve(__dirname, './functions'),
    },
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['functions/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['functions/**/*.ts'],
      exclude: ['functions/**/*.test.ts'],
    },
  },
});

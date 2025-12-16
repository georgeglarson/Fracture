import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'server/ts/**/*.test.ts',
      'shared/ts/**/*.test.ts',
    ],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'server/ts/**/*.ts',
        'shared/ts/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/__tests__/**',
        '**/node_modules/**',
      ],
      thresholds: {
        // Start with minimal thresholds, increase as coverage grows
        // Target: 60%+ for critical paths (spec 020)
        statements: 1,
        branches: 0,
        functions: 1,
        lines: 1,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@server': path.resolve(__dirname, 'server/ts'),
      '@shared': path.resolve(__dirname, 'shared/ts'),
      '@client': path.resolve(__dirname, 'client/ts'),
    },
  },
});

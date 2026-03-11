import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'server/ts/**/*.test.ts',
      'shared/ts/**/*.test.ts',
      'client/ts/**/*.test.ts',
    ],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'server/ts/**/*.ts',
        'shared/ts/**/*.ts',
        'client/ts/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/__tests__/**',
        '**/node_modules/**',
      ],
      thresholds: {
        statements: 10,
        branches: 5,
        functions: 10,
        lines: 10,
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

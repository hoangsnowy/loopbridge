import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['src/main/**/*.ts', 'src/shared/**/*.ts'],
      // Renderer + preload + bootstrap don't unit-test cleanly under Node;
      // they're exercised end-to-end via the Playwright suite under e2e/.
      exclude: [
        'src/main/index.ts',
        'src/preload/**',
        'src/renderer/**',
        '**/*.d.ts',
        '**/types.ts',
        '**/wire.ts',
      ],
      // Floor reflects the current landed coverage with a small safety
      // margin. Ratchet upward as more tests cover the remaining gaps
      // (migration-service, ipc.ts, logger.ts pino-roll harness).
      thresholds: {
        statements: 50,
        branches: 40,
        functions: 55,
        lines: 50,
      },
    },
  },
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@main': resolve('src/main'),
    },
  },
});

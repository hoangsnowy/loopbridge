import { defineConfig } from '@playwright/test';

// Separate config so `npm run test:e2e` keeps producing only the gating
// suite, while `npm run screenshots` runs only the README capture spec.
export default defineConfig({
  testDir: '.',
  testMatch: /screenshots\.spec\.ts$/,
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
});

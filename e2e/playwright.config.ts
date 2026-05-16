import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts$/,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // Electron driver doesn't share state cleanly across parallel tests.
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
});

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  // Exclude screenshots.spec.ts from the gating suite; it runs via the
  // separate playwright.screenshots.config.ts when `npm run screenshots`
  // is invoked.
  testMatch: /(?<!screenshots)\.spec\.ts$/,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // Electron driver doesn't share state cleanly across parallel tests.
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
});

import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { ElectronApplication, Page } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const MAIN_ENTRY = path.join(REPO_ROOT, 'out', 'main', 'index.js');

let userDataDir: string;
let app: ElectronApplication;
let window: Page;

const mockBaseUrl = (): string => {
  const url = process.env.LOOPBRIDGE_TEST_BASE_URL;
  if (!url) throw new Error('global-setup did not export LOOPBRIDGE_TEST_BASE_URL');
  return url;
};

test.beforeAll(async () => {
  userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'loopbridge-e2e-conn-'));
  app = await electron.launch({
    args: [MAIN_ENTRY, `--user-data-dir=${userDataDir}`],
    env: { ...process.env, NODE_ENV: 'test' },
  });
  window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  await app?.close();
  if (userDataDir) {
    await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => undefined);
  }
});

test('first launch lands on /setup screen', async () => {
  // App auto-redirects to /setup when no Confluence config is saved.
  await expect(window.getByRole('heading', { name: 'Connect to Confluence' })).toBeVisible({
    timeout: 5_000,
  });
  expect(window.url()).toContain('#/setup');
});

test('DC test connection against mock returns success', async () => {
  // backend select defaults to "dc"; just fill baseUrl + PAT.
  await window.locator('#baseUrl').fill(mockBaseUrl());
  await window.locator('#secret').fill('fake-pat-token');

  await window.getByRole('button', { name: 'Test connection' }).click();

  // Mock /rest/api/user/current returns displayName "E2E User"
  const success = window.getByText('Connected as', { exact: false });
  await expect(success).toBeVisible({ timeout: 5_000 });
  await expect(success).toContainText('E2E User');
});

test('save & continue persists auth and navigates to /pages', async () => {
  await window.getByRole('button', { name: 'Save & continue' }).click();

  // Hash route changes; the page list heading appears.
  await window.waitForURL((url) => url.hash.startsWith('#/pages'), { timeout: 5_000 });
  expect(window.url()).toContain('#/pages');
});

test('pages list loads DOCS space via mock', async () => {
  // Space key input has placeholder "Space key (e.g. DOCS)".
  await window.getByPlaceholder(/Space key/i).fill('DOCS');
  await window.getByRole('button', { name: 'Load space' }).click();

  // Mock returns two pages: "Hello World" and "Second Page".
  await expect(window.getByText('Hello World')).toBeVisible({ timeout: 5_000 });
  await expect(window.getByText('Second Page')).toBeVisible({ timeout: 5_000 });
});

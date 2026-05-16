/**
 * Screenshot capture suite. Drives the renderer through the documented
 * journey and saves PNGs to docs/screenshots/ for use in README.md.
 *
 * Run via `npm run screenshots`. NOT part of the regular e2e gate;
 * scoped to a different test file pattern.
 */
import { test, _electron as electron } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { ElectronApplication, Page } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const MAIN_ENTRY = path.join(REPO_ROOT, 'out', 'main', 'index.js');
const SHOTS_DIR = path.join(REPO_ROOT, 'docs', 'screenshots');

let userDataDir: string;
let app: ElectronApplication;
let window: Page;

const mockBaseUrl = (): string => {
  const url = process.env.LOOPBRIDGE_TEST_BASE_URL;
  if (!url) throw new Error('global-setup did not export LOOPBRIDGE_TEST_BASE_URL');
  return url;
};

async function shot(name: string) {
  await fs.mkdir(SHOTS_DIR, { recursive: true });
  // Quick stabilization wait; the renderer paints lazily for some Radix
  // primitives. 250ms is enough in practice without bloating wall time.
  await window.waitForTimeout(250);
  await window.screenshot({ path: path.join(SHOTS_DIR, name), type: 'png' });
}

test.beforeAll(async () => {
  userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'loopbridge-shots-'));
  app = await electron.launch({
    args: [MAIN_ENTRY, `--user-data-dir=${userDataDir}`],
    env: { ...process.env, NODE_ENV: 'test' },
  });
  window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  // Standard size for consistent README layout.
  await window.setViewportSize({ width: 1280, height: 800 });
});

test.afterAll(async () => {
  await app?.close();
  if (userDataDir) {
    await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => undefined);
  }
});

test('capture screenshots for README', async () => {
  // 1. Setup screen — empty.
  await shot('setup.png');

  // 2. Setup screen — after a successful Test connection.
  await window.locator('#baseUrl').fill(mockBaseUrl());
  await window.locator('#secret').fill('demo-pat');
  await window.getByRole('button', { name: 'Test connection' }).click();
  await window.getByText('Connected as', { exact: false }).waitFor({ timeout: 5_000 });
  await shot('setup-success.png');

  // 3. Save & continue → /pages.
  await window.getByRole('button', { name: 'Save & continue' }).click();
  await window.waitForURL((u) => u.hash.startsWith('#/pages'), { timeout: 5_000 });

  // 4. Pages list — after loading DOCS.
  await window.getByPlaceholder(/Space key/i).fill('DOCS');
  await window.getByRole('button', { name: 'Load space' }).click();
  await window.getByText('Hello World').waitFor({ timeout: 5_000 });
  await shot('pages.png');

  // 5. Page detail (preview).
  await window.getByRole('link', { name: 'Hello World' }).click();
  await window.waitForURL((u) => u.hash.startsWith('#/pages/1001'), { timeout: 5_000 });
  // The detail screen calls api.pages.get + (optionally) api.pages.convert
  // on user click. Trigger convert so the preview has content.
  const convertBtn = window.getByRole('button', { name: /convert/i }).first();
  if (await convertBtn.isVisible().catch(() => false)) {
    await convertBtn.click();
    await window.waitForTimeout(500);
  }
  await shot('preview.png');

  // 6. Audit / pages list with status badges (use /pages route — it carries
  //    the same status data; the badges are the audit surface in v0.x).
  //    PageList resets its local state on remount, so refill the space key.
  await window.locator('a[href="#/pages"]').first().click();
  await window.waitForURL((u) => u.hash === '#/pages', { timeout: 5_000 });
  const spaceInput = window.getByPlaceholder(/Space key/i);
  if ((await spaceInput.inputValue()) === '') {
    await spaceInput.fill('DOCS');
    await window.getByRole('button', { name: 'Load space' }).click();
  }
  await window.getByText('Hello World').waitFor({ timeout: 5_000 });
  await shot('audit.png');

  // 7. Settings.
  await window.locator('a[href="#/settings"]').first().click();
  await window.waitForURL((u) => u.hash.startsWith('#/settings'), { timeout: 5_000 });
  await shot('settings.png');

  // 8. About.
  await window.locator('a[href="#/about"]').first().click();
  await window.waitForURL((u) => u.hash.startsWith('#/about'), { timeout: 5_000 });
  await shot('about.png');
});

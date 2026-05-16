import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { ElectronApplication } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const MAIN_ENTRY = path.join(REPO_ROOT, 'out', 'main', 'index.js');

let userDataDir: string;
let app: ElectronApplication;

test.beforeAll(async () => {
  // Isolated userData so the suite doesn't trample the dev install's
  // config / audit DB / secrets.bin.
  userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'loopbridge-e2e-'));

  app = await electron.launch({
    args: [MAIN_ENTRY, `--user-data-dir=${userDataDir}`],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      // Surfaced by the mock-confluence global setup; future change can
      // wire this into the main process to override the configured baseUrl.
      LOOPBRIDGE_TEST_BASE_URL: process.env.LOOPBRIDGE_TEST_BASE_URL ?? '',
    },
  });
});

test.afterAll(async () => {
  await app?.close();
  if (userDataDir) {
    await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => undefined);
  }
});

test('main window opens with loopbridge title', async () => {
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  const title = await window.title();
  expect(title.toLowerCase()).toContain('loopbridge');

  // Root react container should render even on the empty first-run state.
  const root = await window.locator('#root').first();
  await expect(root).toBeVisible({ timeout: 5_000 });
});

test('no uncaught main-process exception in first 3s of runtime', async () => {
  const errors: string[] = [];
  app.process().stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf8');
    if (text.includes('Uncaught') || text.includes('UnhandledPromiseRejection')) {
      errors.push(text);
    }
  });

  await new Promise((resolve) => setTimeout(resolve, 3_000));
  expect(errors).toEqual([]);
});

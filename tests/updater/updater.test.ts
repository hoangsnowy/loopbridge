import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Spy on the autoUpdater methods. Hoisted so the mock factory sees them.
const autoUpdater = vi.hoisted(() => ({
  autoDownload: false as boolean,
  autoInstallOnAppQuit: false as boolean,
  channel: '' as string,
  setFeedURL: vi.fn(),
  on: vi.fn(),
  checkForUpdates: vi.fn(),
  downloadUpdate: vi.fn(),
  quitAndInstall: vi.fn(),
}));

vi.mock('electron-updater', () => ({ default: { autoUpdater } }));
vi.mock('electron', () => ({ BrowserWindow: class {} }));
vi.mock('@main/logging/logger', () => ({
  childLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

const { initUpdater, checkForUpdates, downloadUpdate, quitAndInstall } =
  await import('@main/updater');

describe('updater', () => {
  beforeEach(() => {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.channel = '';
    autoUpdater.setFeedURL.mockReset();
    autoUpdater.on.mockReset();
    autoUpdater.checkForUpdates.mockReset();
    autoUpdater.downloadUpdate.mockReset();
    autoUpdater.quitAndInstall.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initUpdater respects autoDownload + autoInstallOnQuit opts', () => {
    initUpdater(() => null, { autoDownload: true, autoInstallOnQuit: false });
    expect(autoUpdater.autoDownload).toBe(true);
    expect(autoUpdater.autoInstallOnAppQuit).toBe(false);
  });

  it('initUpdater defaults autoDownload=false, autoInstallOnQuit=true', () => {
    initUpdater(() => null, {});
    expect(autoUpdater.autoDownload).toBe(false);
    expect(autoUpdater.autoInstallOnAppQuit).toBe(true);
  });

  it('initUpdater sets feed URL when provided', () => {
    initUpdater(() => null, {
      feedUrl: 'https://updates.example.com/',
      channel: 'beta',
    });
    expect(autoUpdater.setFeedURL).toHaveBeenCalledWith({
      provider: 'generic',
      url: 'https://updates.example.com/',
      channel: 'beta',
    });
    expect(autoUpdater.channel).toBe('beta');
  });

  it('initUpdater wires every event listener on autoUpdater', () => {
    initUpdater(() => null, {});
    const events = autoUpdater.on.mock.calls.map((c) => c[0]);
    expect(events).toEqual(
      expect.arrayContaining([
        'checking-for-update',
        'update-available',
        'update-not-available',
        'download-progress',
        'update-downloaded',
        'error',
      ]),
    );
  });

  it('checkForUpdates returns version on success', async () => {
    autoUpdater.checkForUpdates.mockResolvedValue({ updateInfo: { version: '0.3.0' } });
    const out = await checkForUpdates();
    expect(out).toEqual({ version: '0.3.0' });
  });

  it('checkForUpdates returns null when no updateInfo', async () => {
    autoUpdater.checkForUpdates.mockResolvedValue(null);
    expect(await checkForUpdates()).toBeNull();
  });

  it('checkForUpdates returns null and logs on throw (swallows error)', async () => {
    autoUpdater.checkForUpdates.mockRejectedValue(new Error('no network'));
    expect(await checkForUpdates()).toBeNull();
  });

  it('downloadUpdate proxies to autoUpdater.downloadUpdate', async () => {
    autoUpdater.downloadUpdate.mockResolvedValue([]);
    await downloadUpdate();
    expect(autoUpdater.downloadUpdate).toHaveBeenCalledOnce();
  });

  it('quitAndInstall proxies with (true, true)', () => {
    quitAndInstall();
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledWith(true, true);
  });
});

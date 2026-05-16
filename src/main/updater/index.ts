import { BrowserWindow } from 'electron';
import electronUpdater from 'electron-updater';
const { autoUpdater } = electronUpdater;
import { childLogger } from '@main/logging/logger';
import { IPC } from '@shared/ipc-channels';
import type { UpdaterStatus } from '@shared/types';

const log = () => childLogger({ mod: 'updater' });

export interface InitUpdaterOptions {
  feedUrl?: string;
  channel?: string;
  autoDownload?: boolean;
  autoInstallOnQuit?: boolean;
}

export function initUpdater(getWindow: () => BrowserWindow | null, opts: InitUpdaterOptions): void {
  autoUpdater.autoDownload = opts.autoDownload ?? false;
  autoUpdater.autoInstallOnAppQuit = opts.autoInstallOnQuit ?? true;
  if (opts.channel) autoUpdater.channel = opts.channel;
  if (opts.feedUrl) {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: opts.feedUrl,
      channel: opts.channel ?? 'stable',
    });
  }

  autoUpdater.on('checking-for-update', () => emit(getWindow, { kind: 'checking' }));
  autoUpdater.on('update-available', (info) =>
    emit(getWindow, {
      kind: 'available',
      info: { version: info.version, releaseDate: info.releaseDate },
    }),
  );
  autoUpdater.on('update-not-available', () => emit(getWindow, { kind: 'not-available' }));
  autoUpdater.on('download-progress', (p) =>
    emit(getWindow, { kind: 'downloading', progressPercent: p.percent }),
  );
  autoUpdater.on('update-downloaded', (info) =>
    emit(getWindow, {
      kind: 'downloaded',
      info: { version: info.version, releaseDate: info.releaseDate },
    }),
  );
  autoUpdater.on('error', (err) => {
    log().error({ err: err.message }, 'updater error');
    emit(getWindow, { kind: 'error', message: err.message });
  });
}

function emit(getWindow: () => BrowserWindow | null, status: UpdaterStatus): void {
  const win = getWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send(IPC.EvtUpdaterStatus, status);
  }
}

export async function checkForUpdates(): Promise<{ version: string } | null> {
  try {
    const result = await autoUpdater.checkForUpdates();
    if (result && result.updateInfo) {
      return { version: result.updateInfo.version };
    }
    return null;
  } catch (err) {
    log().error({ err }, 'check-for-updates failed');
    return null;
  }
}

export async function downloadUpdate(): Promise<void> {
  await autoUpdater.downloadUpdate();
}

export function quitAndInstall(): void {
  autoUpdater.quitAndInstall(true, true);
}

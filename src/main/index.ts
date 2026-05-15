import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initAudit, pruneEventLog } from './store/audit';
import { initConfigStore, getConfig } from './store/config';
import { initLogger, childLogger } from './logging/logger';
import { registerIpc } from './ipc';
import { resetClient } from './services/migration-service';
import { endCurrentRun } from './services/progress-service';
import { initUpdater } from './updater';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function createWindow(): BrowserWindow {
  const preloadPath = path.join(__dirname, '../preload/index.mjs');
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: 'loopbridge',
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) {
    void window.loadURL(devUrl);
  } else {
    void window.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return window;
}

async function bootstrap(): Promise<void> {
  const got = app.requestSingleInstanceLock();
  if (!got) {
    app.quit();
    return;
  }

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  await app.whenReady();

  const userData = app.getPath('userData');
  initLogger({
    userDataDir: userData,
    level: 'info',
    consoleInDev: !app.isPackaged,
  });
  const log = childLogger({ mod: 'bootstrap' });
  log.info({ userData, packaged: app.isPackaged }, 'app starting');

  initConfigStore();
  initAudit({ userDataDir: userData });

  const cfg = getConfig();
  pruneEventLog(cfg.logging.eventLogRetentionDays);

  registerIpc(() => mainWindow);

  initUpdater(() => mainWindow, {
    ...(cfg.updater.feedUrl ? { feedUrl: cfg.updater.feedUrl } : {}),
    channel: cfg.updater.channel,
  });

  mainWindow = createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', async (event) => {
  event.preventDefault();
  try {
    endCurrentRun();
    await resetClient();
  } finally {
    app.exit(0);
  }
});

bootstrap().catch((err) => {
  console.error('bootstrap failed:', err);
  app.exit(1);
});

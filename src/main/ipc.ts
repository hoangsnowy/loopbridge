import { BrowserWindow, ipcMain, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AppConfigSchema, type AppConfig } from '@shared/config-schema';
import type { PageSummary } from '@shared/domain';
import { ConfigError, toSerializedError } from '@shared/errors';
import { IPC } from '@shared/ipc-channels';
import type {
  AuditFilter,
  AuditRow,
  AuthInput,
  ConnectionResult,
  ConnectionStatus,
  ConvertResult,
  LogLine,
  PageListOptions,
  PagesListProgress,
} from '@shared/types';
import { createClient } from '@main/confluence/factory';
import { identityLabel } from '@main/confluence/shared/auth';
import { writeRichToClipboard } from '@main/clipboard/write';
import { childLogger, currentLogFile } from '@main/logging/logger';
import {
  clearAudit as clearAuditDao,
  listPagesAudit,
} from '@main/store/audit';
import { getConfig, setConfig } from '@main/store/config';
import { clearSecret, getSecret, setSecret } from '@main/store/secrets';
import {
  attachmentLocalPath,
  readPageCache,
} from '@main/store/cache';
import {
  convertPage,
  ensureClient,
  fetchAndCachePage,
  readConvertedHtml,
  resetClient,
  userDataDir,
} from '@main/services/migration-service';
import { ensureRun, transition } from '@main/services/progress-service';
import { checkForUpdates, downloadUpdate, quitAndInstall } from '@main/updater';

const log = () => childLogger({ mod: 'ipc' });

function buildEphemeralConfig(input: AuthInput): { config: AppConfig; secret: string } {
  const current = getConfig();
  if (input.backend === 'dc') {
    const config: AppConfig = {
      ...current,
      confluence: {
        backend: 'dc',
        baseUrl: input.baseUrl,
        authMethod: input.authMethod,
        ...(input.username ? { username: input.username } : {}),
      },
      network: {
        ...current.network,
        ...(input.caBundlePath ? { caBundlePath: input.caBundlePath } : {}),
        ...(input.httpsProxy ? { httpsProxy: input.httpsProxy } : {}),
      },
    };
    return { config, secret: input.secret };
  }
  const config: AppConfig = {
    ...current,
    confluence: {
      backend: 'cloud',
      baseUrl: input.baseUrl,
      email: input.email,
    },
    network: {
      ...current.network,
      ...(input.httpsProxy ? { httpsProxy: input.httpsProxy } : {}),
    },
  };
  return { config, secret: input.apiToken };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handle<T>(channel: string, fn: (...args: any[]) => Promise<T> | T): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      const data = await fn(...args);
      return { ok: true, data };
    } catch (err) {
      log().error({ err: (err as Error).message, channel }, 'ipc handler threw');
      return { ok: false, error: toSerializedError(err) };
    }
  });
}

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  handle(IPC.ConnectionTest, async (input: AuthInput): Promise<ConnectionResult> => {
    const { config, secret } = buildEphemeralConfig(input);
    const client = createClient({ config, secret });
    try {
      const { user, serverVersion } = await client.testAuth();
      const result: ConnectionResult = {
        ok: true,
        backend: input.backend,
        user: { accountId: user.accountId, displayName: user.displayName, ...(user.email ? { email: user.email } : {}) },
      };
      if (serverVersion) result.serverVersion = serverVersion;
      return result;
    } catch (err) {
      return {
        ok: false,
        backend: input.backend,
        error: toSerializedError(err),
      };
    } finally {
      await client.close();
    }
  });

  handle(IPC.ConnectionSaveAuth, async (input: AuthInput): Promise<void> => {
    const { config, secret } = buildEphemeralConfig(input);
    // Validate first.
    const client = createClient({ config, secret });
    try {
      await client.testAuth();
    } finally {
      await client.close();
    }
    setConfig(config);
    await setSecret(input.backend, input.baseUrl, secret);
    await resetClient();
  });

  handle(IPC.ConnectionClearAuth, async (): Promise<void> => {
    const current = getConfig();
    if (current.confluence) {
      await clearSecret(current.confluence.backend, current.confluence.baseUrl);
    }
    const next: AppConfig = { ...current };
    delete (next as { confluence?: unknown }).confluence;
    setConfig(AppConfigSchema.parse(next));
    await resetClient();
  });

  handle(IPC.ConnectionGetStatus, async (): Promise<ConnectionStatus> => {
    const cfg = getConfig();
    if (!cfg.confluence) return { configured: false };
    const secret = await getSecret(cfg.confluence.backend, cfg.confluence.baseUrl);
    return {
      configured: !!secret,
      backend: cfg.confluence.backend,
      baseUrl: cfg.confluence.baseUrl,
      identityLabel: identityLabel(cfg.confluence),
    };
  });

  handle(IPC.SpacesList, async () => {
    const client = await ensureClient();
    return client.listSpaces();
  });

  handle(IPC.SpaceResolve, async (key: string) => {
    const client = await ensureClient();
    return client.resolveSpace(key);
  });

  handle(IPC.PagesList, async (spaceKeyOrId: string, _opts?: PageListOptions): Promise<PageSummary[]> => {
    const client = await ensureClient();
    const cfg = getConfig();
    if (!cfg.confluence) throw new ConfigError('Not configured');
    await ensureRun({
      backend: cfg.confluence.backend,
      spaceKey: spaceKeyOrId,
      baseUrl: cfg.confluence.baseUrl,
    });
    const win = getWindow();
    const out: PageSummary[] = [];
    let fetched = 0;
    for await (const page of client.listPages(spaceKeyOrId)) {
      out.push(page);
      fetched += 1;
      if (fetched % 25 === 0 && win && !win.isDestroyed()) {
        const evt: PagesListProgress = { fetched, done: false };
        win.webContents.send(IPC.EvtPagesListProgress, evt);
      }
    }
    if (win && !win.isDestroyed()) {
      const evt: PagesListProgress = { fetched, done: true };
      win.webContents.send(IPC.EvtPagesListProgress, evt);
    }
    return out;
  });

  handle(IPC.PageGet, async (pageId: string) => {
    await fetchAndCachePage(pageId);
    const cached = await readPageCache(userDataDir(), pageId);
    if (!cached) throw new ConfigError(`Page ${pageId} cache write failed`);
    return cached.page;
  });

  handle(IPC.PageConvert, async (pageId: string): Promise<ConvertResult> => {
    return convertPage(pageId);
  });

  handle(IPC.PageCopyToClipboard, async (pageId: string): Promise<void> => {
    const html = await readConvertedHtml(pageId);
    if (!html) throw new ConfigError(`Page ${pageId} has no converted HTML — convert first`);
    writeRichToClipboard({ html });
    transition({ pageId, next: 'copied', eventKind: 'copy' });
  });

  handle(IPC.PageMarkDone, async (pageId: string, note?: string): Promise<void> => {
    transition({
      pageId,
      next: 'done',
      eventKind: 'mark-done',
      patch: note ? { note } : undefined,
    });
  });

  handle(IPC.PageMarkSkipped, async (pageId: string, reason: string): Promise<void> => {
    transition({
      pageId,
      next: 'skipped',
      eventKind: 'mark-skipped',
      patch: { note: reason },
    });
  });

  handle(IPC.PageReset, async (pageId: string): Promise<void> => {
    transition({
      pageId,
      next: 'pending',
      eventKind: 'reset',
    });
  });

  handle(IPC.AttachmentsList, async (pageId: string) => {
    const client = await ensureClient();
    return client.listAttachments(pageId);
  });

  handle(IPC.AttachmentDownload, async (pageId: string, filename: string) => {
    const local = attachmentLocalPath(userDataDir(), pageId, filename);
    const stat = await fs.stat(local).catch(() => null);
    return { path: local, bytes: stat?.size ?? 0 };
  });

  handle(IPC.AuditList, async (filter: AuditFilter): Promise<AuditRow[]> => {
    return listPagesAudit(filter ?? {});
  });

  handle(IPC.AuditExportCsv, async (targetPath: string): Promise<void> => {
    const rows = listPagesAudit({});
    const { stringify } = await import('csv-stringify/sync');
    const out = stringify(rows, {
      header: true,
      columns: Object.keys(rows[0] ?? { pageId: 1, title: 1 }),
    });
    await fs.writeFile(targetPath, out, 'utf8');
  });

  handle(IPC.AuditClear, async (): Promise<void> => {
    clearAuditDao();
  });

  handle(IPC.ConfigGet, async () => getConfig());

  handle(IPC.ConfigSet, async (patch: Partial<AppConfig>) => {
    const merged = AppConfigSchema.parse({ ...getConfig(), ...patch });
    return setConfig(merged);
  });

  handle(IPC.UpdaterCheck, async () => checkForUpdates());
  handle(IPC.UpdaterDownload, async () => downloadUpdate());
  handle(IPC.UpdaterInstall, async () => quitAndInstall());

  handle(IPC.LogsTail, async (lines: number): Promise<LogLine[]> => {
    const file = currentLogFile();
    if (!file) return [];
    try {
      const text = await fs.readFile(file, 'utf8');
      const all = text.trim().split('\n').slice(-Math.max(1, lines | 0));
      return all
        .map((row) => {
          try {
            return JSON.parse(row) as LogLine;
          } catch {
            return null;
          }
        })
        .filter((x): x is LogLine => x !== null);
    } catch {
      return [];
    }
  });

  handle(IPC.LogsOpenFolder, async (): Promise<void> => {
    const file = currentLogFile();
    if (file) shell.showItemInFolder(file);
  });

  handle(IPC.ShellOpenExternal, async (url: string): Promise<void> => {
    if (!/^https?:\/\//.test(url)) throw new ConfigError('Only http(s) URLs are allowed');
    await shell.openExternal(url);
  });

  handle(IPC.ShellShowItemInFolder, async (target: string): Promise<void> => {
    shell.showItemInFolder(path.resolve(target));
  });
}

import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
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
import { clearAudit as clearAuditDao, listPagesAudit } from '@main/store/audit';
import { getConfig, setConfig } from '@main/store/config';
import { clearSecret, getSecret, setSecret } from '@main/store/secrets';
import { attachmentLocalPath, readPageCache } from '@main/store/cache';
import {
  convertPage,
  ensureClient,
  fetchAndCachePage,
  readConvertedHtml,
  resetClient,
  userDataDir,
} from '@main/services/migration-service';
import { ensureRun, setStatusEmitter, transition } from '@main/services/progress-service';
import { checkForUpdates, downloadUpdate, quitAndInstall } from '@main/updater';

const log = () => childLogger({ mod: 'ipc' });

async function readTailUtf8(file: string, maxBytes: number): Promise<string> {
  const handle = await fs.open(file, 'r');
  try {
    const stat = await handle.stat();
    const size = stat.size;
    if (size === 0) return '';
    const chunk = Math.min(size, maxBytes);
    const buf = Buffer.alloc(chunk);
    await handle.read(buf, 0, chunk, size - chunk);
    // Trim a leading partial line when we did not read from the file start.
    const text = buf.toString('utf8');
    if (chunk < size) {
      const nl = text.indexOf('\n');
      return nl >= 0 ? text.slice(nl + 1) : text;
    }
    return text;
  } finally {
    await handle.close();
  }
}

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
    return { config, secret: input.secret.trim() };
  }
  const config: AppConfig = {
    ...current,
    confluence: {
      backend: 'cloud',
      baseUrl: input.baseUrl,
      email: input.email.trim(),
    },
    network: {
      ...current.network,
      ...(input.httpsProxy ? { httpsProxy: input.httpsProxy } : {}),
    },
  };
  return { config, secret: input.apiToken.trim() };
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
  setStatusEmitter((s) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC.EvtMigrationStatus, s);
    }
  });

  handle(IPC.ConnectionTest, async (input: AuthInput): Promise<ConnectionResult> => {
    const { config, secret } = buildEphemeralConfig(input);
    const client = createClient({ config, secret });
    try {
      const { user, serverVersion } = await client.testAuth();
      const result: ConnectionResult = {
        ok: true,
        backend: input.backend,
        user: {
          accountId: user.accountId,
          displayName: user.displayName,
          ...(user.email ? { email: user.email } : {}),
        },
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

  handle(
    IPC.PagesList,
    async (spaceKeyOrId: string, _opts?: PageListOptions): Promise<PageSummary[]> => {
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
    },
  );

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

  handle(IPC.PageRefetch, async (pageId: string): Promise<void> => {
    if (!/^[A-Za-z0-9_-]+$/.test(pageId)) {
      throw new ConfigError(`Invalid pageId: ${pageId}`);
    }
    const dir = path.join(userDataDir(), 'pages', pageId);
    await fs.rm(dir, { recursive: true, force: true });
    transition({
      pageId,
      next: 'pending',
      eventKind: 'refetch',
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
    if (!targetPath.toLowerCase().endsWith('.csv')) {
      throw new ConfigError('Export path must end with .csv');
    }
    const rows = listPagesAudit({});
    const { stringify } = await import('csv-stringify/sync');
    // Explicit AuditRow column order — keeps CSV header stable even when
    // `rows` is empty and survives later additions to AuditRow.
    const COLUMNS: ReadonlyArray<keyof AuditRow> = [
      'pageId',
      'spaceKey',
      'title',
      'versionNumber',
      'parentId',
      'status',
      'needsReview',
      'imagesEmbedded',
      'imagesManual',
      'fetchedAt',
      'convertedAt',
      'copiedAt',
      'doneAt',
      'errorKind',
      'errorMessage',
      'note',
    ];
    const out = stringify(rows, {
      header: true,
      columns: COLUMNS as unknown as string[],
    });
    await fs.writeFile(targetPath, out, 'utf8');
  });

  handle(IPC.AuditClear, async (): Promise<void> => {
    clearAuditDao();
  });

  handle(IPC.ConfigGet, async () => getConfig());

  handle(IPC.ConfigSet, async (patch: Partial<AppConfig>) => {
    const before = getConfig();
    const merged = AppConfigSchema.parse({ ...before, ...patch });
    const next = setConfig(merged);
    if (JSON.stringify(before.network) !== JSON.stringify(next.network)) {
      await resetClient();
    }
    return next;
  });

  handle(IPC.UpdaterCheck, async () => checkForUpdates());
  handle(IPC.UpdaterDownload, async () => downloadUpdate());
  handle(IPC.UpdaterInstall, async () => quitAndInstall());

  handle(IPC.LogsTail, async (lines: number): Promise<LogLine[]> => {
    const file = currentLogFile();
    if (!file) return [];
    const want = Math.max(1, lines | 0);
    try {
      const text = await readTailUtf8(file, 64 * 1024);
      const all = text.trim().split('\n').slice(-want);
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

  handle(
    IPC.DialogShowSaveDialog,
    async (opts: {
      defaultPath?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
      title?: string;
    }): Promise<string | null> => {
      const win = getWindow();
      const result = win
        ? await dialog.showSaveDialog(win, opts)
        : await dialog.showSaveDialog(opts);
      return result.canceled || !result.filePath ? null : result.filePath;
    },
  );

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

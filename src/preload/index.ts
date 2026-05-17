import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/ipc-channels';
import type {
  AuditFilter,
  AuditRow,
  AuthInput,
  ConnectionResult,
  ConnectionStatus,
  ConvertResult,
  IpcResult,
  LogLine,
  MigrationStatus,
  PageListOptions,
  PagesListProgress,
  UpdateInfo,
  UpdaterStatus,
} from '@shared/types';
import type { AppConfig } from '@shared/config-schema';
import type { AttachmentInfo, PageDetail, PageSummary, SpaceInfo } from '@shared/domain';
import type { SerializedError } from '@shared/errors';

class LoopbridgeApiError extends Error {
  kind: SerializedError['kind'];
  retryable: boolean;
  statusCode?: number;
  hint?: string;

  constructor(err: SerializedError) {
    super(err.message);
    this.name = 'LoopbridgeApiError';
    this.kind = err.kind;
    this.retryable = err.retryable;
    if (err.statusCode !== undefined) this.statusCode = err.statusCode;
    if (err.hint !== undefined) this.hint = err.hint;
  }
}

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const res = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>;
  if (!res.ok) throw new LoopbridgeApiError(res.error);
  return res.data;
}

type Unsubscribe = () => void;

function subscribe<T>(channel: string, cb: (payload: T) => void): Unsubscribe {
  const listener = (_event: Electron.IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api = {
  connection: {
    test: (input: AuthInput): Promise<ConnectionResult> => invoke(IPC.ConnectionTest, input),
    saveAuth: (input: AuthInput): Promise<void> => invoke(IPC.ConnectionSaveAuth, input),
    clearAuth: (): Promise<void> => invoke(IPC.ConnectionClearAuth),
    getStatus: (): Promise<ConnectionStatus> => invoke(IPC.ConnectionGetStatus),
  },
  spaces: {
    list: (): Promise<SpaceInfo[]> => invoke(IPC.SpacesList),
    resolve: (key: string): Promise<SpaceInfo> => invoke(IPC.SpaceResolve, key),
  },
  pages: {
    list: (spaceKeyOrId: string, opts?: PageListOptions): Promise<PageSummary[]> =>
      invoke(IPC.PagesList, spaceKeyOrId, opts),
    get: (pageId: string): Promise<PageDetail> => invoke(IPC.PageGet, pageId),
    convert: (pageId: string): Promise<ConvertResult> => invoke(IPC.PageConvert, pageId),
    copyToClipboard: (pageId: string): Promise<void> => invoke(IPC.PageCopyToClipboard, pageId),
    markDone: (pageId: string, note?: string): Promise<void> =>
      invoke(IPC.PageMarkDone, pageId, note),
    markSkipped: (pageId: string, reason: string): Promise<void> =>
      invoke(IPC.PageMarkSkipped, pageId, reason),
    reset: (pageId: string): Promise<void> => invoke(IPC.PageReset, pageId),
    refetch: (pageId: string): Promise<void> => invoke(IPC.PageRefetch, pageId),
  },
  attachments: {
    list: (pageId: string): Promise<AttachmentInfo[]> => invoke(IPC.AttachmentsList, pageId),
    download: (pageId: string, filename: string): Promise<{ path: string; bytes: number }> =>
      invoke(IPC.AttachmentDownload, pageId, filename),
  },
  audit: {
    list: (filter?: AuditFilter): Promise<AuditRow[]> => invoke(IPC.AuditList, filter ?? {}),
    exportCsv: (targetPath: string): Promise<void> => invoke(IPC.AuditExportCsv, targetPath),
    clear: (): Promise<void> => invoke(IPC.AuditClear),
  },
  config: {
    get: (): Promise<AppConfig> => invoke(IPC.ConfigGet),
    set: (patch: Partial<AppConfig>): Promise<AppConfig> => invoke(IPC.ConfigSet, patch),
  },
  updater: {
    check: (): Promise<UpdateInfo | null> => invoke(IPC.UpdaterCheck),
    download: (): Promise<void> => invoke(IPC.UpdaterDownload),
    quitAndInstall: (): Promise<void> => invoke(IPC.UpdaterInstall),
  },
  logs: {
    tail: (lines: number): Promise<LogLine[]> => invoke(IPC.LogsTail, lines),
    openFolder: (): Promise<void> => invoke(IPC.LogsOpenFolder),
  },
  shell: {
    openExternal: (url: string): Promise<void> => invoke(IPC.ShellOpenExternal, url),
    showItemInFolder: (target: string): Promise<void> => invoke(IPC.ShellShowItemInFolder, target),
  },
  dialog: {
    showSaveDialog: (opts: {
      defaultPath?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
      title?: string;
    }): Promise<string | null> => invoke(IPC.DialogShowSaveDialog, opts),
  },
  on: {
    pagesListProgress: (cb: (p: PagesListProgress) => void): Unsubscribe =>
      subscribe(IPC.EvtPagesListProgress, cb),
    migrationStatus: (cb: (s: MigrationStatus) => void): Unsubscribe =>
      subscribe(IPC.EvtMigrationStatus, cb),
    updaterStatus: (cb: (s: UpdaterStatus) => void): Unsubscribe =>
      subscribe(IPC.EvtUpdaterStatus, cb),
    logLine: (cb: (l: LogLine) => void): Unsubscribe => subscribe(IPC.EvtLogLine, cb),
  },
};

export type LoopbridgeApi = typeof api;

contextBridge.exposeInMainWorld('api', api);

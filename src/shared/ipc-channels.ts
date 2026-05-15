export const IPC = {
  ConnectionTest: 'connection:test',
  ConnectionSaveAuth: 'connection:save-auth',
  ConnectionClearAuth: 'connection:clear-auth',
  ConnectionGetStatus: 'connection:get-status',

  SpacesList: 'spaces:list',
  SpaceResolve: 'spaces:resolve',

  PagesList: 'pages:list',
  PageGet: 'pages:get',
  PageConvert: 'pages:convert',
  PageCopyToClipboard: 'pages:copy-clipboard',
  PageMarkDone: 'pages:mark-done',
  PageMarkSkipped: 'pages:mark-skipped',
  PageReset: 'pages:reset',

  AttachmentsList: 'attachments:list',
  AttachmentDownload: 'attachments:download',

  AuditList: 'audit:list',
  AuditExportCsv: 'audit:export-csv',
  AuditClear: 'audit:clear',

  ConfigGet: 'config:get',
  ConfigSet: 'config:set',

  UpdaterCheck: 'updater:check',
  UpdaterDownload: 'updater:download',
  UpdaterInstall: 'updater:quit-and-install',

  LogsTail: 'logs:tail',
  LogsOpenFolder: 'logs:open-folder',

  ShellOpenExternal: 'shell:open-external',
  ShellShowItemInFolder: 'shell:show-item-in-folder',

  EvtPagesListProgress: 'evt:pages-list-progress',
  EvtMigrationStatus: 'evt:migration-status',
  EvtUpdaterStatus: 'evt:updater-status',
  EvtLogLine: 'evt:log-line',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

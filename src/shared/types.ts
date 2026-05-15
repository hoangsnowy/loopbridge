import type { ConfluenceBackend } from './domain';
import type { SerializedError } from './errors';

export interface AuthInputDc {
  backend: 'dc';
  baseUrl: string;
  authMethod: 'pat' | 'basic';
  username?: string;
  secret: string;
  caBundlePath?: string;
  httpsProxy?: string;
}

export interface AuthInputCloud {
  backend: 'cloud';
  baseUrl: string;
  email: string;
  apiToken: string;
  httpsProxy?: string;
}

export type AuthInput = AuthInputDc | AuthInputCloud;

export interface ConnectionResult {
  ok: boolean;
  user?: {
    accountId: string;
    displayName: string;
    email?: string;
  };
  serverVersion?: string;
  backend: ConfluenceBackend;
  error?: SerializedError;
}

export interface ConnectionStatus {
  configured: boolean;
  backend?: ConfluenceBackend;
  baseUrl?: string;
  identityLabel?: string;
}

export type PageStatus =
  | 'pending'
  | 'fetched'
  | 'converted'
  | 'copied'
  | 'done'
  | 'skipped'
  | 'error';

export interface PageListOptions {
  search?: string;
  status?: PageStatus | 'all';
  limit?: number;
  cursor?: string;
}

export interface ConvertOptions {
  forceRefetch?: boolean;
}

export interface ConvertResult {
  pageId: string;
  html: string;
  needsReview: number;
  imagesEmbedded: number;
  imagesManual: number;
  imagePlan: ImagePlanEntry[];
}

export interface ImagePlanEntry {
  filename: string;
  kind: 'embedded-base64' | 'manual-drag' | 'external';
  sizeBytes: number;
  localPath?: string;
  originalSrc: string;
}

export interface AuditFilter {
  status?: PageStatus | 'all';
  spaceKey?: string;
  needsReviewOnly?: boolean;
  limit?: number;
}

export interface AuditRow {
  pageId: string;
  spaceKey: string;
  title: string;
  versionNumber: number;
  parentId?: string;
  status: PageStatus;
  needsReview: number;
  imagesEmbedded: number;
  imagesManual: number;
  fetchedAt?: string;
  convertedAt?: string;
  copiedAt?: string;
  doneAt?: string;
  errorKind?: string;
  errorMessage?: string;
  note?: string;
}

export interface UpdateInfo {
  version: string;
  releaseNotes?: string;
  releaseDate?: string;
}

export interface UpdaterStatus {
  kind:
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error';
  message?: string;
  info?: UpdateInfo;
  progressPercent?: number;
}

export interface MigrationStatus {
  kind: 'idle' | 'listing' | 'fetching' | 'converting' | 'staging' | 'paused' | 'error';
  pageId?: string;
  message?: string;
  totalPages?: number;
  completedPages?: number;
}

export interface PagesListProgress {
  fetched: number;
  totalKnown?: number;
  done: boolean;
}

export interface LogLine {
  ts: string;
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  msg: string;
  ctx?: Record<string, unknown>;
}

export interface IpcEnvelope<T> {
  ok: true;
  data: T;
}

export interface IpcErrorEnvelope {
  ok: false;
  error: SerializedError;
}

export type IpcResult<T> = IpcEnvelope<T> | IpcErrorEnvelope;

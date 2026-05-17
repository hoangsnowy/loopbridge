import Database, { type Database as Db } from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import type { AuditFilter, AuditRow, PageStatus } from '@shared/types';
import type { ConfluenceBackend } from '@shared/domain';
import { ConfigError } from '@shared/errors';

let db: Db | undefined;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS migration_run (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at   TEXT    NOT NULL,
  ended_at     TEXT,
  backend      TEXT    NOT NULL,
  space_key    TEXT    NOT NULL,
  app_version  TEXT    NOT NULL,
  base_url     TEXT    NOT NULL,
  user_label   TEXT
);

CREATE TABLE IF NOT EXISTS page_state (
  page_id          TEXT PRIMARY KEY,
  space_key        TEXT NOT NULL,
  title            TEXT NOT NULL,
  version_number   INTEGER NOT NULL,
  parent_id        TEXT,
  status           TEXT NOT NULL,
  needs_review     INTEGER NOT NULL DEFAULT 0,
  images_embedded  INTEGER NOT NULL DEFAULT 0,
  images_manual    INTEGER NOT NULL DEFAULT 0,
  fetched_at       TEXT,
  converted_at     TEXT,
  copied_at        TEXT,
  done_at          TEXT,
  error_kind       TEXT,
  error_message    TEXT,
  note             TEXT
);

CREATE TABLE IF NOT EXISTS event_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id       INTEGER NOT NULL REFERENCES migration_run(id),
  page_id      TEXT,
  ts           TEXT NOT NULL,
  kind         TEXT NOT NULL,
  outcome      TEXT NOT NULL,
  details_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_event_page ON event_log(page_id);
CREATE INDEX IF NOT EXISTS idx_state_status ON page_state(status);
`;

export interface InitAuditOptions {
  userDataDir: string;
  filename?: string;
  /** Overrides userDataDir+filename. Use ':memory:' for tests. */
  dbPath?: string;
}

export function initAudit(opts: InitAuditOptions): Db {
  let file: string;
  if (opts.dbPath) {
    file = opts.dbPath;
  } else {
    fs.mkdirSync(opts.userDataDir, { recursive: true });
    file = path.join(opts.userDataDir, opts.filename ?? 'audit.sqlite');
  }
  db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

export function getAudit(): Db {
  if (!db) throw new ConfigError('Audit store not initialized');
  return db;
}

export function closeAudit(): void {
  if (db) {
    db.close();
    db = undefined;
  }
}

export interface StartRunInput {
  backend: ConfluenceBackend;
  spaceKey: string;
  baseUrl: string;
  appVersion: string;
  userLabel?: string;
}

export function startRun(input: StartRunInput): number {
  const d = getAudit();
  const stmt = d.prepare(
    `INSERT INTO migration_run (started_at, backend, space_key, app_version, base_url, user_label)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const info = stmt.run(
    new Date().toISOString(),
    input.backend,
    input.spaceKey,
    input.appVersion,
    input.baseUrl,
    input.userLabel ?? null,
  );
  return Number(info.lastInsertRowid);
}

export function endRun(runId: number): void {
  const d = getAudit();
  d.prepare(`UPDATE migration_run SET ended_at = ? WHERE id = ?`).run(
    new Date().toISOString(),
    runId,
  );
}

export interface UpsertPageInput {
  pageId: string;
  spaceKey: string;
  title: string;
  versionNumber: number;
  parentId?: string;
}

export function upsertPage(input: UpsertPageInput): void {
  const d = getAudit();
  const info = d
    .prepare(
      `INSERT INTO page_state (page_id, space_key, title, version_number, parent_id, status)
     VALUES (?, ?, ?, ?, ?, 'pending')
     ON CONFLICT(page_id) DO UPDATE SET
       title = excluded.title,
       version_number = excluded.version_number,
       parent_id = excluded.parent_id`,
    )
    .run(input.pageId, input.spaceKey, input.title, input.versionNumber, input.parentId ?? null);
  if (info.changes === 0) {
    throw new ConfigError(`Failed to upsert page_state row for ${input.pageId}`);
  }
}

export interface RecordEventInput {
  runId: number;
  pageId?: string;
  kind: string;
  outcome: 'success' | 'error' | 'retried';
  details?: Record<string, unknown>;
}

const SENSITIVE_KEY_RE =
  /^(authorization|token|secret|api[-_]?token|password|pat|cookie|x-api-key|set-cookie|access[-_]?token|refresh[-_]?token)$/i;

function redactSensitive(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEY_RE.test(k) ? '[REDACTED]' : redactSensitive(v);
  }
  return out;
}

export function recordEvent(input: RecordEventInput): void {
  const d = getAudit();
  d.prepare(
    `INSERT INTO event_log (run_id, page_id, ts, kind, outcome, details_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    input.runId,
    input.pageId ?? null,
    new Date().toISOString(),
    input.kind,
    input.outcome,
    input.details ? JSON.stringify(redactSensitive(input.details)) : null,
  );
}

export interface TransitionInput {
  runId: number;
  pageId: string;
  next: PageStatus;
  eventKind: string;
  eventOutcome?: 'success' | 'error' | 'retried';
  patch?: {
    needsReview?: number;
    imagesEmbedded?: number;
    imagesManual?: number;
    errorKind?: string;
    errorMessage?: string;
    note?: string;
  };
  details?: Record<string, unknown>;
}

export function transitionPage(input: TransitionInput): void {
  const d = getAudit();
  const now = new Date().toISOString();
  const tx = d.transaction((i: TransitionInput) => {
    const sets: string[] = ['status = @status'];
    const params: Record<string, unknown> = {
      pageId: i.pageId,
      status: i.next,
    };
    switch (i.next) {
      case 'fetched':
        sets.push('fetched_at = @ts');
        break;
      case 'converted':
        sets.push('converted_at = @ts');
        break;
      case 'copied':
        sets.push('copied_at = @ts');
        break;
      case 'done':
        sets.push('done_at = @ts');
        break;
      default:
        break;
    }
    params.ts = now;
    if (i.patch?.needsReview !== undefined) {
      sets.push('needs_review = @needsReview');
      params.needsReview = i.patch.needsReview;
    }
    if (i.patch?.imagesEmbedded !== undefined) {
      sets.push('images_embedded = @imagesEmbedded');
      params.imagesEmbedded = i.patch.imagesEmbedded;
    }
    if (i.patch?.imagesManual !== undefined) {
      sets.push('images_manual = @imagesManual');
      params.imagesManual = i.patch.imagesManual;
    }
    if (i.patch?.errorKind !== undefined) {
      sets.push('error_kind = @errorKind');
      params.errorKind = i.patch.errorKind;
    }
    if (i.patch?.errorMessage !== undefined) {
      sets.push('error_message = @errorMessage');
      params.errorMessage = i.patch.errorMessage;
    }
    if (i.patch?.note !== undefined) {
      sets.push('note = @note');
      params.note = i.patch.note;
    }
    const upd = d
      .prepare(`UPDATE page_state SET ${sets.join(', ')} WHERE page_id = @pageId`)
      .run(params);
    if (upd.changes === 0) {
      throw new ConfigError(`Cannot transition unknown page ${i.pageId} — call upsertPage first`);
    }
    d.prepare(
      `INSERT INTO event_log (run_id, page_id, ts, kind, outcome, details_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      i.runId,
      i.pageId,
      now,
      i.eventKind,
      i.eventOutcome ?? (i.next === 'error' ? 'error' : 'success'),
      i.details ? JSON.stringify(redactSensitive(i.details)) : null,
    );
  });
  tx(input);
}

export function listPagesAudit(filter: AuditFilter): AuditRow[] {
  const d = getAudit();
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (filter.spaceKey) {
    where.push('space_key = @spaceKey');
    params.spaceKey = filter.spaceKey;
  }
  if (filter.status && filter.status !== 'all') {
    where.push('status = @status');
    params.status = filter.status;
  }
  if (filter.needsReviewOnly) {
    where.push('needs_review > 0');
  }
  const limit = filter.limit ?? 1000;
  const sql = `SELECT page_id, space_key, title, version_number, parent_id, status, needs_review,
                      images_embedded, images_manual, fetched_at, converted_at, copied_at, done_at,
                      error_kind, error_message, note
               FROM page_state
               ${where.length > 0 ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY title COLLATE NOCASE
               LIMIT ${limit}`;
  const rows = d.prepare(sql).all(params) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    pageId: String(r.page_id),
    spaceKey: String(r.space_key),
    title: String(r.title),
    versionNumber: Number(r.version_number),
    parentId: r.parent_id ? String(r.parent_id) : undefined,
    status: r.status as PageStatus,
    needsReview: Number(r.needs_review ?? 0),
    imagesEmbedded: Number(r.images_embedded ?? 0),
    imagesManual: Number(r.images_manual ?? 0),
    fetchedAt: r.fetched_at ? String(r.fetched_at) : undefined,
    convertedAt: r.converted_at ? String(r.converted_at) : undefined,
    copiedAt: r.copied_at ? String(r.copied_at) : undefined,
    doneAt: r.done_at ? String(r.done_at) : undefined,
    errorKind: r.error_kind ? String(r.error_kind) : undefined,
    errorMessage: r.error_message ? String(r.error_message) : undefined,
    note: r.note ? String(r.note) : undefined,
  }));
}

export function countByStatus(): Record<PageStatus, number> {
  const d = getAudit();
  const rows = d
    .prepare(`SELECT status, COUNT(*) as n FROM page_state GROUP BY status`)
    .all() as Array<{ status: string; n: number }>;
  const out: Record<PageStatus, number> = {
    pending: 0,
    fetched: 0,
    converted: 0,
    copied: 0,
    done: 0,
    skipped: 0,
    error: 0,
  };
  for (const r of rows) {
    if (r.status in out) {
      out[r.status as PageStatus] = r.n;
    }
  }
  return out;
}

export function pruneEventLog(olderThanDays: number): number {
  const d = getAudit();
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
  const info = d.prepare(`DELETE FROM event_log WHERE ts < ?`).run(cutoff);
  return info.changes;
}

export function clearAudit(): void {
  const d = getAudit();
  d.exec(`DELETE FROM event_log; DELETE FROM page_state; DELETE FROM migration_run;`);
}

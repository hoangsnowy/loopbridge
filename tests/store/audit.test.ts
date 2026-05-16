import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  closeAudit,
  initAudit,
  startRun,
  upsertPage,
  transitionPage,
  recordEvent,
  getAudit,
  endRun,
} from '@main/store/audit';
import { ConfigError } from '@shared/errors';

function newDb() {
  initAudit({ userDataDir: '', dbPath: ':memory:' });
}

describe('audit store', () => {
  beforeEach(() => {
    newDb();
  });

  afterEach(() => {
    closeAudit();
  });

  it('enables foreign_keys pragma', () => {
    const d = getAudit();
    const row = d.pragma('foreign_keys', { simple: true });
    expect(row).toBe(1);
  });

  it('end-to-end: startRun → upsertPage → transition → recordEvent', () => {
    const runId = startRun({
      backend: 'dc',
      spaceKey: 'DOCS',
      baseUrl: 'https://example.com',
      appVersion: '0.2.0',
    });
    expect(runId).toBeGreaterThan(0);

    upsertPage({
      pageId: 'p1',
      spaceKey: 'DOCS',
      title: 'Hello',
      versionNumber: 1,
    });

    transitionPage({
      runId,
      pageId: 'p1',
      next: 'fetched',
      eventKind: 'fetch',
    });

    recordEvent({
      runId,
      pageId: 'p1',
      kind: 'note',
      outcome: 'success',
    });

    endRun(runId);
  });

  it('transitionPage on unknown page throws ConfigError', () => {
    const runId = startRun({
      backend: 'dc',
      spaceKey: 'DOCS',
      baseUrl: 'https://example.com',
      appVersion: '0.2.0',
    });
    expect(() =>
      transitionPage({
        runId,
        pageId: 'ghost',
        next: 'fetched',
        eventKind: 'fetch',
      }),
    ).toThrow(ConfigError);
  });

  it('event_log insert with invalid run_id is rejected by FK', () => {
    const d = getAudit();
    // FK violation: run_id 9999 does not exist in migration_run.
    expect(() =>
      d
        .prepare(
          `INSERT INTO event_log (run_id, page_id, ts, kind, outcome, details_json)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(9999, null, new Date().toISOString(), 'orphan', 'success', null),
    ).toThrow(/FOREIGN KEY/);
  });
});

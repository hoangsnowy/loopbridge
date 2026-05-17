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

  it('details_json strips sensitive keys from recordEvent and transitionPage', () => {
    const runId = startRun({
      backend: 'dc',
      spaceKey: 'DOCS',
      baseUrl: 'https://example.com',
      appVersion: '0.2.0',
    });
    upsertPage({ pageId: 'p1', spaceKey: 'DOCS', title: 'Hello', versionNumber: 1 });
    recordEvent({
      runId,
      pageId: 'p1',
      kind: 'http',
      outcome: 'success',
      details: {
        headers: {
          Authorization: 'Bearer abc123',
          'X-Api-Key': 'sk-live-xyz',
          'Set-Cookie': 'session=plaintext',
          'Content-Type': 'application/json',
        },
        body: { password: 'hunter2', user: 'jane' },
        url: 'https://example.com/api',
      },
    });
    transitionPage({
      runId,
      pageId: 'p1',
      next: 'fetched',
      eventKind: 'fetch',
      details: { token: 'tk_abc', meta: { refresh_token: 'rt_xyz' } },
    });

    const d = getAudit();
    const rows = d
      .prepare(`SELECT details_json FROM event_log WHERE details_json IS NOT NULL`)
      .all() as Array<{ details_json: string }>;
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const r of rows) {
      expect(r.details_json).toContain('[REDACTED]');
      expect(r.details_json).not.toContain('Bearer abc123');
      expect(r.details_json).not.toContain('sk-live-xyz');
      expect(r.details_json).not.toContain('hunter2');
      expect(r.details_json).not.toContain('tk_abc');
      expect(r.details_json).not.toContain('rt_xyz');
      expect(r.details_json).not.toContain('plaintext');
    }
    // Non-sensitive fields are preserved.
    const joined = rows.map((r) => r.details_json).join('\n');
    expect(joined).toContain('application/json');
    expect(joined).toContain('jane');
    expect(joined).toContain('https://example.com/api');
  });
});

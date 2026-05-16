import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigError } from '@shared/errors';

// app.getVersion is the only Electron API the service touches.
vi.mock('electron', () => ({
  app: { getVersion: () => '0.2.0-test' },
}));

// Imported AFTER the mock so the service picks it up.
const { closeAudit, initAudit } = await import('@main/store/audit');
const { ensureRun, endCurrentRun, getCurrentRunId, transition, upsertPageSummary, recordEvent } =
  await import('@main/services/progress-service');

describe('progress-service', () => {
  beforeEach(() => {
    initAudit({ userDataDir: '', dbPath: ':memory:' });
  });

  afterEach(() => {
    endCurrentRun();
    closeAudit();
  });

  it('ensureRun is idempotent and exposes currentRunId', async () => {
    const a = await ensureRun({
      backend: 'dc',
      spaceKey: 'DOCS',
      baseUrl: 'https://example.com',
    });
    const b = await ensureRun({
      backend: 'dc',
      spaceKey: 'DOCS',
      baseUrl: 'https://example.com',
    });
    expect(a).toBe(b);
    expect(getCurrentRunId()).toBe(a);
  });

  it('endCurrentRun clears the active run', async () => {
    await ensureRun({
      backend: 'dc',
      spaceKey: 'DOCS',
      baseUrl: 'https://example.com',
    });
    endCurrentRun();
    expect(getCurrentRunId()).toBeUndefined();
  });

  it('transition without active run throws ConfigError', () => {
    expect(() => transition({ pageId: 'p1', next: 'fetched', eventKind: 'fetch' })).toThrow(
      ConfigError,
    );
  });

  it('recordEvent without active run throws ConfigError', () => {
    expect(() => recordEvent({ kind: 'noop', outcome: 'success' })).toThrow(ConfigError);
  });

  it('end-to-end: ensureRun → upsertPageSummary → transition → recordEvent', async () => {
    await ensureRun({
      backend: 'dc',
      spaceKey: 'DOCS',
      baseUrl: 'https://example.com',
    });

    upsertPageSummary({
      pageId: 'p1',
      spaceKey: 'DOCS',
      title: 'Hello',
      versionNumber: 1,
    });

    transition({ pageId: 'p1', next: 'fetched', eventKind: 'fetch' });
    recordEvent({ pageId: 'p1', kind: 'note', outcome: 'success' });
  });
});

import { describe, expect, it } from 'vitest';
import {
  AppConfigSchema,
  ConfluenceConfigSchema,
  DEFAULT_APP_CONFIG,
  LoggingConfigSchema,
  MigrationConfigSchema,
  NetworkConfigSchema,
  UpdaterConfigSchema,
} from '@shared/config-schema';

describe('config schema', () => {
  it('DEFAULT_APP_CONFIG parses cleanly with no input', () => {
    expect(DEFAULT_APP_CONFIG.schemaVersion).toBe(1);
    expect(DEFAULT_APP_CONFIG.network.requestTimeoutMs).toBe(30_000);
    expect(DEFAULT_APP_CONFIG.migration.imageStrategy).toBe('auto');
    expect(DEFAULT_APP_CONFIG.logging.fileRetentionDays).toBe(14);
    expect(DEFAULT_APP_CONFIG.updater.autoDownload).toBe(true);
  });

  it('AppConfigSchema accepts minimal valid input', () => {
    const cfg = AppConfigSchema.parse({ schemaVersion: 1 });
    expect(cfg.ui.theme).toBe('system');
    expect(cfg.telemetry.enabled).toBe(false);
  });

  it('ConfluenceConfigSchema (DC) rejects trailing slash baseUrl', () => {
    expect(() =>
      ConfluenceConfigSchema.parse({
        backend: 'dc',
        baseUrl: 'https://confluence.example.com/',
        authMethod: 'pat',
      }),
    ).toThrow(/trailing slash/);
  });

  it('ConfluenceConfigSchema (Cloud) requires *.atlassian.net host', () => {
    expect(() =>
      ConfluenceConfigSchema.parse({
        backend: 'cloud',
        baseUrl: 'https://example.com',
        email: 'a@b.com',
      }),
    ).toThrow(/\batlassian\.net\b/);

    const ok = ConfluenceConfigSchema.parse({
      backend: 'cloud',
      baseUrl: 'https://acme.atlassian.net',
      email: 'a@b.com',
    });
    expect(ok.backend).toBe('cloud');
  });

  it('ConfluenceConfigSchema (Cloud) requires a valid email', () => {
    expect(() =>
      ConfluenceConfigSchema.parse({
        backend: 'cloud',
        baseUrl: 'https://acme.atlassian.net',
        email: 'not-an-email',
      }),
    ).toThrow();
  });

  it('NetworkConfigSchema clamps requestTimeoutMs to [1000, 120000]', () => {
    expect(() => NetworkConfigSchema.parse({ requestTimeoutMs: 999 })).toThrow();
    expect(() => NetworkConfigSchema.parse({ requestTimeoutMs: 120_001 })).toThrow();
    expect(NetworkConfigSchema.parse({ requestTimeoutMs: 5000 }).requestTimeoutMs).toBe(5000);
  });

  it('NetworkConfigSchema enforces maxConcurrentRequests in [1, 8]', () => {
    expect(() => NetworkConfigSchema.parse({ maxConcurrentRequests: 0 })).toThrow();
    expect(() => NetworkConfigSchema.parse({ maxConcurrentRequests: 9 })).toThrow();
    expect(NetworkConfigSchema.parse({ maxConcurrentRequests: 4 }).maxConcurrentRequests).toBe(4);
  });

  it('MigrationConfigSchema imageStrategy only accepts known values', () => {
    expect(() => MigrationConfigSchema.parse({ imageStrategy: 'wild' })).toThrow();
    expect(MigrationConfigSchema.parse({ imageStrategy: 'manual' }).imageStrategy).toBe('manual');
  });

  it('LoggingConfigSchema bounds retention days', () => {
    expect(() => LoggingConfigSchema.parse({ fileRetentionDays: 0 })).toThrow();
    expect(() => LoggingConfigSchema.parse({ fileRetentionDays: 91 })).toThrow();
    expect(LoggingConfigSchema.parse({ fileRetentionDays: 30 }).fileRetentionDays).toBe(30);
  });

  it('UpdaterConfigSchema defaults autoDownload=true, autoInstallOnQuit=true', () => {
    const u = UpdaterConfigSchema.parse({});
    expect(u.autoDownload).toBe(true);
    expect(u.autoInstallOnQuit).toBe(true);
    expect(u.channel).toBe('stable');
  });
});

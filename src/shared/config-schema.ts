import { z } from 'zod';

const baseUrlNoSlash = z
  .string()
  .url()
  .refine((u) => !u.endsWith('/'), 'baseUrl must not end with a trailing slash');

const DcAuthSchema = z.object({
  backend: z.literal('dc'),
  baseUrl: baseUrlNoSlash,
  authMethod: z.enum(['pat', 'basic']),
  username: z.string().min(1).optional(),
});

const CloudAuthSchema = z.object({
  backend: z.literal('cloud'),
  baseUrl: baseUrlNoSlash.refine((u) => {
    try {
      const host = new URL(u).hostname.toLowerCase();
      return host === 'atlassian.net' || host.endsWith('.atlassian.net');
    } catch {
      return false;
    }
  }, 'Cloud baseUrl host must be atlassian.net'),
  email: z.string().email(),
});

export const ConfluenceConfigSchema = z.discriminatedUnion('backend', [
  DcAuthSchema,
  CloudAuthSchema,
]);

export const NetworkConfigSchema = z.object({
  httpsProxy: z.string().url().optional(),
  caBundlePath: z.string().optional(),
  requestTimeoutMs: z.number().int().min(1000).max(120_000).default(30_000),
  maxConcurrentRequests: z.number().int().min(1).max(8).default(3),
});

export const MigrationConfigSchema = z.object({
  activeSpaceKey: z.string().optional(),
  imageStrategy: z.enum(['auto', 'base64', 'manual']).default('auto'),
  base64MaxBytesPerImage: z.number().int().positive().default(1_000_000),
  base64MaxBytesPerPage: z.number().int().positive().default(8_000_000),
  demoteH1ToH2: z.boolean().default(true),
  rewriteInternalLinks: z.enum(['keep-confluence', 'placeholder']).default('keep-confluence'),
  needsReviewMarker: z.boolean().default(true),
  strictNoUnreviewedDone: z.boolean().default(false),
});

export const UiConfigSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  pageListPageSize: z.number().int().min(25).max(500).default(100),
});

export const LoggingConfigSchema = z.object({
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  fileRetentionDays: z.number().int().min(1).max(90).default(14),
  eventLogRetentionDays: z.number().int().min(7).max(365).default(90),
});

export const UpdaterConfigSchema = z.object({
  channel: z.enum(['stable', 'beta']).default('stable'),
  feedUrl: z.string().url().optional(),
  autoDownload: z.boolean().default(true),
  autoInstallOnQuit: z.boolean().default(true),
});

export const TelemetryConfigSchema = z.object({
  enabled: z.boolean().default(false),
  sentryDsn: z.string().url().optional(),
});

export const AppConfigSchema = z.object({
  schemaVersion: z.literal(1),
  confluence: ConfluenceConfigSchema.optional(),
  network: NetworkConfigSchema.default(() => NetworkConfigSchema.parse({})),
  migration: MigrationConfigSchema.default(() => MigrationConfigSchema.parse({})),
  ui: UiConfigSchema.default(() => UiConfigSchema.parse({})),
  logging: LoggingConfigSchema.default(() => LoggingConfigSchema.parse({})),
  updater: UpdaterConfigSchema.default(() => UpdaterConfigSchema.parse({})),
  telemetry: TelemetryConfigSchema.default(() => TelemetryConfigSchema.parse({})),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
export type ConfluenceConfig = z.infer<typeof ConfluenceConfigSchema>;
export type DcConfluenceConfig = z.infer<typeof DcAuthSchema>;
export type CloudConfluenceConfig = z.infer<typeof CloudAuthSchema>;
export type NetworkConfig = z.infer<typeof NetworkConfigSchema>;
export type MigrationConfig = z.infer<typeof MigrationConfigSchema>;

export const DEFAULT_APP_CONFIG: AppConfig = AppConfigSchema.parse({ schemaVersion: 1 });

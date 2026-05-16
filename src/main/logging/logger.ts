import fs from 'node:fs';
import path from 'node:path';
import pino, { type Logger, type Level } from 'pino';
import pinoRoll from 'pino-roll';

const REDACT_PATHS = [
  'req.headers.authorization',
  'headers.authorization',
  'config.basicPassword',
  '*.token',
  '*.password',
  '*.secret',
  '*.apiToken',
  '*.pat',
];

let rootLogger: Logger | undefined;
let activeLogFile: string | undefined;

export interface LoggerInit {
  userDataDir: string;
  level: Level;
  /** Number of rolled log files to keep (oldest deleted). Default 14. */
  fileRetentionDays?: number;
  consoleInDev?: boolean;
}

export async function initLogger(opts: LoggerInit): Promise<Logger> {
  const logsDir = path.join(opts.userDataDir, 'logs');
  fs.mkdirSync(logsDir, { recursive: true });

  const baseFile = path.join(logsDir, 'loopbridge');
  activeLogFile = `${baseFile}.jsonl`;

  const fileStream = await pinoRoll({
    file: baseFile,
    frequency: 'daily',
    size: '10m',
    extension: '.jsonl',
    mkdir: false,
    limit: { count: opts.fileRetentionDays ?? 14 },
  });

  const streams: { stream: NodeJS.WritableStream }[] = [{ stream: fileStream }];
  if (opts.consoleInDev && process.env.NODE_ENV !== 'production') {
    streams.push({ stream: process.stdout });
  }

  rootLogger = pino(
    {
      level: opts.level,
      base: { app: 'loopbridge', pid: process.pid },
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.multistream(streams),
  );

  return rootLogger;
}

export function getLogger(): Logger {
  if (!rootLogger) {
    rootLogger = pino({ level: 'info', base: { app: 'loopbridge-bootstrap' } });
  }
  return rootLogger;
}

export function childLogger(bindings: Record<string, unknown>): Logger {
  return getLogger().child(bindings);
}

export function currentLogFile(): string | undefined {
  return activeLogFile;
}

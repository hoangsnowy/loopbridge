import fs from 'node:fs';
import path from 'node:path';
import pino, { type Logger, type Level } from 'pino';

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
  consoleInDev?: boolean;
}

export function initLogger(opts: LoggerInit): Logger {
  const logsDir = path.join(opts.userDataDir, 'logs');
  fs.mkdirSync(logsDir, { recursive: true });

  const today = new Date().toISOString().slice(0, 10);
  const logFile = path.join(logsDir, `loopbridge-${today}.jsonl`);
  activeLogFile = logFile;

  const destination = pino.destination({ dest: logFile, sync: false, mkdir: false });

  rootLogger = pino(
    {
      level: opts.level,
      base: { app: 'loopbridge', pid: process.pid },
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    destination,
  );

  if (opts.consoleInDev && process.env.NODE_ENV !== 'production') {
    rootLogger = pino(
      {
        level: opts.level,
        base: { app: 'loopbridge', pid: process.pid },
        redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
        timestamp: pino.stdTimeFunctions.isoTime,
      },
      pino.multistream([{ stream: destination }, { stream: process.stdout }]),
    );
  }

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

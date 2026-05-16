// Minimal ambient declaration for pino-roll v4 (no shipped types).
// Only the fields we actually use.
declare module 'pino-roll' {
  interface PinoRollOptions {
    file: string | (() => string);
    size?: string | number;
    frequency?: 'daily' | 'hourly' | number;
    extension?: string;
    mkdir?: boolean;
    symlink?: boolean;
    limit?: { count?: number; removeOtherLogFiles?: boolean };
    dateFormat?: string;
  }
  function pinoRoll(opts: PinoRollOptions): Promise<NodeJS.WritableStream>;
  export default pinoRoll;
}

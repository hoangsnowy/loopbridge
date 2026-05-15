export type ErrorKind =
  | 'auth'
  | 'network'
  | 'vpn'
  | 'rate-limit'
  | 'server'
  | 'client'
  | 'converter'
  | 'tls'
  | 'config'
  | 'unknown';

export interface SerializedError {
  kind: ErrorKind;
  message: string;
  statusCode?: number;
  retryable: boolean;
  retryAfterMs?: number;
  hint?: string;
}

export class LoopbridgeError extends Error {
  readonly kind: ErrorKind;
  readonly retryable: boolean;
  readonly statusCode?: number;
  readonly retryAfterMs?: number;
  readonly hint?: string;

  constructor(
    kind: ErrorKind,
    message: string,
    opts: {
      retryable?: boolean;
      statusCode?: number;
      retryAfterMs?: number;
      hint?: string;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'LoopbridgeError';
    this.kind = kind;
    this.retryable = opts.retryable ?? false;
    if (opts.statusCode !== undefined) this.statusCode = opts.statusCode;
    if (opts.retryAfterMs !== undefined) this.retryAfterMs = opts.retryAfterMs;
    if (opts.hint !== undefined) this.hint = opts.hint;
    if (opts.cause !== undefined) (this as Error & { cause?: unknown }).cause = opts.cause;
  }

  serialize(): SerializedError {
    const out: SerializedError = {
      kind: this.kind,
      message: this.message,
      retryable: this.retryable,
    };
    if (this.statusCode !== undefined) out.statusCode = this.statusCode;
    if (this.retryAfterMs !== undefined) out.retryAfterMs = this.retryAfterMs;
    if (this.hint) out.hint = this.hint;
    return out;
  }
}

export class AuthError extends LoopbridgeError {
  constructor(message = 'Authentication failed', opts: { statusCode?: number; cause?: unknown } = {}) {
    super('auth', message, { retryable: false, ...opts });
    this.name = 'AuthError';
  }
}

export class NetworkError extends LoopbridgeError {
  constructor(message: string, opts: { cause?: unknown } = {}) {
    super('network', message, { retryable: true, ...opts });
    this.name = 'NetworkError';
  }
}

export class VpnError extends LoopbridgeError {
  constructor(host: string, opts: { cause?: unknown } = {}) {
    super('vpn', `Cannot reach ${host}. Connect to VPN and try again.`, {
      retryable: true,
      hint: 'Verify that the corporate VPN is connected and DNS resolves the Confluence host.',
      ...opts,
    });
    this.name = 'VpnError';
  }
}

export class RateLimitError extends LoopbridgeError {
  constructor(message = 'Rate limited', opts: { retryAfterMs?: number; statusCode?: number; cause?: unknown } = {}) {
    super('rate-limit', message, { retryable: true, statusCode: 429, ...opts });
    this.name = 'RateLimitError';
  }
}

export class ServerError extends LoopbridgeError {
  constructor(message: string, opts: { statusCode?: number; cause?: unknown } = {}) {
    super('server', message, { retryable: true, ...opts });
    this.name = 'ServerError';
  }
}

export class ClientError extends LoopbridgeError {
  constructor(message: string, opts: { statusCode?: number; cause?: unknown } = {}) {
    super('client', message, { retryable: false, ...opts });
    this.name = 'ClientError';
  }
}

export class ConverterError extends LoopbridgeError {
  constructor(message: string, opts: { cause?: unknown } = {}) {
    super('converter', message, { retryable: false, ...opts });
    this.name = 'ConverterError';
  }
}

export class TlsError extends LoopbridgeError {
  constructor(message: string, opts: { cause?: unknown } = {}) {
    super('tls', message, {
      retryable: false,
      hint: 'If your Confluence host uses an internal CA, set the CA bundle path in Settings.',
      ...opts,
    });
    this.name = 'TlsError';
  }
}

export class ConfigError extends LoopbridgeError {
  constructor(message: string, opts: { cause?: unknown } = {}) {
    super('config', message, { retryable: false, ...opts });
    this.name = 'ConfigError';
  }
}

export function toSerializedError(err: unknown): SerializedError {
  if (err instanceof LoopbridgeError) return err.serialize();
  if (err instanceof Error) {
    return { kind: 'unknown', message: err.message, retryable: false };
  }
  return { kind: 'unknown', message: String(err), retryable: false };
}

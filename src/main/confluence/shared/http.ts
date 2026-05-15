import { request, type Dispatcher } from 'undici';
import {
  AuthError,
  ClientError,
  LoopbridgeError,
  NetworkError,
  RateLimitError,
  ServerError,
  TlsError,
  VpnError,
} from '@shared/errors';
import { retry, type RetryOptions } from '@main/net/retry';

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers: Record<string, string>;
  body?: string | Buffer;
  dispatcher: Dispatcher;
  timeoutMs: number;
  retry?: Partial<RetryOptions>;
  expectBinary?: boolean;
  host: string;
}

const TLS_ERROR_CODES = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'CERT_UNTRUSTED',
]);

export interface HttpResponse<T> {
  status: number;
  data: T;
  headers: Record<string, string | string[]>;
}

function classifyTransport(err: unknown, host: string): LoopbridgeError {
  if (!(err instanceof Error)) return new NetworkError(String(err), { cause: err });
  const code = (err as NodeJS.ErrnoException).code;
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return new VpnError(host, { cause: err });
  }
  if (code && TLS_ERROR_CODES.has(code)) {
    return new TlsError(`TLS error (${code}) connecting to ${host}`, { cause: err });
  }
  return new NetworkError(err.message, { cause: err });
}

function classifyHttp(status: number, body: string, retryAfterHeader?: string): LoopbridgeError {
  const truncated = body.length > 500 ? `${body.slice(0, 500)}…` : body;
  if (status === 401 || status === 403) {
    return new AuthError(`HTTP ${status}: ${truncated}`, { statusCode: status });
  }
  if (status === 429) {
    let retryAfterMs: number | undefined;
    if (retryAfterHeader) {
      const seconds = Number.parseInt(retryAfterHeader, 10);
      if (Number.isFinite(seconds)) retryAfterMs = seconds * 1000;
    }
    const opts: { retryAfterMs?: number; statusCode: number } = { statusCode: 429 };
    if (retryAfterMs !== undefined) opts.retryAfterMs = retryAfterMs;
    return new RateLimitError(`Rate limited (${truncated})`, opts);
  }
  if (status >= 500) {
    return new ServerError(`HTTP ${status}: ${truncated}`, { statusCode: status });
  }
  if (status === 408 || status === 425) {
    const e = new ServerError(`HTTP ${status}: ${truncated}`, { statusCode: status });
    return e;
  }
  return new ClientError(`HTTP ${status}: ${truncated}`, { statusCode: status });
}

export async function jsonRequest<T>(url: string, opts: HttpRequestOptions): Promise<HttpResponse<T>> {
  const retryOpts: RetryOptions = {
    maxAttempts: opts.retry?.maxAttempts ?? 5,
    baseMs: opts.retry?.baseMs ?? 500,
    maxDelayMs: opts.retry?.maxDelayMs ?? 30_000,
    jitter: opts.retry?.jitter ?? 0.3,
    ...(opts.retry?.signal ? { signal: opts.retry.signal } : {}),
    ...(opts.retry?.onRetry ? { onRetry: opts.retry.onRetry } : {}),
  };

  return retry(async () => {
    let res;
    try {
      res = await request(url, {
        method: opts.method ?? 'GET',
        headers: opts.headers,
        body: opts.body,
        dispatcher: opts.dispatcher,
        headersTimeout: opts.timeoutMs,
        bodyTimeout: opts.timeoutMs,
      });
    } catch (err) {
      throw classifyTransport(err, opts.host);
    }

    const status = res.statusCode;
    const bodyText = await res.body.text();
    if (status >= 200 && status < 300) {
      const data = bodyText ? (JSON.parse(bodyText) as T) : (undefined as unknown as T);
      return { status, data, headers: res.headers as Record<string, string | string[]> };
    }
    const retryAfter = res.headers['retry-after'];
    const retryAfterStr = Array.isArray(retryAfter) ? retryAfter[0] : retryAfter;
    throw classifyHttp(status, bodyText, retryAfterStr);
  }, retryOpts);
}

export async function binaryRequest(url: string, opts: HttpRequestOptions): Promise<Buffer> {
  const retryOpts: RetryOptions = {
    maxAttempts: opts.retry?.maxAttempts ?? 3,
    baseMs: opts.retry?.baseMs ?? 500,
    maxDelayMs: opts.retry?.maxDelayMs ?? 30_000,
    jitter: opts.retry?.jitter ?? 0.3,
    ...(opts.retry?.signal ? { signal: opts.retry.signal } : {}),
    ...(opts.retry?.onRetry ? { onRetry: opts.retry.onRetry } : {}),
  };

  return retry(async () => {
    let res;
    try {
      res = await request(url, {
        method: opts.method ?? 'GET',
        headers: opts.headers,
        dispatcher: opts.dispatcher,
        headersTimeout: opts.timeoutMs,
        bodyTimeout: opts.timeoutMs,
      });
    } catch (err) {
      throw classifyTransport(err, opts.host);
    }

    const status = res.statusCode;
    if (status >= 200 && status < 300) {
      const arr = await res.body.arrayBuffer();
      return Buffer.from(arr);
    }
    const bodyText = await res.body.text();
    const retryAfter = res.headers['retry-after'];
    const retryAfterStr = Array.isArray(retryAfter) ? retryAfter[0] : retryAfter;
    throw classifyHttp(status, bodyText, retryAfterStr);
  }, retryOpts);
}

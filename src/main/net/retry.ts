import { LoopbridgeError, RateLimitError } from '@shared/errors';

export interface RetryOptions {
  maxAttempts: number;
  baseMs: number;
  maxDelayMs: number;
  jitter?: number;
  signal?: AbortSignal;
  onRetry?: (info: { attempt: number; err: unknown; delayMs: number }) => void;
}

const DEFAULT_OPTIONS = {
  baseMs: 500,
  maxDelayMs: 30_000,
  jitter: 0.3,
} as const;

function isRetryable(err: unknown): boolean {
  if (err instanceof LoopbridgeError) return err.retryable;
  return false;
}

function delayForAttempt(
  attempt: number,
  opts: Required<Pick<RetryOptions, 'baseMs' | 'maxDelayMs' | 'jitter'>>,
): number {
  const exp = Math.min(opts.maxDelayMs, opts.baseMs * 2 ** attempt);
  const jitterAmount = Math.random() * opts.jitter * exp;
  return Math.floor(exp + jitterAmount);
}

export async function retry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const merged = { ...DEFAULT_OPTIONS, ...opts };
  let lastErr: unknown;
  for (let attempt = 0; attempt < merged.maxAttempts; attempt++) {
    merged.signal?.throwIfAborted();
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err)) throw err;
      if (attempt === merged.maxAttempts - 1) throw err;

      const explicit = err instanceof RateLimitError ? err.retryAfterMs : undefined;
      const delayMs = explicit ?? delayForAttempt(attempt, merged);
      merged.onRetry?.({ attempt: attempt + 1, err, delayMs });
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, delayMs);
        merged.signal?.addEventListener(
          'abort',
          () => {
            clearTimeout(t);
            reject(merged.signal?.reason ?? new DOMException('Aborted', 'AbortError'));
          },
          { once: true },
        );
      });
    }
  }
  throw lastErr;
}

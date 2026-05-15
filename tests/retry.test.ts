import { describe, expect, it, vi } from 'vitest';
import { retry } from '@main/net/retry';
import { NetworkError, RateLimitError, AuthError } from '@shared/errors';

describe('retry', () => {
  it('returns immediately on success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const out = await retry(fn, { maxAttempts: 3, baseMs: 1, maxDelayMs: 10 });
    expect(out).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable errors and eventually succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new NetworkError('flaky'))
      .mockResolvedValueOnce('done');
    const out = await retry(fn, { maxAttempts: 3, baseMs: 1, maxDelayMs: 10 });
    expect(out).toBe('done');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('honors retry-after on rate limit', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RateLimitError('slow down', { retryAfterMs: 5 }))
      .mockResolvedValueOnce('done');
    const start = Date.now();
    const out = await retry(fn, { maxAttempts: 3, baseMs: 1000, maxDelayMs: 30_000 });
    const elapsed = Date.now() - start;
    expect(out).toBe('done');
    expect(elapsed).toBeLessThan(500); // honored 5ms, not 1000ms base
  });

  it('does not retry non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new AuthError('bad token'));
    await expect(
      retry(fn, { maxAttempts: 3, baseMs: 1, maxDelayMs: 10 }),
    ).rejects.toThrow('bad token');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after max attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new NetworkError('always-flaky'));
    await expect(
      retry(fn, { maxAttempts: 3, baseMs: 1, maxDelayMs: 10 }),
    ).rejects.toThrow('always-flaky');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

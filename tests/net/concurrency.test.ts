import { describe, expect, it } from 'vitest';
import { pLimit } from '@main/net/concurrency';

describe('pLimit', () => {
  it('caps active in-flight tasks at the configured limit', async () => {
    const limit = pLimit(2);
    let active = 0;
    let peak = 0;
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const tasks = [10, 30, 5, 15, 20].map((dur) =>
      limit(async () => {
        active++;
        peak = Math.max(peak, active);
        await wait(dur);
        active--;
        return dur;
      }),
    );
    const results = await Promise.all(tasks);
    expect(results).toEqual([10, 30, 5, 15, 20]);
    expect(peak).toBe(2);
  });

  it('clamps concurrency below 1 up to 1', async () => {
    const limit = pLimit(0);
    let active = 0;
    let peak = 0;
    const tasks = Array.from({ length: 3 }).map(() =>
      limit(async () => {
        active++;
        peak = Math.max(peak, active);
        await Promise.resolve();
        active--;
      }),
    );
    await Promise.all(tasks);
    expect(peak).toBe(1);
  });

  it('releases the slot when the task throws', async () => {
    const limit = pLimit(1);
    await expect(limit(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    const ok = await limit(async () => 'ok');
    expect(ok).toBe('ok');
  });
});

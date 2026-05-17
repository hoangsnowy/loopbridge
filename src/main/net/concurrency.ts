export function pLimit(concurrency: number) {
  if (concurrency < 1) concurrency = 1;
  const queue: Array<() => void> = [];
  let active = 0;
  const next = (): void => {
    active--;
    const head = queue.shift();
    if (head) head();
  };
  return async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active++;
    try {
      return await fn();
    } finally {
      next();
    }
  };
}

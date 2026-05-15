import type { CloudListEnvelope } from './wire';
import { resolveNextUrl } from '../shared/pagination';

export interface CloudPageFetcher<T> {
  (url: string): Promise<CloudListEnvelope<T>>;
}

export async function* paginateCloud<T>(
  initialUrl: string,
  fallbackBase: string,
  fetcher: CloudPageFetcher<T>,
): AsyncIterable<T[]> {
  let next: string | undefined = initialUrl;
  while (next) {
    const env = await fetcher(next);
    yield env.results;
    next = resolveNextUrl(env, fallbackBase);
  }
}

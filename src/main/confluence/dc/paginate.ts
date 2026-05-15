import type { DcListEnvelope } from './wire';
import { resolveNextUrl } from '../shared/pagination';

export interface DcPageFetcher<T> {
  (url: string): Promise<DcListEnvelope<T>>;
}

export async function* paginateDc<T>(
  initialUrl: string,
  fallbackBase: string,
  fetcher: DcPageFetcher<T>,
): AsyncIterable<T[]> {
  let next: string | undefined = initialUrl;
  while (next) {
    const env = await fetcher(next);
    yield env.results;
    next = resolveNextUrl(env, fallbackBase);
  }
}

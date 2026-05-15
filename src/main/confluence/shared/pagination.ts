export interface PageEnvelope<T> {
  results: T[];
  start?: number;
  limit?: number;
  size?: number;
  _links?: {
    next?: string;
    base?: string;
    context?: string;
  };
}

export function resolveNextUrl(env: PageEnvelope<unknown>, fallbackBase: string): string | undefined {
  const next = env._links?.next;
  if (!next) return undefined;
  if (next.startsWith('http://') || next.startsWith('https://')) return next;
  const base = env._links?.base ?? fallbackBase;
  const ctx = env._links?.context ?? '';
  return `${base}${ctx}${next}`;
}

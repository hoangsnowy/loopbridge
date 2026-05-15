export const api = window.api;

export function isAuthError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { kind?: string }).kind === 'auth';
}

export function isVpnError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { kind?: string }).kind === 'vpn';
}

export function isTlsError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { kind?: string }).kind === 'tls';
}

export function errorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const e = err as { message?: string; hint?: string };
    return e.hint ? `${e.message ?? 'Error'} — ${e.hint}` : (e.message ?? 'Unknown error');
  }
  return String(err);
}

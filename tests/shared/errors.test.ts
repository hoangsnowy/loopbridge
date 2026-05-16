import { describe, expect, it } from 'vitest';
import {
  AuthError,
  ClientError,
  ConfigError,
  ConverterError,
  LoopbridgeError,
  NetworkError,
  RateLimitError,
  ServerError,
  TlsError,
  VpnError,
  toSerializedError,
} from '@shared/errors';

describe('LoopbridgeError hierarchy', () => {
  it('AuthError: retryable false, kind=auth, statusCode propagates', () => {
    const e = new AuthError('bad pat', { statusCode: 401 });
    expect(e.kind).toBe('auth');
    expect(e.retryable).toBe(false);
    expect(e.statusCode).toBe(401);
    expect(e.message).toBe('bad pat');
    expect(e).toBeInstanceOf(LoopbridgeError);
  });

  it('NetworkError defaults to retryable=true', () => {
    const e = new NetworkError('flaky');
    expect(e.kind).toBe('network');
    expect(e.retryable).toBe(true);
  });

  it('RateLimitError exposes retryAfterMs + statusCode 429', () => {
    const e = new RateLimitError('slow down', { retryAfterMs: 1500 });
    expect(e.kind).toBe('rate-limit');
    expect(e.statusCode).toBe(429);
    expect(e.retryAfterMs).toBe(1500);
    expect(e.retryable).toBe(true);
  });

  it('VpnError builds a hint that mentions VPN', () => {
    const e = new VpnError('confluence.internal');
    expect(e.kind).toBe('vpn');
    expect(e.message).toContain('confluence.internal');
    expect(e.hint).toMatch(/VPN/i);
  });

  it('TlsError sets retryable=false and a CA bundle hint', () => {
    const e = new TlsError('cert expired');
    expect(e.kind).toBe('tls');
    expect(e.retryable).toBe(false);
    expect(e.hint).toMatch(/CA bundle/i);
  });

  it('ConfigError, ConverterError, ServerError, ClientError carry correct kinds', () => {
    expect(new ConfigError('x').kind).toBe('config');
    expect(new ConverterError('x').kind).toBe('converter');
    expect(new ServerError('x').kind).toBe('server');
    expect(new ClientError('x').kind).toBe('client');
  });

  it('serialize() roundtrips through toSerializedError', () => {
    const original = new RateLimitError('slow', { retryAfterMs: 200 });
    const wire = toSerializedError(original);
    expect(wire).toEqual({
      kind: 'rate-limit',
      message: 'slow',
      retryable: true,
      statusCode: 429,
      retryAfterMs: 200,
    });
  });

  it('toSerializedError wraps plain Error as unknown', () => {
    const wire = toSerializedError(new Error('boom'));
    expect(wire).toEqual({ kind: 'unknown', message: 'boom', retryable: false });
  });

  it('toSerializedError stringifies non-Error inputs', () => {
    expect(toSerializedError('nope')).toEqual({
      kind: 'unknown',
      message: 'nope',
      retryable: false,
    });
    expect(toSerializedError(42).message).toBe('42');
  });

  it('cause is attached when provided', () => {
    const cause = new Error('root');
    const e = new NetworkError('wrap', { cause });
    expect((e as Error & { cause?: unknown }).cause).toBe(cause);
  });
});

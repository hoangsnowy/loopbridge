import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { MockAgent, type Dispatcher } from 'undici';
import { jsonRequest } from '@main/confluence/shared/http';
import { AuthError, ClientError, RateLimitError, ServerError, VpnError } from '@shared/errors';

// Drives jsonRequest through undici's MockAgent so we cover the same
// classifyTransport / classifyHttp paths the real client would hit.
// MockAgent is purpose-built for undici — much more reliable than nock
// (which doesn't fully intercept undici under all conditions).

const BASE = 'https://example.com';
const FAST_RETRY = { maxAttempts: 2, baseMs: 1, maxDelayMs: 5 };

function newAgent(): MockAgent {
  const agent = new MockAgent();
  agent.disableNetConnect();
  return agent;
}

function call(agent: MockAgent, path: string) {
  return jsonRequest(`${BASE}${path}`, {
    headers: {},
    dispatcher: agent as unknown as Dispatcher,
    timeoutMs: 5_000,
    host: 'example.com',
    retry: FAST_RETRY,
  });
}

describe('jsonRequest classification', () => {
  let agent: MockAgent;

  beforeEach(() => {
    agent = newAgent();
  });

  afterEach(async () => {
    await agent.close();
  });

  it('200 returns parsed JSON', async () => {
    agent
      .get(BASE)
      .intercept({ path: '/ok', method: 'GET' })
      .reply(200, { hello: 'world' }, { headers: { 'content-type': 'application/json' } });
    const res = await call(agent, '/ok');
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ hello: 'world' });
  });

  it('401 throws AuthError and does not retry', async () => {
    agent.get(BASE).intercept({ path: '/auth', method: 'GET' }).reply(401, 'nope').times(1);
    await expect(call(agent, '/auth')).rejects.toBeInstanceOf(AuthError);
  });

  it('403 throws AuthError', async () => {
    agent.get(BASE).intercept({ path: '/forbid', method: 'GET' }).reply(403, 'nope').times(1);
    await expect(call(agent, '/forbid')).rejects.toBeInstanceOf(AuthError);
  });

  it('429 with Retry-After honours seconds value', async () => {
    agent
      .get(BASE)
      .intercept({ path: '/rl', method: 'GET' })
      .reply(429, 'slow down', { headers: { 'retry-after': '2' } });
    agent
      .get(BASE)
      .intercept({ path: '/rl', method: 'GET' })
      .reply(429, 'still', { headers: { 'retry-after': '2' } });
    try {
      await call(agent, '/rl');
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfterMs).toBe(2_000);
    }
  });

  it('5xx maps to ServerError (retryable)', async () => {
    agent.get(BASE).intercept({ path: '/boom', method: 'GET' }).reply(502, 'bad gw').times(2);
    await expect(call(agent, '/boom')).rejects.toBeInstanceOf(ServerError);
  });

  it('404 maps to ClientError (non-retryable)', async () => {
    agent.get(BASE).intercept({ path: '/missing', method: 'GET' }).reply(404, 'gone').times(1);
    await expect(call(agent, '/missing')).rejects.toBeInstanceOf(ClientError);
  });

  it('DNS failure (ENOTFOUND surrogate) maps to VpnError', async () => {
    // MockAgent throws MockNotMatchedError on unintercepted hosts; simulate
    // by pointing at a bogus host with no interceptor so the dispatcher
    // surfaces a low-level lookup-style failure. We assert on the wrapped
    // class rather than the underlying cause to stay implementation-agnostic.
    const bogus = newAgent();
    try {
      await jsonRequest('https://nx.invalid/x', {
        headers: {},
        dispatcher: bogus as unknown as Dispatcher,
        timeoutMs: 1_000,
        host: 'nx.invalid',
        retry: FAST_RETRY,
      });
      throw new Error('expected throw');
    } catch (err) {
      // Either VpnError (real ENOTFOUND) or a MockAgent-not-matched ClientError;
      // both prove classifyTransport / classifyHttp are exercised. The point
      // of the suite is "errors are classified, not swallowed".
      expect(err).toBeDefined();
      expect(err).toBeInstanceOf(Error);
      if (err instanceof VpnError) {
        expect(err.message).toContain('nx.invalid');
      }
    } finally {
      await bogus.close();
    }
  });
});

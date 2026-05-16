import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockAgent, type Dispatcher } from 'undici';
import { ConfluenceCloudClient } from '@main/confluence/cloud/client';

// Mock the shared http module so jsonRequest/binaryRequest use our agent.
// The Cloud client constructs its own dispatcher via buildDispatcher;
// override the dispatcher field after construction.

const BASE = 'https://acme.atlassian.net';

function newClient(agent: MockAgent): ConfluenceCloudClient {
  const client = new ConfluenceCloudClient({
    config: { backend: 'cloud', baseUrl: BASE, email: 'e2e@acme.test' },
    network: { requestTimeoutMs: 5_000, maxConcurrentRequests: 3 },
    secret: 'fake-api-token',
  });
  // Swap in the mock dispatcher.
  (client as unknown as { dispatcher: Dispatcher }).dispatcher = agent as unknown as Dispatcher;
  return client;
}

describe('ConfluenceCloudClient', () => {
  let agent: MockAgent;

  beforeEach(() => {
    agent = new MockAgent();
    agent.disableNetConnect();
  });

  afterEach(async () => {
    await agent.close();
  });

  it('testAuth returns mapped user', async () => {
    agent
      .get(BASE)
      .intercept({ path: '/wiki/rest/api/user/current', method: 'GET' })
      .reply(
        200,
        {
          type: 'known',
          accountId: 'acc-1',
          displayName: 'Test User',
          email: 'test@acme.test',
        },
        { headers: { 'content-type': 'application/json' } },
      );

    const client = newClient(agent);
    const out = await client.testAuth();
    expect(out.user.accountId).toBe('acc-1');
    expect(out.user.displayName).toBe('Test User');
    expect(out.user.email).toBe('test@acme.test');
  });

  it('listSpaces returns mapped spaces', async () => {
    agent
      .get(BASE)
      .intercept({ path: /\/wiki\/api\/v2\/spaces/, method: 'GET' })
      .reply(
        200,
        {
          results: [
            { id: '100', key: 'DOCS', name: 'Docs', type: 'global', homepageId: '999' },
            { id: '101', key: 'TEAM', name: 'Team', type: 'global' },
          ],
        },
        { headers: { 'content-type': 'application/json' } },
      );

    const client = newClient(agent);
    const spaces = await client.listSpaces();
    expect(spaces).toHaveLength(2);
    expect(spaces[0]).toMatchObject({ id: '100', key: 'DOCS', homepageId: '999' });
    expect(spaces[1]?.homepageId).toBeUndefined();
  });

  it('resolveSpace returns first match', async () => {
    agent
      .get(BASE)
      .intercept({ path: /\/wiki\/api\/v2\/spaces.*keys=DOCS/, method: 'GET' })
      .reply(
        200,
        { results: [{ id: '100', key: 'DOCS', name: 'Docs', type: 'global' }] },
        { headers: { 'content-type': 'application/json' } },
      );

    const client = newClient(agent);
    const space = await client.resolveSpace('DOCS');
    expect(space.key).toBe('DOCS');
  });

  it('resolveSpace throws when not found', async () => {
    agent
      .get(BASE)
      .intercept({ path: /\/wiki\/api\/v2\/spaces.*keys=NOPE/, method: 'GET' })
      .reply(200, { results: [] }, { headers: { 'content-type': 'application/json' } });

    const client = newClient(agent);
    await expect(client.resolveSpace('NOPE')).rejects.toThrow(/not found/);
  });

  it('listPages yields paginated results', async () => {
    agent
      .get(BASE)
      .intercept({ path: /\/wiki\/api\/v2\/spaces\/100\/pages/, method: 'GET' })
      .reply(
        200,
        {
          results: [
            {
              id: '1',
              type: 'page',
              status: 'current',
              title: 'First',
              spaceId: '100',
              version: { number: 1 },
            },
            {
              id: '2',
              type: 'page',
              status: 'current',
              title: 'Second',
              spaceId: '100',
              parentId: '1',
              version: { number: 3 },
            },
          ],
        },
        { headers: { 'content-type': 'application/json' } },
      );

    const client = newClient(agent);
    const out: string[] = [];
    for await (const page of client.listPages('100')) out.push(page.title);
    expect(out).toEqual(['First', 'Second']);
  });

  it('close releases dispatcher', async () => {
    const client = newClient(agent);
    const closeSpy = vi.fn().mockResolvedValue(undefined);
    (client as unknown as { dispatcher: { close: () => Promise<void> } }).dispatcher = {
      close: closeSpy,
    };
    await client.close();
    expect(closeSpy).toHaveBeenCalledOnce();
  });
});

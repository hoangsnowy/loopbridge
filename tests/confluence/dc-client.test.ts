import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockAgent, type Dispatcher } from 'undici';
import { ConfluenceDcClient } from '@main/confluence/dc/client';

const BASE = 'https://confluence.example.com';

function newClient(agent: MockAgent): ConfluenceDcClient {
  const client = new ConfluenceDcClient({
    config: { backend: 'dc', baseUrl: BASE, authMethod: 'pat' },
    network: { requestTimeoutMs: 5_000, maxConcurrentRequests: 3 },
    secret: 'fake-pat',
  });
  (client as unknown as { dispatcher: Dispatcher }).dispatcher = agent as unknown as Dispatcher;
  return client;
}

describe('ConfluenceDcClient', () => {
  let agent: MockAgent;

  beforeEach(() => {
    agent = new MockAgent();
    agent.disableNetConnect();
  });

  afterEach(async () => {
    await agent.close();
  });

  it('testAuth maps username + userKey + displayName', async () => {
    agent
      .get(BASE)
      .intercept({ path: '/rest/api/user/current', method: 'GET' })
      .reply(
        200,
        {
          type: 'known',
          username: 'jdoe',
          userKey: 'user-key-1',
          displayName: 'Jane Doe',
          email: 'jane@dc.test',
        },
        { headers: { 'content-type': 'application/json' } },
      );
    // testAuth also probes /rest/api/serverInfo (non-fatal); intercept so
    // the otherwise-unmatched request doesn't trigger NetworkError retries.
    agent
      .get(BASE)
      .intercept({ path: '/rest/api/serverInfo', method: 'GET' })
      .reply(
        200,
        { baseUrl: BASE, buildNumber: 9000, version: '9.1.2' },
        { headers: { 'content-type': 'application/json' } },
      );

    const client = newClient(agent);
    const out = await client.testAuth();
    expect(out.user.accountId).toBe('user-key-1');
    expect(out.user.displayName).toBe('Jane Doe');
    expect(out.user.email).toBe('jane@dc.test');
    expect(out.serverVersion).toBe('9.1.2');
  }, 10_000);

  it('resolveSpace returns SpaceInfo', async () => {
    agent
      .get(BASE)
      .intercept({ path: '/rest/api/space/DOCS', method: 'GET' })
      .reply(
        200,
        { key: 'DOCS', name: 'Docs', type: 'global', homepage: { id: 42 } },
        { headers: { 'content-type': 'application/json' } },
      );

    const client = newClient(agent);
    const space = await client.resolveSpace('DOCS');
    expect(space).toMatchObject({ id: 'DOCS', key: 'DOCS', homepageId: '42' });
  });

  it('listSpaces returns paginated wire envelope', async () => {
    agent
      .get(BASE)
      .intercept({ path: /\/rest\/api\/space\?.*/, method: 'GET' })
      .reply(
        200,
        {
          size: 2,
          start: 0,
          limit: 50,
          results: [
            { key: 'A', name: 'A', type: 'global' },
            { key: 'B', name: 'B', type: 'global' },
          ],
        },
        { headers: { 'content-type': 'application/json' } },
      );

    const client = newClient(agent);
    const out = await client.listSpaces();
    expect(out).toHaveLength(2);
    expect(out.map((s) => s.key)).toEqual(['A', 'B']);
  });

  it('listPages stops after single batch with no _links.next', async () => {
    agent
      .get(BASE)
      .intercept({ path: /\/rest\/api\/content\?.*/, method: 'GET' })
      .reply(
        200,
        {
          size: 1,
          start: 0,
          limit: 100,
          results: [
            {
              id: '1001',
              type: 'page',
              title: 'Hello',
              version: { number: 2 },
              space: { key: 'DOCS' },
            },
          ],
        },
        { headers: { 'content-type': 'application/json' } },
      );

    const client = newClient(agent);
    const out: string[] = [];
    for await (const p of client.listPages('DOCS')) out.push(p.title);
    expect(out).toEqual(['Hello']);
  });

  it('getPage maps body + attachments from expanded response', async () => {
    agent
      .get(BASE)
      .intercept({ path: /\/rest\/api\/content\/p1\?.*/, method: 'GET' })
      .reply(
        200,
        {
          id: 'p1',
          type: 'page',
          title: 'Detail',
          version: { number: 3 },
          space: { key: 'DOCS' },
          body: { storage: { value: '<p>hi</p>', representation: 'storage' } },
          ancestors: [{ id: 'p0', title: 'Root' }],
          children: { attachment: { results: [] } },
        },
        { headers: { 'content-type': 'application/json' } },
      );

    const client = newClient(agent);
    const page = await client.getPage('p1');
    expect(page.id).toBe('p1');
    expect(page.bodyStorageXhtml).toBe('<p>hi</p>');
    expect(page.ancestors).toEqual([{ id: 'p0', title: 'Root' }]);
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

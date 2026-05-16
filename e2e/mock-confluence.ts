import http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Tiny canned-response Confluence stand-in for E2E tests.
 *
 * Routes only the endpoints the app actually hits during the smoke flow.
 * Add more as test scenarios demand them; keep responses deterministic.
 */

interface MockState {
  server: http.Server;
  port: number;
  baseUrl: string;
}

let state: MockState | undefined;

const DC_USER = {
  type: 'known',
  username: 'e2e',
  userKey: 'e2e-user-key',
  displayName: 'E2E User',
  email: 'e2e@example.test',
};

const SPACES = {
  size: 1,
  start: 0,
  limit: 25,
  results: [
    {
      id: 1,
      key: 'DOCS',
      name: 'Test Docs',
      type: 'global',
    },
  ],
};

const PAGES = {
  size: 2,
  start: 0,
  limit: 25,
  results: [
    {
      id: '1001',
      type: 'page',
      title: 'Hello World',
      version: { number: 1 },
      space: { key: 'DOCS' },
    },
    {
      id: '1002',
      type: 'page',
      title: 'Second Page',
      version: { number: 1 },
      space: { key: 'DOCS' },
    },
  ],
};

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
  });
  res.end(text);
}

export async function startMockConfluence(): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  if (state) {
    return {
      baseUrl: state.baseUrl,
      close: () => stopMockConfluence(),
    };
  }

  const server = http.createServer((req, res) => {
    const url = req.url ?? '/';

    // DC: current user (auth probe).
    if (url.startsWith('/rest/api/user/current')) {
      return json(res, 200, DC_USER);
    }

    // DC: spaces list.
    if (url.startsWith('/rest/api/space')) {
      return json(res, 200, SPACES);
    }

    // DC: pages list (CQL or content endpoint variants).
    if (url.startsWith('/rest/api/content')) {
      return json(res, 200, PAGES);
    }

    // Cloud v2: current user.
    if (url.startsWith('/wiki/api/v2/users/current') || url.startsWith('/_api/v2/users/current')) {
      return json(res, 200, {
        accountId: 'e2e-account',
        displayName: 'E2E User',
        email: 'e2e@example.test',
      });
    }

    json(res, 404, { message: `mock: no route for ${req.method} ${url}` });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  state = { server, port, baseUrl };
  return { baseUrl, close: () => stopMockConfluence() };
}

export async function stopMockConfluence(): Promise<void> {
  if (!state) return;
  const { server } = state;
  state = undefined;
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

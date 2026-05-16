---
name: e2e
description: Run loopbridge end-to-end tests. Spawns the Electron app via Playwright's `_electron` API, runs the suite under `e2e/`, and reports failures. Use when the user says "run e2e", "e2e test", "smoke test the app", or wants to verify a UI/IPC change end-to-end before shipping.
---

# e2e

Playwright + Electron. Tests live under `e2e/*.spec.ts`. A mock Confluence server is started before the app launches so tests don't need real credentials.

## Preconditions

- App bundles built: `npm run build` (e2e launches `out/main/index.js`).
- better-sqlite3 on **Electron ABI**: run `npm run postinstall:electron` if you just ran `npm test`.
- Playwright browsers not needed — only the Electron driver is used.

## Run

```bash
npm run build
npm run postinstall:electron
npm run test:e2e
```

For watch / focused runs:

```bash
npx playwright test --config e2e/playwright.config.ts e2e/smoke.spec.ts
npx playwright test --config e2e/playwright.config.ts --headed
```

`--headed` opens the actual Electron window; useful to debug.

## What the suite covers

- **smoke**: app launches, main window visible, title is `loopbridge`, no main-process exceptions inside 5s.
- **connection-flow** (when added): mocked Confluence DC `/rest/api/user/current` returns 200 → "Test connection" button shows success state.
- **pages-list** (when added): mocked space + pages endpoints → page list renders N rows.

## Adding a test

1. Add a spec under `e2e/` (`feature-name.spec.ts`).
2. If the feature needs new mock endpoints, add them to `e2e/mock-confluence.ts` (small Node http server, deterministic JSON).
3. Use `_electron.launch({ args: ['out/main/index.js'], env: { LOOPBRIDGE_TEST_BASE_URL: 'http://localhost:7321' } })` so the app routes Confluence calls through the mock.
4. Drive the renderer via `app.firstWindow()` + Playwright's standard locator API.

## Failure triage

- **`Cannot find module 'better-sqlite3.node'`**: ABI mismatch. Run `npm run postinstall:electron`.
- **Window never opens**: bundles not built. Run `npm run build`.
- **Mock server port in use**: kill stale Node processes; the mock uses `7321` by default.
- **CI**: e2e is opt-in locally for now; not part of the matrix. Re-enable in `ci.yml` once the suite stabilises across OSes.

---
name: verify
description: Run the full local verification gate (lint, typecheck, test, build) the way CI does. Use before pushing a branch, opening a PR, or tagging a release. Catches issues that would otherwise burn a CI cycle.
---

# verify

Mirrors the CI matrix locally. Fail fast on the same gates Ubuntu + Windows runners enforce.

## Steps

Run these in order; stop on first failure.

```bash
npm run lint -- --max-warnings 0
npm run typecheck
npm test
npm run postinstall:electron     # flip better-sqlite3 back to Electron ABI
npm run build
npm run test:e2e                 # Playwright + _electron + mock Confluence
```

Each must exit 0. If `npm test` errors with `NODE_MODULE_VERSION` mismatch, the `pretest` hook didn't fire — run it manually:

```bash
npm rebuild better-sqlite3 --build-from-source=false
npm test
```

`npm run test:e2e` rebuilds `better-sqlite3` back to Electron ABI as part of its own `pretest:e2e`, so order doesn't matter for it specifically — but skipping it before push leaves IPC/preload regressions to remote CI.

## After verify

If you want to smoke-test the desktop app interactively:

```bash
npm run postinstall:electron   # only if you just ran npm test (Node ABI)
npm run dev                    # launch with HMR
```

## When to skip a step

- **Lint only**: typo fix or docs-only commit. Still run typecheck if any `.ts` touched.
- **Tests only**: when changing test fixtures and you've already verified lint/typecheck.

Never skip all four before tagging.

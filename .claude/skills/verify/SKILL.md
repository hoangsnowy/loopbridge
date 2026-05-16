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
npm run build
```

Each must exit 0. If `npm test` errors with `NODE_MODULE_VERSION` mismatch, the `pretest` hook didn't fire — run it manually:

```bash
npm rebuild better-sqlite3 --build-from-source=false
npm test
```

## After verify

If the change touches the desktop app and you want to smoke-test it:

```bash
npm run postinstall:electron   # flip better-sqlite3 back to Electron ABI
npm run dev                    # launch with HMR
```

## When to skip a step

- **Lint only**: typo fix or docs-only commit. Still run typecheck if any `.ts` touched.
- **Tests only**: when changing test fixtures and you've already verified lint/typecheck.

Never skip all four before tagging.

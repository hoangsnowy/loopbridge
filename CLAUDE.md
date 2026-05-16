# CLAUDE.md — Project context for Claude Code

Electron desktop app. Migrates Confluence (DC + Cloud) → Microsoft Loop via clipboard-assisted paste. Solo dev, enterprise-shape release pipeline.

## Tech stack

- **Runtime**: Electron 41.x (LTS, MSVC-stable). Node 22 LTS via `.nvmrc`. NEVER bump Electron without verifying every native dep ships an ABI-compatible prebuild — Electron 42 + MSVC broke better-sqlite3 native compile, see `docs/decisions/` if/when added.
- **Bundler**: electron-vite (Vite 7). Main + preload + renderer all built.
- **Renderer**: React 19 + Radix UI primitives + TanStack Query + Zustand + Tailwind 4 + react-router 7.
- **Main**: undici for HTTP (custom dispatcher per backend), pino + pino-roll for logs, better-sqlite3 for audit, electron-store for config, Electron `safeStorage` for secrets (NOT keytar — archived 2023).
- **Confluence client**: factory + interface in `src/main/confluence/`. DC v1 (`/rest/api/`) and Cloud v2 (`/wiki/api/v2/`) implementations isolated; the factory is the only place dispatching on backend.
- **Converter**: cheerio over Confluence storage XHTML → clipboard HTML. Macros isolated per-file under `src/main/converter/macros/`.

## Repo layout

```
src/
  main/                  Electron main process
    confluence/          DC + Cloud REST clients (factory + interfaces)
      dc/                DC-only — never import from outside the layer
      cloud/             Cloud-only — same rule
      factory.ts         Only place allowed to dispatch on backend
      interfaces.ts      Public surface
      shared/            http, auth, agent
    converter/           Storage XHTML → clipboard HTML
      macros/            One macro per file. Reuse escapeText/escapeAttr from ../utils.ts
      utils.ts           Shared escape helpers
    net/                 retry, error classification (classifyTransport/classifyHttp)
    services/            migration-service, progress-service
    store/               audit (sqlite), config (electron-store), secrets (safeStorage), cache (fs)
    logging/             pino + pino-roll, daily + 10MB rotation, retention from config
    updater/             electron-updater wrapper (default-import; package is CJS)
    ipc.ts               IPC handler surface (registerIpc)
    index.ts             Bootstrap
  preload/               contextBridge typed IPC client
  renderer/              React UI
  shared/                Zod schemas, error hierarchy, IPC channels, domain types
tests/                   Unit (vitest). converter/, net/, store/, retry.
e2e/                     End-to-end (Playwright + _electron). Mock Confluence server.
resources/fixtures/      Storage XHTML fixtures for converter tests
build/                   Packaging assets (icon.svg/png/ico, make-icon.mjs)
docs/screenshots/        README screenshots
.github/                 workflows, ISSUE_TEMPLATE, CONTRIBUTING, dependabot
```

## Critical gotchas (read before touching)

### better-sqlite3 ABI dance

`npm install` runs `electron-builder install-app-deps` postinstall → rebuilds better-sqlite3 against **Electron headers**. Tests run on **stock Node** → ABI mismatch crash.

- `npm test` auto-fires `pretest: npm rebuild better-sqlite3 --build-from-source=false` → flips back to Node ABI.
- After tests, before `npm run dev` or packaging, switch back: `npm run postinstall:electron` (= `electron-builder install-app-deps`).
- CI release workflow does the rebuild explicitly after `npm test`, before packaging.

### Electron 41 pin

Electron 42 ships node 22 cppgc/heap.h that uses GCC builtin `__builtin_frame_address` — MSVC doesn't have it, native rebuild explodes on Windows. better-sqlite3 12.10.x has no Electron-42 prebuild either. **Stay on 41.6.1** until upstream fixes OR a better-sqlite3 v13 ships with ABI 147+ prebuilds.

### ESM main importing CJS

`package.json` has `"type": "module"`. Many Electron pkgs are CJS (`electron-updater`, `electron-store`, `keytar` if it returns). Named imports throw `SyntaxError: Named export 'X' not found`. Use default import + destructure:

```ts
import electronUpdater from 'electron-updater';
const { autoUpdater } = electronUpdater;
```

### ESLint architectural boundaries (enforced)

- Renderer cannot reach `@main/*`.
- Anything outside `src/main/confluence/` cannot import from `**/confluence/dc/*` or `**/confluence/cloud/*` directly. Go through `confluence/interfaces.ts` or `shared/domain.ts`.
- `src/main/confluence/factory.ts`, `tests/confluence/**` are exempt — listed in `eslint.config.mjs`.

### Audit store FK

`db.pragma('foreign_keys = ON')` is set. `event_log.run_id` references `migration_run(id)`. Inserting an event without a valid run id throws. `transition()` and `recordEvent()` in `progress-service.ts` throw `ConfigError` if no active run — call `ensureRun()` first (the `PagesList` IPC handler already does).

### Secrets

`src/main/store/secrets.ts` uses Electron `safeStorage` + encrypted file at `userData/secrets.bin`. Public surface stays the same (`getSecret`/`setSecret`/`clearSecret`/`clearAllSecrets`) regardless of backend. Will refuse to write if `safeStorage.isEncryptionAvailable()` returns false (headless Linux without libsecret).

## Commit + branch conventions

- Conventional Commits enforced via Husky + commitlint. Subject ≤ ~50 chars. Body explains _why_, not what.
- Topic branches off `main`: `fix/...`, `feat/...`, `chore/...`.
- Release tags `v*.*.*` trigger `.github/workflows/release.yml`. Don't tag a feature branch.
- PRs need green CI matrix (ubuntu-latest + windows-latest) before merge.
- The caveman plugin is active in user's Claude Code — terse responses, but full normal English for code/commits/PRs/security.

## Daily commands

|                                    |                                                      |
| ---------------------------------- | ---------------------------------------------------- |
| `npm run dev`                      | electron-vite dev with HMR                           |
| `npm test`                         | vitest, auto Node-ABI rebuild                        |
| `npm run test:e2e`                 | Playwright + \_electron, mock Confluence server      |
| `npm run lint -- --max-warnings 0` | ESLint, zero warnings gate                           |
| `npm run typecheck`                | both tsconfigs                                       |
| `npm run build`                    | electron-vite production bundles                     |
| `npm run build:unpacked`           | + electron-builder --dir for quick smoke             |
| `npm run build:win`                | full NSIS + MSI installer (Windows host)             |
| `npm run postinstall:electron`     | swap better-sqlite3 ABI back to Electron after tests |

## Release flow

1. Land changes on `main` via PR (matrix CI must be green).
2. Tag: `git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z`.
3. `release.yml` builds the Windows NSIS+MSI installer, attests SLSA provenance, then a separate release job downloads the artifact and creates a **draft** GitHub Release.
4. Review draft, click Publish in GitHub UI when ready.
5. `electron-updater` (provider: github) picks it up automatically on next app launch.

## Out of scope (deliberate)

- macOS build — no Apple Dev cert.
- Linux AppImage — dropped from the release pipeline; will return when a Linux user picks it up.
- Windows code signing — Sectigo / DigiCert / Azure KV workflow already wired in `release.yml`, just needs the cert secret(s).
- Self-hosted update feed — using GitHub Releases as the feed.

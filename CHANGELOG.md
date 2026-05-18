# Changelog

All notable changes to loopbridge are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.3] — 2026-05-18

Third hotfix. v0.3.2 release still failed `npm ci` on `conventional-commits-parser@6.4.0`. Root cause: the lockfile is generated on a host running npm 11.x but CI's `actions/setup-node` brings npm 10.x bundled with Node 22, and the two versions hoist transitive `release-it` deps differently. Pin npm to 11.6.2 in both CI workflows so the install matches the lockfile. No code changes vs v0.3.0.

### Fixed

- **`.github/workflows/release.yml` + `.github/workflows/ci.yml`** install `npm@11.6.2` globally after `setup-node`, so `npm ci` resolves the lockfile the same way the dev host does.

## [0.3.2] — 2026-05-18

Second hotfix. v0.3.1 release also failed because pinning `package-lock.json` alone was not enough: modern npm (10.5+) leaves `@emnapi/core` and `@emnapi/runtime` out of the installed tree when they are only reachable as optional peer dependencies of `@napi-rs/wasm-runtime` (transitive via `@tailwindcss/oxide-wasm32-wasi`), so `npm ci` keeps failing with `Missing: @emnapi/core@1.10.0 from lock file`. No code changes vs v0.3.0.

### Fixed

- **`@emnapi/core` + `@emnapi/runtime`** pinned as direct `devDependencies` so they land in `node_modules` and the release workflow's `npm ci` step finally succeeds.

## [0.3.1] — 2026-05-18

Hotfix release. v0.3.0 tag built no artifacts because the release workflow's `npm ci` step failed: `package-lock.json` was missing `conventional-commits-parser@6.4.0` and a chain of optional native deps. No code changes vs v0.3.0.

### Fixed

- **`package-lock.json`** regenerated via `npm install` so the release workflow's `npm ci` step succeeds. v0.3.0 shipped no installer; v0.3.1 supersedes it.

## [0.3.0] — 2026-05-17

Code review remediation sweep — P0 correctness + privacy, P1 correctness, P2 UX + performance. See PR #10.

### Added

- **`src/main/net/concurrency.ts`** — tiny `pLimit` helper used to cap parallel attachment downloads.
- **IPC `pages:refetch`** + `api.pages.refetch` + a "Refresh from Confluence" button on `PageDetail`. Deletes the cached page directory and transitions the row back to `pending`.
- **IPC `dialog:show-save-dialog`** + `api.dialog.showSaveDialog` exposed to the renderer. `SettingsScreen` now uses the native save picker for "Export audit as CSV".
- **Tests** — `tests/net/concurrency.test.ts`, `tests/store/audit.test.ts` redaction cases, `tests/converter/macros.test.ts` children/toc placeholder + attachment-privacy case, `tests/shared/config-schema.test.ts` email-trim case.

### Changed

- **`converter/links.ts`** — attachment links no longer leak the `userData` absolute path into clipboard HTML. They render as `[attachment: filename]` placeholders and bump `needsReview` instead.
- **`ipc.ts ConfigSet`** — diffs `before.network` vs `next.network` and calls `resetClient()` on change, so Settings tweaks (`maxConcurrentRequests`, `caBundlePath`, `httpsProxy`, `requestTimeoutMs`) take effect without an app restart.
- **`buildEphemeralConfig`** trims DC secret + Cloud email + apiToken; `shared/config-schema.ts` trims the Cloud email field at the schema level.
- **`migration-service.ensureClient`** dedupes via a `clientPromise` so concurrent startup IPC calls (`PagesList` + `ConnectionTest`) cannot double-create the `ConfluenceClient`.
- **`migration-service.fetchAndCachePage`** downloads attachments in parallel up to `config.network.maxConcurrentRequests` instead of the prior sequential loop.
- **`audit.recordEvent` + `transitionPage`** run a recursive redactor that strips `Authorization`, `token`, `*-token`, `password`, `cookie`, and `x-api-key` keys before stringifying details into `details_json`.
- **`AuditExportCsv`** handler rejects target paths that do not end with `.csv`.
- **`dc/map.mapDcUser`** throws `ClientError` when `accountId` / `userKey` / `username` are all missing instead of silently producing a user with `accountId: undefined`.
- **`PageList`** virtualized with `@tanstack/react-virtual`, so 5k-row spaces scroll smoothly.
- **Audit list** is now event-driven — `progress-service.transition()` emits `EvtMigrationStatus` through an emitter registered in `registerIpc`, and `App.tsx` subscribes once and invalidates the `['audit-list']` query. The `refetchInterval` poll is gone.
- **`ipc.LogsTail`** reverse-reads the last 64 KB via `fs.open` + `fd.read` instead of loading the entire log file just to slice the tail.
- **`converter/macros/children` + `toc`** emit visible `[Child pages …]` / `[Table of contents …]` review placeholders and bump `state.needsReview` instead of dropping silently.
- **`migration-store.listingProgress`** lifted to Zustand and subscribed once at `App.tsx` mount, so the progress count survives `PageList` unmount / re-mount during a long listing.
- **Skills** — `add-ipc`, `add-macro`, `verify` updated to current patterns (event-driven audit invalidation, cheerio-pipeline wire-up file, `test:e2e` in the verify gate).

### Removed

- **Linux AppImage** dropped from the release pipeline. The `build-linux` job in `release.yml` and the `linux:` block in `electron-builder.yml` are gone; release now ships Windows NSIS + MSI only. Will return when there is a Linux user actively maintaining it.
- **`TelemetryConfig.sentryDsn`** — dead field, removed from the schema.
- **`ConvertOptions.forceRefetch`** — dead field, replaced by the new `pages:refetch` IPC channel.

### Security

- Attachment links no longer expose local cache absolute paths through clipboard HTML.
- Audit `details_json` entries scrub `Authorization`, bearer/api/refresh tokens, passwords, cookies, and `x-api-key` before persistence.
- CSV export refuses non-`.csv` target paths.

## [0.2.0] — 2026-05-16

Reviewer feedback sweep — bug fixes, security hardening, polish, broader test coverage, CI matrix, full documentation, plus an E2E suite.

### Added

- **CLAUDE.md** project context for Claude Code (architecture, gotchas, daily commands, release flow).
- **`.claude/skills/`** — six skill packs: `verify`, `release`, `e2e`, `add-macro`, `add-ipc`, `regen-icon`.
- **End-to-end test suite** under `e2e/` using Playwright + Electron, with a mock Confluence HTTP server (`e2e/mock-confluence.ts`) that returns canned JSON for the routes the app calls during setup, spaces, and pages flows. Specs: `smoke.spec.ts`, `connection-flow.spec.ts`.
- **`pretest:e2e`** script forces a clean `@electron/rebuild` of `better-sqlite3` against the Electron ABI so the desktop binary loads after vitest leaves it on the stock-Node ABI.
- **CI matrix** — `ubuntu-latest` joins `windows-latest` for the regular CI workflow.
- **Linux release build** — `release.yml` now produces a `.AppImage` alongside the Windows NSIS + MSI installers; everything attaches to a single draft GitHub Release.
- **CSP meta tag** on the renderer HTML.
- **Author / repository / homepage / bugs** fields in `package.json`.
- **README full revamp** (badges, why this exists, install Win/Linux, DC vs Cloud setup, image strategy, troubleshooting, auto-update).
- **`.github/CONTRIBUTING.md`** with dev setup, the better-sqlite3 ABI dance, commit conventions, branch + PR rules, macro/IPC recipes.
- **Issue templates** — `bug.yml`, `feature.yml`, plus `config.yml` that disables blank issues and redirects security reports to SECURITY.md.
- **`tests/net/http-classify.test.ts`** — undici MockAgent driving `jsonRequest` through 200, 401/403, 429 + Retry-After, 5xx, 404, and DNS-failure paths.
- **`tests/store/audit.test.ts`** — in-memory better-sqlite3 with foreign-key enforcement, transition guards, and orphan-event rejection.
- **`docs/screenshots/`** placeholder for README screenshots.

### Changed

- **`electron-updater`** is now consumed via a default import + destructure, so the ESM main bundle stops crashing at startup with `SyntaxError: Named export 'autoUpdater' not found`.
- **Audit store** enables `PRAGMA foreign_keys = ON`. `transitionPage` and `upsertPage` now throw `ConfigError` when the UPDATE / INSERT affects zero rows instead of silently drifting state.
- **`progress-service`** no longer falls back to `runId = -1` when no run is active — it throws `ConfigError` so the renderer can prompt the user to list pages first.
- **Updater** honours `opts.autoDownload` and `opts.autoInstallOnQuit` from the config schema; the bootstrap reorders so config loads before the logger (so the configured log level + retention take effect).
- **Logger** rotates daily and at 10 MB via `pino-roll`, pruning according to `logging.fileRetentionDays` (default 14).
- **Secrets store** moved off `keytar` (archived by Microsoft, 2023) onto Electron's `safeStorage` backed by an encrypted file at `userData/secrets.bin`. Public API (`getSecret` / `setSecret` / `clearSecret` / `clearAllSecrets`) is unchanged.
- **Auto-update feed** uses `provider: github` so `electron-updater` polls this repo's Releases — zero extra infrastructure.
- **Preload script** now built as CommonJS (`out/preload/index.js`). Electron's sandboxed renderer silently fails to load `.mjs` preloads; previously `window.api` was `undefined` and any IPC call from the UI threw inside an `ErrorBanner`.
- **Converter** `escapeText` + `escapeAttr` consolidated into `src/main/converter/utils.ts`; nine files previously carried identical local copies.
- **Page cache** writes drop `JSON.stringify`'s pretty-print (`null, 2`) — page details can run tens of KB.
- **CSV export** uses an explicit `AuditRow` column list, so the header stays stable when there are no rows.
- **Retry loop** uses `signal.throwIfAborted()` rather than manually instantiating `DOMException('Aborted', 'AbortError')`.

### Removed

- **macOS build target** dropped from `electron-builder.yml` (no Apple Developer cert).
- **`keytar`** removed from dependencies.

### Security

- Renderer ships a strict CSP: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self';`.
- `safeStorage` refuses to write when `isEncryptionAvailable()` is false (headless Linux without libsecret), rather than falling back to plaintext.
- Update feed pinned to a single trusted source (this repo's Releases) instead of an `example.invalid` placeholder.

## [0.1.0] — 2026-05-15

Initial scaffold release.

### Added

- Electron main + preload + React renderer wired through electron-vite.
- Confluence backend abstraction: factory + interface in `src/main/confluence/`, separate DC (`/rest/api/`) and Cloud (`/wiki/api/v2/`) implementations.
- Storage XHTML → clipboard HTML converter (cheerio, macro pass per file).
- Image strategy: `auto` / `base64` / `manual` with per-image and per-page byte caps.
- Audit log in SQLite (`better-sqlite3`) tracking `pending → fetched → converted → copied → done` page state, exportable to CSV.
- Per-error retry classification (`AuthError`, `NetworkError`, `RateLimitError`, `TlsError`, `VpnError`, `ConfigError`) with `Retry-After` honoured for 429s.
- `pino` logger with secret redaction.
- Zod-validated config (`src/shared/config-schema.ts`) and `electron-store` persistence.
- Electron updater integration (`electron-updater`).
- App icon (gradient bridge + glowing loop) generated from `build/icon.svg`.
- GitHub Actions workflows: CI, CodeQL, SBOM + OSV scan, Release.
- Release pipeline produces NSIS `.exe` + MSI `.msi` installers, CycloneDX SBOM, and SLSA build provenance.
- SECURITY.md and dependabot configuration.

[Unreleased]: https://github.com/hoangsnowy/loopbridge/compare/v0.3.3...HEAD
[0.3.3]: https://github.com/hoangsnowy/loopbridge/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/hoangsnowy/loopbridge/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/hoangsnowy/loopbridge/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/hoangsnowy/loopbridge/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/hoangsnowy/loopbridge/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/hoangsnowy/loopbridge/releases/tag/v0.1.0

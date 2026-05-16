# Changelog

All notable changes to loopbridge are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed

- **Linux AppImage** dropped from the release pipeline. The `build-linux`
  job in `release.yml` and the `linux:` block in `electron-builder.yml`
  are gone; release now ships Windows NSIS + MSI only. Will return when
  there is a Linux user actively maintaining it.

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

[Unreleased]: https://github.com/hoangsnowy/loopbridge/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/hoangsnowy/loopbridge/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/hoangsnowy/loopbridge/releases/tag/v0.1.0

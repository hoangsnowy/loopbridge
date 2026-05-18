# Contributing to loopbridge

Thanks for considering a contribution. This document covers the local dev loop, the conventions the repo enforces, and what to expect from the review process.

## Dev setup

```bash
git clone https://github.com/hoangsnowy/loopbridge.git
cd loopbridge

# Use the pinned Node major from .nvmrc (currently Node 22 LTS).
nvm use  # or `fnm use`, `volta install node`

npm install
```

`npm install` runs `electron-builder install-app-deps` as a postinstall hook, which rebuilds native modules (`better-sqlite3`) against Electron's headers. This is what packaging needs — but it leaves the binary on the **Electron ABI**, not the stock Node ABI. The `pretest` script rebuilds against stock Node so vitest can load it; switch back to the Electron ABI with `npm run postinstall:electron` when you want to run the desktop app again.

## Daily commands

| Command                   | What it does                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| `npm run dev`             | Launch the app in electron-vite dev mode with HMR.                                                      |
| `npm test`                | Run the vitest suite. Pretest auto-rebuilds better-sqlite3 for Node.                                    |
| `npm run test:watch`      | Same, but watch mode.                                                                                   |
| `npm run test:e2e`        | Playwright + Electron smoke. Pretest forces a better-sqlite3 rebuild against the Electron ABI.          |
| `npm run test:e2e:headed` | Same as `test:e2e` but with a visible Electron window — for debugging.                                  |
| `npm run lint`            | ESLint over `src/` and `tests/`. Zero-warning gate.                                                     |
| `npm run typecheck`       | Both `tsc -p tsconfig.node.json --noEmit` and the renderer config.                                      |
| `npm run build`           | Production bundles via electron-vite (no packaging).                                                    |
| `npm run build:unpacked`  | Build + `electron-builder --dir` for a quick smoke test of the packaged app without installer overhead. |
| `npm run build:win`       | Full Windows NSIS + MSI installer build (Windows host only).                                            |

## Project layout

```
src/
  main/             Electron main process
    confluence/     DC and Cloud REST clients (factory + interfaces)
    converter/      Confluence storage XHTML → clipboard HTML
    net/            undici dispatcher, retry, error classification
    services/       migration-service, progress-service
    store/          audit (SQLite), config (electron-store), secrets (safeStorage), cache (filesystem)
    updater/        electron-updater wrapper
    ipc.ts          IPC handler surface
    index.ts        Bootstrap
  preload/          contextBridge: exposes typed IPC client to renderer
  renderer/         React + Radix UI + TanStack Query
  shared/           Zod schemas, error hierarchy, IPC channel names, domain types
tests/
  converter/        Storage XHTML fixture-driven tests
  net/              HTTP classification with undici MockAgent
  store/            In-memory SQLite audit tests
resources/
  fixtures/         Converter test inputs
build/              Packaging assets (icon.svg/png/ico, make-icon.mjs)
```

ESLint enforces architectural boundaries:

- Renderer cannot import anything from `@main/*`.
- Anything outside the Confluence backend layer cannot import from `**/confluence/dc/*` or `**/confluence/cloud/*` directly — go through `confluence/interfaces.ts` or `shared/domain.ts` instead.

The factory in `src/main/confluence/factory.ts` is the only place allowed to dispatch on backend type.

## Commits

The repo uses [Conventional Commits](https://www.conventionalcommits.org/) enforced by `@commitlint/config-conventional` via a Husky `commit-msg` hook. Subjects under ~50 chars; body explains the _why_. Examples:

- `fix(audit): enable foreign_keys pragma to reject orphan event_log rows`
- `feat(converter): map jira macro with key to <a href>`
- `chore(deps): bump electron from 41.6.0 to 41.6.1`

For multi-line bodies, prefer reasoning over restating the diff.

## Branches and PRs

- Work on a topic branch off `main`: `fix/audit-fk`, `feat/cloud-attachment-paging`, etc.
- Keep PRs focused. Split unrelated fixes into separate PRs.
- Before opening: `npm run lint && npm run typecheck && npm test && npm run build` all green.
- CI runs the same four steps on a matrix of `ubuntu-latest` and `windows-latest`. Both must be green for merge.
- The release pipeline triggers on tag pushes (`v*.*.*`) — don't tag from a feature branch.

### PR checklist

- [ ] Tests added or updated for behavior changes.
- [ ] No new ESLint warnings.
- [ ] No new `any` without a `// eslint-disable-next-line` justification.
- [ ] No new direct imports across the `confluence/{dc,cloud}` boundary.
- [ ] CHANGELOG / Release notes will be generated from commit messages — make them readable.

## Adding a converter macro

1. Drop a fixture under `resources/fixtures/NN-name.storage.xhtml` covering the new macro.
2. Implement `applyXxx($, ctx, state)` in `src/main/converter/macros/xxx.ts`. Reuse `escapeText` / `escapeAttr` from `src/main/converter/utils.ts`.
3. Wire it into `src/main/converter/index.ts` in the macro pass.
4. Add an assertion in `tests/converter/converter.test.ts` (or a new test file under `tests/converter/`).
5. If the macro is partially supported, bump `state.needsReview` and surface a `<mark>[needs review: …]</mark>` marker so the user knows to verify.

## Adding a new IPC channel

1. Name the channel in `src/shared/ipc-channels.ts` (`IPC.MyNewChannel = 'my-new-channel'`).
2. Define the request/response types in `src/shared/types.ts` so both processes see the same shape.
3. Implement the handler in `src/main/ipc.ts` inside `registerIpc()` using the existing `handle()` wrapper (it serializes errors to `LoopbridgeApiError` for the renderer).
4. Expose it on the preload bridge in `src/preload/index.ts`.
5. Consume it from React via TanStack Query (see existing hooks under `src/renderer/hooks/`).

## Dependency changes

`v0.3.0`, `v0.3.1`, and `v0.3.2` each shipped as ghost tags because `package-lock.json` drifted out of sync with `package.json` and the release workflow's `npm ci` step bailed. To keep that from recurring:

- **Always use `npm install`** when adding or removing a dep — never edit `package.json` by hand without running it. Avoid `npm install <pkg> --no-save`; commit both files together.
- **Use the pinned npm version.** CI runs `npm@11.6.2` (see `release.yml` + `ci.yml`). If your local npm differs significantly the lockfile may resolve differently. Match it with `npm install -g npm@11.6.2`.
- **Verify locally before pushing.** `npm ci --ignore-scripts --dry-run` must succeed against the committed lockfile.
- **The Husky `pre-commit` hook** rejects commits that stage `package.json` without also staging `package-lock.json`.
- **CI runs a `lockfile-check` job** on every PR that re-resolves the lock from `package.json` and fails if there is any diff. PRs cannot merge with a stale lock.
- **Optional WASM peer deps** (e.g. `@emnapi/core`, `@emnapi/runtime`) sometimes need to be pinned as direct devDependencies to satisfy `npm ci` strict mode — see the v0.3.2 fix.

## Security-sensitive changes

If your change touches: auth flow, secret storage, IPC surface, network egress, CSP, or sandbox flags, flag the PR with a `security` label and request review. See [SECURITY.md](../SECURITY.md) for the vulnerability disclosure process.

## License

By contributing you agree your work is released under the [MIT license](../LICENSE).

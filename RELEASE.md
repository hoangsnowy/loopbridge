# Release playbook

How to cut a loopbridge release without producing a ghost tag.

## Pre-flight checklist

Run on a clean checkout of `main`:

- [ ] `git status` is clean and `git log` shows the merge commits you expect on `main`.
- [ ] `nvm use` (or `fnm use` / `volta`) — match the `.nvmrc` Node version.
- [ ] `npm install -g npm@11.6.2` — match the CI-pinned npm version.
- [ ] `npm ci --ignore-scripts --dry-run` succeeds. If it fails with `Missing: <pkg> from lock file`, **stop**: run `npm install`, inspect the diff, commit the lockfile fix as a separate `fix(release): regen lockfile` commit, and start over.
- [ ] `npm run lint -- --max-warnings 0` green.
- [ ] `npm run typecheck` green.
- [ ] `npm test` green.
- [ ] `npm run build` green.

If any check fails, fix it on `main` via a PR — **do not tag**.

## Cut the release

1. Update `package.json` `version` to `X.Y.Z` (no `v` prefix).
2. Update `package-lock.json` — the top-level `version` and `packages.""."version"` fields. Easiest: `npm install` and it rewrites them.
3. Update `CHANGELOG.md`: rename `[Unreleased]` to `[X.Y.Z] — YYYY-MM-DD`, add a fresh empty `[Unreleased]` section above, and append a link reference at the bottom.
4. Commit: `chore(release): X.Y.Z`. Push to `main`.
5. Tag: `git tag -a vX.Y.Z <merge-commit-sha> -m "vX.Y.Z"`.
6. Push the tag: `git push origin vX.Y.Z`. This triggers `release.yml`.

## Watch the workflow

- `gh run watch <run-id> --exit-status --interval 30`.
- If `Install deps (with native rebuild)` fails: the lockfile is out of sync. Stop, regenerate locally, push a `fix(release): regen lockfile` commit, bump to the next patch version (the failed tag is now a ghost — leave it), re-tag.
- If `Verify package.json matches tag` fails: `package.json` `version` does not match the tag. Bump `package.json`, commit, re-tag.

## Publish

The release pipeline creates a **draft** GitHub Release with the NSIS `.exe`, MSI `.msi`, and CycloneDX SBOM attached.

1. Open the draft URL printed by the workflow.
2. Verify the assets: `loopbridge-X.Y.Z-setup.exe`, `loopbridge-X.Y.Z-setup.msi`, `loopbridge-X.Y.Z-setup.exe.blockmap`, `sbom.cdx.json`.
3. Click **Publish release** in the GitHub UI. `electron-updater` will pick it up on the next app launch via the GitHub provider feed.

## Post-mortem index

| Tag    | Status                                                       | Root cause                                                                   |
| ------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| v0.3.0 | Ghost — `npm ci` missing `conventional-commits-parser`       | Lockfile drifted; CI uses strict `npm ci`                                    |
| v0.3.1 | Ghost — same plus `@emnapi/core` / `@emnapi/runtime`         | Modern npm omits optional peer WASM deps from install tree                   |
| v0.3.2 | Ghost — `npm ci` still missing `conventional-commits-parser` | Local npm 11 hoisted differently than CI's npm 10                            |
| v0.3.3 | ✅ Shipped                                                   | All three of the above fixed (lockfile regen + emnapi pin + npm version pin) |

Read this if a release fails — odds are you are reliving one of these.

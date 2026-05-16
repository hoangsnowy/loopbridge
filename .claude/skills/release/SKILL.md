---
name: release
description: Cut a new loopbridge release. Bumps the version in package.json, commits, tags, pushes the tag, watches the GitHub Actions release workflow, and surfaces the draft release URL. Use when the user says "release", "ship", "cut v0.X.Y", or asks to publish a new version.
---

# release

End-to-end release flow. The release workflow (`.github/workflows/release.yml`) triggers on any `v*.*.*` tag push.

## Preconditions

- On `main`, working tree clean, in sync with `origin/main`.
- Local `npm run lint -- --max-warnings 0 && npm run typecheck && npm test && npm run build` all green (run the `verify` skill first).
- Decide the version. Follow semver: bug-fix only → `vX.Y.(Z+1)`; new feature or behaviour change → `vX.(Y+1).0`; breaking → `v(X+1).0.0`.

## Steps

1. Bump `package.json` version field to the new `X.Y.Z` (no `v` prefix in package.json).
2. Commit with conventional message:

   ```
   chore(release): vX.Y.Z
   ```

3. Push the commit, then tag and push the tag:

   ```bash
   git push origin main
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   ```

4. Watch the release workflow:

   ```bash
   gh run watch --repo hoangsnowy/loopbridge $(gh run list --workflow=release.yml --branch=vX.Y.Z --limit=1 --json databaseId --jq '.[0].databaseId') --exit-status
   ```

5. On success, surface the draft release URL:

   ```bash
   gh release view vX.Y.Z --repo hoangsnowy/loopbridge --json url --jq '.url'
   ```

6. Tell the user the draft is ready to review + publish in the GitHub UI.

## Failure recovery

If the workflow fails:

- **Install / native rebuild fails**: the lockfile or Electron version is bad. Fix on `main`, then force-move the tag (`git tag -d v…; git push --delete origin v…; git tag -a v… -m v…; git push origin v…`). Destructive — confirm with user first.
- **Packaging fails (NSIS / MSI / AppImage)**: read `electron-builder.yml` validation error or WiX log. Common cause: missing `build/icon.ico` or `build/icon.png` (run `node build/make-icon.mjs` if `icon.svg` exists).
- **Release upload fails (`fail_on_unmatched_files`)**: a glob in `release.yml` matched nothing. Verify locally with `npm run build:unpacked` then `npx electron-builder --win nsis msi --publish never` and check `release/X.Y.Z/`.

## Don'ts

- Don't tag from a feature branch — releases ship from `main`.
- Don't skip Husky hooks (`--no-verify`) on the release commit. The commitlint and lint-staged gates exist for a reason.
- Don't bump the version directly to mainline without a PR if the bump rides on top of other changes — split commits or land them via PR first.

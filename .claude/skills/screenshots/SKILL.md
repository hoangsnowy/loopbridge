---
name: screenshots
description: Regenerate the README screenshots under docs/screenshots/. Drives the renderer through setup → connect → pages → page detail → audit → settings → about via Playwright + mock Confluence server, then saves PNGs at standard 1280x800. Use when the user says "regenerate screenshots", "update README images", "rebuild docs images", or after a UI change that would invalidate the existing captures.
---

# screenshots

Auto-captures the seven README images from the live app driven through the mock Confluence server. Non-gating — kept separate from `test:e2e` so the regular gate stays fast and deterministic.

## Run

```bash
npm run screenshots
```

`prescreenshots` rebuilds bundles + rebuilds better-sqlite3 against the Electron ABI. Output goes to `docs/screenshots/`:

| File                | What it shows                                    |
| ------------------- | ------------------------------------------------ |
| `setup.png`         | Empty first-run setup form                       |
| `setup-success.png` | Same form after a successful Test connection     |
| `pages.png`         | Pages list with DOCS space loaded (2 mock pages) |
| `preview.png`       | Page detail / preview screen                     |
| `audit.png`         | Pages list re-visited, status badges visible     |
| `settings.png`      | Settings screen                                  |
| `about.png`         | About screen                                     |

## When the spec breaks

- **"Hello World" not visible after navigating back to /pages**: PageList resets its local state on remount; the spec refills the space key. If you added a route change that drops state differently, update the navigation block in `e2e/screenshots.spec.ts`.
- **Detail/Preview shows "Loading…"**: the mock `pageDetailResponse` in `e2e/mock-confluence.ts` may not match a new wire field the renderer now requires. Extend the mock response.
- **Screenshots come out blank or partially-rendered**: bump the `await window.waitForTimeout(...)` in the `shot()` helper. Radix portals and Tailwind animations need a beat after navigation.

## Layout / styling

Window is forced to 1280x800 in `beforeAll`. The renderer follows OS theme; on light-theme hosts you get light screenshots, on dark-theme hosts you get dark. To force a theme add a query param or `prefers-color-scheme` override before `shot()` calls.

## Don'ts

- Don't run `screenshots` in CI on tag pushes — it's interactive flow, not part of the release gate.
- Don't add screenshot specs to `e2e/playwright.config.ts` — the gating config has a `testMatch` that explicitly excludes `screenshots.spec.ts`.
- Don't manually edit the generated PNGs; rerun the script.

## Commit

Commit all changed PNGs together so README references stay coherent:

```
docs: regenerate README screenshots
```

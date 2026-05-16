---
name: regen-icon
description: Regenerate the Windows .ico and Linux .png app icons from the source SVG at build/icon.svg. Use when the user edits the SVG, asks to "rebuild the icon", or after a brand tweak. Installs sharp + png-to-ico ad-hoc and runs the one-shot script.
---

# regen-icon

`build/icon.svg` is the source of truth. `build/icon.png` (Linux) and `build/icon.ico` (Windows, multi-size 16/24/32/48/64/128/256) are generated. `electron-builder` consumes both at packaging time.

## Run

```bash
npm install --no-save sharp png-to-ico
node build/make-icon.mjs
```

`--no-save` keeps `sharp` + `png-to-ico` out of `package.json` — they're one-shot tooling, not runtime deps. After regen, `npm install` again to restore the regular dep set.

## Verify

```bash
ls -la build/
# icon.svg  (source)
# icon.png  (~50–80 KB, 512x512)
# icon.ico  (~370 KB, multi-size)
```

Then a quick visual check:

```bash
# Windows
start build/icon.ico
# Linux
xdg-open build/icon.png
```

## Commit

Commit all three files together — the `.ico` and `.png` ride alongside the SVG so devs don't need the regen toolchain.

```
chore(brand): regenerate app icon
```

## Editing the SVG

`build/icon.svg` is 1024x1024, two linear gradients (`#bg` and `#loop`), a glow filter. Keep the design simple — at 16x16 (taskbar) anything finer than a stroke width of ~3 disappears. Test the small rendering by opening `icon.ico` in Windows Explorer thumbnail view after regen.

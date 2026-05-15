// Regenerate build/icon.ico (Windows) and build/icon.png (fallback) from icon.svg.
// One-shot tooling, not a runtime dep:
//   npm install --no-save sharp png-to-ico
//   node build/make-icon.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const svg = readFileSync(new URL('./icon.svg', import.meta.url));

const sizes = [16, 24, 32, 48, 64, 128, 256];
const buffers = await Promise.all(
  sizes.map((s) => sharp(svg).resize(s, s).png().toBuffer()),
);

writeFileSync(new URL('./icon.png', import.meta.url), await sharp(svg).resize(512, 512).png().toBuffer());
writeFileSync(new URL('./icon.ico', import.meta.url), await pngToIco(buffers));
console.log('icon.png + icon.ico written');

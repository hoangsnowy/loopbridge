---
name: add-macro
description: Add support for a Confluence storage macro in the converter. Walks through fixture → implementation → wire-up → test. Use when the user asks to "support the X macro", "convert the Y macro", or shows a Confluence page whose output is missing a known macro.
---

# add-macro

Confluence stores rich content as `ac:structured-macro` XHTML. The converter walks each macro and produces clipboard-safe HTML. Each macro lives in its own file under `src/main/converter/macros/`.

## Steps

1. **Capture a fixture.** Drop the smallest reproducible storage XHTML at `resources/fixtures/NN-<macro-name>.storage.xhtml` (next number after the last fixture). One macro per fixture.

2. **Implement the handler.** Create `src/main/converter/macros/<name>.ts`:

   ```ts
   import type { CheerioAPI } from 'cheerio';
   import type { ConvertContext, ConvertState } from '../types';
   import { escapeAttr, escapeText } from '../utils';

   export function applyXxx($: CheerioAPI, ctx: ConvertContext, state: ConvertState): void {
     $('ac\\:structured-macro[ac\\:name="xxx"]').each((_, el) => {
       const $m = $(el);
       const title = $m.find('ac\\:parameter[ac\\:name="title"]').first().text().trim();
       const body = $m.find('ac\\:rich-text-body').first().html() ?? '';
       $m.replaceWith(`<blockquote>${escapeText(title)}: ${body}</blockquote>`);
     });
   }
   ```

   Reuse `escapeText` / `escapeAttr` from `../utils` — never re-define locally.

3. **Wire into the pipeline.** Open `src/main/converter/index.ts`, import the new function, and call it in the macro pass alongside the others. Order matters when one macro nests inside another — usually deeper-first.

4. **Add a test.** Append to `tests/converter/converter.test.ts`:

   ```ts
   it('renders xxx macro', async () => {
     const result = await convertStorageToHtml(loadFixture('NN-xxx.storage.xhtml'), baseContext());
     expect(result.html).toContain('<blockquote>');
     expect(result.html).not.toContain('ac:structured-macro');
   });
   ```

5. **Run** `npm test` and `npm run lint -- --max-warnings 0`.

## When the macro is only partly supported

If you can't produce a faithful rendering (e.g. Gliffy diagrams), emit a visible review marker and bump the counter:

```ts
if (ctx.needsReviewMarker) {
  $m.replaceWith(
    `<mark>[needs review: ${escapeText(name)}]</mark><!-- needs-review: ${escapeText(name)} -->`,
  );
}
state.needsReview += 1;
```

The renderer's audit view counts `needsReview > 0` and surfaces it as a checklist item.

## Don'ts

- Don't import macro modules across each other — each macro stands alone.
- Don't reach into renderer state. Macros run in the main process under `convertStorageToHtml`.
- Don't introduce a new escape helper. If `escapeText` / `escapeAttr` aren't enough, extend `converter/utils.ts` once.

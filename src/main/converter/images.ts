import type { CheerioAPI } from 'cheerio';
import type { ConvertContext, ConvertState } from './types';

export async function transformImages(
  $: CheerioAPI,
  ctx: ConvertContext,
  state: ConvertState,
): Promise<void> {
  const tasks: Array<{ el: ReturnType<CheerioAPI>; filename: string; external?: string }> = [];

  $('ac\\:image').each((_, el) => {
    const $img = $(el);
    const $att = $img.find('ri\\:attachment').first();
    const $url = $img.find('ri\\:url').first();
    if ($att.length > 0) {
      const filename = $att.attr('ri:filename') ?? '';
      tasks.push({ el: $img, filename });
    } else if ($url.length > 0) {
      const src = $url.attr('ri:value') ?? '';
      tasks.push({ el: $img, filename: '', external: src });
    } else {
      $img.replaceWith('<mark>[image: unresolved]</mark>');
      state.needsReview += 1;
    }
  });

  for (const t of tasks) {
    if (t.external) {
      t.el.replaceWith(`<img src="${escapeAttr(t.external)}" alt="" />`);
      state.imagePlan.push({
        filename: t.external,
        kind: 'external',
        sizeBytes: 0,
        originalSrc: t.external,
      });
      continue;
    }
    if (!t.filename) {
      t.el.replaceWith('<mark>[image: unresolved]</mark>');
      state.needsReview += 1;
      continue;
    }

    const att = ctx.attachments.find((a) => a.filename === t.filename);
    const size = att?.sizeBytes ?? 0;
    const localPath = ctx.attachmentLocalPath?.(t.filename);

    let kind: 'embedded-base64' | 'manual-drag' = 'manual-drag';
    if (
      ctx.imageStrategy === 'base64' ||
      (ctx.imageStrategy === 'auto' &&
        size > 0 &&
        size <= ctx.base64MaxBytesPerImage &&
        state.base64BytesUsed + size <= ctx.base64MaxBytesPerPage)
    ) {
      kind = 'embedded-base64';
    }

    if (kind === 'embedded-base64' && ctx.loadAttachment) {
      const data = await ctx.loadAttachment(t.filename);
      if (data) {
        const mime = att?.mediaType ?? 'image/png';
        const b64 = data.toString('base64');
        t.el.replaceWith(`<img src="data:${mime};base64,${b64}" alt="${escapeAttr(t.filename)}" />`);
        state.imagesEmbedded += 1;
        state.base64BytesUsed += data.length;
        const entry: import('@shared/types').ImagePlanEntry = {
          filename: t.filename,
          kind: 'embedded-base64',
          sizeBytes: data.length,
          originalSrc: att?.downloadHref ?? '',
        };
        if (localPath) entry.localPath = localPath;
        state.imagePlan.push(entry);
        continue;
      }
    }

    t.el.replaceWith(
      `<mark>[image: ${escapeText(t.filename)}]</mark>`,
    );
    state.imagesManual += 1;
    if (ctx.needsReviewMarker) state.needsReview += 1;
    const entry: import('@shared/types').ImagePlanEntry = {
      filename: t.filename,
      kind: 'manual-drag',
      sizeBytes: size,
      originalSrc: att?.downloadHref ?? '',
    };
    if (localPath) entry.localPath = localPath;
    state.imagePlan.push(entry);
  }
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, '&quot;');
}

import type { CheerioAPI } from 'cheerio';
import type { ConvertContext, ConvertState } from '../types';

export function applyToc($: CheerioAPI, ctx: ConvertContext, state: ConvertState): void {
  $('ac\\:structured-macro[ac\\:name="toc"]').each((_, el) => {
    const marker = ctx.needsReviewMarker
      ? '<mark>[Table of contents — Loop auto-generates ToC differently]</mark>'
      : '';
    $(el).replaceWith(`${marker}<!-- needs-review: toc macro -->`);
    state.needsReview += 1;
  });
}

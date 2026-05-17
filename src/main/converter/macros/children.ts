import type { CheerioAPI } from 'cheerio';
import type { ConvertContext, ConvertState } from '../types';

export function applyChildren($: CheerioAPI, ctx: ConvertContext, state: ConvertState): void {
  $('ac\\:structured-macro[ac\\:name="children"]').each((_, el) => {
    const marker = ctx.needsReviewMarker
      ? '<mark>[Child pages — recreate in Loop manually]</mark>'
      : '';
    $(el).replaceWith(`${marker}<!-- needs-review: children macro -->`);
    state.needsReview += 1;
  });
}

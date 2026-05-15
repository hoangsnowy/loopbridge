import type { CheerioAPI } from 'cheerio';
import type { ConvertContext, ConvertState } from '../types';

export function applyUnknownMacros($: CheerioAPI, ctx: ConvertContext, state: ConvertState): void {
  $('ac\\:structured-macro').each((_, el) => {
    const $m = $(el);
    const name = $m.attr('ac:name') ?? 'unknown';
    const body = $m.find('ac\\:rich-text-body').first().html() ?? '';
    const marker = ctx.needsReviewMarker
      ? `<mark>[unsupported macro: ${escapeText(name)}]</mark>`
      : '';
    $m.replaceWith(`${marker}<!-- needs-review: macro ${escapeText(name)} -->${body}`);
    state.needsReview += 1;
  });
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

import type { CheerioAPI } from 'cheerio';
import type { ConvertContext, ConvertState } from '../types';
import { escapeText } from '../utils';

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

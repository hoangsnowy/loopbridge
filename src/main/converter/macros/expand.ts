import type { CheerioAPI } from 'cheerio';

export function applyExpand($: CheerioAPI): void {
  $('ac\\:structured-macro[ac\\:name="expand"]').each((_, el) => {
    const $m = $(el);
    const title = $m.find('ac\\:parameter[ac\\:name="title"]').first().text().trim() || 'Details';
    const body = $m.find('ac\\:rich-text-body').first().html() ?? '';
    $m.replaceWith(`<p><strong>▸ ${escapeText(title)}</strong></p><blockquote>${body}</blockquote>`);
  });
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

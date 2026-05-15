import type { CheerioAPI } from 'cheerio';

export function applyPanel($: CheerioAPI): void {
  $('ac\\:structured-macro[ac\\:name="panel"]').each((_, el) => {
    const $m = $(el);
    const title = $m.find('ac\\:parameter[ac\\:name="title"]').first().text().trim();
    const body = $m.find('ac\\:rich-text-body').first().html() ?? '';
    const titleHtml = title ? `<p><strong>${escapeText(title)}</strong></p>` : '';
    $m.replaceWith(`<blockquote>${titleHtml}${body}</blockquote>`);
  });
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

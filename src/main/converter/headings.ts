import type { CheerioAPI } from 'cheerio';

export function demoteH1($: CheerioAPI): void {
  $('h1').each((_, el) => {
    const $h1 = $(el);
    const inner = $h1.html() ?? '';
    $h1.replaceWith(`<h2>${inner}</h2>`);
  });
}

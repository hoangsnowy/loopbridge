import type { CheerioAPI } from 'cheerio';

export function applyChildren($: CheerioAPI): void {
  $('ac\\:structured-macro[ac\\:name="children"]').each((_, el) => {
    $(el).replaceWith('<!-- children macro removed -->');
  });
}

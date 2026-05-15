import type { CheerioAPI } from 'cheerio';

export function applyToc($: CheerioAPI): void {
  $('ac\\:structured-macro[ac\\:name="toc"]').each((_, el) => {
    $(el).replaceWith('<!-- toc removed -->');
  });
}

import type { CheerioAPI } from 'cheerio';
import { escapeText } from '../utils';

export function applyStatus($: CheerioAPI): void {
  $('ac\\:structured-macro[ac\\:name="status"]').each((_, el) => {
    const $m = $(el);
    const title = $m.find('ac\\:parameter[ac\\:name="title"]').first().text().trim();
    const color =
      $m.find('ac\\:parameter[ac\\:name="colour"]').first().text().trim() ||
      $m.find('ac\\:parameter[ac\\:name="color"]').first().text().trim();
    const label = color ? `${color}: ${title}` : title;
    $m.replaceWith(`<span><strong>[${escapeText(label)}]</strong></span>`);
  });
}

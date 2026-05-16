import type { CheerioAPI } from 'cheerio';
import { escapeAttr, escapeText } from '../utils';

export function applyCode($: CheerioAPI): void {
  $('ac\\:structured-macro[ac\\:name="code"]').each((_, el) => {
    const $m = $(el);
    const lang = $m.find('ac\\:parameter[ac\\:name="language"]').first().text().trim();
    const body = $m.find('ac\\:plain-text-body').first().text();
    const escaped = escapeText(body);
    const langClass = lang ? ` class="language-${escapeAttr(lang)}"` : '';
    $m.replaceWith(`<pre><code${langClass}>${escaped}</code></pre>`);
  });
}

import type { CheerioAPI } from 'cheerio';

export function normalizeTables($: CheerioAPI): void {
  $('table').each((_, table) => {
    const $t = $(table);
    cleanAttributes($t);
    $t.find('thead, tbody, tfoot, tr, th, td, colgroup, col').each((_idx, el) => {
      cleanAttributes($(el));
    });
    // Drop colgroup entirely; many renderers ignore it.
    $t.find('colgroup').remove();
  });
}

function cleanAttributes($el: ReturnType<CheerioAPI>) {
  const allowed = new Set(['colspan', 'rowspan']);
  const node = $el[0];
  if (!node || node.type !== 'tag') return;
  const attribs = node.attribs ?? {};
  for (const name of Object.keys(attribs)) {
    if (name.startsWith('ac:') || name.startsWith('data-')) {
      $el.removeAttr(name);
      continue;
    }
    if (!allowed.has(name)) {
      $el.removeAttr(name);
    }
  }
}

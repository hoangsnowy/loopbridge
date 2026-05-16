import type { CheerioAPI } from 'cheerio';
import type { ConvertContext, ConvertState } from '../types';
import { escapeAttr, escapeText } from '../utils';

export function applyJira($: CheerioAPI, ctx: ConvertContext, state: ConvertState): void {
  $('ac\\:structured-macro[ac\\:name="jira"]').each((_, el) => {
    const $m = $(el);
    const key = $m.find('ac\\:parameter[ac\\:name="key"]').first().text().trim();
    const jql = $m.find('ac\\:parameter[ac\\:name="jqlQuery"]').first().text().trim();
    if (key && !jql) {
      const href = ctx.jiraBase ? `${ctx.jiraBase}/browse/${encodeURIComponent(key)}` : `#${key}`;
      $m.replaceWith(`<a href="${escapeAttr(href)}">${escapeText(key)}</a>`);
    } else {
      $m.replaceWith('<mark>[needs review: jira-jql]</mark><!-- needs-review: jira-jql -->');
      state.needsReview += 1;
    }
  });
}

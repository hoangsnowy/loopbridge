import type { CheerioAPI } from 'cheerio';
import type { ConvertContext, ConvertState } from '../types';

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

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, '&quot;');
}

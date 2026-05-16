import type { CheerioAPI } from 'cheerio';
import type { ConvertContext, ConvertState } from './types';
import { escapeAttr, escapeText } from './utils';

export function transformLinks($: CheerioAPI, ctx: ConvertContext, state: ConvertState): void {
  $('ac\\:link').each((_, el) => {
    const $link = $(el);
    const anchor = $link.attr('ac:anchor');
    const $page = $link.find('ri\\:page').first();
    const $user = $link.find('ri\\:user').first();
    const $att = $link.find('ri\\:attachment').first();
    const bodyText = $link.find('ac\\:link-body, ac\\:plain-text-link-body').first().text();

    let href = '#';
    let label = bodyText.trim();

    if ($page.length > 0) {
      const spaceKey = $page.attr('ri:space-key') ?? ctx.spaceKey;
      const title = $page.attr('ri:content-title') ?? '';
      if (ctx.rewriteInternalLinks === 'placeholder') {
        href = '#';
      } else {
        href = `${ctx.baseUrl}/display/${encodeURIComponent(spaceKey)}/${encodeURIComponent(title.replace(/\s+/g, '+'))}`;
      }
      if (!label) label = title;
      if (anchor) href = `${href}#${encodeURIComponent(anchor)}`;
    } else if ($user.length > 0) {
      const ident = $user.attr('ri:account-id') ?? $user.attr('ri:userkey') ?? 'unknown';
      $link.replaceWith(
        `<strong>@${escapeText(label || 'unknown-user')}</strong><!-- user: ${escapeText(ident)} -->`,
      );
      state.needsReview += 1;
      return;
    } else if ($att.length > 0) {
      const filename = $att.attr('ri:filename') ?? '';
      if (!label) label = filename;
      href = ctx.attachmentLocalPath?.(filename) ?? '#';
    } else if (anchor && !$page.length) {
      href = `#${encodeURIComponent(anchor)}`;
    }

    $link.replaceWith(`<a href="${escapeAttr(href)}">${escapeText(label || href)}</a>`);
  });
}

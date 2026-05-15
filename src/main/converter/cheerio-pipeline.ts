import * as cheerio from 'cheerio';
import { applyAttachmentsMacro } from './macros/attachments-macro';
import { applyChildren } from './macros/children';
import { applyCode } from './macros/code';
import { applyExpand } from './macros/expand';
import { applyInfoNoteWarningTip } from './macros/info-note-warning-tip';
import { applyJira } from './macros/jira';
import { applyPanel } from './macros/panel';
import { applyStatus } from './macros/status';
import { applyToc } from './macros/toc';
import { applyUnknownMacros } from './macros/unknown';
import { transformTaskLists } from './tasklist';
import { transformImages } from './images';
import { transformLinks } from './links';
import { normalizeTables } from './tables';
import { demoteH1 } from './headings';
import type { ConvertContext, ConvertState } from './types';

export async function runPipeline(
  xhtml: string,
  ctx: ConvertContext,
  state: ConvertState,
): Promise<string> {
  // CDATA blocks are stripped by HTML-mode parsers. Inline them as text first.
  const inlined = xhtml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, body: string) =>
    body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  );
  const wrapped = `<root>${inlined}</root>`;
  const $ = cheerio.load(wrapped, { xmlMode: false });

  applyToc($);
  applyChildren($);
  applyInfoNoteWarningTip($);
  applyCode($);
  applyExpand($);
  applyPanel($);
  applyStatus($);
  applyJira($, ctx, state);
  applyAttachmentsMacro($, ctx);
  applyUnknownMacros($, ctx, state);

  transformTaskLists($);
  await transformImages($, ctx, state);
  transformLinks($, ctx, state);

  if (ctx.demoteH1ToH2) demoteH1($);
  normalizeTables($);

  // Strip any remaining ri: tags by unwrapping their text content
  $('ri\\:user, ri\\:page, ri\\:attachment, ri\\:url').each((_, el) => {
    const $el = $(el);
    $el.replaceWith($el.text());
  });

  return $('root').html() ?? '';
}

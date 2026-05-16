import type { CheerioAPI } from 'cheerio';
import type { ConvertContext } from '../types';
import { escapeText } from '../utils';

export function applyAttachmentsMacro($: CheerioAPI, ctx: ConvertContext): void {
  $('ac\\:structured-macro[ac\\:name="attachments"]').each((_, el) => {
    if (ctx.attachments.length === 0) {
      $(el).replaceWith('<!-- attachments macro: no attachments on this page -->');
      return;
    }
    const items = ctx.attachments
      .map((a) => `<li>${escapeText(a.filename)} (${humanSize(a.sizeBytes)})</li>`)
      .join('');
    $(el).replaceWith(`<p><strong>Attachments</strong></p><ul>${items}</ul>`);
  });
}

function humanSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

import { clipboard } from 'electron';
import sanitizeHtml from 'sanitize-html';

const NBSP = String.fromCharCode(0xa0);

export interface ClipboardPayload {
  html: string;
  plainText?: string;
}

export function writeRichToClipboard(payload: ClipboardPayload): void {
  const plain = payload.plainText ?? htmlToPlain(payload.html);
  clipboard.write({
    text: plain,
    html: payload.html,
  });
}

function htmlToPlain(html: string): string {
  const text = sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  });
  return text
    .split(NBSP)
    .join(' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

import type { CheerioAPI } from 'cheerio';

const PREFIXES: Record<string, { emoji: string; label: string }> = {
  info: { emoji: 'ℹ️', label: 'Info' },
  note: { emoji: '📝', label: 'Note' },
  warning: { emoji: '⚠️', label: 'Warning' },
  tip: { emoji: '💡', label: 'Tip' },
};

export function applyInfoNoteWarningTip($: CheerioAPI): void {
  for (const name of Object.keys(PREFIXES)) {
    $(`ac\\:structured-macro[ac\\:name="${name}"]`).each((_, el) => {
      const $m = $(el);
      const body = $m.find('ac\\:rich-text-body').first().html() ?? '';
      const meta = PREFIXES[name]!;
      $m.replaceWith(
        `<blockquote><p><strong>${meta.emoji} ${meta.label}:</strong></p>${body}</blockquote>`,
      );
    });
  }
}

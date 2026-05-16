/**
 * Minimal HTML escaping helpers shared across converter modules.
 * Kept tiny on purpose — converter output is fed straight to clipboard
 * HTML, and downstream sanitization (sanitize-html) is the real defence.
 */
export function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, '&quot;');
}

import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'br',
  'hr',
  'strong',
  'em',
  'u',
  's',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'a',
  'img',
  'span',
  'mark',
  'input',
  'div',
];

export function sanitize(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      code: ['class'],
      input: ['type', 'checked', 'disabled'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
      div: ['class'],
      span: ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'data'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data'],
    },
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => {
        const out = { tagName, attribs: { ...attribs } };
        if (attribs.href && /^https?:/i.test(attribs.href)) {
          out.attribs.target = '_blank';
          out.attribs.rel = 'noreferrer noopener';
        }
        return out;
      },
    },
  });
}

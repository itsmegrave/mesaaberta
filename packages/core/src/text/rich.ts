// `xss` is CommonJS: Node (the SSR build's analysis, scripts) only offers its default export.
import xss from 'xss';
import type * as XssTypes from 'xss';

const { FilterXSS, escapeAttrValue } = xss as unknown as Pick<
  typeof XssTypes,
  'FilterXSS' | 'escapeAttrValue'
>;

// Rich text (the GM's descriptions, the welcome message, announcements) is stored as a small,
// closed subset of HTML. The editor produces it, the server cleans it again before saving, and it
// is cleaned once more before it is shown, so what is stored can never carry a script.

const ALLOWED_TAGS: Record<string, string[]> = {
  p: [],
  br: [],
  h2: [],
  h3: [],
  strong: [],
  em: [],
  u: [],
  s: [],
  code: [],
  pre: [],
  blockquote: [],
  hr: [],
  ul: [],
  ol: [],
  li: [],
  a: ['href'],
};

/** The protocols a link may use. Anything else (`javascript:`, `data:`) loses its address. */
const SAFE_LINK = /^(https?:\/\/|mailto:)/i;

const filter = new FilterXSS({
  whiteList: ALLOWED_TAGS,
  // A tag that is not allowed goes away and its text stays; a script or style goes with its body.
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
  safeAttrValue(tag, name, value) {
    if (tag === 'a' && name === 'href') {
      const href = value.trim();
      return SAFE_LINK.test(href) ? escapeAttrValue(href) : '';
    }
    return '';
  },
});

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

const decodeEntities = (value: string) =>
  value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1].toLowerCase() === 'x'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });

/** Tags of the allowed set, as an HTML-looking string tells a plain-text one apart. */
const LOOKS_LIKE_HTML = /<\/?(p|br|h2|h3|strong|em|u|s|code|pre|blockquote|hr|ul|ol|li|a)[\s/>]/i;

export const looksLikeHtml = (value: string) => LOOKS_LIKE_HTML.test(value);

/** Plain text as HTML: escaped, a blank line starts a paragraph, a line break stays one. */
export function plainToHtml(text: string): string {
  const paragraphs = text
    .replace(/\r\n?/g, '\n')
    .trim()
    .split(/\n{2,}/)
    .filter((paragraph) => paragraph.trim());
  return paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/**
 * The HTML the editor wrote, reduced to the allowed tags; text with no tags at all (a form sent
 * without JavaScript) becomes paragraphs. Empty in, or nothing visible, gives an empty string.
 */
export function cleanRichHtml(input: string): string {
  const value = input.trim();
  if (!value) return '';
  const html = looksLikeHtml(value) ? filter.process(value) : plainToHtml(value);
  // A link whose address was refused keeps its text and loses the link.
  const safe = html
    .replace(/<a href(?:="")?>([\s\S]*?)<\/a>/g, '$1')
    .replace(/<a href=/g, '<a target="_blank" rel="noopener nofollow ugc" href=');
  return richIsEmpty(safe) ? '' : safe.trim();
}

/** Nothing a reader could see: no text and no divider (an editor's empty document is `<p></p>`). */
function richIsEmpty(html: string): boolean {
  return !toPlainText(html) && !/<hr\b/i.test(html);
}

/**
 * The text of rich HTML, for the places that cannot show it (calendar, Instagram, the e-mail's
 * plain copy, the bell): paragraphs separated by a blank line, list items marked, links followed
 * by their address. Expects HTML that went through `cleanRichHtml`.
 */
export function toPlainText(html: string): string {
  let out = '';
  const lists: Array<{ ordered: boolean; count: number }> = [];
  let href: string | null = null;
  let linkStart = 0;
  const gap = (lines: number) => {
    if (!out) return;
    const trailing = /\n*$/.exec(out)![0].length;
    if (trailing < lines) out += '\n'.repeat(lines - trailing);
  };

  for (const token of html.matchAll(/<(\/?)([a-z0-9]+)([^>]*)>|([^<]+)/gi)) {
    const [, closing, rawName, attrs, text] = token;
    if (text !== undefined) {
      out += decodeEntities(text);
      continue;
    }
    const name = rawName.toLowerCase();
    if (closing) {
      if (name === 'a' && href !== null) {
        const label = out.slice(linkStart);
        if (href && href !== label && href !== `mailto:${label}`) out += ` (${href})`;
        href = null;
      } else if (name === 'ul' || name === 'ol') {
        lists.pop();
        gap(2);
      } else if (name === 'li') gap(1);
      else if (['p', 'h2', 'h3', 'blockquote', 'pre'].includes(name)) gap(2);
      continue;
    }
    if (name === 'br') out += '\n';
    else if (name === 'hr') {
      gap(2);
      out += '---';
      gap(2);
    } else if (name === 'ul' || name === 'ol') {
      gap(lists.length ? 1 : 2);
      lists.push({ ordered: name === 'ol', count: 0 });
    } else if (name === 'li') {
      const list = lists[lists.length - 1];
      gap(1);
      if (list) {
        list.count += 1;
        out += `${'  '.repeat(lists.length - 1)}${list.ordered ? `${list.count}.` : '•'} `;
      }
    } else if (name === 'a') {
      const match = /href="([^"]*)"/i.exec(attrs);
      href = match ? decodeEntities(match[1]) : '';
      linkStart = out.length;
    }
  }
  return out.replace(/[ \t]+\n/g, '\n').trim();
}

/** How many characters a reader sees: what the limits on a field count, never the markup. */
export const richTextLength = (html: string) => [...toPlainText(html)].length;

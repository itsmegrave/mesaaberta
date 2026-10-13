import { find } from 'linkifyjs';

export type BodyPart =
  { kind: 'text'; text: string } | { kind: 'link'; text: string; href: string };

const WEB = /^https?:\/\//i;

/**
 * Splits a plain message body into text and web links, for the page to render as text and anchors.
 * Only http and https addresses become links; anything else (a `javascript:` string, an email) stays
 * text. The result is never markup.
 */
export function linkifyBody(body: string): BodyPart[] {
  const parts: BodyPart[] = [];
  let cursor = 0;
  for (const found of find(body, 'url')) {
    if (!WEB.test(found.href)) continue;
    if (found.start > cursor) parts.push({ kind: 'text', text: body.slice(cursor, found.start) });
    parts.push({ kind: 'link', text: found.value, href: found.href });
    cursor = found.end;
  }
  if (cursor < body.length) parts.push({ kind: 'text', text: body.slice(cursor) });
  return parts;
}

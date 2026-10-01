import { z } from 'zod';
import '$lib/forms/zod-codes';
import { cleanRichHtml, richTextLength } from './rich';

/** The stored HTML may be this many times the visible limit, so formatting never eats the text. */
export const RICH_HTML_FACTOR = 6;

/**
 * A rich-text field: cleaned to the allowed HTML, then limited by what a reader sees (`max`) and,
 * as a hard cap, by the size of what is stored. The database checks mirror the cap.
 */
export const richText = (max: number) =>
  z
    .string()
    .transform(cleanRichHtml)
    .superRefine((html, ctx) => {
      if (richTextLength(html) > max || html.length > max * RICH_HTML_FACTOR) {
        ctx.addIssue({
          code: 'too_big',
          origin: 'string',
          maximum: max,
          inclusive: true,
          input: html,
        });
      }
    });

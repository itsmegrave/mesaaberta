import { marked } from 'marked';
import { z } from 'zod';

// The changelog: one Markdown file per release in `src/content/changelog/`, written for players and
// GMs, not a commit log. See CONTRIBUTING.md for how to write one.

/** The only sections an entry may have, in the order the page shows them. */
export const SECTIONS = {
  Adicionado: 'added',
  Alterado: 'changed',
  Corrigido: 'fixed',
} as const;

export type SectionKind = (typeof SECTIONS)[keyof typeof SECTIONS];

export type ChangelogEntry = {
  /** The file name without `.md`: stable, and unique across entries. */
  slug: string;
  /** The release day, `YYYY-MM-DD`. */
  date: string;
  title: string;
  /** Shown only in development and to admins, so an entry can be previewed before it goes out. */
  draft: boolean;
  /** Rendered text before the first section, if any. */
  summary: string;
  sections: { kind: SectionKind; html: string }[];
};

const frontmatterSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
    .refine((value) => {
      const day = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(day.getTime()) && day.toISOString().startsWith(value);
    }, 'date is not a real day'),
  title: z.string().trim().min(1, 'title is required'),
  draft: z.enum(['true', 'false']).default('false'),
});

const render = (markdown: string) => marked.parse(markdown.trim(), { async: false }).trim();

/** Splits `---` frontmatter of flat `key: value` lines from the body. */
function splitFrontmatter(raw: string) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) throw new Error('missing frontmatter');
  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const at = line.indexOf(':');
    if (at < 1) throw new Error(`bad frontmatter line "${line}"`);
    const value = line
      .slice(at + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/, '$2');
    fields[line.slice(0, at).trim()] = value;
  }
  return { fields, body: match[2] };
}

/**
 * One entry from its file. Throws, naming the file, on anything the page could not show right: a
 * bad date, no title, a section other than Adicionado, Alterado and Corrigido, or nothing to say.
 */
export function parseEntry(slug: string, raw: string): ChangelogEntry {
  try {
    const { fields, body } = splitFrontmatter(raw);
    const meta = frontmatterSchema.parse(fields);

    // `## Heading` lines cut the body into sections; anything before the first is the summary.
    const [intro, ...rest] = body.split(/^##[ \t]+(.+?)[ \t]*$/m);
    const sections: ChangelogEntry['sections'] = [];
    for (let i = 0; i < rest.length; i += 2) {
      const heading = rest[i];
      const kind = SECTIONS[heading as keyof typeof SECTIONS];
      if (!kind) {
        throw new Error(`unknown section "${heading}" (use ${Object.keys(SECTIONS).join(', ')})`);
      }
      if (sections.some((section) => section.kind === kind)) {
        throw new Error(`section "${heading}" appears twice`);
      }
      const html = render(rest[i + 1] ?? '');
      if (!html) throw new Error(`section "${heading}" is empty`);
      sections.push({ kind, html });
    }
    const order = Object.values(SECTIONS);
    sections.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));

    const summary = render(intro);
    if (!summary && sections.length === 0) throw new Error('the entry says nothing');

    return {
      slug,
      date: meta.date,
      title: meta.title,
      draft: meta.draft === 'true',
      summary,
      sections,
    };
  } catch (cause) {
    const reason = cause instanceof z.ZodError ? cause.issues[0].message : (cause as Error).message;
    throw new Error(`changelog/${slug}.md: ${reason}`, { cause });
  }
}

/** Every entry from `{ path: raw }`, newest first; entries of the same day keep file-name order, newest name first. */
export function parseEntries(files: Record<string, string>): ChangelogEntry[] {
  return Object.entries(files)
    .map(([path, raw]) => parseEntry(path.replace(/^.*\//, '').replace(/\.md$/, ''), raw))
    .sort((a, b) => b.date.localeCompare(a.date) || b.slug.localeCompare(a.slug));
}

/** How many entries one page (one request) carries. */
export const PAGE_SIZE = 15;

/**
 * The `pagina` asked for, as a page number: missing or not a positive whole number reads as the
 * first page. Past the last page is `null`, a page that does not exist.
 */
export function pageOf(param: string | null, total: number, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(total / size));
  const asked = param && /^\d+$/.test(param) ? Number(param) : 1;
  const page = asked < 1 ? 1 : asked;
  return page > pages ? null : { page, pages, start: (page - 1) * size, end: page * size };
}

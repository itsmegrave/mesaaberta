import { z } from 'zod';

// Blog posts are Markdown files in `src/content/blog/`, named by their address (`por-que-um-blog.md`
// is /blog/por-que-um-blog), with a small frontmatter block on top. This module reads and checks
// them; rendering the Markdown happens on the server (`#lib/server/blog`).

export const PAGE_SIZE = 10;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const realDay = (value: string) =>
  DAY.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

const frontmatterSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    date: z.string().refine(realDay, 'expected a real YYYY-MM-DD day'),
    summary: z.string().trim().min(1).max(300),
    // The member who wrote it, by @username (without the @): the post links to their profile.
    author: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    tags: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
    draft: z.boolean().default(false),
  })
  .strict();

export type PostMeta = z.infer<typeof frontmatterSchema> & { slug: string; minutes: number };
export type Post = PostMeta & { body: string };

/** One frontmatter value: a quoted or plain string, `true`/`false`, or a `[a, b]` list. */
function value(raw: string): unknown {
  const text = raw.trim();
  if (text === 'true' || text === 'false') return text === 'true';
  if (text.startsWith('[') && text.endsWith(']'))
    return text
      .slice(1, -1)
      .split(',')
      .map((item) => value(item))
      .filter((item) => item !== '');
  const quoted = /^"(.*)"$|^'(.*)'$/.exec(text);
  return quoted ? (quoted[1] ?? quoted[2]) : text;
}

/** Splits `---\nkey: value\n---\nbody` into its fields and the Markdown body. */
export function splitFrontmatter(source: string): {
  fields: Record<string, unknown>;
  body: string;
} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source);
  if (!match) throw new Error('missing the --- frontmatter block');
  const fields: Record<string, unknown> = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const pair = /^([a-z]+):(.*)$/.exec(line);
    if (!pair) throw new Error(`frontmatter line is not "key: value": ${line}`);
    if (pair[1] in fields) throw new Error(`frontmatter repeats "${pair[1]}"`);
    fields[pair[1]] = value(pair[2]);
  }
  return { fields, body: match[2].trim() };
}

/** Reads one post file; a broken file throws an error naming it, which fails the tests and build. */
export function parsePost(path: string, source: string): Post {
  const slug = path.split('/').pop()!.replace(/\.md$/, '');
  try {
    if (!SLUG.test(slug)) throw new Error('the file name must be the address: a-z, 0-9 and -');
    const { fields, body } = splitFrontmatter(source);
    const result = frontmatterSchema.safeParse(fields);
    if (!result.success)
      throw new Error(
        result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
      );
    if (!body) throw new Error('the post has no text');
    // About 200 words a minute, never less than one.
    const minutes = Math.max(1, Math.round(body.split(/\s+/).length / 200));
    return { ...result.data, slug, minutes, body };
  } catch (error) {
    throw new Error(`blog post ${path}: ${(error as Error).message}`, { cause: error });
  }
}

/** Every post, newest first (by date, then title); two files can't share an address. */
export function loadPosts(files: Record<string, string>): Post[] {
  return Object.entries(files)
    .map(([path, source]) => parsePost(path, source))
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'pt-BR'));
}

/** Published: not a draft and its day has come (UTC), so a post can be scheduled. */
export const isPublished = (post: PostMeta, today = new Date().toISOString().slice(0, 10)) =>
  !post.draft && post.date <= today;

export function postPage(posts: PostMeta[], requestedPage: string | null) {
  const page = requestedPage && /^[1-9]\d*$/.test(requestedPage) ? Number(requestedPage) : 1;
  const pages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  return { page, pages, posts: posts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) };
}

export const blogHref = (page: number): `/blog${string}` =>
  page > 1 ? `/blog?page=${page}` : '/blog';

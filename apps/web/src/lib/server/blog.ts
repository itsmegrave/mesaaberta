import { Marked, type Tokens } from 'marked';
import { cleanRichHtml } from '@mesaaberta/core/text/rich';
import { can } from '@mesaaberta/core/server/auth/policy';
import { isPublished, loadPosts, type Post } from '#lib/blog.js';

// The posts are read at build time, so the Markdown never reaches the browser bundle. They come from
// the private repository, whose overlay copies them into this folder; the public repo ships none.
const files = import.meta.glob<string>('../../content/blog/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});
export const posts: Post[] = loadPosts(files);

/** What this visitor may read: published posts, plus drafts and scheduled posts for admins. */
export async function visiblePosts(locals: App.Locals, all: Post[] = posts) {
  const profile = await locals.getProfile().catch(() => null);
  const admin = !!profile && can(profile, 'admin:access');
  return { admin, posts: admin ? all : all.filter((post) => isPublished(post)) };
}

/**
 * The post's Markdown as the rich-text subset that `RichText` shows. The page's title is the h1,
 * so `#` and `##` become h2 and anything deeper h3; site links (`/t`) become absolute, because the
 * subset only keeps http, https and mailto addresses. Images and tables are not part of it yet.
 */
export function renderPost(body: string, origin: string): string {
  const markdown = new Marked({
    async: false,
    gfm: true,
    walkTokens(token) {
      if (token.type === 'heading') {
        const heading = token as Tokens.Heading;
        heading.depth = heading.depth <= 2 ? 2 : 3;
      }
      if (token.type === 'link') {
        const link = token as Tokens.Link;
        if (link.href.startsWith('/') && !link.href.startsWith('//'))
          link.href = new URL(link.href, origin).href;
      }
    },
  });
  return cleanRichHtml(markdown.parse(body) as string);
}

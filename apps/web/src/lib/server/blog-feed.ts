import { escapeHtml } from '@mesaaberta/core/text/rich';
import { isPublished, type PostMeta } from '#lib/blog.js';
import { m } from '#lib/paraglide/messages.js';
import { posts as allPosts } from './blog.js';

/** RSS 2.0 for /blog/rss.xml: the newest 20 published posts, with their summaries. */
export function blogFeed(origin: string, posts: PostMeta[] = allPosts, today?: string): string {
  const blog = new URL('/blog', origin).href;
  const items = posts
    .filter((post) => isPublished(post, today))
    .slice(0, 20)
    .map((post) => {
      const link = new URL(`/blog/${post.slug}`, origin).href;
      return [
        '<item>',
        `<title>${escapeHtml(post.title)}</title>`,
        `<link>${link}</link>`,
        `<guid isPermaLink="true">${link}</guid>`,
        `<pubDate>${new Date(`${post.date}T12:00:00Z`).toUTCString()}</pubDate>`,
        `<description>${escapeHtml(post.summary)}</description>`,
        ...post.tags.map((tag) => `<category>${escapeHtml(tag)}</category>`),
        '</item>',
      ].join('');
    });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>',
    `<title>${escapeHtml(m.blog_feed_title())}</title>`,
    `<link>${blog}</link>`,
    `<atom:link href="${blog}/rss.xml" rel="self" type="application/rss+xml"/>`,
    `<description>${escapeHtml(m.blog_description())}</description>`,
    '<language>pt-BR</language>',
    ...items,
    '</channel></rss>',
  ].join('');
}

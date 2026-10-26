import { error } from '@sveltejs/kit';
import { siteOf } from '@mesaaberta/core/server/site';
import { isPublished } from '#lib/blog.js';
import { renderPost, visiblePosts } from '#lib/server/blog.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
  const { posts } = await visiblePosts(locals);
  const post = posts.find((candidate) => candidate.slug === params.slug);
  if (!post) error(404);
  const { body, ...meta } = post;
  return {
    post: {
      ...meta,
      // Drafts and scheduled posts (only admins get them) stay out of search engines.
      unpublished: !isPublished(post),
      html: renderPost(body, siteOf(locals.env, locals.log).APP_ORIGIN),
    },
  };
};

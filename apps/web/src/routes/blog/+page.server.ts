import { error } from '@sveltejs/kit';
import { postPage } from '#lib/blog.js';
import { visiblePosts } from '#lib/server/blog.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const { admin, posts } = await visiblePosts(locals);
  const data = postPage(
    posts.map(({ body, ...meta }) => meta),
    url.searchParams.get('page'),
  );
  if (data.page > data.pages) error(404);
  return { ...data, admin };
};

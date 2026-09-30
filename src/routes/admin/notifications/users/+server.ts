import { error, json } from '@sveltejs/kit';
import { searchRecipients } from '$lib/server/notifications/announcements';
import type { RequestHandler } from './$types';

/** Usernames for the recipient field's suggestions. Admins only, like everything under /admin. */
export const GET: RequestHandler = async ({ locals, url }) => {
  if (!(await locals.getUser())) error(401, 'Sign in first');
  if (!locals.db) error(503, 'Database not configured');

  const people = await searchRecipients(locals.db, url.searchParams.get('q') ?? '');
  return json(people.map((person) => person.username));
};

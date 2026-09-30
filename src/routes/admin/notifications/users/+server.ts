import { error, json } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/admin-access';
import { searchRecipients } from '$lib/server/notifications/announcements';
import type { RequestHandler } from './$types';

/** Usernames for the recipient field's suggestions. Admins only, like everything under /admin. */
export const GET: RequestHandler = async ({ locals, url }) => {
  await requireAdmin(locals);
  if (!locals.db) error(503, 'Database not configured');

  const people = await searchRecipients(locals.db, url.searchParams.get('q') ?? '');
  return json(people.map((person) => person.username));
};

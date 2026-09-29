import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import { pageOf } from '$lib/changelog/entries';
import { can } from '$lib/server/auth/policy';
import { changelog } from '$lib/server/changelog';
import type { PageServerLoad } from './$types';

/** Drafts are previews: seen while developing and by admins, never by everyone else. */
async function seesDrafts(locals: App.Locals) {
  if (dev) return true;
  try {
    const profile = await locals.getProfile();
    return profile ? can(profile, 'admin:access') : false;
  } catch {
    return false;
  }
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const entries = (await seesDrafts(locals)) ? changelog : changelog.filter((e) => !e.draft);

  const at = pageOf(url.searchParams.get('page'), entries.length);
  if (!at) error(404, 'Página não encontrada');

  // Only this page's entries go to the browser.
  return { entries: entries.slice(at.start, at.end), page: at.page, pages: at.pages };
};

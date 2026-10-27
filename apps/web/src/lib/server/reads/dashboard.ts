import { listReceivedInvitations } from '#lib/server/invitations/api.js';
import { requireUser } from '#lib/server/auth/guard.js';
import type { readDashboard } from '@mesaaberta/core/server/reads/dashboard';
import type { RequestEvent } from '@sveltejs/kit';
import { readFromApi } from '../api-read';

export { DASHBOARD_PAGE_SIZE } from '@mesaaberta/core/server/reads/dashboard';

type Dashboard = NonNullable<Awaited<ReturnType<typeof readDashboard>>>;

/**
 * Every table I play in and every table I run, whatever its status, a page at a time (see the
 * shared reader), from the api Worker. A page past the last is the api's 404, which becomes the page's.
 */
export const read = async ({ locals, url }: RequestEvent) => {
  const user = await requireUser(locals, url);
  const page = url.searchParams.get('page');
  const remote = await readFromApi<Dashboard>(
    locals,
    user.id,
    `/v1/reads/dashboard${page === null ? '' : `?page=${encodeURIComponent(page)}`}`,
  );
  // JSON turned the start dates into strings; the page gets them as dates.
  const revive = <T extends { startsAt: Date }>(items: T[]) =>
    items.map((item) => ({ ...item, startsAt: new Date(item.startsAt) }));
  const dashboard = { ...remote, playing: revive(remote.playing), running: revive(remote.running) };
  const profile = await locals.getProfile().catch(() => null);
  return { ...dashboard, invitations: await listReceivedInvitations(locals, profile) };
};

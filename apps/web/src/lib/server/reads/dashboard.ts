import { error } from '@sveltejs/kit';
import { listReceivedInvitations } from '#lib/server/invitations/api.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { readDashboard } from '@mesaaberta/core/server/reads/dashboard';
import type { RequestEvent } from '@sveltejs/kit';
import { readViaApi } from '../api-read';

export { DASHBOARD_PAGE_SIZE } from '@mesaaberta/core/server/reads/dashboard';

type Dashboard = NonNullable<Awaited<ReturnType<typeof readDashboard>>>;

/**
 * Every table I play in and every table I run, whatever its status, a page at a time (see the
 * shared reader). Through the api Worker when `api_reads_dashboard` is on for me; here otherwise,
 * which is also where a page past the last ends in the page's own 404.
 */
export const read = async ({ locals, url }: RequestEvent) => {
  const user = await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');

  const profile = await locals.getProfile().catch(() => null);
  const page = url.searchParams.get('page');
  const remote = profile
    ? await readViaApi<Dashboard>(
        locals,
        'api_reads_dashboard',
        profile,
        `/v1/reads/dashboard${page === null ? '' : `?page=${encodeURIComponent(page)}`}`,
      )
    : null;
  // JSON turned the start dates into strings; the page gets them as dates either way.
  const revive = <T extends { startsAt: Date }>(items: T[]) =>
    items.map((item) => ({ ...item, startsAt: new Date(item.startsAt) }));
  const dashboard = remote
    ? { ...remote, playing: revive(remote.playing), running: revive(remote.running) }
    : await readDashboard(locals.db, user.id, page, new Date());
  if (!dashboard) error(404, 'Not found');
  return { ...dashboard, invitations: await listReceivedInvitations(locals, profile) };
};

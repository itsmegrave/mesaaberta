import { error, json } from '@sveltejs/kit';
import { platformOf } from '$lib/crowdfunding/platforms';
import { normalizeCampaignUrl } from '$lib/crowdfunding/url';
import { can } from '$lib/server/auth/policy';
import { readLinkPreview } from '$lib/server/crowdfunding/link-preview';
import type { AnyDb } from '$lib/server/db/client';
import { RateLimited } from '$lib/server/errors';
import { recordEvent } from '$lib/server/events/outbox';
import { enforceRateLimit, LINK_READ_LIMIT } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

/**
 * What the add form asks once a link is typed: the campaign's name (from the page's title) and
 * platform, to fill the fields. Only a signed-in member may ask, since it makes this server fetch
 * an address, and each ask counts against LINK_READ_LIMIT. A page that cannot be read answers with
 * no name: the member types it.
 */
export const GET: RequestHandler = async ({ locals, url, setHeaders }) => {
  const actor = await locals.getProfile();
  if (!actor || !can(actor, 'crowdfunding:add')) error(401, 'Sign in first');
  if (!locals.db) error(503, 'Database not configured');
  const link = normalizeCampaignUrl(url.searchParams.get('url') ?? '');
  if (!link) return json({ url: null, title: null, platform: 'other' }, { status: 400 });

  // The limit is taken before the fetch, under a lock, so simultaneous asks cannot all slip through.
  try {
    await locals.db.transaction(async (tx) => {
      const t = tx as unknown as AnyDb;
      await enforceRateLimit(t, actor.id, LINK_READ_LIMIT);
      await recordEvent(t, { type: 'CrowdfundingLinkRead', actorId: actor.id, payload: {} });
    });
  } catch (cause) {
    if (!(cause instanceof RateLimited)) throw cause;
    setHeaders({ 'Retry-After': String(cause.retryAfterSeconds) });
    return json({ url: link, title: null, platform: platformOf(link) }, { status: 429 });
  }

  const { title } = await readLinkPreview(link);
  return json(
    { url: link, title, platform: platformOf(link) },
    { headers: { 'cache-control': 'private, no-store' } },
  );
};

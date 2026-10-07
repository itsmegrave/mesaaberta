import { error, json } from '@sveltejs/kit';
import { platformOf } from '$lib/crowdfunding/platforms';
import { normalizeCampaignUrl } from '$lib/crowdfunding/url';
import { can } from '$lib/server/auth/policy';
import { readLinkPreview } from '$lib/server/crowdfunding/link-preview';
import type { RequestHandler } from './$types';

/**
 * What the add form asks once a link is typed: the campaign's name (from the page's title) and
 * platform, to fill the fields. Only a signed-in member may ask, since it makes this server fetch
 * an address, and a page that cannot be read answers with no name: the member types it.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  if (!can(await locals.getProfile(), 'crowdfunding:add')) error(401, 'Sign in first');
  const link = normalizeCampaignUrl(url.searchParams.get('url') ?? '');
  if (!link) return json({ url: null, title: null, platform: 'other' }, { status: 400 });

  const { title } = await readLinkPreview(link);
  return json(
    { url: link, title, platform: platformOf(link) },
    { headers: { 'cache-control': 'private, no-store' } },
  );
};

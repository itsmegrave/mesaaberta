import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { initialForm, validateStringForm } from '#lib/forms/contract.js';
import { formMessage } from '#lib/forms/server.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { can } from '@mesaaberta/core/server/auth/policy';
import type { Actions, PageServerLoad } from './$types';

// Supabase's own id for the request it sent here; never shown, only handed back.
const consentSchema = z.object({ authorizationId: z.string().min(1).max(200) });

/**
 * Whether the MCP (and so this page) is open to the signed-in person. Admins only, always: that is
 * a requirement, not a rollout, so it is checked here and `use_mcp` is only the kill switch.
 */
async function mcpEnabled(locals: App.Locals) {
  const profile = await locals.getProfile();
  if (!profile || !can(profile, 'admin:access')) return false;
  return locals.flags.isEnabled('use_mcp', { id: profile.id, isAdmin: true });
}

/**
 * The consent step of Supabase's OAuth 2.1 server (its "Authorization Path"): an MCP client such
 * as Claude asked to read the site as the signed-in person, and Supabase sent them here with an
 * `authorization_id`. The page names the client and where the person goes back to; approving
 * makes Supabase issue that client a token for this person, denying tells the client no. Both are
 * Supabase Auth calls with the person's own session, with no database write, so they stay in web.
 */
export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
  setHeaders({ 'cache-control': 'private, no-store' });
  await requireUser(locals, url);
  if (!(await mcpEnabled(locals))) error(404, 'Not found');
  const authorizationId = url.searchParams.get('authorization_id') ?? '';
  if (!locals.supabase || !consentSchema.safeParse({ authorizationId }).success)
    return { request: null };

  const { data, error: refused } =
    await locals.supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (refused || !data) {
    locals.log.info('oauth.consent_unavailable', { code: 'authorization_unknown' });
    return { request: null };
  }
  // Already approved for this client: Supabase answers where to send the person straight away.
  if (!('authorization_id' in data)) redirect(303, data.redirect_url, { external: true });

  const profile = await locals.getProfile();
  return {
    request: {
      client: data.client.name,
      // The host only: the full address carries nothing a person can check.
      returnsTo: hostOf(data.redirect_uri),
      username: profile?.username ?? '',
    },
    form: initialForm({ authorizationId: data.authorization_id }),
  };
};

const hostOf = (address: string) => {
  try {
    return new URL(address).host;
  } catch {
    return '';
  }
};

/** Approves or denies, then sends the person back to the client with Supabase's answer. */
const decide =
  (decision: 'approve' | 'deny') =>
  async ({ locals, request, url }: Parameters<Actions[string]>[0]) => {
    await requireUser(locals, url);
    if (!(await mcpEnabled(locals))) error(404, 'Not found');
    const form = validateStringForm(await request.formData(), consentSchema, ['authorizationId']);
    if (!form.valid || !locals.supabase) return fail(400, { form });
    const oauth = locals.supabase.auth.oauth;
    const { data, error: refused } =
      decision === 'approve'
        ? await oauth.approveAuthorization(form.data.authorizationId, { skipBrowserRedirect: true })
        : await oauth.denyAuthorization(form.data.authorizationId, { skipBrowserRedirect: true });
    if (refused || !data?.redirect_url) {
      locals.log.warn('oauth.consent_failed', { code: 'consent_refused', outcome: decision });
      return formMessage(form, { code: 'expired' }, { status: 400 });
    }
    locals.log.info('oauth.consent_decided', { outcome: decision });
    // Supabase built it from the client's registered redirect URI (claude.ai, a localhost port).
    redirect(303, data.redirect_url, { external: true });
  };

export const actions: Actions = { approve: decide('approve'), deny: decide('deny') };

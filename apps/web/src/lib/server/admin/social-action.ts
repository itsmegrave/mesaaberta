import { error, fail } from '@sveltejs/kit';
import { can } from '@mesaaberta/core/server/auth/policy';
import { socialFor, type SocialEnv } from '@mesaaberta/core/server/social/index';
import type { RequestEvent } from '@sveltejs/kit';
import { requireApi } from '../api-required';
import { extensionAction } from './extension-api';

export const publishSocialAction = async ({ locals, request }: RequestEvent) => {
  const profile = await locals.getProfile();
  if (!can(profile, 'admin:access')) error(404);
  const form = await request.formData();
  const tableId = String(form.get('tableId') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(tableId)) return fail(400, { publishError: 'invalid' });
  try {
    const social = socialFor(locals.env as SocialEnv);
    // Queued by the api Worker, which then renders and publishes after its answer.
    const answer = await extensionAction(locals, social.name, profile!.id, 'queue', { tableId });
    if ('invalid' in answer) return fail(400, { publishError: 'invalid' });
    const result = answer.result as Awaited<ReturnType<typeof social.queueTable>>;
    if (result === 'queued')
      await requireApi(locals, profile, '/v1/admin/social/publish', {
        method: 'POST',
        body: { tableId },
      });
    return { publishResult: result };
  } catch (cause) {
    // Network and api errors can include credentials or bound values. Log only safe codes.
    locals.log.error('social.publish_failed', {
      tableId,
      errorType: cause instanceof Error ? cause.name : 'unknown',
      code: (cause as { code?: number } | null)?.code,
    });
    return fail(502, { publishError: 'failed' });
  }
};

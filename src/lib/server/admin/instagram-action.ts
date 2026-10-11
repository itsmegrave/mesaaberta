import { error, fail } from '@sveltejs/kit';
import { can } from '$lib/server/auth/policy';
import { InstagramError, type InstagramEnv } from '$lib/server/instagram/api';
import { socialFor, type SocialEnv } from '$lib/server/social';
import type { RequestEvent } from '@sveltejs/kit';

export const publishInstagramAction = async ({ locals, platform, request }: RequestEvent) => {
  if (!can(await locals.getProfile(), 'admin:access')) error(404);
  if (!locals.db) error(503);
  const form = await request.formData();
  const tableId = String(form.get('tableId') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(tableId)) return fail(400, { publishError: 'invalid' });
  try {
    const env = platform?.env as InstagramEnv & SocialEnv;
    const social = socialFor(env);
    const result = await social.queueTable(locals.db, env, tableId);
    if (result === 'queued')
      locals.afterResponse(async (db) => {
        const useTableImage = await locals.flags.isEnabled('use_table_image');
        // Background failures are recorded on the durable job; never log Meta payloads.
        try {
          await social.publishTable(db, env, tableId, new Date(), { useTableImage });
        } catch {
          locals.log.error('instagram.background_publish_failed', { tableId });
        }
      });
    return { publishResult: result };
  } catch (cause) {
    // Meta and database errors can include credentials or bound values. Log only safe codes.
    const dbCode = (cause as { cause?: { code?: string } } | null)?.cause?.code;
    locals.log.error('instagram.publish_failed', {
      tableId,
      errorType: cause instanceof Error ? cause.name : 'unknown',
      code: cause instanceof InstagramError ? cause.code : dbCode,
    });
    return fail(502, { publishError: 'failed' });
  }
};

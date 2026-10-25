import { error, fail } from '@sveltejs/kit';
import { can } from '@mesaaberta/core/server/auth/policy';
import { socialFor, type SocialEnv } from '@mesaaberta/core/server/social/index';
import type { RequestEvent } from '@sveltejs/kit';
import { extensionViaApi } from './extension-api';

export const publishInstagramAction = async ({ locals, request }: RequestEvent) => {
  if (!can(await locals.getProfile(), 'admin:access')) error(404);
  if (!locals.db) error(503);
  const form = await request.formData();
  const tableId = String(form.get('tableId') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(tableId)) return fail(400, { publishError: 'invalid' });
  try {
    const env = locals.env as SocialEnv;
    const social = socialFor(env);
    // Queued by the api Worker when `api_admin_instagram` is on; here otherwise. Either way the
    // render and the publish run in the background after this response.
    const profile = await locals.getProfile();
    const remote = profile
      ? await extensionViaApi(locals, 'instagram', profile.id, 'queue', { tableId })
      : null;
    if (remote && 'invalid' in remote) return fail(400, { publishError: 'invalid' });
    const result =
      typeof remote?.result === 'string'
        ? (remote.result as Awaited<ReturnType<typeof social.queueTable>>)
        : await social.queueTable(locals.db, env, tableId);
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
      code: (cause as { code?: number } | null)?.code ?? dbCode,
    });
    return fail(502, { publishError: 'failed' });
  }
};

import { error, fail } from '@sveltejs/kit';
import { validateFormData } from '#lib/forms/contract.js';
import { requireUser } from '../auth/guard';
import { failFrom } from '../fail-from';
import { followSchema } from '@mesaaberta/core/follows/schema';
import { Forbidden } from '@mesaaberta/core/server/errors';
import { dispatchEvent } from '@mesaaberta/core/server/events/dispatcher';
import { handlersFor } from '@mesaaberta/core/server/events/handlers';
import { follow, unfollow } from '@mesaaberta/core/server/follows/service';
import { followsEnabled } from './state';

/**
 * The Seguir / Seguindo button, wherever it is (a profile, a table's GM row, "Seguindo"): follows
 * or stops following `profileId` as the signed-in person. A visitor is sent to log in and back.
 */
export async function followAction({
  locals,
  url,
  request,
}: {
  locals: App.Locals;
  url: URL;
  request: Request;
}) {
  const user = await requireUser(locals, new URL(url.pathname, url));
  if (!locals.db) error(503, 'Database not configured');
  const form = validateFormData(await request.formData(), followSchema, {
    profileId: '',
    follow: 'true',
  });
  if (!form.valid) return fail(400, { form });

  try {
    const profile = await locals.getProfile();
    if (!(await followsEnabled(locals, profile))) throw new Forbidden('use_follows');
    if (form.data.follow === 'false') {
      await unfollow(locals.db, user.id, form.data.profileId);
      return { form };
    }
    const { eventIds } = await follow(locals.db, profile, form.data.profileId);
    for (const id of eventIds)
      locals.afterResponse((db) =>
        dispatchEvent(db, handlersFor(locals.env), id, new Date(), locals.log),
      );
    return { form };
  } catch (cause) {
    return failFrom(cause);
  }
}

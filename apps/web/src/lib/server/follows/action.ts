import { fail } from '@sveltejs/kit';
import { validateFormData } from '#lib/forms/contract.js';
import { writeViaApi } from '../api-write';
import { requireUser } from '../auth/guard';
import { failFrom } from '../fail-from';
import { followSchema } from '@mesaaberta/core/follows/schema';
import { Forbidden } from '@mesaaberta/core/server/errors';
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
  const form = validateFormData(await request.formData(), followSchema, {
    profileId: '',
    follow: 'true',
  });
  if (!form.valid) return fail(400, { form });

  try {
    const profile = await locals.getProfile();
    if (!(await followsEnabled(locals, profile))) throw new Forbidden('use_follows');
    // The api follows or stops following; a new follow comes back with its event.
    await writeViaApi(locals, user, `/v1/follows/${encodeURIComponent(form.data.profileId)}`, {
      follow: form.data.follow === 'true',
    });
    return { form };
  } catch (cause) {
    return failFrom(cause);
  }
}

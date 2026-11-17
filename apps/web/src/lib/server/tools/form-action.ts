import { safeNext } from '@mesaaberta/core/server/auth/safe-next';
import { onboardingUrl } from '@mesaaberta/core/server/auth/onboarding';
import { fail, redirect } from '@sveltejs/kit';
import { validateFormData } from '#lib/forms/contract.js';
import { formMessage, refuse, responseForm } from '#lib/forms/server.js';
import { NEW_TOOL_VALUES, toolFormSchema } from '@mesaaberta/core/tools/schema';
import { Forbidden, Invalid, NotFound } from '@mesaaberta/core/server/errors';
import { AVATAR_BUCKET, prepareImage, storeImage } from '@mesaaberta/core/server/images';
import { isInside, serverStorage } from '@mesaaberta/core/server/storage';
import { writeViaApi } from '../api-write';

type Event = {
  request: Request;
  locals: App.Locals;
  url: URL;
};

/**
 * "Sugerir ferramenta" and the admin's "Editar ferramenta": check who is asking, validate the form,
 * store the logo (in the avatar bucket, under `tools/<their id>/`) and save. A suggestion waits for
 * an admin; an admin's edit keeps the tool where it was. The permission itself is the policy's,
 * inside the service. Every failure answers with what the person typed.
 */
export async function handleToolForm(
  { request, locals, url }: Event,
  { id, done }: { id?: string; done: string },
) {
  if (!(await locals.getUser())) {
    redirect(303, `/login?next=${encodeURIComponent(safeNext(url.pathname + url.search))}`);
  }
  if (!(await locals.getProfile())?.username) {
    redirect(303, onboardingUrl(url.pathname + url.search));
  }

  const data = await request.formData();
  // Files are allowed so the schema can check the logo; every failure below strips them.
  const form = validateFormData(data, toolFormSchema, NEW_TOOL_VALUES, {
    arrays: ['kinds'],
    files: ['logo'],
  });
  if (!form.valid) return fail(400, { form: responseForm(form) });

  let replacedLogo: string | null = null;
  try {
    const actor = await locals.getProfile();
    if (!actor) throw new Forbidden();
    const { logo, ...input } = form.data;

    let logoPath: string | null = null;
    if (logo) {
      const prepared = await prepareImage(logo, `tools/${actor.id}`);
      const storage = serverStorage(locals.env, AVATAR_BUCKET);
      if (!storage) throw new Invalid('image', 'upload_failed');
      logoPath = await storeImage(storage, prepared, locals.log);
    }

    const written = await writeViaApi(
      locals,
      actor,
      id ? `/v1/submissions/tools/${encodeURIComponent(id)}` : '/v1/submissions/tools',
      { input, logoPath },
    );
    if (typeof written.body.replacedLogo === 'string') replacedLogo = written.body.replacedLogo;
  } catch (error) {
    if (error instanceof Invalid) {
      // The upload errors are about "the image"; on this form that field is the logo.
      return refuse(form, 400, error.message, error.field === 'image' ? 'logo' : error.field);
    }
    if (error instanceof Forbidden)
      return formMessage(form, { code: 'forbidden' }, { status: 403 });
    if (error instanceof NotFound) return formMessage(form, { code: 'not_found' }, { status: 404 });
    throw error;
  }

  // The old logo is only deleted once the new one is saved, and never a seeded one (a site path).
  // Best effort: a leftover file is harmless.
  if (replacedLogo && isInside(replacedLogo, 'tools')) {
    const { error } =
      (await serverStorage(locals.env, AVATAR_BUCKET)?.remove([replacedLogo])) ?? {};
    if (error) locals.log.warn('storage.tool_logo_delete_failed', { error });
  }

  redirect(303, done);
}

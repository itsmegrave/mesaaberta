import { fail, redirect } from '@sveltejs/kit';
import { validateFormData } from '$lib/forms/contract';
import { formMessage, refuse, responseForm } from '$lib/forms/server';
import {
  editPartnerSchema,
  NEW_PARTNER_VALUES,
  newPartnerSchema,
} from '@mesaaberta/core/partners/schema';
import { Forbidden, Invalid, NotFound } from '@mesaaberta/core/server/errors';
import { dispatchEvent } from '@mesaaberta/core/server/events/dispatcher';
import { handlersFor } from '@mesaaberta/core/server/events/handlers';
import { AVATAR_BUCKET, prepareImage, storeImage } from '@mesaaberta/core/server/images';
import { addPartner, updatePartner } from '@mesaaberta/core/server/partners/service';
import { writeViaApi } from '../api-write';

type Event = {
  request: Request;
  locals: App.Locals;
  url: URL;
};

/**
 * "Quero ser parceiro" and "Editar parceiro": check who is asking, validate the form, store the logo
 * (in the avatar bucket, under `partners/<their id>/`) and save. The partner waits for an admin
 * either way: a new one is not listed yet, and an edit takes an approved one off the page until it
 * is approved again. The permission itself is the policy's, inside the service. Every failure
 * answers with what the person typed.
 */
export async function handlePartnerForm(
  { request, locals, url }: Event,
  { id }: { id?: string } = {},
) {
  if (!(await locals.getUser())) {
    redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
  }
  if (!(await locals.getProfile())?.username) {
    redirect(303, `/onboarding?next=${encodeURIComponent(url.pathname + url.search)}`);
  }

  const data = await request.formData();
  // Files are allowed so the schema can check the logo; every failure below strips them.
  const form = validateFormData(
    data,
    id ? editPartnerSchema : newPartnerSchema,
    NEW_PARTNER_VALUES,
    { arrays: ['linkNetwork', 'linkUrl'], files: ['logo'] },
  );
  if (!form.valid) return fail(400, { form: responseForm(form) });
  if (!locals.db) return formMessage(form, { code: 'unavailable' }, { status: 503 });
  const db = locals.db;

  let replacedLogo: string | null = null;
  try {
    const actor = await locals.getProfile();
    const { logo, ...input } = form.data;

    let logoPath: string | null = null;
    if (logo && actor) {
      const prepared = await prepareImage(logo, `partners/${actor.id}`);
      const storage = locals.supabase?.storage.from(AVATAR_BUCKET);
      if (!storage) throw new Invalid('image', 'upload_failed');
      logoPath = await storeImage(storage, prepared, locals.log);
    }

    if (!id && !logoPath) throw new Invalid('logo', 'required');
    // Through the api Worker when `api_submissions` is on for this person; here otherwise.
    const remote = actor
      ? await writeViaApi(
          locals,
          'api_submissions',
          actor,
          id ? `/v1/submissions/partners/${encodeURIComponent(id)}` : '/v1/submissions/partners',
          { input, logoPath },
        )
      : null;
    let eventId: string;
    if (remote) {
      eventId = remote.eventIds[0];
      if (typeof remote.body.replacedLogo === 'string') replacedLogo = remote.body.replacedLogo;
    } else if (id) {
      ({ eventId, replacedLogo } = await updatePartner(db, actor, id, input, { logoPath }));
    } else {
      ({ eventId } = await addPartner(db, actor, input, { logoPath: logoPath! }));
    }
    // After the commit and the response, so the visitor never waits for a handler.
    locals.afterResponse((db) =>
      dispatchEvent(db, handlersFor(locals.env), eventId, new Date(), locals.log),
    );
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

  // The old logo is only deleted once the new one is saved. Best effort: a leftover file is harmless.
  if (replacedLogo) {
    const { error } =
      (await locals.supabase?.storage.from(AVATAR_BUCKET).remove([replacedLogo])) ?? {};
    if (error) locals.log.warn('partner logo: could not delete the old file', { error });
  }

  redirect(303, '/partners?enviado=1');
}

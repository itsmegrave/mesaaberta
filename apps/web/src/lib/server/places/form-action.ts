import { fail, redirect } from '@sveltejs/kit';
import { validateFormData } from '#lib/forms/contract.js';
import { formMessage, refuse, responseForm } from '#lib/forms/server.js';
import { NEW_PLACE_VALUES, placeSchema, type PlaceFormInput } from '@mesaaberta/core/places/schema';
import { Forbidden, Invalid, NotFound, RateLimited } from '@mesaaberta/core/server/errors';
import { IMAGE_BUCKET, prepareImage, storeImage } from '@mesaaberta/core/server/images';
import { isInside, serverStorage } from '@mesaaberta/core/server/storage';
import { PlaceDuplicate } from '@mesaaberta/core/server/places/service';
import { writeViaApi } from '../api-write';

type Event = {
  request: Request;
  locals: App.Locals;
  setHeaders?: (headers: Record<string, string>) => void;
};

/**
 * "Cadastrar lugar" and "Editar lugar": validate the form, store the photo (in the table images
 * bucket, under `places/<their id>/`) and save. Who may send or edit is the policy's, inside the
 * service; the page has already sent visitors to log in. Every failure answers with what the person
 * typed. A place that waits for review goes to its page, which says so; an edit an admin or the
 * owner makes is live at once.
 */
export async function handlePlaceForm(
  { request, locals, setHeaders }: Event,
  { slug: editing }: { slug?: string } = {},
) {
  const data = await request.formData();
  // Files are allowed so the schema can check the photo; every failure below strips them.
  // A new form has no kind yet; the schema narrows it once it is picked.
  const empty = NEW_PLACE_VALUES as unknown as Partial<PlaceFormInput>;
  const form = validateFormData(data, placeSchema, empty, {
    arrays: ['amenities', 'linkNetwork', 'linkUrl'],
    files: ['image'],
  });
  if (!form.valid) return fail(400, { form: responseForm(form) });

  let slug: string;
  let replacedImage: string | null = null;
  try {
    const actor = await locals.getProfile();
    const { image, ...input } = form.data;

    let imagePath: string | null = null;
    if (image && actor) {
      const prepared = await prepareImage(image, `places/${actor.id}`);
      const storage = serverStorage(locals.env, IMAGE_BUCKET);
      if (!storage) throw new Invalid('image', 'upload_failed');
      imagePath = await storeImage(storage, prepared, locals.log);
    }

    if (!actor) throw new Forbidden();
    // The api saves it (a new place, or an edit by the place's slug) and answers its slug.
    const written = await writeViaApi(
      locals,
      actor,
      editing ? `/v1/places/${encodeURIComponent(editing)}` : '/v1/places',
      { input, imagePath },
    );
    slug = String(written.body.slug);
    if (typeof written.body.replacedImage === 'string') replacedImage = written.body.replacedImage;
  } catch (error) {
    if (error instanceof PlaceDuplicate) {
      return formMessage(
        form,
        { code: 'place_duplicate', ...(error.slug ? { href: `/pp/${error.slug}` } : {}) },
        { status: 409 },
      );
    }
    if (error instanceof Invalid) return refuse(form, 400, error.message, error.field);
    if (error instanceof Forbidden)
      return formMessage(form, { code: 'forbidden' }, { status: 403 });
    if (error instanceof NotFound) return formMessage(form, { code: 'not_found' }, { status: 404 });
    if (error instanceof RateLimited) {
      setHeaders?.({ 'Retry-After': String(error.retryAfterSeconds) });
      return formMessage(
        form,
        { code: 'rate_limited', retryAfter: error.retryAfterSeconds },
        { status: 429 },
      );
    }
    throw error;
  }

  // The old photo is only deleted once the new one is saved. Best effort: a leftover is harmless.
  if (replacedImage && isInside(replacedImage, 'places')) {
    const { error } =
      (await serverStorage(locals.env, IMAGE_BUCKET)?.remove([replacedImage])) ?? {};
    if (error) locals.log.warn('place photo: could not delete the old file', { error });
  }

  redirect(303, `/pp/${slug}?enviado=1`);
}

import { error, isHttpError } from '@sveltejs/kit';
import { initialForm } from '#lib/forms/contract.js';
import { can } from '@mesaaberta/core/server/auth/policy';
import { formatCep } from '@mesaaberta/core/location/cep';
import { MAX_PLACE_LINKS } from '@mesaaberta/core/places/types';
import { requireUser } from '#lib/server/auth/guard.js';
import { requireDirectory } from '#lib/server/directories/flags.js';
import { imageUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import type { findEditablePlace } from '@mesaaberta/core/server/places/service';
import { readFromApi, revivedDates } from '#lib/server/api-read.js';
import { handlePlaceForm } from '#lib/server/places/form-action.js';
import { placeTagOptions } from '#lib/server/places/tags.js';
import type { Actions, PageServerLoad } from './$types';

/** The place this person may edit; anything else (unknown, removed, somebody else's) is a 404. */
async function editable(locals: App.Locals, slug: string) {
  const profile = await locals.getProfile();
  if (!profile) error(404, 'Not found');
  try {
    const place = await readFromApi<Awaited<ReturnType<typeof findEditablePlace>>>(
      locals,
      profile.id,
      `/v1/places/${encodeURIComponent(slug)}/edit`,
    );
    return { profile, place: revivedDates(place) };
  } catch (cause) {
    if (isHttpError(cause) && (cause.status === 403 || cause.status === 404))
      error(404, 'Not found');
    throw cause;
  }
}

export const load: PageServerLoad = async ({ locals, url, params }) => {
  await requireDirectory(locals, 'places');
  await requireUser(locals, url);
  const { profile, place } = await editable(locals, params.slug);
  const links = place.links.slice(0, MAX_PLACE_LINKS);
  return {
    ...(await placeTagOptions(locals, profile.id, place.features)),
    slug: place.slug,
    imageUrl: imageUrl(supabaseUrlOf(locals.env), place.imagePath),
    // An admin's or the owner's edit is live at once; anyone else's goes back to the queue.
    reviewAgain: !(profile && can(profile, 'admin:access')) && profile?.id !== place.ownerId,
    approved: place.approvedAt !== null,
    form: initialForm({
      name: place.name,
      kind: place.kind as string,
      postalCode: formatCep(place.postalCode),
      street: place.street,
      complement: place.complement ?? '',
      description: place.description ?? '',
      openingHours: place.openingHours ?? '',
      tags: place.features.map((feature) => feature.slug),
      siteUrl: place.siteUrl ?? '',
      linkNetwork: links.map((link) => link.network as string),
      linkUrl: links.map((link) => link.url),
      removeImage: false,
      image: undefined,
    }),
  };
};

export const actions: Actions = {
  default: async (event) => {
    await requireDirectory(event.locals, 'places');
    await requireUser(event.locals, event.url);
    const { place } = await editable(event.locals, event.params.slug);
    return handlePlaceForm(event, { slug: place.slug });
  },
};

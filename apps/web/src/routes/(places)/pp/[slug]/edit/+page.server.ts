import { error } from '@sveltejs/kit';
import { initialForm } from '#lib/forms/contract.js';
import { can } from '@mesaaberta/core/server/auth/policy';
import { formatCep } from '@mesaaberta/core/location/cep';
import { MAX_PLACE_LINKS } from '@mesaaberta/core/places/types';
import { requireUser } from '#lib/server/auth/guard.js';
import { requireDirectory } from '#lib/server/directories/flags.js';
import { Forbidden, NotFound } from '@mesaaberta/core/server/errors';
import { imageUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { findEditablePlace } from '@mesaaberta/core/server/places/service';
import { handlePlaceForm } from '#lib/server/places/form-action.js';
import type { Actions, PageServerLoad } from './$types';

/** The place this person may edit; anything else (unknown, removed, somebody else's) is a 404. */
async function editable(locals: App.Locals, slug: string) {
  try {
    const profile = await locals.getProfile();
    return { profile, place: await findEditablePlace(locals.db!, profile, slug) };
  } catch (cause) {
    if (cause instanceof NotFound || cause instanceof Forbidden) error(404, 'Not found');
    throw cause;
  }
}

export const load: PageServerLoad = async ({ locals, url, params }) => {
  await requireDirectory(locals, 'places');
  await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');
  const { profile, place } = await editable(locals, params.slug);
  const links = place.links.slice(0, MAX_PLACE_LINKS);
  return {
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
      amenities: [...place.amenities],
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
    if (!event.locals.db) error(503, 'Database not configured');
    const { place } = await editable(event.locals, event.params.slug);
    return handlePlaceForm(event, { id: place.id });
  },
};

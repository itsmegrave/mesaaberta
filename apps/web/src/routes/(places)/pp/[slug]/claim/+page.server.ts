import { error } from '@sveltejs/kit';
import { initialForm, validateFormData } from '#lib/forms/contract.js';
import { formMessage, refuse } from '#lib/forms/server.js';
import { placeClaimSchema } from '@mesaaberta/core/places/claims';
import { Invalid, NotFound, RateLimited } from '@mesaaberta/core/server/errors';
import { readFromApi } from '#lib/server/api-read.js';
import { writeViaApi } from '#lib/server/api-write.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { requireDirectory } from '#lib/server/directories/flags.js';
import type { Actions, PageServerLoad } from './$types';

const DEFAULTS = { relation: '', contact: '', note: '', confirm: false };

type ClaimPage = {
  place: { slug: string; name: string };
  owner: boolean;
  claimable: boolean;
  waiting: boolean;
};

/** The listed place at this address, for a signed-in member; anything else is the api's 404. */
async function placeFor(locals: App.Locals, url: URL, slug: string) {
  await requireDirectory(locals, 'places');
  await requireUser(locals, url);
  const profile = await locals.getProfile();
  if (!profile) error(404, 'Not found');
  const found = await readFromApi<ClaimPage>(
    locals,
    profile.id,
    `/v1/places/${encodeURIComponent(slug)}/claim`,
  );
  return { profile, found };
}

// "Este lugar é seu?": who they are at the place and how the team reaches them. An admin reads it
// in /admin/places/claims; approved, the member manages the page and it shows "Verificado".
export const load: PageServerLoad = async ({ locals, url, params }) => {
  const { found } = await placeFor(locals, url, params.slug);
  return {
    place: found.place,
    // Owned already (by them or someone else), or theirs waits: the page says so instead of the form.
    state: found.owner ? 'owner' : !found.claimable ? 'owned' : found.waiting ? 'pending' : 'open',
    form: initialForm(DEFAULTS),
  };
};

export const actions: Actions = {
  default: async (event) => {
    const { locals, url, params, request } = event;
    const { profile } = await placeFor(locals, url, params.slug);
    const form = validateFormData(await request.formData(), placeClaimSchema, DEFAULTS as never, {
      booleans: ['confirm'],
    });
    if (!form.valid) return formMessage(form, { code: 'invalid' }, { status: 400 });

    try {
      await writeViaApi(
        locals,
        profile,
        `/v1/places/${encodeURIComponent(params.slug)}/claim`,
        form.data,
      );
    } catch (cause) {
      if (cause instanceof Invalid)
        return formMessage(form, { code: cause.message }, { status: 400 });
      if (cause instanceof RateLimited) return refuse(form, 429, 'rate_limited');
      if (cause instanceof NotFound) error(404, 'Not found');
      throw cause;
    }
    return formMessage(form, { code: 'sent' });
  },
};

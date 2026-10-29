import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guard.js';
import { moderationAction } from '#lib/server/moderation/form-action.js';
import { imageUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import type { loadPlaceHostInvitation } from '@mesaaberta/core/server/places/hosts';
import { readFromApi, revivedDates } from '#lib/server/api-read.js';
import type { Actions, PageServerLoad } from './$types';

// The invite to be a place's house GM ("Quem mestra na casa"), for the person invited only: anyone
// else gets a 404. It works whatever the flags say, so an invite that was sent can be answered.
export const load: PageServerLoad = async ({ locals, url, params }) => {
  const user = await requireUser(locals, url);
  if (!z.uuid().safeParse(params.id).success) error(404, 'Not found');
  // The api answers it for the invited person only: a 403 or 404 for anyone else.
  const invitation = revivedDates(
    await readFromApi<Awaited<ReturnType<typeof loadPlaceHostInvitation>>>(
      locals,
      user.id,
      `/v1/places/hosts/invitations/${params.id}`,
    ),
  );
  const { imagePath, ...place } = invitation.place;
  return {
    invitation: {
      ...invitation,
      place: { ...place, imageUrl: imageUrl(supabaseUrlOf(locals.env), imagePath) },
    },
  };
};

const answer = (decision: 'accept' | 'decline') =>
  moderationAction(z.object({}), [], {
    path: (event) => `/v1/places/hosts/invitations/${event.params.id}/${decision}`,
  });

export const actions: Actions = {
  accept: answer('accept'),
  decline: answer('decline'),
};

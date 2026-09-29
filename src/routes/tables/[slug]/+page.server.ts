import { loadRead } from '$lib/server/reads/load';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { submitRating } from '$lib/server/ratings/service';
import { ratingSchema } from '$lib/tables/rating';
import { playerActionSchema, tableActionSchema } from '$lib/tables/registration';
import { runRegistrationAction } from '$lib/server/registrations/form-action';
import {
  approveRegistration,
  declineRegistration,
  joinTable,
  leaveTable,
  removePlayer,
} from '$lib/server/registrations/service';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = async (event) => {
  const data = await loadRead(event, 'detail');
  return {
    ...data,
    ratingForm: await superValidate(data.myRating ?? {}, zod4(ratingSchema), { errors: false }),
  };
};

// Each action runs a registration operation as the signed-in player (see runRegistrationAction).
export const actions: Actions = {
  join: (event) =>
    runRegistrationAction(event, tableActionSchema, (db, actor) =>
      joinTable(db, actor, event.params.slug),
    ),
  leave: (event) =>
    runRegistrationAction(event, tableActionSchema, (db, actor) =>
      leaveTable(db, actor, event.params.slug),
    ),
  approve: (event) =>
    runRegistrationAction(event, playerActionSchema, (db, actor, { playerId }) =>
      approveRegistration(db, actor, event.params.slug, playerId),
    ),
  decline: (event) =>
    runRegistrationAction(event, playerActionSchema, (db, actor, { playerId }) =>
      declineRegistration(db, actor, event.params.slug, playerId),
    ),
  rate: (event) =>
    runRegistrationAction(event, ratingSchema, (db, actor, data) =>
      submitRating(db, actor, event.params.slug, {
        gmScore: data.gmScore,
        comment: data.comment || null,
      }),
    ),
  remove: (event) =>
    runRegistrationAction(event, playerActionSchema, (db, actor, { playerId }) =>
      removePlayer(db, actor, event.params.slug, playerId),
    ),
};

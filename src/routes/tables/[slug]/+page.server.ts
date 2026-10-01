import { error, isRedirect, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth/guard';
import { gameTables } from '$lib/server/db/schema';
import { failFrom } from '$lib/server/errors';
import { openDirect } from '$lib/server/messages/service';
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
  const { locals, params } = event;
  locals.track('player_mesa_detail_viewed', (await locals.getUser())?.id, async (db) => {
    const [table] = await db
      .select({ id: gameTables.id, gmId: gameTables.gmId })
      .from(gameTables)
      .where(eq(gameTables.slug, params.slug));
    return table
      ? { mesa_id: table.id, gm_user_id: table.gmId, seat_availability: data.table.seatsLeft }
      : null;
  });
  return {
    ...data,
    ratingForm: await superValidate(data.myRating ?? {}, zod4(ratingSchema), { errors: false }),
  };
};

// Each action runs a registration operation as the signed-in player (see runRegistrationAction).
export const actions: Actions = {
  // "Falar com o mestre": opens the direct conversation with the GM, about this table.
  talk: async ({ locals, url, params }) => {
    await requireUser(locals, new URL(url.pathname, url));
    if (!locals.db) error(503, 'Database not configured');

    const [table] = await locals.db
      .select({ gmId: gameTables.gmId, slug: gameTables.slug, status: gameTables.status })
      .from(gameTables)
      .where(eq(gameTables.slug, params.slug));
    if (!table || table.status !== 'active') error(404, 'Not found');

    try {
      const conversation = await openDirect(locals.db, await locals.getProfile(), table.gmId);
      redirect(303, `/messages/${conversation.id}?mesa=${encodeURIComponent(table.slug)}`);
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'DirectMessagesOff') {
        return failFrom(cause);
      }
      // A redirect is thrown too: let it through, and let failFrom rethrow anything unexpected.
      if (isRedirect(cause)) throw cause;
      return failFrom(cause);
    }
  },

  join: async (event) => {
    const { locals, params } = event;
    // The attempt, before it succeeds or fails: `player_seat_claimed` comes from the outbox.
    const playerId = (await locals.getUser())?.id;
    locals.track('player_seat_claim_initiated', playerId, async (db) => {
      const [table] = await db
        .select({ id: gameTables.id })
        .from(gameTables)
        .where(eq(gameTables.slug, params.slug));
      return table && playerId
        ? { mesa_id: table.id, player_user_id: playerId, seat_claim_method: 'button_click' }
        : null;
    });
    return runRegistrationAction(event, tableActionSchema, (db, actor) =>
      joinTable(db, actor, event.params.slug),
    );
  },
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

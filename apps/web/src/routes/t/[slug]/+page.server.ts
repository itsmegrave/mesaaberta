import { error, isRedirect, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { requireUser } from '#lib/server/auth/guard.js';
import { gameTables } from '@mesaaberta/core/server/db/schema';
import { failFrom } from '#lib/server/fail-from.js';
import { openDirectConversation } from '#lib/server/messages/open-direct.js';
import { loadRead } from '#lib/server/reads/load.js';

import { pendingInvitationFor } from '#lib/server/invitations/api.js';
import { submitRating } from '@mesaaberta/core/server/ratings/service';
import { ratingSchema } from '@mesaaberta/core/tables/rating';
import { joinSchema, playerActionSchema, tableActionSchema } from '#lib/tables/registration.js';
import { runRegistrationAction } from '#lib/server/registrations/form-action.js';
import {
  approveRegistration,
  declineRegistration,
  joinTable,
  leaveTable,
  removePlayer,
} from '@mesaaberta/core/server/registrations/service';
import { reportSchema } from '@mesaaberta/core/moderation/reports';
import { moderationAction } from '#lib/server/moderation/form-action.js';
import { fileReport } from '@mesaaberta/core/server/moderation/reports';
import { followAction } from '#lib/server/follows/action.js';
import { followState } from '#lib/server/follows/state.js';
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
  // Seguir on the GM row, for anyone but the GM.
  const [gm] = locals.db
    ? await locals.db
        .select({ gmId: gameTables.gmId })
        .from(gameTables)
        .where(eq(gameTables.slug, params.slug))
    : [];
  return {
    ...data,
    follow: gm && data.gmUsername ? await followState(locals, gm.gmId) : null,
    ratingForm: {
      valid: false,
      data: {
        gmScore: data.myRating?.gmScore ?? 0,
        comment: data.myRating?.comment ?? '',
        commentPublic: false,
      },
      errors: {},
    },
  };
};

// Each action runs a registration operation as the signed-in player (see runRegistrationAction).
export const actions: Actions = {
  // Seguir / Seguindo on the GM row.
  follow: followAction,

  // "Falar com quem mestra": opens the direct conversation with the GM, about this table.
  talk: async ({ locals, url, params }) => {
    await requireUser(locals, new URL(url.pathname, url));
    if (!locals.db) error(503, 'Database not configured');

    const [table] = await locals.db
      .select({ gmId: gameTables.gmId, slug: gameTables.slug, status: gameTables.status })
      .from(gameTables)
      .where(eq(gameTables.slug, params.slug));
    if (!table || table.status !== 'active') error(404, 'Not found');

    try {
      const conversationId = await openDirectConversation(
        locals,
        await locals.getProfile(),
        table.gmId,
      );
      redirect(303, `/m/${conversationId}?mesa=${encodeURIComponent(table.slug)}`);
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
    const user = await locals.getUser();
    if (user) {
      const actor = await locals.getProfile();
      const invitation = actor && (await pendingInvitationFor(locals, actor, params.slug!));
      if (invitation) redirect(303, `/u/profile/invitations/${invitation.id}`);
    }
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
    return runRegistrationAction(
      event,
      joinSchema,
      (db, actor, { message }) => joinTable(db, actor, event.params.slug, { message }),
      (data) => ({ action: 'join', slug: event.params.slug, body: { message: data.message } }),
    );
  },
  leave: (event) =>
    runRegistrationAction(
      event,
      tableActionSchema,
      (db, actor) => leaveTable(db, actor, event.params.slug),
      () => ({ action: 'leave', slug: event.params.slug, body: {} }),
    ),
  approve: (event) =>
    runRegistrationAction(
      event,
      playerActionSchema,
      (db, actor, { playerId }) => approveRegistration(db, actor, event.params.slug, playerId),
      ({ playerId }) => ({ action: 'approve', slug: event.params.slug, body: { playerId } }),
    ),
  decline: (event) =>
    runRegistrationAction(
      event,
      playerActionSchema,
      (db, actor, { playerId }) => declineRegistration(db, actor, event.params.slug, playerId),
      ({ playerId }) => ({ action: 'decline', slug: event.params.slug, body: { playerId } }),
    ),
  rate: (event) =>
    runRegistrationAction(
      event,
      ratingSchema,
      (db, actor, data) =>
        submitRating(db, actor, event.params.slug, {
          gmScore: data.gmScore,
          comment: data.comment || null,
          commentPublic: data.commentPublic,
        }),
      (data) => ({
        action: 'rate',
        slug: event.params.slug,
        body: { gmScore: data.gmScore, comment: data.comment, commentPublic: data.commentPublic },
        flag: 'api_ratings',
      }),
    ),
  // "Denunciar": the table, or someone the reporter shares it with. Admins see it in the queue.
  report: moderationAction(
    reportSchema,
    ['targetType', 'playerId', 'reason', 'details'],
    async (db, actor, data, event) =>
      (await fileReport(db, actor, event.params.slug!, data)).eventId,
    {
      player: {
        path: '/v1/reports/table',
        body: (data, event) => ({ ...data, slug: event.params.slug }),
      },
    },
  ),
  remove: (event) =>
    runRegistrationAction(
      event,
      playerActionSchema,
      (db, actor, { playerId }) => removePlayer(db, actor, event.params.slug, playerId),
      ({ playerId }) => ({ action: 'remove', slug: event.params.slug, body: { playerId } }),
    ),
};

import { error, isRedirect, redirect } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guard.js';
import { writeViaApi } from '#lib/server/api-write.js';
import { readFromApi } from '#lib/server/api-read.js';
import { NotFound } from '@mesaaberta/core/server/errors';
import { failFrom } from '#lib/server/fail-from.js';
import { loadRead } from '#lib/server/reads/load.js';

import { pendingInvitationFor } from '#lib/server/invitations/api.js';
import { ratingSchema } from '@mesaaberta/core/tables/rating';
import { joinSchema, playerActionSchema, tableActionSchema } from '#lib/tables/registration.js';
import { runRegistrationAction } from '#lib/server/registrations/form-action.js';
import { reportSchema } from '@mesaaberta/core/moderation/reports';
import { moderationAction } from '#lib/server/moderation/form-action.js';
import { followAction } from '#lib/server/follows/action.js';
import { gmFollowState } from '#lib/server/follows/state.js';
import { waitlistEnabled } from '#lib/server/waitlist/enabled.js';
import type { Actions, PageServerLoad } from './$types';
/** The table's id and its GM's for a product event, after the response; null when it is gone. */
const tableIds = (locals: App.Locals, actorId: string, slug: string) =>
  readFromApi<{ id: string; gmId: string }>(
    locals,
    actorId,
    `/v1/reads/table-ids/${encodeURIComponent(slug)}`,
  ).catch(() => null);

export const load: PageServerLoad = async (event) => {
  const data = await loadRead(event, 'detail');
  const { locals, params } = event;
  const viewerId = (await locals.getUser())?.id;
  locals.track('player_mesa_detail_viewed', viewerId, async () => {
    const table = viewerId ? await tableIds(locals, viewerId, params.slug) : null;
    return table
      ? { mesa_id: table.id, gm_user_id: table.gmId, seat_availability: data.table.seatsLeft }
      : null;
  });
  return {
    ...data,
    // Seguir on the GM row, for anyone but the GM.
    follow: data.gmUsername ? await gmFollowState(locals, params.slug) : null,
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
    const user = await requireUser(locals, new URL(url.pathname, url));

    try {
      // The api finds the active table and opens the conversation with its GM; any other table is
      // its 404.
      const { body } = await writeViaApi(
        locals,
        user,
        `/v1/messages/tables/${encodeURIComponent(params.slug)}/gm`,
        {},
      );
      if (typeof body.conversationId !== 'string' || typeof body.slug !== 'string')
        error(503, 'Invalid API response');
      redirect(303, `/m/${body.conversationId}?mesa=${encodeURIComponent(body.slug)}`);
    } catch (cause) {
      if (cause instanceof NotFound) error(404, 'Not found');
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
    locals.track('player_seat_claim_initiated', playerId, async () => {
      const table = playerId ? await tableIds(locals, playerId, params.slug) : null;
      return table && playerId
        ? { mesa_id: table.id, player_user_id: playerId, seat_claim_method: 'button_click' }
        : null;
    });
    return runRegistrationAction(event, joinSchema, {
      api: (data) => ({ action: 'join', slug: event.params.slug, body: { message: data.message } }),
    });
  },
  leave: (event) =>
    runRegistrationAction(event, tableActionSchema, {
      api: () => ({ action: 'leave', slug: event.params.slug, body: {} }),
    }),
  // "Entrar na lista de espera" on a full table, and leaving the line (`use_waitlist`).
  waitlist: async (event) =>
    runRegistrationAction(event, tableActionSchema, {
      allow: await waitlistEnabled(event.locals, await event.locals.getProfile()),
      api: () => ({ action: 'waitlist', slug: event.params.slug, body: {} }),
    }),
  unwaitlist: (event) =>
    runRegistrationAction(event, tableActionSchema, {
      api: () => ({ action: 'unwaitlist', slug: event.params.slug, body: {} }),
    }),
  approve: (event) =>
    runRegistrationAction(event, playerActionSchema, {
      api: ({ playerId }) => ({ action: 'approve', slug: event.params.slug, body: { playerId } }),
    }),
  decline: (event) =>
    runRegistrationAction(event, playerActionSchema, {
      api: ({ playerId }) => ({ action: 'decline', slug: event.params.slug, body: { playerId } }),
    }),
  rate: (event) =>
    runRegistrationAction(event, ratingSchema, {
      api: (data) => ({
        action: 'rate',
        slug: event.params.slug,
        body: { gmScore: data.gmScore, comment: data.comment, commentPublic: data.commentPublic },
      }),
    }),
  // "Denunciar": the table, or someone the reporter shares it with. Admins see it in the queue.
  report: moderationAction(reportSchema, ['targetType', 'playerId', 'reason', 'details'], {
    path: '/v1/reports/table',
    body: (data, event) => ({ ...data, slug: event.params.slug }),
  }),
  remove: (event) =>
    runRegistrationAction(event, playerActionSchema, {
      api: ({ playerId }) => ({ action: 'remove', slug: event.params.slug, body: { playerId } }),
    }),
};

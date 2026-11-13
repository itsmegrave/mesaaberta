import { requireUser } from '#lib/server/auth/guard.js';
import { requireDirectory } from '#lib/server/directories/flags.js';
import { readFromApi } from '#lib/server/api-read.js';
import { writeViaApi } from '#lib/server/api-write.js';
import { initialForm, validateFormData } from '#lib/forms/contract.js';
import { refuse, responseForm } from '#lib/forms/server.js';
import { matchCardSchema, type MatchCardInput } from '@mesaaberta/core/matches/schema';
import { routes } from '@mesaaberta/core/routes';
import { Invalid } from '@mesaaberta/core/server/errors';
import type { MatchCardState, MatchPerson } from '@mesaaberta/core/server/matches/service';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/** A first card starts in the middle of every axis, with nothing picked. */
const NEW_CARD: MatchCardInput = {
  enabled: true,
  adult: false,
  seeking: [],
  online: true,
  inPerson: false,
  combat: 50,
  rules: 50,
  length: 50,
  tone: 50,
};

// Meu cartão: what they look for, how they play and the 18+ confirmation. Saving turns the card
// on (the deck opens); Pausar takes it out of every deck and deletes the answers given.
export const load: PageServerLoad = async ({ locals, url }) => {
  const user = await requireUser(locals, url);
  await requireDirectory(locals, 'matches');
  const state = await readFromApi<MatchCardState & { preview: MatchPerson | null }>(
    locals,
    user.id,
    '/v1/matches/card',
  );
  const card = state.card;
  return {
    state: { ...state, card: undefined, preview: undefined },
    // Their own card as others see it; the page draws the answers over it as they change.
    preview: state.preview,
    hasCard: card !== null,
    enabled: card?.enabled ?? false,
    form: initialForm<MatchCardInput>(
      card
        ? {
            enabled: true,
            // They confirmed it to save the card; it stays confirmed.
            adult: true,
            seeking: card.seeking,
            online: card.online,
            inPerson: card.inPerson,
            ...card.axes,
          }
        : NEW_CARD,
    ),
  };
};

async function save({ locals, request, url }: Parameters<Actions[string]>[0], enabled: boolean) {
  const user = await requireUser(locals, new URL(url.pathname, url));
  await requireDirectory(locals, 'matches');
  const data = await request.formData();
  const form = validateFormData(
    data,
    matchCardSchema,
    { ...NEW_CARD, enabled },
    { arrays: ['seeking'], booleans: ['adult', 'online', 'inPerson'] },
  );
  // Pausing keeps whatever was on the card; only switching on needs it complete.
  form.data.enabled = enabled;
  if (enabled && !form.valid) return fail(400, { form: responseForm(form) });
  try {
    await writeViaApi(locals, user, '/v1/matches/card', { ...form.data, enabled });
  } catch (cause) {
    if (cause instanceof Invalid) return refuse(form, 400, cause.message, cause.field);
    throw cause;
  }
  redirect(303, enabled ? routes.matches : routes.matchCard);
}

export const actions: Actions = {
  save: (event) => save(event, true),
  pause: (event) => save(event, false),
};

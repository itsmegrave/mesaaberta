import { requireUser } from '#lib/server/auth/guard.js';
import { requireDirectory } from '#lib/server/directories/flags.js';
import { readFromApi } from '#lib/server/api-read.js';
import { writeViaApi } from '#lib/server/api-write.js';
import { failFrom } from '#lib/server/fail-from.js';
import { matchAnswerSchema } from '@mesaaberta/core/matches/schema';
import type {
  MatchAnswerResult,
  MatchCardState,
  MatchDeck,
} from '@mesaaberta/core/server/matches/service';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// Combinar: the deck, one card at a time, best fit first. Signed-in people, while
// `use_matchmaking` is on; without a card (or with it off, or under 18) the page explains instead.
export const load: PageServerLoad = async ({ locals, url }) => {
  const user = await requireUser(locals, url);
  await requireDirectory(locals, 'matches');
  const [deck, mine] = await Promise.all([
    readFromApi<MatchDeck>(locals, user.id, '/v1/matches/deck'),
    readFromApi<MatchCardState>(locals, user.id, '/v1/matches/card'),
  ]);
  // The viewer's own marks, for Ver mais.
  return { deck, mine: mine.card?.axes ?? null };
};

export const actions: Actions = {
  // Quero jogar junto (`yes=true`) or Agora não, about the card on top.
  answer: async ({ locals, request, url }) => {
    const user = await requireUser(locals, new URL(url.pathname, url));
    await requireDirectory(locals, 'matches');
    const form = await request.formData();
    const parsed = matchAnswerSchema.safeParse({
      username: form.get('username'),
      yes: form.get('yes') === 'true',
    });
    if (!parsed.success) return fail(400, { error: 'invalid' as const });
    try {
      const written = await writeViaApi(locals, user, '/v1/matches/answers', parsed.data);
      return { match: (written.body as unknown as MatchAnswerResult).match };
    } catch (cause) {
      return failFrom(cause);
    }
  },

  // Voltar a última: the latest answer of the day is taken back and its card comes back on top.
  undo: async ({ locals, url }) => {
    const user = await requireUser(locals, new URL(url.pathname, url));
    await requireDirectory(locals, 'matches');
    const written = await writeViaApi(locals, user, '/v1/matches/answers/undo', {});
    return { undone: written.body.undone === true };
  },
};

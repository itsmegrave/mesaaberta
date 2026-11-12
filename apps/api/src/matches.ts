import { Hono } from 'hono';
import { z } from 'zod';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import { pageNumber } from '@mesaaberta/core/admin/catalog';
import { pictureOf, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { matchAnswerSchema, matchCardSchema } from '@mesaaberta/core/matches/schema';
import {
  answerMatch,
  endMatch,
  listMatches,
  matchCardOf,
  matchPreviewOf,
  matchDeck,
  saveMatchCard,
  undoLastAnswer,
} from '@mesaaberta/core/server/matches/service';
import { listPlayedWith } from '@mesaaberta/core/server/matches/graph';
import { refusal } from './refusal';
import { userGuard, type UserVariables } from './user-guard';

type Open = typeof createDb;
type Env = DatabaseEnv & { SUPABASE_URL?: string };

const matchId = z.guid();

/** The first issue of a body that did not parse, as the web Worker shows it on the form. */
const invalid = (issues: { path: PropertyKey[]; message: string }[]) => ({
  error: 'invalid' as const,
  field: String(issues[0]?.path[0] ?? ''),
  message: issues[0]?.message ?? 'invalid',
});

/**
 * Combinar (`/matches`), the "RPG tinder": the actor's card, their deck, their answers and their
 * matches. Signed-in people only, always about the actor; web checks `use_matchmaking` before it
 * calls these.
 */
export function matchRoutes(open: Open = openDb) {
  const app = new Hono<{ Bindings: Env; Variables: UserVariables }>();
  app.use('*', userGuard(open));

  app.get('/card', async (c) => {
    const [state, preview] = await Promise.all([
      matchCardOf(c.get('db'), c.get('actorId')),
      matchPreviewOf(c.get('db'), c.get('actorId'), { supabaseUrl: supabaseUrlOf(c.env) }),
    ]);
    return c.json({ ...state, preview });
  });

  // Save and switch on (adults only, with the confirmation), or switch off.
  app.post('/card', async (c) => {
    const parsed = matchCardSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json(invalid(parsed.error.issues), 400);
    try {
      return c.json(await saveMatchCard(c.get('db'), c.get('actorId'), parsed.data));
    } catch (error) {
      const refused = refusal(c, error);
      if (refused) return refused;
      throw error;
    }
  });

  // The next cards, best fit first, or why there is no deck (no card, off, not an adult).
  // `?graph=1` when web has `use_play_graph` on for the actor: recent table-mates stay out and
  // people in common come first.
  app.get('/deck', async (c) =>
    c.json(
      await matchDeck(c.get('db'), c.get('actorId'), {
        supabaseUrl: supabaseUrlOf(c.env),
        graph: c.req.query('graph') === '1',
      }),
    ),
  );

  // Quem já jogou comigo: a page of the people the actor shared a played table with.
  app.get('/played', async (c) => {
    const list = await listPlayedWith(
      c.get('db'),
      c.get('actorId'),
      pageNumber(c.req.query('page') ?? null),
    );
    if (!list) return c.json({ error: 'not_found' }, 404);
    const supabaseUrl = supabaseUrlOf(c.env);
    return c.json({
      ...list,
      items: list.items.map(({ avatarPath, avatarUrl, ...person }) => ({
        ...person,
        avatarUrl: pictureOf(supabaseUrl, { avatarPath, avatarUrl }),
      })),
    });
  });

  // Quero jogar junto or Agora não. A yes that meets theirs answers the match.
  app.post('/answers', async (c) => {
    const parsed = matchAnswerSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json(invalid(parsed.error.issues), 400);
    try {
      return c.json(
        await answerMatch(c.get('db'), c.get('actorId'), parsed.data, {
          supabaseUrl: supabaseUrlOf(c.env),
        }),
      );
    } catch (error) {
      const refused = refusal(c, error);
      if (refused) return refused;
      throw error;
    }
  });

  // Voltar a última: the latest answer of the day is taken back.
  app.post('/answers/undo', async (c) =>
    c.json({ eventIds: [], ...(await undoLastAnswer(c.get('db'), c.get('actorId'))) }),
  );

  // A page of the actor's matches (a page past the last is a 404).
  app.get('/', async (c) => {
    const list = await listMatches(
      c.get('db'),
      c.get('actorId'),
      pageNumber(c.req.query('page') ?? null),
      {
        supabaseUrl: supabaseUrlOf(c.env),
      },
    );
    return list ? c.json(list) : c.json({ error: 'not_found' }, 404);
  });

  // Desfazer combinação.
  app.post('/:id/end', async (c) => {
    const id = c.req.param('id');
    if (!matchId.safeParse(id).success) return c.json({ error: 'not_found' }, 404);
    try {
      return c.json(await endMatch(c.get('db'), c.get('actorId'), id));
    } catch (error) {
      const refused = refusal(c, error);
      if (refused) return refused;
      throw error;
    }
  });

  return app;
}

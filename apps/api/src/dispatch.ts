import { eq } from 'drizzle-orm';
import type { Context, MiddlewareHandler } from 'hono';
import type { QueueBinding } from '@mesaaberta/events';
import { profiles } from '@mesaaberta/db/schema';
import { can } from '@mesaaberta/core/server/auth/policy';
import { analyticsHandlers, type AnalyticsEnv } from '@mesaaberta/core/server/analytics/index';
import {
  connectionStringFrom,
  createDb,
  type AnyDb,
  type DatabaseEnv,
} from '@mesaaberta/core/server/db/client';
import { dispatchEvent } from '@mesaaberta/core/server/events/dispatcher';
import { registerFencing } from '@mesaaberta/core/server/events/fencing';
import {
  MAIL_HANDLER_NAMES,
  bellHandlers,
  handlersFor,
} from '@mesaaberta/core/server/events/handlers';
import { registerLiveQueue } from '@mesaaberta/core/server/events/live-queue';
import { registerShadowQueue } from '@mesaaberta/core/server/events/shadow-queue';
import { logger } from '@mesaaberta/core/server/logger';
import { ACTOR_HEADER } from './admin-guard';
import { afterAnswer, apiFlags, type FlagsEnv } from './flags';

export type DispatchEnv = DatabaseEnv &
  FlagsEnv &
  NonNullable<Parameters<typeof handlersFor>[0]> & { DOMAIN_EVENTS?: QueueBinding };

type Open = typeof createDb;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Delivers the events a write committed, on a connection of its own (the route's is closed once it
 * answers). The canary flags are the api's own (`api_events_fenced_leases`, the queue stages),
 * targeted at the actor who made the write, read once and only when an event is dispatched. Never
 * throws: what fails stays due, and the sweeper runs it.
 */
export async function dispatchEvents(
  env: DispatchEnv | undefined,
  eventIds: readonly string[],
  actorId: string | undefined,
  open: Open = createDb,
) {
  const connectionString = connectionStringFrom(env);
  if (!connectionString || eventIds.length === 0) return;
  const { db, close } = open(connectionString);
  try {
    const flags = apiFlags(env);
    let target: Promise<{ id?: string; isAdmin?: boolean }> | undefined;
    const targetOf = () =>
      (target ??= (async () => {
        if (!actorId || !UUID.test(actorId)) return {};
        const [actor] = await db
          .select({ id: profiles.id, role: profiles.role, status: profiles.status })
          .from(profiles)
          .where(eq(profiles.id, actorId));
        return actor ? { id: actor.id, isAdmin: can(actor, 'admin:access') } : {};
      })());

    registerFencing(db, async () => flags.isEnabled('api_events_fenced_leases', await targetOf()));
    const queue = env?.DOMAIN_EVENTS;
    // No binding, no flag read: the queue stages need the producer binding.
    if (queue) {
      registerShadowQueue(db, async () =>
        (await flags.isEnabled('api_events_queue_shadow', await targetOf())) ? queue : null,
      );
      registerLiveQueue(db, async () => {
        const on = await targetOf();
        const [analytics, bell, mail] = await Promise.all([
          flags.isEnabled('api_events_queue_analytics', on),
          flags.isEnabled('api_events_queue_bell', on),
          flags.isEnabled('api_events_queue_mail', on),
        ]);
        const handlers = [
          ...(analytics ? analyticsHandlers(env as AnalyticsEnv) : []),
          ...(bell ? bellHandlers : []),
        ]
          .map(({ name }) => name)
          .concat(mail ? MAIL_HANDLER_NAMES : []);
        return handlers.length > 0 ? { queue, handlers } : null;
      });
    }

    const handlers = handlersFor(env);
    for (const id of eventIds) {
      await dispatchEvent(db as AnyDb, handlers, id, new Date(), logger).catch((error: unknown) =>
        logger.error('event dispatch failed', { eventId: id, error }),
      );
    }
  } finally {
    await close().catch(() => undefined);
  }
}

/** The event ids a write answered with, when it answered JSON with some. */
async function eventIdsOf(c: Context): Promise<string[]> {
  if (c.req.method === 'GET' || c.res.status < 200 || c.res.status >= 300) return [];
  if (!c.res.headers.get('content-type')?.includes('application/json')) return [];
  const body = (await c.res
    .clone()
    .json()
    .catch(() => null)) as { eventIds?: unknown } | null;
  const ids = Array.isArray(body?.eventIds) ? body.eventIds : [];
  return ids.filter((id): id is string => typeof id === 'string' && UUID.test(id));
}

/**
 * Every write that answers `eventIds` has them delivered after its answer, here: the web Worker no
 * longer touches the database (Grave, 2026-10-27). The ids still go back in the answer.
 */
export const dispatchAfterWrites =
  (open: Open = createDb): MiddlewareHandler =>
  async (c, next) => {
    await next();
    const ids = await eventIdsOf(c);
    if (ids.length > 0)
      afterAnswer(c, dispatchEvents(c.env as DispatchEnv, ids, c.req.header(ACTOR_HEADER), open));
  };

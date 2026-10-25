import { z } from 'zod';
import '../../forms/zod-codes';
import { isLocalDateTime } from '../../tables/schema';
import type { Actor } from '../auth/policy';
import type { AnyDb } from '../db/client';
import {
  allowRatings,
  concludeTable,
  finishTable,
  holdSession,
  markTableNotHeld,
  postponeTable,
} from './lifecycle';
import { publishTable } from './write';

const none = z.object({});

/**
 * What the GM does from the manage page, by name: the data each needs (without the form's `next`)
 * and the service call. The web form actions and the api route
 * (`POST /v1/manage/:slug/:action`) both run these. Each answers the `eventId` to dispatch after
 * the response; the service authorizes the actor and the table's state.
 */
export const tableLifecycleActions = {
  publish: {
    schema: none,
    apply: (db: AnyDb, actor: Actor | null, slug: string) => publishTable(db, actor, slug),
  },
  happened: {
    // `presentPlayerIds`: the confirmed players the GM left checked. Without it nobody is marked
    // and every confirmed player may rate, as before attendance existed.
    schema: z.object({ presentPlayerIds: z.array(z.uuid()).optional() }),
    apply: (
      db: AnyDb,
      actor: Actor | null,
      slug: string,
      { presentPlayerIds }: { presentPlayerIds?: string[] },
    ) => concludeTable(db, actor, slug, presentPlayerIds),
  },
  // A session of a campaign or adventure happened and more follow: the table stays open.
  sessionHeld: {
    schema: z.object({
      presentPlayerIds: z.array(z.uuid()).optional(),
      nextStartsAtLocal: z.string().refine(isLocalDateTime, 'invalid').optional(),
    }),
    apply: (
      db: AnyDb,
      actor: Actor | null,
      slug: string,
      data: { presentPlayerIds?: string[]; nextStartsAtLocal?: string },
    ) => holdSession(db, actor, slug, data),
  },
  finish: {
    schema: none,
    apply: (db: AnyDb, actor: Actor | null, slug: string) => finishTable(db, actor, slug),
  },
  allowRatings: {
    schema: z.object({ playerIds: z.array(z.uuid()).min(1) }),
    apply: (db: AnyDb, actor: Actor | null, slug: string, { playerIds }: { playerIds: string[] }) =>
      allowRatings(db, actor, slug, playerIds),
  },
  notHeld: {
    schema: none,
    apply: (db: AnyDb, actor: Actor | null, slug: string) => markTableNotHeld(db, actor, slug),
  },
  postpone: {
    schema: z.object({ startsAtLocal: z.string().refine(isLocalDateTime, 'invalid') }),
    apply: (
      db: AnyDb,
      actor: Actor | null,
      slug: string,
      { startsAtLocal }: { startsAtLocal: string },
    ) => postponeTable(db, actor, slug, startsAtLocal),
  },
};

export type TableLifecycleActionName = keyof typeof tableLifecycleActions;

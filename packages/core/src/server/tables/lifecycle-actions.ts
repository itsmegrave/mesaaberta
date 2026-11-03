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
  skipSession,
} from './lifecycle';
import { publishTable } from './write';
import {
  SESSION_NOTE_MAX,
  cancelSession,
  moveSession,
  noteSession,
  scheduleSession,
} from './session-actions';

const none = z.object({});
const localDateTime = z.string().refine(isLocalDateTime, 'invalid');
const note = z.string().max(SESSION_NOTE_MAX).optional();

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
  // A session of a campaign or adventure did not happen and the table goes on to the next one.
  sessionSkipped: {
    schema: z.object({
      nextStartsAtLocal: z.string().refine(isLocalDateTime, 'invalid').optional(),
    }),
    apply: (db: AnyDb, actor: Actor | null, slug: string, data: { nextStartsAtLocal?: string }) =>
      skipSession(db, actor, slug, data),
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
  // Gerenciar mesa → Sessões: one more session, a session moved, its note, a session cancelled.
  scheduleSession: {
    schema: z.object({
      startsAtLocal: localDateTime,
      durationMinutes: z
        .number()
        .int()
        .min(30)
        .max(24 * 60)
        .optional(),
      note,
    }),
    apply: (
      db: AnyDb,
      actor: Actor | null,
      slug: string,
      data: { startsAtLocal: string; durationMinutes?: number; note?: string },
    ) => scheduleSession(db, actor, slug, data),
  },
  moveSession: {
    schema: z.object({ sessionId: z.uuid(), startsAtLocal: localDateTime }),
    apply: (
      db: AnyDb,
      actor: Actor | null,
      slug: string,
      data: { sessionId: string; startsAtLocal: string },
    ) => moveSession(db, actor, slug, data),
  },
  noteSession: {
    schema: z.object({ sessionId: z.uuid(), note }),
    apply: (
      db: AnyDb,
      actor: Actor | null,
      slug: string,
      data: { sessionId: string; note?: string },
    ) => noteSession(db, actor, slug, data),
  },
  cancelSession: {
    schema: z.object({ sessionId: z.uuid(), message: note }),
    apply: (
      db: AnyDb,
      actor: Actor | null,
      slug: string,
      data: { sessionId: string; message?: string },
    ) => cancelSession(db, actor, slug, data),
  },
};

export type TableLifecycleActionName = keyof typeof tableLifecycleActions;

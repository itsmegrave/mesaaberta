import { z } from 'zod';
import '../../forms/zod-codes';
import type { Actor } from '../auth/policy';
import type { AnyDb } from '../db/client';
import {
  approveRegistration,
  declineRegistration,
  joinTable,
  leaveTable,
  removePlayer,
} from './service';
import { playerRatingSchema, ratingSchema } from '../../tables/rating';
import { submitRating } from '../ratings/service';
import { ratePlayer } from '../ratings/players';

/** Mirrors the `registrations_message_length` check. */
export const JOIN_MESSAGE_MAX = 500;

const player = z.object({ playerId: z.guid() });

/**
 * What a player or a GM does to a table's registrations and ratings, by name: the data each needs (without the
 * form's `next`, which is a browser concern) and the service call. The web form actions and the api
 * route (`POST /v1/tables/:slug/registrations/:action`) both run these. The service authorizes the
 * actor; what it refuses is thrown (`Forbidden`, `NotFound`, `TableFull`, `AlreadyRegistered`,
 * `RateLimited`). Every one answers the events to dispatch after the response.
 */
export const registrationActions = {
  join: {
    schema: z.object({ message: z.string().trim().max(JOIN_MESSAGE_MAX).default('') }),
    apply: (db: AnyDb, actor: Actor | null, slug: string, { message }: { message: string }) =>
      joinTable(db, actor, slug, { message }),
  },
  leave: {
    schema: z.object({}),
    apply: (db: AnyDb, actor: Actor | null, slug: string) => leaveTable(db, actor, slug),
  },
  approve: {
    schema: player,
    apply: (db: AnyDb, actor: Actor | null, slug: string, { playerId }: { playerId: string }) =>
      approveRegistration(db, actor, slug, playerId),
  },
  decline: {
    schema: player,
    apply: (db: AnyDb, actor: Actor | null, slug: string, { playerId }: { playerId: string }) =>
      declineRegistration(db, actor, slug, playerId),
  },
  remove: {
    schema: player,
    apply: (db: AnyDb, actor: Actor | null, slug: string, { playerId }: { playerId: string }) =>
      removePlayer(db, actor, slug, playerId),
  },
  // A player rating the GM after the first session: final, one per player and table.
  rate: {
    schema: ratingSchema,
    apply: (
      db: AnyDb,
      actor: Actor | null,
      slug: string,
      {
        gmScore,
        comment,
        commentPublic,
      }: { gmScore: number; comment: string; commentPublic: boolean },
    ) => submitRating(db, actor, slug, { gmScore, comment: comment || null, commentPublic }),
  },
  // The GM rating a player they marked present (`use_player_ratings`, checked by the web Worker).
  ratePlayer: {
    schema: playerRatingSchema,
    apply: (
      db: AnyDb,
      actor: Actor | null,
      slug: string,
      { playerId, score, comment }: { playerId: string; score: number; comment: string },
    ) => ratePlayer(db, actor, slug, playerId, { score, comment: comment || null }),
  },
};

export type RegistrationActionName = keyof typeof registrationActions;

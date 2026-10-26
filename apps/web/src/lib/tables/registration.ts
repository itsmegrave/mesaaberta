import '@mesaaberta/core/forms/zod-codes';
import { z } from 'zod';
import { next } from '#lib/forms/next.js';
import { playerRatingSchema } from '@mesaaberta/core/tables/rating';

/** Every button-only action: which player it is about (when it is about one), and where to come back to. */
export const actionSchema = z.object({ playerId: z.guid().optional(), next });

/** Join and leave: the table is in the address, so the form carries only where to come back to. */
export const tableActionSchema = z.object({ next });

/** Approve, decline and remove: the player the GM is acting on. */
export const playerActionSchema = actionSchema.required({ playerId: true });

/** Mirrors the `registrations_message_length` check. */
export const JOIN_MESSAGE_MAX = 500;

/** Join: where to come back to, and the optional note the player leaves for the GM. */
export const joinSchema = tableActionSchema.extend({
  message: z.string().trim().max(JOIN_MESSAGE_MAX).default(''),
});

/** The GM's rating of a player, from the manage page: who, the stars, the GM's own note. */
export const playerRatingFormSchema = playerRatingSchema.extend({ next });

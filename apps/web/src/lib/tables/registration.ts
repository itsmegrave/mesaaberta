import '$lib/forms/zod-codes';
import { z } from 'zod';
import { next } from '$lib/forms/next';

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

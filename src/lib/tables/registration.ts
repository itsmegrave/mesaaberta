import '$lib/forms/zod-codes';
import { z } from 'zod';

const next = z.string().max(2000).default('');

/** Every button-only action: which player it is about (when it is about one), and where to come back to. */
export const actionSchema = z.object({ playerId: z.guid().optional(), next });

/** Join and leave: the table is in the address, so the form carries only where to come back to. */
export const tableActionSchema = z.object({ next });

/** Approve, decline and remove: the player the GM is acting on. */
export const playerActionSchema = actionSchema.required({ playerId: true });

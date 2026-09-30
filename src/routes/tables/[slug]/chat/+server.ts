import { error, redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth/guard';
import { gameTables, registrations } from '$lib/server/db/schema';
import { addTableMember, ensureTableConversation } from '$lib/server/messages/service';
import type { RequestHandler } from './$types';

/**
 * Opens a table's chat for its GM and confirmed players: makes the conversation on first use, makes
 * sure they are in it, and goes to it. Anyone else gets a 404, as if there were no chat.
 */
export const GET: RequestHandler = async ({ locals, url, params }) => {
  const user = await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');

  const [table] = await locals.db
    .select({ id: gameTables.id, gmId: gameTables.gmId })
    .from(gameTables)
    .where(eq(gameTables.slug, params.slug));
  if (!table) error(404, 'Not found');

  const [seat] = await locals.db
    .select({ status: registrations.status })
    .from(registrations)
    .where(and(eq(registrations.tableId, table.id), eq(registrations.playerId, user.id)));
  if (table.gmId !== user.id && seat?.status !== 'confirmed') error(404, 'Not found');

  await addTableMember(locals.db, table.id, user.id);
  const conversation = await ensureTableConversation(locals.db, table.id);
  redirect(303, `/messages/${conversation.id}`);
};

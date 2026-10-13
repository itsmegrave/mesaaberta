import { error, type RequestEvent } from '@sveltejs/kit';
import { and, eq, ne } from 'drizzle-orm';
import { initialForm } from '$lib/forms/contract';
import { requireUser } from '$lib/server/auth/guard';
import { gameTables } from '@mesaaberta/core/server/db/schema';
import { NotFound } from '@mesaaberta/core/server/errors';
import { imageUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { withPicture, withPictures } from '@mesaaberta/core/server/messages/present';
import {
  listMessages,
  loadConversation,
  markConversationRead,
} from '@mesaaberta/core/server/messages/service';

export const loadChatThread = async (
  { locals, url }: Pick<RequestEvent, 'locals' | 'url'>,
  conversationId: string,
) => {
  const user = await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');
  const actor = await locals.getProfile();
  const supabaseUrl = supabaseUrlOf(locals.env);

  try {
    const conversation = await loadConversation(locals.db, actor, conversationId);
    const thread = await listMessages(locals.db, actor, conversationId);
    await markConversationRead(locals.db, actor, conversationId);

    // A direct message that starts from a table's page is about that table.
    const about = url.searchParams.get('mesa');
    const [context] = about
      ? await locals.db
          .select({ id: gameTables.id, slug: gameTables.slug, title: gameTables.title })
          .from(gameTables)
          // A draft is nobody's business but its GM's: its title is not shown here either.
          .where(and(eq(gameTables.slug, about), ne(gameTables.status, 'draft')))
      : [];

    return {
      viewerId: user.id,
      conversation: {
        ...conversation,
        table: conversation.table && {
          ...conversation.table,
          imageUrl: imageUrl(supabaseUrl, conversation.table.imagePath),
          imagePath: undefined,
        },
        other: conversation.other && withPicture(supabaseUrl, conversation.other),
      },
      messages: withPictures(supabaseUrl, thread.messages),
      hasMore: thread.hasMore,
      context: conversation.kind === 'direct' ? (context ?? null) : null,
      form: initialForm({ body: '', tableId: context?.id }),
    };
  } catch (cause) {
    if (cause instanceof NotFound) error(404, 'Not found');
    throw cause;
  }
};

export type ChatThreadData = Awaited<ReturnType<typeof loadChatThread>>;

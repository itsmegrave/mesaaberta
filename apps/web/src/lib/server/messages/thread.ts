import type { RequestEvent } from '@sveltejs/kit';
import { initialForm } from '#lib/forms/contract.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { imageUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { withPicture, withPictures } from '@mesaaberta/core/server/messages/present';
import { openThreadViaApi } from './api';
import { messageSafetyEnabled } from './safety';

export const loadChatThread = async (
  { locals, url }: Pick<RequestEvent, 'locals' | 'url'>,
  conversationId: string,
) => {
  const user = await requireUser(locals, url);
  const actor = await locals.getProfile();
  const supabaseUrl = supabaseUrlOf(locals.env);

  // A direct message that starts from a table's page is about that table. Not a member: the api's
  // 404, which becomes the page's.
  const { conversation, messages, hasMore, context } = await openThreadViaApi(
    locals,
    user.id,
    conversationId,
    url.searchParams.get('mesa'),
  );

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
    messages: withPictures(supabaseUrl, messages),
    hasMore,
    context,
    // Bloquear and Denunciar (`use_message_safety`).
    safety: await messageSafetyEnabled(locals, actor),
    form: initialForm({ body: '', tableId: context?.id }),
  };
};

export type ChatThreadData = Awaited<ReturnType<typeof loadChatThread>>;

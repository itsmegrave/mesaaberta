import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { message, superValidate, type ErrorStatus } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { messageSchema, muteSchema } from '$lib/messages/schema';
import { requireUser } from '$lib/server/auth/guard';
import { gameTables } from '$lib/server/db/schema';
import { NotFound, RateLimited, failFrom } from '$lib/server/errors';
import { imageUrl, supabaseUrlOf } from '$lib/server/images';
import { withPicture, withPictures } from '$lib/server/messages/present';
import {
  listMessages,
  loadConversation,
  markConversationRead,
  sendMessage,
  setMuted,
} from '$lib/server/messages/service';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, params, platform }) => {
  const user = await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');
  const actor = await locals.getProfile();
  const supabaseUrl = supabaseUrlOf(platform?.env);

  try {
    const conversation = await loadConversation(locals.db, actor, params.id);
    const thread = await listMessages(locals.db, actor, params.id);
    await markConversationRead(locals.db, actor, params.id);

    // A direct message that starts from a table's page is about that table.
    const about = url.searchParams.get('mesa');
    const [context] = about
      ? await locals.db
          .select({ id: gameTables.id, slug: gameTables.slug, title: gameTables.title })
          .from(gameTables)
          .where(eq(gameTables.slug, about))
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
      form: await superValidate({ body: '', tableId: context?.id }, zod4(messageSchema), {
        errors: false,
      }),
    };
  } catch (cause) {
    if (cause instanceof NotFound) error(404, 'Not found');
    throw cause;
  }
};

export const actions: Actions = {
  send: async ({ request, locals, url, params, setHeaders }) => {
    await requireUser(locals, new URL(url.pathname, url));
    if (!locals.db) error(503, 'Database not configured');

    const form = await superValidate(request, zod4(messageSchema));
    if (!form.valid) return fail(400, { form });

    try {
      await sendMessage(locals.db, await locals.getProfile(), params.id, form.data.body, {
        tableId: form.data.tableId ?? null,
      });
    } catch (cause) {
      if (cause instanceof RateLimited) {
        setHeaders({ 'Retry-After': String(cause.retryAfterSeconds) });
      }
      const failure = failFrom(cause);
      return message(form, { code: failure.data.error }, { status: failure.status as ErrorStatus });
    }
    // The body is cleared for the next message; the thread refreshes itself.
    return message({ ...form, data: { ...form.data, body: '' } }, { code: 'sent' });
  },

  mute: async ({ request, locals, url, params }) => {
    await requireUser(locals, new URL(url.pathname, url));
    if (!locals.db) error(503, 'Database not configured');

    const form = await superValidate(request, zod4(muteSchema));
    if (!form.valid) return fail(400, { form });
    try {
      await setMuted(locals.db, await locals.getProfile(), params.id, form.data.muted);
    } catch (cause) {
      const failure = failFrom(cause);
      return message(form, { code: failure.data.error }, { status: failure.status as ErrorStatus });
    }
    return { form };
  },
};

import type { listBlocked } from '@mesaaberta/core/server/blocks/service';
import type { openThread } from '@mesaaberta/core/server/messages/reads';
import type { listInbox, listMessages } from '@mesaaberta/core/server/messages/service';
import { readFromApi } from '../api-read';

// Mensagens from the api Worker (Trello #120): the web Worker reads no database for these. JSON
// turned the dates into strings; these give them back as dates.

type Inbox = Awaited<ReturnType<typeof listInbox>>;
type Thread = Awaited<ReturnType<typeof listMessages>>;
type Opened = Awaited<ReturnType<typeof openThread>>;
type Blocked = Awaited<ReturnType<typeof listBlocked>>;

const dateOf = (value: Date | string) => new Date(value);
const maybeDateOf = (value: Date | string | null) => (value === null ? null : new Date(value));

const reviveMessages = (messages: Thread['messages']) =>
  messages.map((message) => ({ ...message, createdAt: dateOf(message.createdAt) }));

/** The person's conversations, a page at a time; a page past the last is the page's 404. */
export async function readInbox(
  locals: App.Locals,
  actorId: string,
  page: number,
  kind?: 'direct' | 'table',
): Promise<Inbox> {
  const query = new URLSearchParams({ page: String(page), ...(kind ? { kind } : {}) });
  const inbox = await readFromApi<Inbox>(locals, actorId, `/v1/messages/inbox?${query}`);
  return {
    ...inbox,
    items: inbox.items.map((item) => ({ ...item, lastMessageAt: dateOf(item.lastMessageAt) })),
  };
}

/** A page of a conversation's messages (`before`: the oldest one shown). */
export async function readMessages(
  locals: App.Locals,
  actorId: string,
  conversationId: string,
  before?: Date,
): Promise<Thread> {
  const query = before ? `?before=${encodeURIComponent(before.toISOString())}` : '';
  const thread = await readFromApi<Thread>(
    locals,
    actorId,
    `/v1/messages/${encodeURIComponent(conversationId)}${query}`,
  );
  return {
    ...thread,
    messages: reviveMessages(thread.messages),
    otherLastReadAt: maybeDateOf(thread.otherLastReadAt),
  };
}

/** Opens a thread, which reads it; `about` is the table a direct message started from. */
export async function openThreadViaApi(
  locals: App.Locals,
  actorId: string,
  conversationId: string,
  about: string | null,
): Promise<Opened> {
  const opened = await readFromApi<Opened>(
    locals,
    actorId,
    `/v1/messages/${encodeURIComponent(conversationId)}/open`,
    { about },
  );
  const { other } = opened.conversation;
  return {
    ...opened,
    conversation: {
      ...opened.conversation,
      other: other && { ...other, lastReadAt: maybeDateOf(other.lastReadAt) },
    },
    messages: reviveMessages(opened.messages),
  };
}

/** Everything in a conversation is read now. */
export async function markReadViaApi(locals: App.Locals, actorId: string, conversationId: string) {
  await readFromApi(locals, actorId, `/v1/messages/${encodeURIComponent(conversationId)}/read`, {});
}

/** A table's chat for its GM and confirmed players; anyone else gets the page's 404. */
export async function openTableChatViaApi(locals: App.Locals, actorId: string, slug: string) {
  return readFromApi<{ conversationId: string }>(
    locals,
    actorId,
    `/v1/messages/tables/${encodeURIComponent(slug)}`,
    {},
  );
}

/** Everyone the person blocked, for "Pessoas bloqueadas". */
export async function readBlocked(locals: App.Locals, actorId: string): Promise<Blocked> {
  const blocked = await readFromApi<Blocked>(locals, actorId, '/v1/messages/blocked');
  return blocked.map((row) => ({ ...row, blockedAt: dateOf(row.blockedAt) }));
}

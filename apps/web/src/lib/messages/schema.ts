import { z } from 'zod';

z.config({ jitless: true });

/** Mirrors the `messages_body_length` check in the database. */
export const MESSAGE_MAX_LENGTH = 2000;

/** Messages in one page of a thread, and conversations in one page of the inbox. */
export const THREAD_PAGE_SIZE = 50;
export const INBOX_PAGE_SIZE = 20;

/** The message form. The message is a short code, translated where the form shows it. */
export const messageSchema = z.object({
  body: z.string().trim().min(1, 'required').max(MESSAGE_MAX_LENGTH, 'too_long'),
  // The table a direct message is about, when it started from that table's page.
  tableId: z.string().uuid().optional(),
});

/** The mute switch on a conversation. */
export const muteSchema = z.object({ muted: z.boolean() });

/** The profile switch for direct messages. */
export const directMessagesSchema = z.object({ enabled: z.boolean() });

export type MessageInput = z.infer<typeof messageSchema>;

/** The key of the one direct conversation between two people, the same whoever asks. */
export const pairKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);

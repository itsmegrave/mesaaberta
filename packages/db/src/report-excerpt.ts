/**
 * What a `message` or `person` report keeps of the conversation: the messages the reporter saw,
 * oldest first, copied when they reported, so an admin can read them after the sender deletes
 * them or closes their account. `messageId` is the reported one (null for a report about a person).
 */
export type ReportExcerpt = {
  conversationId: string;
  kind: 'table' | 'direct';
  messageId: string | null;
  messages: {
    id: string;
    senderId: string | null;
    username: string | null;
    body: string;
    createdAt: string;
  }[];
};

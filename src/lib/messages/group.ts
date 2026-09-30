/** A message as the thread shows it. */
export type ThreadItem = {
  id: string;
  body: string;
  sender: string | null;
  avatarUrl: string | null;
  tableId: string | null;
  tableTitle: string | null;
  tableSlug: string | null;
  createdAt: Date;
  own: boolean;
  /** Set on a message that is still being sent, or failed to send. */
  pending?: 'sending' | 'failed';
};

/** Consecutive messages from the same person within this many minutes read as one group. */
export const GROUP_WINDOW_MS = 5 * 60 * 1000;

export type MessageGroup = {
  key: string;
  own: boolean;
  sender: string | null;
  avatarUrl: string | null;
  messages: ThreadItem[];
};

export type DayBlock = { day: string; date: Date; groups: MessageGroup[] };

/** `2026-09-30` in the given timezone: the key two messages share when they fall on one day. */
export function dayKey(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Groups messages (oldest first) by day, then into runs from one sender within the window. */
export function groupMessages(items: ThreadItem[], timeZone?: string): DayBlock[] {
  const blocks: DayBlock[] = [];
  let previous: ThreadItem | undefined;
  for (const item of items) {
    const day = dayKey(item.createdAt, timeZone);
    let block = blocks[blocks.length - 1];
    if (!block || block.day !== day) {
      block = { day, date: item.createdAt, groups: [] };
      blocks.push(block);
      previous = undefined;
    }
    const group = block.groups[block.groups.length - 1];
    const sameRun =
      group &&
      previous &&
      group.own === item.own &&
      group.sender === item.sender &&
      item.createdAt.getTime() - previous.createdAt.getTime() <= GROUP_WINDOW_MS;
    if (sameRun) group.messages.push(item);
    else
      block.groups.push({
        key: item.id,
        own: item.own,
        sender: item.sender,
        avatarUrl: item.avatarUrl,
        messages: [item],
      });
    previous = item;
  }
  return blocks;
}

/** Merges polled messages into what is shown, by id, oldest first. Newer copies replace older. */
export function mergeMessages(shown: ThreadItem[], incoming: ThreadItem[]): ThreadItem[] {
  const byId = new Map(shown.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : 1),
  );
}

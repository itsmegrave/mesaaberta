import { describe, expect, it } from 'vitest';
import { groupMessages, mergeMessages, type ThreadItem } from './group';

const at = (iso: string, over: Partial<ThreadItem> = {}): ThreadItem => ({
  id: iso + (over.sender ?? 'ana') + (over.own ? 'own' : ''),
  body: 'oi',
  sender: 'ana',
  avatarUrl: null,
  tableId: null,
  tableTitle: null,
  tableSlug: null,
  createdAt: new Date(iso),
  own: false,
  ...over,
});

describe('groupMessages', () => {
  it('joins consecutive messages from one sender within five minutes', () => {
    const [block] = groupMessages([at('2026-09-30T12:00:00Z'), at('2026-09-30T12:04:00Z')], 'UTC');
    expect(block.groups).toHaveLength(1);
    expect(block.groups[0].messages).toHaveLength(2);
  });

  it('starts a new group after a longer pause', () => {
    const [block] = groupMessages([at('2026-09-30T12:00:00Z'), at('2026-09-30T12:06:00Z')], 'UTC');
    expect(block.groups).toHaveLength(2);
  });

  it('starts a new group when the sender changes', () => {
    const [block] = groupMessages(
      [at('2026-09-30T12:00:00Z'), at('2026-09-30T12:01:00Z', { sender: 'bia' })],
      'UTC',
    );
    expect(block.groups).toHaveLength(2);
  });

  it('separates own from others even with the same name', () => {
    const [block] = groupMessages(
      [at('2026-09-30T12:00:00Z'), at('2026-09-30T12:01:00Z', { own: true })],
      'UTC',
    );
    expect(block.groups).toHaveLength(2);
  });

  it('splits across days in the given timezone', () => {
    const blocks = groupMessages(
      [at('2026-09-30T02:30:00Z'), at('2026-09-30T03:10:00Z')],
      'America/Sao_Paulo',
    );
    expect(blocks).toHaveLength(2);
  });
});

describe('mergeMessages', () => {
  it('adds new messages once and keeps the order', () => {
    const a = at('2026-09-30T12:00:00Z');
    const b = at('2026-09-30T12:01:00Z', { sender: 'bia' });
    expect(mergeMessages([a], [b, a]).map((item) => item.id)).toEqual([a.id, b.id]);
  });
});

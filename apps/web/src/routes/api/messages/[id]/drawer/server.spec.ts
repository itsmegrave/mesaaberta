import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadChatThread } from '$lib/server/messages/thread';
import { GET } from './+server';
vi.mock('$lib/server/messages/thread', () => ({ loadChatThread: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
describe('drawer thread', () => {
  it('rejects anonymous requests before loading or marking a conversation read', async () => {
    await expect(
      GET({
        locals: { getUser: async () => null },
        params: { id: 'thread' },
      } as unknown as Parameters<typeof GET>[0]),
    ).rejects.toMatchObject({ status: 401 });
    expect(loadChatThread).not.toHaveBeenCalled();
  });
});

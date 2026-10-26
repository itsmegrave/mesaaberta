import { beforeEach, describe, expect, it, vi } from 'vitest';
import { markConversationRead } from '@mesaaberta/core/server/messages/service';
import { POST } from './+server';

vi.mock('@mesaaberta/core/server/messages/service', () => ({ markConversationRead: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

const event = (user: { id: string } | null) =>
  ({
    locals: { db: {}, getUser: async () => user, getProfile: async () => user },
    params: { id: 'thread' },
  }) as unknown as Parameters<typeof POST>[0];

describe('marking a conversation read', () => {
  it('rejects anonymous requests before marking anything', async () => {
    await expect(POST(event(null))).rejects.toMatchObject({ status: 401 });
    expect(markConversationRead).not.toHaveBeenCalled();
  });

  it('marks it read for the signed-in reader', async () => {
    const response = await POST(event({ id: 'ana' }));
    expect(response.status).toBe(204);
    expect(markConversationRead).toHaveBeenCalledWith({}, { id: 'ana' }, 'thread');
  });
});

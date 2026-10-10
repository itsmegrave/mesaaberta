import { describe, expect, it, vi } from 'vitest';
import { postgresEventBus } from './postgres-outbox';

describe('postgresEventBus', () => {
  it('inserts the event and returns its id', async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 'event-1' }]);
    const values = vi.fn().mockReturnValue({ returning });
    const db = { insert: vi.fn().mockReturnValue({ values }) };
    const bus = postgresEventBus(db as never);

    const id = await bus.publish({
      type: 'AccountReinstated',
      actorId: 'admin-1',
      payload: { profileId: 'profile-1' },
    });

    expect(id).toBe('event-1');
    expect(values).toHaveBeenCalledWith({
      type: 'AccountReinstated',
      actorId: 'admin-1',
      payload: { profileId: 'profile-1' },
    });
  });

  it('records a given time as both creation and due time', async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 'event-2' }]);
    const values = vi.fn().mockReturnValue({ returning });
    const bus = postgresEventBus({ insert: () => ({ values }) } as never);
    const now = new Date('2026-10-10T12:00:00Z');

    await bus.publish(
      { type: 'AccountBanLifted', actorId: null, payload: { profileId: 'p' } },
      { now },
    );

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ createdAt: now, nextAttemptAt: now }),
    );
  });
});

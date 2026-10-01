import { describe, expect, it } from 'vitest';
import { taxonomyEvents } from './card-events';
import type { StoredEvent } from '../events/types';

const ids = {
  event: '11111111-1111-4111-8111-111111111111',
  actor: '22222222-2222-4222-8222-222222222222',
  table: '33333333-3333-4333-8333-333333333333',
};
const stored = (type: string, payload: object, actorId: string | null = ids.actor) =>
  ({
    id: ids.event,
    actorId,
    type,
    payload,
    createdAt: new Date('2026-09-30T12:00:00Z'),
    attempts: 0,
  }) as StoredEvent;
const dbWith = (rows: { capacity: number }[]) =>
  ({ select: () => ({ from: () => ({ where: async () => rows }) }) }) as never;

describe('product taxonomy from domain events', () => {
  it('turns a created table into gm_mesa_created and gm_mesa_published with its seats', async () => {
    const events = await taxonomyEvents(
      stored('TableCreated', { tableId: ids.table, slug: 'secret', title: 'secret' }),
      dbWith([{ capacity: 5 }]),
    );
    expect(events.map((e) => e.name)).toEqual(['gm_mesa_created', 'gm_mesa_published']);
    expect(events[1].properties).toMatchObject({
      gm_user_id: ids.actor,
      mesa_id: ids.table,
      seats_initial_count: 5,
      timestamp_utc: '2026-09-30T12:00:00.000Z',
    });
    // Both share the domain event's id and actor, so a retry is deduplicated per name.
    expect(new Set(events.map((e) => e.insertId))).toEqual(new Set([ids.event]));
    expect(JSON.stringify(events)).not.toContain('secret');
  });

  it('does not claim a mesa was published when its row is gone', async () => {
    const events = await taxonomyEvents(
      stored('TableCreated', { tableId: ids.table, slug: 's', title: 't' }),
      dbWith([]),
    );
    expect(events.map((e) => e.name)).toEqual(['gm_mesa_created']);
  });

  it('separates a seat taken from a seat asked for', async () => {
    const payload = { tableId: ids.table, slug: 's', playerId: ids.actor };
    const [joined] = await taxonomyEvents(stored('PlayerJoined', payload), dbWith([]));
    const [requested] = await taxonomyEvents(stored('JoinRequested', payload), dbWith([]));
    expect(joined).toMatchObject({
      name: 'player_seat_claimed',
      properties: { claim_status: 'success', player_user_id: ids.actor, mesa_id: ids.table },
    });
    expect(requested.properties.claim_status).toBe('pending_approval');
  });

  it('sends nothing for other events or for events with no actor', async () => {
    expect(
      await taxonomyEvents(stored('TableDisabled', { tableId: ids.table }), dbWith([])),
    ).toEqual([]);
    expect(
      await taxonomyEvents(stored('PlayerJoined', { tableId: ids.table }, null), dbWith([])),
    ).toEqual([]);
  });
});

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dispatch = vi.fn();
vi.mock('@mesaaberta/core/server/events/dispatcher', () => ({
  dispatchEvent: (...args: unknown[]) => dispatch(...args),
}));
vi.mock('@mesaaberta/core/server/events/handlers', async (original) => ({
  ...(await original<object>()),
  handlersFor: () => [],
}));

import { fencedFor } from '@mesaaberta/core/server/events/fencing';
import { ACTOR_HEADER } from './admin-guard';
import { dispatchAfterWrites, dispatchEvents } from './dispatch';

const env = { DATABASE_URL: 'postgres://test' };
const ID = '11111111-1111-4111-8111-111111111111';
const ACTOR = '22222222-2222-4222-8222-222222222222';

const open = (actors: object[] = []) => {
  const close = vi.fn(async () => undefined);
  const db = { select: () => ({ from: () => ({ where: async () => actors }) }) };
  return Object.assign(() => ({ db, close }) as never, { close, db });
};

describe('dispatchEvents', () => {
  beforeEach(() => dispatch.mockReset().mockResolvedValue({ outcome: 'processed' }));

  it('delivers each event on a connection of its own, then closes it', async () => {
    const opened = open();
    await dispatchEvents(env, [ID, ID], ACTOR, opened);
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch.mock.calls[0][0]).toBe(opened.db);
    expect(dispatch.mock.calls[0][2]).toBe(ID);
    expect(opened.close).toHaveBeenCalledOnce();
  });

  it('does nothing without a database or events', async () => {
    const opened = open();
    await dispatchEvents({}, [ID], ACTOR, opened);
    await dispatchEvents(env, [], ACTOR, opened);
    expect(dispatch).not.toHaveBeenCalled();
    expect(opened.close).not.toHaveBeenCalled();
  });

  it('keeps going and closes when one event fails', async () => {
    dispatch.mockRejectedValueOnce(new Error('down'));
    const opened = open();
    await dispatchEvents(env, [ID, ID], ACTOR, opened);
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(opened.close).toHaveBeenCalledOnce();
  });

  it('reads the fencing flag as off without GrowthBook settings', async () => {
    const opened = open([{ id: ACTOR, role: 'admin', status: 'active' }]);
    await dispatchEvents(env, [ID], ACTOR, opened);
    expect(await fencedFor(opened.db as never)).toBe(false);
  });
});

describe('dispatchAfterWrites', () => {
  beforeEach(() => dispatch.mockReset().mockResolvedValue({ outcome: 'processed' }));

  const app = (opened: ReturnType<typeof open>) => {
    const api = new Hono();
    api.use('*', dispatchAfterWrites(opened));
    api.post('/write', (c) => c.json({ eventIds: [ID, 'not-an-id'] }));
    api.post('/refused', (c) => c.json({ eventIds: [ID] }, 400));
    api.get('/read', (c) => c.json({ eventIds: [ID] }));
    return api;
  };
  const run = async (method: string, path: string) => {
    const waits: Promise<unknown>[] = [];
    const ctx = { waitUntil: (p: Promise<unknown>) => waits.push(p), passThroughOnException() {} };
    const response = await app(open()).request(
      path,
      { method, headers: { [ACTOR_HEADER]: ACTOR } },
      env,
      ctx as never,
    );
    await Promise.all(waits);
    return response;
  };

  it('delivers the ids a write answers, after the answer, and keeps them in it', async () => {
    const response = await run('POST', '/write');
    expect(await response.json()).toEqual({ eventIds: [ID, 'not-an-id'] });
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch.mock.calls[0][2]).toBe(ID);
  });

  it('leaves refused writes and reads alone', async () => {
    await run('POST', '/refused');
    await run('GET', '/read');
    expect(dispatch).not.toHaveBeenCalled();
  });
});

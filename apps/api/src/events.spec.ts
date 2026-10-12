import { beforeEach, describe, expect, it, vi } from 'vitest';

const force = vi.fn();
const retry = vi.fn();
vi.mock('@mesaaberta/core/server/events/dispatcher', () => ({
  forceEvent: (...args: unknown[]) => force(...args),
  forceFailedEvents: (...args: unknown[]) => retry(...args),
}));
vi.mock('@mesaaberta/core/server/events/handlers', () => ({ handlersFor: () => [] }));

import { ACTOR_HEADER, eventRoutes } from './events';

const env = { DATABASE_URL: 'postgres://test' };
const open = (actor: unknown) => {
  const close = vi.fn(async () => undefined);
  const db = { select: () => ({ from: () => ({ where: async () => (actor ? [actor] : []) }) }) };
  return Object.assign(() => ({ db, close }) as never, { close });
};
const post =
  (path: string, actor?: string, bindings: object = env) =>
  (open_: ReturnType<typeof open>) =>
    eventRoutes(open_).request(
      path,
      { method: 'POST', headers: actor ? { [ACTOR_HEADER]: actor } : {} },
      bindings,
    );

describe('api admin event routes', () => {
  beforeEach(() => {
    force.mockReset().mockResolvedValue('processed');
    retry.mockReset().mockResolvedValue({ tried: 2, processed: 1, remaining: 1 });
  });

  it('answers 401 without an actor', async () => {
    const response = await post('/e1/force')(open(null));
    expect(response.status).toBe(401);
    expect(force).not.toHaveBeenCalled();
  });

  it('answers 403 to an actor who is not an active admin', async () => {
    for (const actor of [
      null,
      { id: 'u', role: 'user', status: 'active' },
      { id: 'u', role: 'admin', status: 'suspended' },
    ]) {
      const response = await post('/e1/force', 'u')(open(actor));
      expect(response.status).toBe(403);
    }
    expect(force).not.toHaveBeenCalled();
  });

  it('answers 503 without a database', async () => {
    const response = await post('/e1/force', 'a', {})(open(null));
    expect(response.status).toBe(503);
  });

  it('forces one event as the admin and closes the connection', async () => {
    const opened = open({ id: 'a', role: 'admin', status: 'active' });
    const response = await post('/e1/force', 'a')(opened);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: 'processed' });
    expect(force).toHaveBeenCalledWith(
      expect.anything(),
      [],
      'e1',
      'a',
      expect.any(Date),
      expect.anything(),
    );
    expect(opened.close).toHaveBeenCalled();
  });

  it('retries the failed events as the admin', async () => {
    const response = await post(
      '/retry-failed',
      'a',
    )(open({ id: 'a', role: 'admin', status: 'active' }));

    expect(await response.json()).toEqual({ tried: 2, processed: 1, remaining: 1 });
    expect(retry).toHaveBeenCalledWith(
      expect.anything(),
      [],
      'a',
      expect.any(Date),
      expect.anything(),
    );
  });
});

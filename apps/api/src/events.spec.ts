import { beforeEach, describe, expect, it, vi } from 'vitest';

const force = vi.fn();
const retry = vi.fn();
vi.mock('@mesaaberta/core/server/events/dispatcher', () => ({
  forceEvent: (...args: unknown[]) => force(...args),
  forceFailedEvents: (...args: unknown[]) => retry(...args),
}));
vi.mock('@mesaaberta/core/server/events/handlers', () => ({ handlersFor: () => [] }));
const review = vi.fn();
vi.mock('@mesaaberta/core/server/admin/event-queue', () => ({
  reviewEvent: (...args: unknown[]) => review(...args),
}));

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
    review.mockReset().mockResolvedValue('reviewed');
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

  it('records the review an admin gives of a failed event', async () => {
    const actor = { id: 'a', role: 'admin', status: 'active' };
    const response = await post('/e1/review/ignored', 'a')(open(actor));

    expect(await response.json()).toEqual({ outcome: 'reviewed' });
    expect(review).toHaveBeenCalledWith(expect.anything(), actor, 'e1', 'ignored');
  });

  it('answers 400 to a review that is not one of the three', async () => {
    const response = await post(
      '/e1/review/deleted',
      'a',
    )(open({ id: 'a', role: 'admin', status: 'active' }));

    expect(response.status).toBe(400);
    expect(review).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from 'vitest';
import {
  AlreadyRegistered,
  Forbidden,
  NotFound,
  RateLimited,
  TableFull,
} from '@mesaaberta/core/server/errors';
import { playerActionSchema, tableActionSchema } from '#lib/tables/registration.js';
import { runRegistrationAction } from './form-action';

const call = () => ({ action: 'leave' as const, slug: 'mesa', body: {} });

const setup = (over: { user?: boolean; db?: boolean; username?: string | null } = {}) => {
  const queued: ((db: unknown) => Promise<unknown>)[] = [];
  const profile = {
    id: 'p1',
    username: over.username === undefined ? 'ana' : over.username,
    role: 'member',
    status: 'active',
  };
  const locals = {
    getUser: async () => (over.user === false ? null : { id: 'p1' }),
    getProfile: async () => (over.user === false ? null : profile),
    db: over.db === false ? null : { fake: 'db' },
    afterResponse: (task: (db: unknown) => Promise<unknown>) => queued.push(task),
  } as unknown as App.Locals;
  const url = new URL('https://x.test/t/mesa');
  const setHeaders = vi.fn();
  const event = (fields: Record<string, string> = {}) => {
    const body = new FormData();
    for (const [k, v] of Object.entries(fields)) body.set(k, v);
    return { locals, url, request: new Request(url, { method: 'POST', body }), setHeaders };
  };

  return { event, queued, profile, setHeaders };
};

describe('runRegistrationAction', () => {
  it('runs the operation as the signed-in player, then goes back to the page', async () => {
    const { event, profile } = setup();
    const run = vi.fn().mockResolvedValue({ eventIds: [] });

    await expect(runRegistrationAction(event(), tableActionSchema, run)).rejects.toMatchObject({
      status: 303,
      location: '/t/mesa',
    });
    expect(run).toHaveBeenCalledWith({ fake: 'db' }, profile, { next: '' });
  });

  it('goes back to the page named in `next`, such as the dashboard the form was posted from', async () => {
    const { event } = setup();

    await expect(
      runRegistrationAction(event({ next: '/u/tables' }), tableActionSchema, async () => ({
        eventIds: [],
      })),
    ).rejects.toMatchObject({ status: 303, location: '/u/tables' });
  });

  it.each(['https://evil.example/', '//evil.example', '/\\evil.example'])(
    'ignores a `next` that leaves the site: %j',
    async (next) => {
      const { event } = setup();

      await expect(
        runRegistrationAction(event({ next }), tableActionSchema, async () => ({ eventIds: [] })),
      ).rejects.toMatchObject({ status: 303, location: '/t/mesa' });
    },
  );

  it('queues each event for dispatch after the response', async () => {
    const { event, queued } = setup();

    await runRegistrationAction(event(), tableActionSchema, async () => ({
      eventIds: ['e1', 'e2'],
    })).catch(() => {});

    expect(queued).toHaveLength(2);
  });

  it('sends an anonymous visitor to log in, and runs nothing', async () => {
    const { event } = setup({ user: false });
    const run = vi.fn();

    await expect(runRegistrationAction(event(), tableActionSchema, run)).rejects.toMatchObject({
      status: 303,
      location: '/login?next=%2Ft%2Fmesa',
    });
    expect(run).not.toHaveBeenCalled();
  });

  it('sends someone who has not picked a username yet to finish the profile, and runs nothing', async () => {
    const { event } = setup({ username: null });
    const run = vi.fn();

    await expect(runRegistrationAction(event(), tableActionSchema, run)).rejects.toMatchObject({
      status: 303,
      location: '/u/profile/setup?next=%2Ft%2Fmesa',
    });
    expect(run).not.toHaveBeenCalled();
  });

  it('returns to the page, not to the action address, after logging in', async () => {
    const { event } = setup({ user: false });
    const e = event();
    e.url = new URL('https://x.test/t/mesa?/join');

    await expect(
      runRegistrationAction(
        e,
        tableActionSchema,
        vi.fn(async () => ({ eventIds: [] })),
      ),
    ).rejects.toMatchObject({
      location: '/login?next=%2Ft%2Fmesa',
    });
  });

  it.each([
    [new TableFull(), 409, 'table_full'],
    [new AlreadyRegistered(), 409, 'already_registered'],
    [new Forbidden('x'), 403, 'forbidden'],
    [new NotFound('x'), 404, 'not_found'],
  ])('answers %s with a %i the page can show', async (error, status, code) => {
    const { event, queued } = setup();

    const result = await runRegistrationAction(event(), tableActionSchema, async () => {
      throw error;
    });

    expect(result).toMatchObject({ status, data: { form: { message: { code } } } });
    expect(queued).toHaveLength(0);
  });

  it('answers RateLimited with a 429 that says when to try again, in the form and in Retry-After', async () => {
    const { event, queued, setHeaders } = setup();

    const result = await runRegistrationAction(event(), tableActionSchema, async () => {
      throw new RateLimited(90);
    });

    expect(result).toMatchObject({
      status: 429,
      data: { form: { message: { code: 'rate_limited', retryAfter: 90 } } },
    });
    expect(setHeaders).toHaveBeenCalledWith({ 'Retry-After': '90' });
    expect(queued).toHaveLength(0);
  });

  it('lets a real bug surface instead of hiding it as a permission problem', async () => {
    const { event } = setup();

    await expect(
      runRegistrationAction(event(), tableActionSchema, async () => {
        throw new TypeError('bug');
      }),
    ).rejects.toThrow('bug');
  });

  it('says the service is unavailable when there is no database', async () => {
    const { event } = setup({ db: false });

    await expect(
      runRegistrationAction(
        event(),
        tableActionSchema,
        vi.fn(async () => ({ eventIds: [] })),
      ),
    ).rejects.toMatchObject({
      status: 503,
    });
  });

  it('refuses a request whose fields are not valid, and runs nothing', async () => {
    const { event } = setup();
    const run = vi.fn();

    const result = await runRegistrationAction(
      event({ playerId: 'not-a-uuid' }),
      playerActionSchema,
      run,
    );

    expect(result).toMatchObject({
      status: 400,
      data: { form: { message: { code: 'invalid' }, errors: { playerId: expect.any(Array) } } },
    });
    expect(run).not.toHaveBeenCalled();
  });

  it('hands the run the validated fields', async () => {
    const { event } = setup();
    const run = vi.fn().mockResolvedValue({ eventIds: [] });
    const playerId = '11111111-1111-4111-8111-111111111111';

    await runRegistrationAction(event({ playerId }), playerActionSchema, run).catch(() => {});

    expect(run).toHaveBeenCalledWith({ fake: 'db' }, expect.anything(), { playerId, next: '' });
  });

  describe('through the api', () => {
    const withApi = (answer: () => Promise<Response> | Response) => {
      const harness = setup();
      const fetch = vi.fn(async (_request: Request) => answer());
      const locals = harness.event().locals as unknown as Record<string, unknown>;
      locals.env = { API: { fetch } };
      locals.log = { warn: vi.fn(), info: vi.fn(), error: vi.fn() };
      return { ...harness, fetch, locals };
    };
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    // `setup().event` builds a new request each time but shares `locals`.
    const run = (h: ReturnType<typeof withApi>) =>
      runRegistrationAction(h.event(), tableActionSchema, { api: call }).catch((e) => e);

    it('lets the api decide, as the signed-in person, and dispatches the events it answers', async () => {
      const h = withApi(() => json(200, { eventIds: ['e9'] }));
      await run(h);

      expect(h.fetch).toHaveBeenCalledOnce();
      const request = h.fetch.mock.calls[0][0];
      expect(new URL(request.url).pathname).toBe('/v1/tables/mesa/leave');
      expect(request.headers.get('x-actor-id')).toBe('p1');
      expect(h.queued).toHaveLength(1);
    });

    it('shows the api refusal as the form failure', async () => {
      const h = withApi(() => json(409, { error: 'table_full' }));
      const result = (await run(h)) as { status: number };

      expect(result).toMatchObject({ status: 409 });
      expect(h.queued).toHaveLength(0);
    });

    it('answers 503 when the api fails: nothing is written here', async () => {
      const h = withApi(() => json(500, { error: 'internal_error' }));

      expect(await run(h)).toMatchObject({ status: 503 });
      expect(h.queued).toHaveLength(0);
    });
  });
});

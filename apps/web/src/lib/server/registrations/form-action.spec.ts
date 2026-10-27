import { describe, expect, it, vi } from 'vitest';
import { playerActionSchema, tableActionSchema } from '#lib/tables/registration.js';
import { runRegistrationAction } from './form-action';

const call = () => ({ action: 'leave' as const, slug: 'mesa', body: {} });

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const setup = (
  over: {
    user?: boolean;
    username?: string | null;
    answer?: (request: Request) => Promise<Response> | Response;
  } = {},
) => {
  const queued: ((db: unknown) => Promise<unknown>)[] = [];
  const profile = {
    id: 'p1',
    username: over.username === undefined ? 'ana' : over.username,
    role: 'member',
    status: 'active',
  };
  const answer = over.answer ?? (() => json(200, { eventIds: [] }));
  const fetch = vi.fn(async (request: Request) => answer(request));
  const locals = {
    getUser: async () => (over.user === false ? null : { id: 'p1' }),
    getProfile: async () => (over.user === false ? null : profile),
    env: { API: { fetch } },
    log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
    afterResponse: (task: (db: unknown) => Promise<unknown>) => queued.push(task),
  } as unknown as App.Locals;
  const url = new URL('https://x.test/t/mesa');
  const setHeaders = vi.fn();
  const event = (fields: Record<string, string> = {}) => {
    const body = new FormData();
    for (const [k, v] of Object.entries(fields)) body.set(k, v);
    return { locals, url, request: new Request(url, { method: 'POST', body }), setHeaders };
  };

  return { event, queued, profile, setHeaders, fetch };
};

const sentBody = async (fetch: ReturnType<typeof setup>['fetch']) =>
  (fetch.mock.calls[0][0] as Request).json();

describe('runRegistrationAction', () => {
  it('lets the api decide, as the signed-in player, then goes back to the page', async () => {
    const { event, fetch } = setup();

    await expect(
      runRegistrationAction(event(), tableActionSchema, { api: call }),
    ).rejects.toMatchObject({ status: 303, location: '/t/mesa' });
    expect(fetch).toHaveBeenCalledOnce();
    const request = fetch.mock.calls[0][0] as Request;
    expect(new URL(request.url).pathname).toBe('/v1/tables/mesa/leave');
    expect(request.headers.get('x-actor-id')).toBe('p1');
  });

  it('goes back to the page named in `next`, such as the dashboard the form was posted from', async () => {
    const { event } = setup();

    await expect(
      runRegistrationAction(event({ next: '/u/tables' }), tableActionSchema, { api: call }),
    ).rejects.toMatchObject({ status: 303, location: '/u/tables' });
  });

  it.each(['https://evil.example/', '//evil.example', '/\\evil.example'])(
    'ignores a `next` that leaves the site: %j',
    async (next) => {
      const { event } = setup();

      await expect(
        runRegistrationAction(event({ next }), tableActionSchema, { api: call }),
      ).rejects.toMatchObject({ status: 303, location: '/t/mesa' });
    },
  );

  it('queues each event the api wrote for dispatch after the response', async () => {
    const { event, queued } = setup({ answer: () => json(200, { eventIds: ['e1', 'e2'] }) });

    await runRegistrationAction(event(), tableActionSchema, { api: call }).catch(() => {});

    expect(queued).toHaveLength(2);
  });

  it('sends an anonymous visitor to log in, and calls nothing', async () => {
    const { event, fetch } = setup({ user: false });

    await expect(
      runRegistrationAction(event(), tableActionSchema, { api: call }),
    ).rejects.toMatchObject({ status: 303, location: '/login?next=%2Ft%2Fmesa' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends someone who has not picked a username yet to finish the profile, and calls nothing', async () => {
    const { event, fetch } = setup({ username: null });

    await expect(
      runRegistrationAction(event(), tableActionSchema, { api: call }),
    ).rejects.toMatchObject({ status: 303, location: '/u/profile/setup?next=%2Ft%2Fmesa' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns to the page, not to the action address, after logging in', async () => {
    const { event } = setup({ user: false });
    const e = event();
    e.url = new URL('https://x.test/t/mesa?/join');

    await expect(runRegistrationAction(e, tableActionSchema, { api: call })).rejects.toMatchObject({
      location: '/login?next=%2Ft%2Fmesa',
    });
  });

  it('refuses with forbidden when the action is not allowed here, and calls nothing', async () => {
    const { event, fetch } = setup();

    const result = await runRegistrationAction(event(), tableActionSchema, {
      allow: false,
      api: call,
    });

    expect(result).toMatchObject({
      status: 403,
      data: { form: { message: { code: 'forbidden' } } },
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [409, 'table_full'],
    [409, 'already_registered'],
    [403, 'forbidden'],
    [404, 'not_found'],
  ])('shows the api refusal %i %s as a failure the page can show', async (status, code) => {
    const { event, queued } = setup({ answer: () => json(status, { error: code }) });

    const result = await runRegistrationAction(event(), tableActionSchema, { api: call });

    expect(result).toMatchObject({ status, data: { form: { message: { code } } } });
    expect(queued).toHaveLength(0);
  });

  it('answers the rate limit with a 429 that says when to try again, in the form and in Retry-After', async () => {
    const { event, queued, setHeaders } = setup({
      answer: () => json(429, { error: 'rate_limited', retryAfter: 90 }, { 'retry-after': '90' }),
    });

    const result = await runRegistrationAction(event(), tableActionSchema, { api: call });

    expect(result).toMatchObject({
      status: 429,
      data: { form: { message: { code: 'rate_limited', retryAfter: 90 } } },
    });
    expect(setHeaders).toHaveBeenCalledWith({ 'Retry-After': '90' });
    expect(queued).toHaveLength(0);
  });

  it('answers 503 when the api fails: nothing is written here', async () => {
    const { event, queued } = setup({ answer: () => json(500, { error: 'internal_error' }) });

    await expect(
      runRegistrationAction(event(), tableActionSchema, { api: call }),
    ).rejects.toMatchObject({ status: 503 });
    expect(queued).toHaveLength(0);
  });

  it('refuses a request whose fields are not valid, and calls nothing', async () => {
    const { event, fetch } = setup();

    const result = await runRegistrationAction(
      event({ playerId: 'not-a-uuid' }),
      playerActionSchema,
      { api: call },
    );

    expect(result).toMatchObject({
      status: 400,
      data: { form: { message: { code: 'invalid' }, errors: { playerId: expect.any(Array) } } },
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('builds the api call from the validated fields', async () => {
    const { event, fetch } = setup();
    const api = vi.fn((data: { playerId: string }) => ({
      action: 'remove' as const,
      slug: 'mesa',
      body: { playerId: data.playerId },
    }));
    const playerId = '11111111-1111-4111-8111-111111111111';

    await runRegistrationAction(event({ playerId }), playerActionSchema, { api }).catch(() => {});

    expect(api).toHaveBeenCalledWith({ playerId, next: '' });
    expect(await sentBody(fetch)).toEqual({ playerId });
  });
});

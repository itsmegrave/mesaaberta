import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Invalid, RateLimited } from '@mesaaberta/core/server/errors';
import { PlaceDuplicate, submitPlace } from '@mesaaberta/core/server/places/service';
import { actions, load } from './+page.server';

vi.mock('@mesaaberta/core/server/places/service', async (original) => ({
  ...(await original<typeof import('@mesaaberta/core/server/places/service')>()),
  submitPlace: vi.fn(async () => ({ id: 'p1', slug: 'taverna-do-dado', eventId: 'e1' })),
}));
vi.mock('@mesaaberta/core/server/events/dispatcher', () => ({ dispatchEvent: vi.fn() }));

const ANA = '00000000-0000-4000-8000-0000000000aa';
const fields = {
  name: 'Taverna do Dado',
  kind: 'game_cafe',
  postalCode: '51020-000',
  street: 'Av. Boa Viagem, 100',
  amenities: 'accessible',
};

function event(form: Record<string, string>, { flagOn = true, signedIn = true } = {}) {
  const after: unknown[] = [];
  return {
    after,
    event: {
      locals: {
        db: {},
        env: {},
        flags: {
          isEnabled: async (name: string) => (name === 'api_directory_places' ? flagOn : false),
        },
        log: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
        getUser: async () => (signedIn ? { id: ANA } : null),
        getProfile: async () =>
          signedIn ? { id: ANA, role: 'member', status: 'active', username: 'ana' } : null,
        afterResponse: (task: unknown) => void after.push(task),
      },
      params: {},
      url: new URL('https://x.test/pp/new'),
      setHeaders: vi.fn(),
      request: new Request('https://x.test/pp/new', {
        method: 'POST',
        body: new URLSearchParams(form),
      }),
    } as unknown as RequestEvent,
  };
}

type Run = (e: RequestEvent) => Promise<unknown>;
async function send(e: RequestEvent) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- whatever the action returns
    return { result: (await (actions.default as unknown as Run)(e)) as any };
  } catch (thrown) {
    return { thrown: thrown as { status?: number; location?: string } };
  }
}

beforeEach(() => vi.clearAllMocks());

describe('"Cadastrar lugar"', () => {
  it('answers 404 while api_directory_places is off, before asking anyone to log in', async () => {
    const { event: e } = event(fields, { flagOn: false, signedIn: false });
    await expect((load as unknown as Run)(e)).rejects.toMatchObject({ status: 404 });
    expect((await send(e)).thrown).toMatchObject({ status: 404 });
  });

  it('sends a visitor to log in', async () => {
    const { event: e } = event(fields, { signedIn: false });
    await expect((load as unknown as Run)(e)).rejects.toMatchObject({
      location: '/login?next=%2Fpp%2Fnew',
    });
  });

  it('sends the place and goes to its page, dispatching the event after the response', async () => {
    const { event: e, after } = event(fields);
    const { thrown } = await send(e);
    expect(thrown?.location).toBe('/pp/taverna-do-dado?enviado=1');
    expect(vi.mocked(submitPlace).mock.lastCall?.[2]).toMatchObject({
      name: 'Taverna do Dado',
      kind: 'game_cafe',
      amenities: ['accessible'],
    });
    expect(after).toHaveLength(1);
  });

  it('refuses a form without a kind, with what was typed', async () => {
    const { result } = await send(event({ ...fields, kind: '' }).event);
    expect(result.status).toBe(400);
    expect(result.data.form.errors.kind).toEqual(['required']);
    expect(result.data.form.data.name).toBe('Taverna do Dado');
    expect(submitPlace).not.toHaveBeenCalled();
  });

  it('links a duplicate to the place already there', async () => {
    vi.mocked(submitPlace).mockRejectedValueOnce(new PlaceDuplicate('taverna-do-dado'));
    const { result } = await send(event(fields).event);
    expect(result.status).toBe(409);
    expect(result.data.form.message).toEqual({
      code: 'place_duplicate',
      href: '/pp/taverna-do-dado',
    });
  });

  it('puts a CEP refusal on the CEP and a rate limit on the form', async () => {
    vi.mocked(submitPlace).mockRejectedValueOnce(new Invalid('postalCode', 'not_found'));
    expect((await send(event(fields).event)).result.data.form.errors.postalCode).toEqual([
      'not_found',
    ]);
    vi.mocked(submitPlace).mockRejectedValueOnce(new RateLimited(600));
    const { result } = await send(event(fields).event);
    expect(result.status).toBe(429);
    expect(result.data.form.message).toEqual({ code: 'rate_limited', retryAfter: 600 });
  });
});

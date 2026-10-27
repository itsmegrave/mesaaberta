import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Forbidden } from '@mesaaberta/core/server/errors';
import { findEditablePlace, updatePlace } from '@mesaaberta/core/server/places/service';
import { actions, load } from './+page.server';

vi.mock('@mesaaberta/core/server/places/service', async (original) => ({
  ...(await original<typeof import('@mesaaberta/core/server/places/service')>()),
  findEditablePlace: vi.fn(),
  updatePlace: vi.fn(async () => ({
    eventId: 'e1',
    slug: 'taverna',
    replacedImage: null,
    pending: true,
  })),
}));
vi.mock('@mesaaberta/core/server/events/dispatcher', () => ({ dispatchEvent: vi.fn() }));

const ANA = '00000000-0000-4000-8000-0000000000aa';
const PLACE = '00000000-0000-4000-8000-000000000001';
const place = {
  id: PLACE,
  slug: 'taverna',
  name: 'Taverna do Dado',
  kind: 'game_cafe',
  postalCode: '51020000',
  street: 'Av. Boa Viagem, 100',
  complement: null,
  description: null,
  openingHours: 'Ter a dom',
  amenities: ['accessible'],
  siteUrl: null,
  imagePath: null,
  ownerId: null,
  approvedAt: new Date('2026-10-20T12:00:00Z'),
  links: [{ network: 'instagram', url: 'https://instagram.com/taverna' }],
};

function event(form?: Record<string, string>, role = 'member') {
  return {
    locals: {
      db: {},
      env: {},
      flags: { isEnabled: async () => true },
      log: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
      getUser: async () => ({ id: ANA }),
      getProfile: async () => ({ id: ANA, role, status: 'active', username: 'ana' }),
      afterResponse: vi.fn(),
    },
    params: { slug: 'taverna' },
    url: new URL('https://x.test/pp/taverna/edit'),
    request: new Request('https://x.test/pp/taverna/edit', {
      method: 'POST',
      body: new URLSearchParams(form ?? {}),
    }),
  } as unknown as RequestEvent;
}

type Run = (e: RequestEvent) => Promise<unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the columns the page reads
  vi.mocked(findEditablePlace).mockResolvedValue(place as any);
});

describe('"Editar lugar"', () => {
  it('fills the form from the place and says a member’s save goes back to the queue', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- whatever the load returns
    const data = (await (load as unknown as Run)(event())) as any;
    expect(data.form.data).toMatchObject({
      name: 'Taverna do Dado',
      kind: 'game_cafe',
      postalCode: '51020-000',
      amenities: ['accessible'],
      linkNetwork: ['instagram'],
      linkUrl: ['https://instagram.com/taverna'],
    });
    expect(data).toMatchObject({ reviewAgain: true, approved: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- whatever the load returns
    expect(((await (load as unknown as Run)(event(undefined, 'admin'))) as any).reviewAgain).toBe(
      false,
    );
  });

  it('answers 404 for a place this person may not edit', async () => {
    vi.mocked(findEditablePlace).mockRejectedValue(new Forbidden('no'));
    await expect((load as unknown as Run)(event())).rejects.toMatchObject({ status: 404 });
    await expect((actions.default as unknown as Run)(event({ name: 'x' }))).rejects.toMatchObject({
      status: 404,
    });
    expect(updatePlace).not.toHaveBeenCalled();
  });

  it('saves the place it found and goes back to its page', async () => {
    await expect(
      (actions.default as unknown as Run)(
        event({
          name: 'Taverna do Dado',
          kind: 'game_cafe',
          postalCode: '51020-000',
          street: 'Av. Boa Viagem, 100',
        }),
      ),
    ).rejects.toMatchObject({ location: '/pp/taverna?enviado=1' });
    expect(vi.mocked(updatePlace).mock.lastCall?.[2]).toBe(PLACE);
  });
});

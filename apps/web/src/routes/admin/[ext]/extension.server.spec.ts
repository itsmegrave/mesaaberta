import type { RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Extension } from '@mesaaberta/core/server/extensions/index';
import { extensionViaApi } from '#lib/server/admin/extension-api.js';
import { GET as callback } from './callback/+server';
import { POST as connect } from './connect/+server';
import { GET as asset } from '../../[ext]/assets/[key]/+server';

const apply = vi.fn(async () => ({ connected: true }));
const complete = vi.fn(
  async (
    _env: unknown,
    _code: string,
    save: Parameters<NonNullable<Extension['oauth']>['complete']>[2],
  ) => save('connect', { token: 'sealed' }),
);
const found = vi.fn(async () => ({ body: new Uint8Array([1, 2, 3]), type: 'image/png' }));

const fake: Extension = {
  id: 'fake',
  oauth: {
    origin: 'https://auth.fake.test',
    configured: (env) => Boolean((env as { KEY?: string } | undefined)?.KEY),
    authorizeUrl: (_env, state) => new URL(`https://auth.fake.test/authorize?state=${state}`),
    complete,
  },
  adminActions: { connect: { schema: z.object({ token: z.string() }), apply } },
  asset: found,
};

vi.mock('@mesaaberta/core/server/extensions/index', () => ({
  extensionById: (id: string) =>
    id === 'fake' ? fake : id === 'bare' ? { id: 'bare' } : undefined,
}));
vi.mock('#lib/server/admin/extension-api.js', () => ({ extensionViaApi: vi.fn(async () => null) }));

const admin = { id: 'admin', role: 'admin', status: 'active', username: 'ana' };
const cookies = () => {
  const jar = new Map<string, string>();
  return {
    jar,
    cookies: {
      get: (name: string) => jar.get(name),
      set: (name: string, value: string) => void jar.set(name, value),
      delete: (name: string) => void jar.delete(name),
    },
  };
};

const event = ({
  ext = 'fake',
  profile = admin as object | null,
  env = { KEY: 'x' } as object,
  search = '',
  jar = cookies(),
  key = '',
}: {
  ext?: string;
  profile?: object | null;
  env?: object;
  search?: string;
  jar?: ReturnType<typeof cookies>;
  key?: string;
} = {}) =>
  ({
    params: { ext, key },
    locals: {
      db: {},
      env,
      getProfile: async () => profile,
      flags: { isEnabled: async () => false },
      log: { warn: () => undefined },
    },
    cookies: jar.cookies,
    url: new URL(`https://x.test/admin/${ext}/callback${search}`),
  }) as unknown as RequestEvent<{ ext: string; key: string }, null>;

const outcome = (result: unknown) =>
  Promise.resolve(result).then(
    (response) => response,
    (thrown) => thrown as { status: number; location?: string; body?: { message: string } },
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(extensionViaApi).mockResolvedValue(null);
});

describe('connecting an extension', () => {
  it('is for admins, and only for an extension that connects', async () => {
    expect(await outcome(connect(event({ profile: null }) as never))).toMatchObject({
      status: 404,
    });
    expect(await outcome(connect(event({ ext: 'bare' }) as never))).toMatchObject({ status: 404 });
    expect(await outcome(connect(event({ ext: 'ghost' }) as never))).toMatchObject({ status: 404 });
  });

  it('answers 503 until the deployment has the credentials', async () => {
    expect(await outcome(connect(event({ env: {} }) as never))).toMatchObject({ status: 503 });
  });

  it('remembers a state for the way back and leaves for the extension’s authorize page', async () => {
    const jar = cookies();

    const thrown = (await outcome(connect(event({ jar }) as never))) as {
      status: number;
      location: string;
    };

    const state = jar.jar.get('fake_oauth_state');
    expect(state).toMatch(/^[0-9a-f-]{36}$/);
    expect(thrown).toMatchObject({
      status: 303,
      location: `https://auth.fake.test/authorize?state=${state}`,
    });
  });
});

describe('coming back from the extension', () => {
  const back = async (search: string, jar = cookies()) =>
    outcome(callback(event({ jar, search }) as never));

  it('refuses a state it did not issue', async () => {
    const jar = cookies();
    jar.jar.set('fake_oauth_state', 'issued');

    expect(await back('?state=other&code=c', jar)).toMatchObject({ status: 400 });
    expect(await back('?code=c')).toMatchObject({ status: 400 });
    expect(complete).not.toHaveBeenCalled();
  });

  it('spends the state whatever happens next', async () => {
    const jar = cookies();
    jar.jar.set('fake_oauth_state', 's');

    await back('?state=s&error=access_denied', jar);

    expect(jar.jar.has('fake_oauth_state')).toBe(false);
  });

  it('reports a refusal or a missing code as a connection error', async () => {
    for (const search of ['?state=s&error=access_denied', '?state=s']) {
      const jar = cookies();
      jar.jar.set('fake_oauth_state', 's');
      expect(await back(search, jar)).toMatchObject({
        status: 303,
        location: '/admin/fake?connection_error=1',
      });
    }
    expect(complete).not.toHaveBeenCalled();
  });

  it('saves the account through the extension’s own action and reports it connected', async () => {
    const jar = cookies();
    jar.jar.set('fake_oauth_state', 's');

    expect(await back('?state=s&code=the-code', jar)).toMatchObject({
      status: 303,
      location: '/admin/fake?connected=1',
    });

    expect(complete).toHaveBeenCalledWith({ KEY: 'x' }, 'the-code', expect.any(Function));
    expect(apply).toHaveBeenCalledWith({}, { KEY: 'x' }, { token: 'sealed' });
  });

  it('leaves the saving to the api Worker when it took the call', async () => {
    vi.mocked(extensionViaApi).mockResolvedValue({ eventIds: [], connected: true });
    const jar = cookies();
    jar.jar.set('fake_oauth_state', 's');

    expect(await back('?state=s&code=c', jar)).toMatchObject({
      location: '/admin/fake?connected=1',
    });

    expect(extensionViaApi).toHaveBeenCalledWith(expect.anything(), 'fake', 'admin', 'connect', {
      token: 'sealed',
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it('reports a failed handshake or an invalid account as a connection error, never logging it', async () => {
    complete.mockRejectedValueOnce(new Error('token leaked in here'));
    const first = cookies();
    first.jar.set('fake_oauth_state', 's');
    expect(await back('?state=s&code=c', first)).toMatchObject({
      location: '/admin/fake?connection_error=1',
    });

    vi.mocked(extensionViaApi).mockResolvedValue({ invalid: true });
    const second = cookies();
    second.jar.set('fake_oauth_state', 's');
    expect(await back('?state=s&code=c', second)).toMatchObject({
      location: '/admin/fake?connection_error=1',
    });
    expect(apply).not.toHaveBeenCalled();
  });
});

describe('an extension’s public asset', () => {
  it('is served without cookies, never cached, never indexed', async () => {
    const response = (await asset(event({ key: 'k' }) as never)) as Response;

    expect(found).toHaveBeenCalledWith({}, 'k');
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2, 3]);
  });

  it('is a 404 for an unknown extension, one without assets, or a key with nothing behind it', async () => {
    expect(await outcome(asset(event({ ext: 'ghost' }) as never))).toMatchObject({ status: 404 });
    expect(await outcome(asset(event({ ext: 'bare' }) as never))).toMatchObject({ status: 404 });
    found.mockResolvedValueOnce(null as never);
    expect(await outcome(asset(event({ key: 'gone' }) as never))).toMatchObject({ status: 404 });
  });
});

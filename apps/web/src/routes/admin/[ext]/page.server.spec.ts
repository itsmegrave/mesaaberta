import type { RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Extension } from '@mesaaberta/core/server/extensions/index';
import { actorsOnly, apiOver } from '#lib/server/db/test-api.js';
import { actions, load } from './+page.server';

const apply = vi.fn(async (_db: unknown, _env: unknown, data: { tableId: string }) => ({
  reconciled: data.tableId,
}));
const panel = vi.fn(async () => ({ account: null, secretFree: true }));

const fake: Extension = {
  id: 'fake',
  admin: { count: async () => 2, load: panel },
  adminActions: { reconcile: { schema: z.object({ tableId: z.string().min(2) }), apply } },
};

vi.mock('@mesaaberta/core/server/extensions/index', async (original) => ({
  ...(await original<object>()),
  extensionById: (id: string) =>
    id === 'fake' ? fake : id === 'bare' ? { id: 'bare' } : undefined,
}));

const admin = { id: 'admin', role: 'admin', status: 'active', username: 'ana' };

const event = ({
  ext = 'fake',
  profile = admin as object | null,
  search = '',
  fields,
}: {
  ext?: string;
  profile?: object | null;
  search?: string;
  fields?: [string, string][];
} = {}) => {
  const body = new FormData();
  for (const [key, value] of fields ?? []) body.append(key, value);
  const url = new URL(`https://x.test/admin/${ext}${search}`);
  return {
    params: { ext },
    locals: {
      env: apiOver(actorsOnly([admin]), { KEY: 'x' }),
      log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
      getProfile: async () => profile,
    },
    url,
    request: new Request(url, { method: 'POST', body }),
  } as unknown as RequestEvent<{ ext: string }, '/admin/[ext]'>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the tests read whatever shape comes back
const run = (fn: unknown, e: unknown) => Promise.resolve((fn as (e: unknown) => any)(e));
const thrown = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error) => error as { status: number },
  );
const reconcile = (e: RequestEvent<{ ext: string }, '/admin/[ext]'>) =>
  run((actions as Record<string, unknown>).run, e);

beforeEach(() => vi.clearAllMocks());

describe('an extension’s panel page', () => {
  it('is for admins, and only for an extension with a panel', async () => {
    expect(await thrown(run(load, event({ profile: null })))).toMatchObject({ status: 404 });
    expect(await thrown(run(load, event({ ext: 'bare' })))).toMatchObject({ status: 404 });
    expect(await thrown(run(load, event({ ext: 'ghost' })))).toMatchObject({ status: 404 });
  });

  it('shows the panel’s own data, and whether the OAuth connection just came back', async () => {
    expect(await run(load, event())).toEqual({
      account: null,
      secretFree: true,
      section: null,
      connected: false,
      connectionError: false,
    });
    // The api Worker reads it, with its own settings.
    expect(panel).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ KEY: 'x' }));

    expect(await run(load, event({ search: '?connected=1' }))).toMatchObject({ connected: true });
    expect(await run(load, event({ search: '?connection_error=1' }))).toMatchObject({
      connectionError: true,
    });
  });
});

describe('an extension’s hand action', () => {
  it('has the api Worker run the named action with the rest of the form, and passes its answer on', async () => {
    const result = await reconcile(
      event({
        fields: [
          ['action', 'reconcile'],
          ['tableId', 'table-1'],
        ],
      }),
    );

    expect(result).toEqual({ reconciled: 'table-1' });
    expect(apply).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ KEY: 'x' }), {
      tableId: 'table-1',
    });
  });

  it('refuses data its schema refuses, before asking the api', async () => {
    const fields: [string, string][] = [
      ['action', 'reconcile'],
      ['tableId', 'x'],
    ];

    expect(await reconcile(event({ fields }))).toMatchObject({
      status: 400,
      data: { invalid: true },
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it('is for admins, and answers 404 for an action nobody installed', async () => {
    const fields: [string, string][] = [['action', 'reconcile']];
    expect(await thrown(reconcile(event({ profile: null, fields })))).toMatchObject({
      status: 404,
    });
    expect(await thrown(reconcile(event({ fields: [['action', 'explode']] })))).toMatchObject({
      status: 404,
    });
    expect(await thrown(reconcile(event({ fields: [['action', 'toString']] })))).toMatchObject({
      status: 404,
    });
    expect(await thrown(reconcile(event({ ext: 'bare', fields })))).toMatchObject({ status: 404 });
  });
});

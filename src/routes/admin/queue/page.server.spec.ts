import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Invalid } from '$lib/server/errors';
import { dispatchEvent } from '$lib/server/events/dispatcher';
import { approveEntry, mergeEntry, renameEntry } from '$lib/server/admin/catalog';
import { actions } from './+page.server';

vi.mock('$lib/server/admin/catalog', async (original) => ({
  ...(await original<typeof import('$lib/server/admin/catalog')>()),
  approveEntry: vi.fn(async () => 'event-1'),
  rejectEntry: vi.fn(async () => 'event-2'),
  renameEntry: vi.fn(async () => 'event-3'),
  mergeEntry: vi.fn(async () => 'event-4'),
}));
vi.mock('$lib/server/events/dispatcher', () => ({ dispatchEvent: vi.fn() }));

const admin = { id: 'admin', role: 'admin', status: 'active', username: 'ana' };
const entry = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';

function event(form: Record<string, string>, profile: object = admin) {
  const after: ((db: unknown) => Promise<unknown>)[] = [];
  return {
    after,
    event: {
      locals: {
        db: {},
        getUser: async () => ({ id: 'admin' }),
        getProfile: async () => profile,
        afterResponse: (task: (db: unknown) => Promise<unknown>) => void after.push(task),
      },
      url: new URL('https://x.test/admin/queue'),
      request: new Request('https://x.test/admin/queue', {
        method: 'POST',
        body: new URLSearchParams(form),
      }),
    } as unknown as RequestEvent,
  };
}

const run = (name: keyof typeof actions, e: RequestEvent) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- whatever the action returns
  (actions[name] as unknown as (e: RequestEvent) => Promise<any>)(e);

beforeEach(() => vi.clearAllMocks());

describe('the queue actions', () => {
  it('answer 404 to someone who is not an admin, even if the hook is bypassed', async () => {
    const { event: e } = event({ kind: 'tag', id: entry }, { ...admin, role: 'member' });
    await expect(run('approve', e)).rejects.toMatchObject({ status: 404 });
    expect(approveEntry).not.toHaveBeenCalled();
  });

  it('approve, and dispatch the event after the response', async () => {
    const { event: e, after } = event({ kind: 'tag', id: entry });

    const result = await run('approve', e);

    expect(result.form.valid).toBe(true);
    expect(approveEntry).toHaveBeenCalledWith({}, admin, 'tag', entry);
    expect(after).toHaveLength(1);
    await after[0]({});
    expect(dispatchEvent).toHaveBeenCalledWith({}, expect.anything(), 'event-1');
  });

  it('refuse an id that is not an id, and a kind that is not a catalog', async () => {
    expect((await run('approve', event({ kind: 'tag', id: 'x' }).event)).status).toBe(400);
    expect((await run('approve', event({ kind: 'system', id: entry }).event)).status).toBe(400);
    expect(approveEntry).not.toHaveBeenCalled();
  });

  it('rename with the typed name, and refuse a name that is too short', async () => {
    await run('rename', event({ kind: 'platform', id: entry, name: 'Roll 20' }).event);
    expect(renameEntry).toHaveBeenCalledWith({}, admin, 'platform', entry, 'Roll 20');

    const short = await run('rename', event({ kind: 'platform', id: entry, name: 'a' }).event);
    expect(short.status).toBe(400);
    expect(short.data.form.errors.name).toEqual(['too_small']);
  });

  it('put what the service refuses on its field', async () => {
    vi.mocked(renameEntry).mockRejectedValueOnce(new Invalid('name', 'taken'));
    const taken = await run('rename', event({ kind: 'tag', id: entry, name: 'Terror' }).event);
    expect(taken.data.form.errors.name).toEqual(['taken']);

    vi.mocked(mergeEntry).mockRejectedValueOnce(new Invalid('into', 'not_approved'));
    const merge = await run('merge', event({ kind: 'tag', id: entry, into: other }).event);
    expect(merge.data.form.errors.into).toEqual(['not_approved']);
  });

  it('merge refuses folding an entry into itself before the service is asked', async () => {
    const result = await run('merge', event({ kind: 'tag', id: entry, into: entry }).event);
    expect(result.status).toBe(400);
    expect(result.data.form.errors.into).toEqual(['same']);
    expect(mergeEntry).not.toHaveBeenCalled();
  });

  it('an entry that is gone is an error of the form', async () => {
    vi.mocked(approveEntry).mockRejectedValueOnce(new Invalid('id', 'not_found'));
    const result = await run('approve', event({ kind: 'tag', id: entry }).event);
    expect(result.status).toBe(400);
    expect(result.data.form.errors.id).toEqual(['not_found']);
  });
});

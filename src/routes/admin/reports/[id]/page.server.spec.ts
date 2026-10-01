import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Invalid } from '$lib/server/errors';
import { dispatchEvent } from '$lib/server/events/dispatcher';
import { closeReport, startReview } from '$lib/server/moderation/admin';
import { actions } from './+page.server';

vi.mock('$lib/server/moderation/admin', async (original) => ({
  ...(await original<typeof import('$lib/server/moderation/admin')>()),
  startReview: vi.fn(async () => 'event-1'),
  closeReport: vi.fn(async () => 'event-2'),
}));
vi.mock('$lib/server/events/dispatcher', () => ({ dispatchEvent: vi.fn() }));

const admin = { id: 'admin', role: 'admin', status: 'active', username: 'ana' };
const report = '00000000-0000-4000-8000-000000000001';

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
      url: new URL(`https://x.test/admin/reports/${report}`),
      request: new Request(`https://x.test/admin/reports/${report}`, {
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

describe('the report decisions', () => {
  it('answer 404 to someone who is not an admin, even if the hook is bypassed', async () => {
    const { event: e } = event({ id: report, note: '' }, { ...admin, role: 'member' });
    await expect(run('accept', e)).rejects.toMatchObject({ status: 404 });
    expect(closeReport).not.toHaveBeenCalled();
  });

  it('accept with the note, and dispatch the event after the response', async () => {
    const { event: e, after } = event({ id: report, note: '  Mesa desativada  ' });

    const result = await run('accept', e);

    expect(result.form.valid).toBe(true);
    expect(closeReport).toHaveBeenCalledWith({}, admin, report, 'resolved', 'Mesa desativada');
    await after[0]({});
    expect(dispatchEvent).toHaveBeenCalledWith(
      {},
      expect.anything(),
      'event-2',
      expect.any(Date),
      e.locals.log,
    );
  });

  it('refuse a note over the limit before the service sees it', async () => {
    const { event: e } = event({ id: report, note: 'x'.repeat(1001) });

    const result = await run('dismiss', e);

    expect(result.status).toBe(400);
    expect(result.data.form.errors.note).toEqual(['too_big']);
    expect(closeReport).not.toHaveBeenCalled();
  });

  it('put what the service refuses on the form, and dispatch nothing', async () => {
    vi.mocked(startReview).mockRejectedValueOnce(new Invalid('id', 'not_open'));
    const { event: e, after } = event({ id: report });

    const result = await run('review', e);

    expect(result.status).toBe(400);
    expect(result.data.form.errors.id).toEqual(['not_open']);
    expect(after).toHaveLength(0);
  });
});

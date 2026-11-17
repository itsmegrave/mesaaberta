import type { RequestEvent } from '@sveltejs/kit';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Invalid } from '@mesaaberta/core/server/errors';
import { dispatchEvent } from '@mesaaberta/core/server/events/dispatcher';
import { closeReport, startReview } from '@mesaaberta/core/server/moderation/admin';
import { profiles } from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '#lib/server/db/test-db.js';
import { apiOver } from '#lib/server/db/test-api.js';
import { actions } from './+page.server';

vi.mock('@mesaaberta/core/server/moderation/admin', async (original) => ({
  ...(await original<typeof import('@mesaaberta/core/server/moderation/admin')>()),
  startReview: vi.fn(async () => 'event-1'),
  closeReport: vi.fn(async () => 'event-2'),
}));
vi.mock('@mesaaberta/core/server/events/dispatcher', () => ({ dispatchEvent: vi.fn() }));

const admin = {
  id: '00000000-0000-4000-8000-0000000000ad',
  role: 'admin',
  status: 'active',
  username: 'ana',
};
// The api Worker makes the decisions over the test database (the moderation services are mocked).
let test: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values(admin as never);
});
afterAll(() => test.close());
const report = '00000000-0000-4000-8000-000000000001';

function event(form: Record<string, string>, profile: object = admin) {
  const after: ((db: unknown) => Promise<unknown>)[] = [];
  return {
    after,
    event: {
      locals: {
        db: {},
        getUser: async () => ({ id: admin.id }),
        getProfile: async () => profile,
        env: apiOver(test.db),
        log: { warn: vi.fn() },
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

  it('accept with the note, and leave the event to the api', async () => {
    const { event: e, after } = event({ id: report, note: '  Mesa desativada  ' });

    const result = await run('accept', e);

    expect(result.form.valid).toBe(true);
    expect(closeReport).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: admin.id }),
      report,
      'resolved',
      'Mesa desativada',
    );
    expect(after).toHaveLength(0);
    expect(dispatchEvent).not.toHaveBeenCalled();
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

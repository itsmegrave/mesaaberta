import { beforeEach, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { publishInstagramAction } from './instagram-action';
import { publishInstagramTable, queueInstagramTable } from '../instagram/publisher';
vi.mock('../instagram/publisher', () => ({
  queueInstagramTable: vi.fn(async () => 'queued'),
  publishInstagramTable: vi.fn(async () => 'published'),
}));
vi.mock('$lib/server/auth/policy', () => ({ can: () => true }));
beforeEach(() => vi.clearAllMocks());
it('returns queue feedback before running rendering or publication', async () => {
  const tasks: Array<(db: unknown) => Promise<unknown>> = [];
  const form = new FormData();
  form.set('tableId', '00000000-0000-4000-8000-000000001101');
  const flags = { isEnabled: vi.fn(async () => true) };
  const event = {
    request: new Request('https://test/admin/tables', { method: 'POST', body: form }),
    platform: { env: {} },
    locals: {
      db: {},
      getProfile: async () => ({}),
      flags,
      afterResponse: (task: (db: unknown) => Promise<unknown>) => tasks.push(task),
      log: { error: vi.fn() },
    },
  } as unknown as RequestEvent;
  expect(await publishInstagramAction(event)).toEqual({ publishResult: 'queued' });
  expect(queueInstagramTable).toHaveBeenCalledOnce();
  expect(publishInstagramTable).not.toHaveBeenCalled();
  expect(flags.isEnabled).not.toHaveBeenCalled();
  expect(tasks).toHaveLength(1);
  await tasks[0]({});
  expect(flags.isEnabled).toHaveBeenCalledWith('use_table_image');
  expect(publishInstagramTable).toHaveBeenCalledWith(
    {},
    {},
    form.get('tableId'),
    expect.any(Date),
    { useTableImage: true },
  );
});

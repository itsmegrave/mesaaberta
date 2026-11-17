import { beforeEach, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { requireApi } from '../api-required';
import { extensionAction } from './extension-api';
import { publishSocialAction } from './social-action';
// The action talks to the port, so any installed connector behaves the same here.
const social = vi.hoisted(() => ({ name: 'instagram' }));
vi.mock('@mesaaberta/core/server/social/index', () => ({ socialFor: vi.fn(() => social) }));
vi.mock('@mesaaberta/core/server/auth/policy', () => ({ can: () => true }));
vi.mock('./extension-api', () => ({ extensionAction: vi.fn() }));
vi.mock('../api-required', () => ({ requireApi: vi.fn(async () => ({ eventIds: [] })) }));
beforeEach(() => vi.clearAllMocks());

const tableId = '00000000-0000-4000-8000-000000001101';
const event = () => {
  const form = new FormData();
  form.set('tableId', tableId);
  return {
    request: new Request('https://test/admin/tables', { method: 'POST', body: form }),
    locals: { env: {}, getProfile: async () => ({ id: 'admin' }), log: { error: vi.fn() } },
  } as unknown as RequestEvent;
};

it('queues through the api, then has it render and publish after its answer', async () => {
  vi.mocked(extensionAction).mockResolvedValueOnce({ result: 'queued' });

  expect(await publishSocialAction(event())).toEqual({ publishResult: 'queued' });
  expect(extensionAction).toHaveBeenCalledWith(expect.anything(), 'instagram', 'admin', 'queue', {
    tableId,
  });
  expect(requireApi).toHaveBeenCalledWith(
    expect.anything(),
    { id: 'admin' },
    '/v1/admin/social/publish',
    { method: 'POST', body: { tableId } },
  );
});

it('publishes nothing when the table was not queued, and reports a failure without details', async () => {
  vi.mocked(extensionAction).mockResolvedValueOnce({ result: 'already_published' });
  expect(await publishSocialAction(event())).toEqual({ publishResult: 'already_published' });
  expect(requireApi).not.toHaveBeenCalled();

  vi.mocked(extensionAction).mockRejectedValueOnce(new Error('token in here'));
  expect(await publishSocialAction(event())).toMatchObject({
    status: 502,
    data: { publishError: 'failed' },
  });
});

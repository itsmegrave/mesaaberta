import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Invalid } from '@mesaaberta/core/server/errors';
import { requireApi } from '../api-required';
import { extensionAction } from './extension-api';

vi.mock('../api-required', () => ({ requireApi: vi.fn() }));

const locals = {} as App.Locals;

beforeEach(() => vi.mocked(requireApi).mockReset());

describe('extensionAction', () => {
  it('has the api run the action as the admin, and answers without the event ids', async () => {
    vi.mocked(requireApi).mockResolvedValueOnce({ eventIds: [], result: 'queued' });

    expect(await extensionAction(locals, 'fake', 'admin', 'queue', { tableId: 't' })).toEqual({
      result: 'queued',
    });
    expect(requireApi).toHaveBeenCalledWith(locals, { id: 'admin' }, '/v1/admin/fake/queue', {
      method: 'POST',
      body: { tableId: 't' },
    });
  });

  it('says invalid for data the action refuses, and lets any other failure surface', async () => {
    vi.mocked(requireApi).mockRejectedValueOnce(new Invalid('', 'invalid'));
    expect(await extensionAction(locals, 'fake', 'admin', 'queue', {})).toEqual({ invalid: true });

    vi.mocked(requireApi).mockRejectedValueOnce(Object.assign(new Error('down'), { status: 503 }));
    await expect(extensionAction(locals, 'fake', 'admin', 'queue', {})).rejects.toMatchObject({
      status: 503,
    });
  });
});

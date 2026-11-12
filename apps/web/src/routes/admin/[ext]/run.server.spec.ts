import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Extension } from '@mesaaberta/core/server/extensions/index';
import { extensionAction } from '#lib/server/admin/extension-api.js';
import { actions } from './+page.server';

const fake: Extension = {
  id: 'fake',
  adminActions: {
    post: {
      schema: z.object({ caption: z.string(), media: z.string().startsWith('data:') }),
      apply: async () => ({}),
    },
  },
};
vi.mock('@mesaaberta/core/server/extensions/index', async (original) => ({
  ...(await original<object>()),
  extensionById: (id: string) => (id === 'fake' ? fake : undefined),
}));
vi.mock('#lib/server/admin/extension-api.js', () => ({ extensionAction: vi.fn() }));

const admin = { id: 'admin', role: 'admin', status: 'active', username: 'ana' };
const run = (form: FormData) =>
  actions.run({
    locals: { getProfile: async () => admin },
    params: { ext: 'fake' },
    request: new Request('https://mesa.test/admin/fake?/run', { method: 'POST', body: form }),
  } as never);

beforeEach(() => vi.mocked(extensionAction).mockReset());

describe('an extension’s hand action with a file', () => {
  it('sends the file on as a data URL, beside the other fields', async () => {
    vi.mocked(extensionAction).mockResolvedValueOnce({ queued: true });
    const form = new FormData();
    form.set('action', 'post');
    form.set('caption', 'Bora');
    form.set('media', new File([new Uint8Array([1, 2, 3])], 'a.mp4', { type: 'video/mp4' }));

    expect(await run(form)).toEqual({ queued: true });
    expect(extensionAction).toHaveBeenCalledWith(expect.anything(), 'fake', 'admin', 'post', {
      caption: 'Bora',
      media: 'data:video/mp4;base64,AQID',
    });
  });

  it('refuses a file over the limit before calling the api', async () => {
    const form = new FormData();
    form.set('action', 'post');
    form.set('caption', 'Bora');
    form.set('media', new File([new Uint8Array(25 * 1024 * 1024 + 1)], 'big.mp4'));

    expect(await run(form)).toMatchObject({ status: 413, data: { tooLarge: true } });
    expect(extensionAction).not.toHaveBeenCalled();
  });
});

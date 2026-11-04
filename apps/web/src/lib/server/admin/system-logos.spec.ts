import { beforeEach, describe, expect, it, vi } from 'vitest';
import { serverStorage } from '@mesaaberta/core/server/storage';
import { requireApi } from '../api-required';
import { decideLogo, uploadLogo } from './system-logos';

vi.mock('../api-required', () => ({ requireApi: vi.fn() }));
vi.mock('@mesaaberta/core/server/storage', async (original) => ({
  ...(await original<typeof import('@mesaaberta/core/server/storage')>()),
  serverStorage: vi.fn(),
}));

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const upload = vi.fn(async () => ({ error: null }));
const remove = vi.fn(async () => ({ error: null }));
const locals = { env: {}, log: { warn: vi.fn() } } as unknown as App.Locals;
const admin = { id: 'admin' };
beforeEach(() => {
  vi.mocked(requireApi).mockReset();
  vi.mocked(serverStorage).mockReturnValue({ upload, remove } as never);
  upload.mockClear();
  remove.mockClear();
});

describe('decideLogo', () => {
  it('deletes the file a rejection frees, never one outside the logos folder', async () => {
    vi.mocked(requireApi).mockResolvedValueOnce({ removed: 'systems/x.png' });
    await decideLogo(locals, admin, 'reject', 's1');
    expect(remove).toHaveBeenCalledWith(['systems/x.png']);

    remove.mockClear();
    vi.mocked(requireApi).mockResolvedValueOnce({ removed: 'tables/x.png' });
    await decideLogo(locals, admin, 'reject', 's1');
    expect(remove).not.toHaveBeenCalled();
  });
});

describe('uploadLogo', () => {
  const logo = new File([PNG], 'logo.png', { type: 'image/png' });

  it('stores the file, records it and deletes the one it replaced', async () => {
    vi.mocked(requireApi).mockResolvedValueOnce({ replaced: 'systems/old.png' });
    await uploadLogo(locals, admin, {
      systemId: 's1',
      logo,
      sourcePage: 'https://editora.example/',
      attribution: '',
    });
    const [path] = upload.mock.calls[0] as unknown as [string];
    expect(vi.mocked(requireApi).mock.calls[0][3]).toEqual({
      method: 'POST',
      body: { systemId: 's1', path, sourcePage: 'https://editora.example/', attribution: null },
    });
    expect(remove).toHaveBeenCalledWith(['systems/old.png']);
  });

  it('deletes its own file when the api refuses it', async () => {
    vi.mocked(requireApi).mockRejectedValueOnce(new Error('nope'));
    await expect(
      uploadLogo(locals, admin, {
        systemId: 's1',
        logo,
        sourcePage: 'https://editora.example/',
        attribution: '',
      }),
    ).rejects.toThrow('nope');
    const [path] = upload.mock.calls[0] as unknown as [string];
    expect(remove).toHaveBeenCalledWith([path]);
  });
});

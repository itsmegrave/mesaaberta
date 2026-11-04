import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findSystemLogo } from '@mesaaberta/core/server/systems/logos/finder';
import { serverStorage } from '@mesaaberta/core/server/storage';
import { requireApi } from '../api-required';
import { decideLogo, searchNextLogos, uploadLogo } from './system-logos';

vi.mock('../api-required', () => ({ requireApi: vi.fn() }));
vi.mock('@mesaaberta/core/server/systems/logos/finder', async (original) => ({
  ...(await original<typeof import('@mesaaberta/core/server/systems/logos/finder')>()),
  findSystemLogo: vi.fn(),
}));
vi.mock('@mesaaberta/core/server/storage', async (original) => ({
  ...(await original<typeof import('@mesaaberta/core/server/storage')>()),
  serverStorage: vi.fn(),
}));

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const upload = vi.fn(async () => ({ error: null }));
const remove = vi.fn(async () => ({ error: null }));
const locals = { env: {}, log: { warn: vi.fn() } } as unknown as App.Locals;
const admin = { id: 'admin' };
const candidate = {
  imageUrl: 'https://upload.wikimedia.org/dh.png',
  sourcePage: 'https://commons.wikimedia.org/wiki/File:DH.svg',
  method: 'wikidata' as const,
  confidence: 'high' as const,
  attribution: 'Darrington Press',
  license: 'Public domain',
  note: 'nota',
};
const deps = {
  // The picture's host answers the PNG; DNS is public.
  fetcher: vi.fn(async () => new Response(PNG, { headers: { 'content-type': 'image/png' } })),
  resolve: async () => ['93.184.216.34'],
};

beforeEach(() => {
  vi.mocked(requireApi).mockReset();
  vi.mocked(serverStorage).mockReturnValue({ upload, remove } as never);
  upload.mockClear();
  remove.mockClear();
});

describe('searchNextLogos', () => {
  it('stores what it finds, records it as pending and says whether there is more', async () => {
    vi.mocked(requireApi)
      .mockResolvedValueOnce({ systems: [{ id: 's1', name: 'Daggerheart', slug: 'daggerheart' }] })
      .mockResolvedValueOnce({ unused: null });
    vi.mocked(findSystemLogo).mockResolvedValue({
      candidate,
      wikidataId: 'Q2',
      website: null,
      reason: null,
    });

    const result = await searchNextLogos(locals, admin, deps);

    expect(result).toEqual({
      more: true,
      searched: [
        { name: 'Daggerheart', slug: 'daggerheart', outcome: 'found', confidence: 'high' },
      ],
    });
    const [path] = upload.mock.calls[0] as unknown as [string];
    expect(path).toMatch(/^systems\/[0-9a-f-]{36}\.png$/);
    expect(vi.mocked(requireApi).mock.calls[1]).toEqual([
      locals,
      admin,
      '/v1/admin/system-logos/record',
      {
        method: 'POST',
        body: {
          systemId: 's1',
          found: { path, ...candidate, wikidataId: 'Q2' },
          reason: null,
          wikidataId: 'Q2',
        },
      },
    ]);
  });

  it('records a system with nothing as missing, and stops when none is left', async () => {
    vi.mocked(requireApi)
      .mockResolvedValueOnce({ systems: [{ id: 's2', name: 'Caseiro', slug: 'caseiro' }] })
      .mockResolvedValueOnce({ unused: null })
      .mockResolvedValueOnce({ systems: [] });
    vi.mocked(findSystemLogo).mockResolvedValue({
      candidate: null,
      wikidataId: null,
      website: null,
      reason: 'no_wikidata_item',
    });

    expect((await searchNextLogos(locals, admin, deps)).searched[0].outcome).toBe('missing');
    expect(vi.mocked(requireApi).mock.calls[1][3]).toMatchObject({
      body: { found: null, reason: 'no_wikidata_item' },
    });
    expect(upload).not.toHaveBeenCalled();
    expect(await searchNextLogos(locals, admin, deps)).toEqual({ searched: [], more: false });
  });

  it('deletes the file when another search recorded the system first', async () => {
    vi.mocked(requireApi)
      .mockResolvedValueOnce({ systems: [{ id: 's1', name: 'Daggerheart', slug: 'daggerheart' }] })
      .mockResolvedValueOnce({ unused: 'systems/late.png' });
    vi.mocked(findSystemLogo).mockResolvedValue({
      candidate,
      wikidataId: 'Q2',
      website: null,
      reason: null,
    });

    await searchNextLogos(locals, admin, deps);
    expect(remove).toHaveBeenCalledWith(['systems/late.png']);
  });

  it('records a picture it cannot read as missing, with why', async () => {
    vi.mocked(requireApi)
      .mockResolvedValueOnce({ systems: [{ id: 's1', name: 'Daggerheart', slug: 'daggerheart' }] })
      .mockResolvedValueOnce({ unused: null });
    vi.mocked(findSystemLogo).mockResolvedValue({
      candidate,
      wikidataId: 'Q2',
      website: null,
      reason: null,
    });
    const html = {
      ...deps,
      fetcher: vi.fn(
        async () => new Response('<html>', { headers: { 'content-type': 'image/png' } }),
      ),
    };

    expect((await searchNextLogos(locals, admin, html)).searched[0].outcome).toBe(
      'image_unreadable',
    );
    expect(vi.mocked(requireApi).mock.calls[1][3]).toMatchObject({
      body: { found: null, reason: `image_unreadable: ${candidate.imageUrl}` },
    });
  });
});

describe('searchNextLogos when Wikidata does not answer', () => {
  it('records nothing and stops, so an outage never marks systems as missing', async () => {
    vi.mocked(requireApi).mockResolvedValueOnce({
      systems: [{ id: 's1', name: 'Daggerheart', slug: 'daggerheart' }],
    });
    vi.mocked(findSystemLogo).mockResolvedValue({
      candidate: null,
      wikidataId: null,
      website: null,
      reason: 'lookup_failed',
    });

    expect(await searchNextLogos(locals, admin, deps)).toEqual({
      searched: [],
      more: false,
      failed: true,
      retryAfter: undefined,
    });
    expect(requireApi).toHaveBeenCalledTimes(1);
  });
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

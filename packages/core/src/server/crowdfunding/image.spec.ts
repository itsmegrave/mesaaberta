import { describe, expect, it, vi } from 'vitest';
import { Invalid } from '../errors';
import type { ImageStorage } from '../images';
import { campaignImagePath } from './image';
import type { Resolver } from './link-preview';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const publicDns: Resolver = async () => ['93.184.216.34'];
const storage = (): ImageStorage & { uploaded: string[] } => {
  const uploaded: string[] = [];
  return {
    uploaded,
    upload: async (path) => {
      uploaded.push(path);
      return { error: null };
    },
  };
};

describe('campaignImagePath', () => {
  it('stores the uploaded file under the crowdfunding folder', async () => {
    const store = storage();

    const path = await campaignImagePath(store, {
      upload: new File([PNG], 'capa.png', { type: 'image/png' }),
    });

    expect(path).toMatch(/^crowdfunding\/[0-9a-f-]+\.png$/);
    expect(store.uploaded).toEqual([path]);
  });

  it('refuses an upload that is not an image, by its bytes and not its name', async () => {
    await expect(
      campaignImagePath(storage(), {
        upload: new File(['<svg/>'], 'a.png', { type: 'image/png' }),
      }),
    ).rejects.toMatchObject({ field: 'image', message: 'not_an_image' });
    await expect(
      campaignImagePath(undefined, { upload: new File([PNG], 'a.png', { type: 'image/png' }) }),
    ).rejects.toBeInstanceOf(Invalid);
  });

  it("copies the page's own picture when nothing was uploaded", async () => {
    const store = storage();
    const fetcher = vi.fn(
      async () => new Response(PNG, { headers: { 'content-type': 'image/png' } }),
    );

    const path = await campaignImagePath(store, {
      pageImageUrl: 'https://cdn.example.com/capa.png',
      fetcher,
      resolve: publicDns,
    });

    expect(path).toMatch(/^crowdfunding\//);
    expect(store.uploaded).toHaveLength(1);
  });

  it('prefers the upload over the page picture, and never reads the page then', async () => {
    const fetcher = vi.fn();

    await campaignImagePath(storage(), {
      upload: new File([PNG], 'a.png', { type: 'image/png' }),
      pageImageUrl: 'https://cdn.example.com/capa.png',
      fetcher,
      resolve: publicDns,
    });

    expect(fetcher).not.toHaveBeenCalled();
  });

  it('has no picture, without failing, when the page picture is unsafe, not an image or cannot be stored', async () => {
    const never = vi.fn();
    expect(
      await campaignImagePath(storage(), {
        pageImageUrl: 'https://127.0.0.1/a.png',
        fetcher: never,
        resolve: publicDns,
      }),
    ).toBeNull();
    expect(never).not.toHaveBeenCalled();

    const html = vi.fn(
      async () => new Response('<html>', { headers: { 'content-type': 'image/png' } }),
    );
    expect(
      await campaignImagePath(storage(), {
        pageImageUrl: 'https://cdn.example.com/a.png',
        fetcher: html,
        resolve: publicDns,
      }),
    ).toBeNull();

    const refusing: ImageStorage = { upload: async () => ({ error: { message: 'no policy' } }) };
    const png = vi.fn(async () => new Response(PNG, { headers: { 'content-type': 'image/png' } }));
    expect(
      await campaignImagePath(refusing, {
        pageImageUrl: 'https://cdn.example.com/a.png',
        fetcher: png,
        resolve: publicDns,
      }),
    ).toBeNull();
    expect(
      await campaignImagePath(undefined, { pageImageUrl: 'https://cdn.example.com/a.png' }),
    ).toBeNull();
  });
});

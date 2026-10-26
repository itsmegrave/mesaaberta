import { afterEach, describe, expect, it, vi } from 'vitest';
import { isInside, serverStorage } from './storage';

describe('serverStorage', () => {
  it('is null until the project URL and a secret key are set', () => {
    expect(serverStorage(undefined, 'table-images')).toBeNull();
    expect(serverStorage({ SUPABASE_URL: 'https://x.supabase.co' }, 'table-images')).toBeNull();
    expect(serverStorage({ SUPABASE_SECRET_KEY: 'sb_secret_x' }, 'table-images')).toBeNull();
  });

  it('uses the secret key, or its legacy name', () => {
    for (const key of ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
      const storage = serverStorage(
        { SUPABASE_URL: 'https://x.supabase.co', [key]: 'secret' },
        'profile-avatars',
      );
      expect(storage).toMatchObject({ upload: expect.any(Function), remove: expect.any(Function) });
    }
  });
});

describe('serverStorage with STORAGE_PROVIDER=s3', () => {
  const env = {
    STORAGE_PROVIDER: 's3',
    S3_ENDPOINT: 'https://acc.r2.cloudflarestorage.com/',
    S3_BUCKET: 'mesa-files',
    S3_ACCESS_KEY_ID: 'key',
    S3_SECRET_ACCESS_KEY: 'secret',
  };
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  const options = { contentType: 'image/png', upsert: false, cacheControl: '86400' };
  const answer = (...responses: Response[]) => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    for (const response of responses) fetch.mockResolvedValueOnce(response);
    vi.stubGlobal('fetch', fetch);
    return fetch;
  };
  const sent = (fetch: ReturnType<typeof answer>, call = 0) => fetch.mock.calls[call][0] as Request;
  afterEach(() => vi.unstubAllGlobals());

  it('is null until the endpoint, bucket and keys are all set', () => {
    for (const missing of [
      'S3_ENDPOINT',
      'S3_BUCKET',
      'S3_ACCESS_KEY_ID',
      'S3_SECRET_ACCESS_KEY',
    ]) {
      expect(serverStorage({ ...env, [missing]: '' }, 'table-images')).toBeNull();
    }
  });

  it('puts a signed object under the app bucket, never over an existing one', async () => {
    const fetch = answer(new Response(null, { status: 200 }));
    const storage = serverStorage(env, 'profile-avatars')!;

    await expect(storage.upload('u1/banners/a.png', png, options)).resolves.toEqual({
      error: null,
    });
    const request = sent(fetch);
    expect(request.method).toBe('PUT');
    expect(request.url).toBe(
      'https://acc.r2.cloudflarestorage.com/mesa-files/profile-avatars/u1/banners/a.png',
    );
    expect(request.headers.get('if-none-match')).toBe('*');
    expect(request.headers.get('content-type')).toBe('image/png');
    expect(request.headers.get('cache-control')).toBe('max-age=86400');
    expect(request.headers.get('authorization')).toMatch(
      /^AWS4-HMAC-SHA256 Credential=key\/\d{8}\/auto\/s3\/aws4_request/,
    );
  });

  it("answers the store's refusal as an error, so the form says the upload failed", async () => {
    answer(new Response('<Error><Code>PreconditionFailed</Code></Error>', { status: 412 }));
    const { error } = await serverStorage(env, 'table-images')!.upload(
      'tables/a.png',
      png,
      options,
    );
    expect(error?.message).toMatch(/^412 .*PreconditionFailed/);
  });

  it('deletes each file, and a file already gone is not an error', async () => {
    const fetch = answer(new Response(null, { status: 204 }), new Response(null, { status: 404 }));
    const storage = serverStorage(env, 'profile-avatars')!;

    await expect(storage.remove(['u1/a.png', 'u1/b.png'])).resolves.toEqual({ error: null });
    expect(fetch.mock.calls.map((_, i) => [sent(fetch, i).method, sent(fetch, i).url])).toEqual([
      ['DELETE', 'https://acc.r2.cloudflarestorage.com/mesa-files/profile-avatars/u1/a.png'],
      ['DELETE', 'https://acc.r2.cloudflarestorage.com/mesa-files/profile-avatars/u1/b.png'],
    ]);
  });

  it('stops at a delete the store refuses', async () => {
    answer(new Response('denied', { status: 403 }));
    const { error } = await serverStorage(env, 'profile-avatars')!.remove(['u1/a.png']);
    expect(error).toEqual({ message: '403 denied' });
  });
});

describe('isInside', () => {
  const ana = '00000000-0000-4000-8000-000000000001';

  it('accepts files in the folder and below it', () => {
    expect(isInside(`${ana}/a.png`, ana)).toBe(true);
    expect(isInside(`${ana}/banners/a.webp`, ana)).toBe(true);
    expect(isInside(`partners/${ana}/logo.png`, 'partners')).toBe(true);
  });

  it("refuses someone else's folder, the folder itself and climbing out of it", () => {
    expect(isInside(`00000000-0000-4000-8000-000000000002/a.png`, ana)).toBe(false);
    expect(isInside(`${ana}x/a.png`, ana)).toBe(false);
    expect(isInside(`${ana}/`, ana)).toBe(false);
    expect(isInside(`${ana}/../b/a.png`, ana)).toBe(false);
    expect(isInside(`${ana}//a.png`, ana)).toBe(false);
  });
});

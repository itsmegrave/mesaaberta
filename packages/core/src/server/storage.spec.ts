import { describe, expect, it } from 'vitest';
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

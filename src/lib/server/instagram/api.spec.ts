import { describe, expect, it } from 'vitest';
import { decryptToken, encryptToken, responseJson, InstagramError } from './api';
const key = Buffer.alloc(32, 3).toString('base64');
describe('Instagram credentials', () => {
  it('encrypts with a fresh nonce and authenticates ciphertext', async () => {
    const encrypted = await encryptToken('secret-token', key);
    expect(encrypted).not.toContain('secret-token');
    expect(await decryptToken(encrypted, key)).toBe('secret-token');
    expect(await encryptToken('secret-token', key)).not.toBe(encrypted);
    await expect(decryptToken(encrypted, Buffer.alloc(32, 4).toString('base64'))).rejects.toThrow();
  });
  it('does not propagate Meta messages that could contain credentials', async () => {
    await expect(
      responseJson(
        new Response(JSON.stringify({ error: { code: 190, message: 'secret-token' } }), {
          status: 400,
        }),
      ),
    ).rejects.toEqual(new InstagramError(190, false));
  });
});

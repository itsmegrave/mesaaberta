import { describe, expect, it } from 'vitest';
import { isDecodable } from './decodable';

async function png() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 4;
  const blob = await new Promise<Blob>((done) => canvas.toBlob((b) => done(b!), 'image/png'));
  return new File([blob], 'a.png', { type: 'image/png' });
}

describe('isDecodable', () => {
  it('is true for a picture the browser can draw', async () => {
    expect(await isDecodable(await png())).toBe(true);
  });

  it('is false for bytes that only claim to be a picture', async () => {
    const fake = new File([new Uint8Array(1024)], 'capa.png', { type: 'image/png' });
    expect(await isDecodable(fake)).toBe(false);
    expect(
      await isDecodable(
        new File(['<svg onload="alert(1)"></svg>'], 'x.png', { type: 'image/png' }),
      ),
    ).toBe(false);
  });
});

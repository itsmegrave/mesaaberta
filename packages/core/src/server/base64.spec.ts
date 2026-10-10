import { describe, expect, it } from 'vitest';
import { bytesToBase64 } from './base64';

describe('bytesToBase64', () => {
  it('matches Buffer for bytes of every length remainder', () => {
    for (const length of [0, 1, 2, 3, 4, 100]) {
      const bytes = Uint8Array.from({ length }, (_, index) => (index * 37 + 11) % 256);
      expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
    }
  });

  it('accepts an ArrayBuffer and survives more than one chunk', () => {
    const bytes = Uint8Array.from({ length: 0x8000 * 2 + 5 }, (_, index) => index % 256);
    expect(bytesToBase64(bytes.buffer)).toBe(Buffer.from(bytes).toString('base64'));
  });
});

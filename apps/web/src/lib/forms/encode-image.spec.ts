import { describe, expect, it, vi } from 'vitest';
import { encodeImage } from './encode-image';
import { MAX_IMAGE_BYTES } from './files';

const blob = (size: number, type: string) => new Blob([new Uint8Array(size)], { type });
const canvas = (encode: (type: string, quality: number) => Blob | null) => ({
  toBlob: vi.fn((done: BlobCallback, type?: string, quality?: number) =>
    done(encode(type!, quality!)),
  ),
});

describe('encodeImage', () => {
  it('stops encoding once a WebP meets the transfer budget', async () => {
    const source = canvas((type) => blob(100_000, type));
    expect((await encodeImage(source))?.type).toBe('image/webp');
    expect(source.toBlob).toHaveBeenCalledTimes(1);
  });

  it('reduces quality when the first output exceeds the transfer budget', async () => {
    const source = canvas((type, quality) => blob(quality > 0.7 ? 400_000 : 200_000, type));
    expect((await encodeImage(source))?.size).toBe(200_000);
    expect(source.toBlob).toHaveBeenCalledTimes(2);
  });

  it('uses JPEG when WebP silently falls back to PNG', async () => {
    const source = canvas((type) => blob(100_000, type === 'image/webp' ? 'image/png' : type));
    expect((await encodeImage(source))?.type).toBe('image/jpeg');
  });

  it('uses JPEG when the WebP encoder returns no output', async () => {
    const source = canvas((type) => (type === 'image/webp' ? null : blob(100_000, type)));
    expect((await encodeImage(source))?.type).toBe('image/jpeg');
  });

  it('keeps the smallest output if the target is unreachable but the upload limit is met', async () => {
    const source = canvas((type, quality) => blob(Math.round(quality * 1_000_000), type));
    expect((await encodeImage(source))?.size).toBe(550_000);
  });

  it('refuses output that still exceeds the server upload limit', async () => {
    const source = canvas((type) => blob(MAX_IMAGE_BYTES + 1, type));
    expect(await encodeImage(source)).toBeNull();
  });
});

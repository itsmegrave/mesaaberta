import { describe, expect, it } from 'vitest';
import { withoutMetadata } from './image-metadata';

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));
const has = (bytes: Uint8Array, text: string) =>
  Buffer.from(bytes).includes(Buffer.from(text, 'latin1'));

const segment = (marker: number, payload: number[]) => [
  0xff,
  marker,
  (payload.length + 2) >> 8,
  (payload.length + 2) & 255,
  ...payload,
];

const jpeg = new Uint8Array([
  0xff,
  0xd8,
  ...segment(0xe0, ascii('JFIF\0')),
  ...segment(0xe1, ascii('Exif\0\0GPS-HOME')),
  ...segment(0xe2, ascii('ICC_PROFILE\0')),
  ...segment(0xfe, ascii('a comment')),
  0xff,
  0xda,
  0,
  2,
  1,
  2,
  3,
  0xff,
  0xd9,
]);

const pngChunk = (name: string, data: number[]) => [
  0,
  0,
  0,
  data.length,
  ...ascii(name),
  ...data,
  0,
  0,
  0,
  0,
];
const png = new Uint8Array([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  ...pngChunk('IHDR', [1, 2, 3]),
  ...pngChunk('eXIf', ascii('GPS-HOME')),
  ...pngChunk('tEXt', ascii('Author')),
  ...pngChunk('IDAT', [9, 9]),
  ...pngChunk('IEND', []),
]);

const webpChunk = (name: string, data: number[]) => [
  ...ascii(name),
  data.length,
  0,
  0,
  0,
  ...data,
  ...(data.length % 2 ? [0] : []),
];
const webpBody = [
  ...ascii('WEBP'),
  ...webpChunk('VP8X', [0x0c, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  ...webpChunk('VP8 ', [1, 2, 3, 4]),
  ...webpChunk('EXIF', ascii('GPS-HOME')),
];
const webp = new Uint8Array([
  ...ascii('RIFF'),
  webpBody.length & 255,
  webpBody.length >> 8,
  0,
  0,
  ...webpBody,
]);

describe('withoutMetadata', () => {
  it('drops EXIF and comments from a JPEG but keeps what draws it', () => {
    const out = withoutMetadata(jpeg, 'image/jpeg');
    expect(has(out, 'GPS-HOME')).toBe(false);
    expect(has(out, 'a comment')).toBe(false);
    expect(has(out, 'JFIF')).toBe(true);
    expect(has(out, 'ICC_PROFILE')).toBe(true);
    expect([...out.slice(-7)]).toEqual([0xff, 0xda, 0, 2, 1, 2, 3, 0xff, 0xd9].slice(-7));
  });

  it('drops eXIf and text chunks from a PNG and keeps the picture chunks', () => {
    const out = withoutMetadata(png, 'image/png');
    expect(has(out, 'GPS-HOME')).toBe(false);
    expect(has(out, 'tEXt')).toBe(false);
    expect(has(out, 'IHDR')).toBe(true);
    expect(has(out, 'IDAT')).toBe(true);
    expect(has(out, 'IEND')).toBe(true);
  });

  it('drops EXIF from a WebP, clears its flag and fixes the RIFF size', () => {
    const out = withoutMetadata(webp, 'image/webp');
    expect(has(out, 'GPS-HOME')).toBe(false);
    const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
    expect(view.getUint32(4, true)).toBe(out.length - 8);
    expect(out[20]! & 0x0c).toBe(0);
  });

  it('gives back a file it cannot walk unchanged', () => {
    const junk = new Uint8Array([0xff, 0xd8, 0x00, 0x01]);
    expect(withoutMetadata(junk, 'image/jpeg')).toBe(junk);
  });
});

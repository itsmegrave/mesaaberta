import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { IMAGE_TYPES, imageFile, MAX_IMAGE_BYTES } from './files';

const schema = z.object({ image: imageFile });
const file = (size: number, type = 'image/png', name = 'capa.png') =>
  new File([new Uint8Array(size)], name, { type });
const codes = (value: unknown) => {
  const result = schema.safeParse({ image: value });
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('imageFile', () => {
  it('takes a PNG, JPEG or WebP up to the size limit', () => {
    for (const type of IMAGE_TYPES) expect(codes(file(1024, type))).toEqual([]);
    expect(codes(file(MAX_IMAGE_BYTES))).toEqual([]);
  });

  it('treats no file, or the empty one a file input posts, as no image', () => {
    expect(schema.parse({}).image).toBeUndefined();
    expect(schema.parse({ image: file(0, 'application/octet-stream', '') }).image).toBeUndefined();
  });

  it('refuses a file over the limit before it is uploaded', () => {
    expect(codes(file(MAX_IMAGE_BYTES + 1))).toEqual(['too_big']);
  });

  it('refuses a type that is not an image the site shows, such as an SVG', () => {
    expect(codes(file(1024, 'image/svg+xml', 'x.svg'))).toEqual(['not_an_image']);
  });

  it('refuses something that is not a file at all', () => {
    expect(codes('capa.png')).toEqual(['not_an_image']);
  });
});

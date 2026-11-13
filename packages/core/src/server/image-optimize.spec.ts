import { describe, expect, it, vi } from 'vitest';
import { encode as encodePng } from 'fast-png';
import jpeg from 'jpeg-js';
import {
  decodeImage,
  downscale,
  fitInside,
  imageSize,
  jpegOrientation,
  optimizeImage,
  orient,
  type Pixels,
} from './image-optimize';
import { compressed, optimizeOptionsFor, prepareImage, storeImage } from './images';

/** A noisy picture, so the encoders can't shrink it to nothing. */
const pixels = (width: number, height: number, alpha = 255): Pixels => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = (i * 7) % 256;
    data[i + 1] = (i * 13) % 256;
    data[i + 2] = (i * 31) % 256;
    data[i + 3] = alpha;
  }
  return { width, height, data };
};

/** Something like a photo: smooth light with grain, which a PNG keeps losslessly and big. */
const photo = (width: number, height: number): Pixels => {
  const data = new Uint8ClampedArray(width * height * 4);
  let seed = 7;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const grain = (seed % 17) - 8;
      const i = (y * width + x) * 4;
      data[i] = (x * 255) / width + grain;
      data[i + 1] = (y * 255) / height + grain;
      data[i + 2] = 128 + grain;
      data[i + 3] = 255;
    }
  return { width, height, data };
};

const png = (width: number, height: number, image = pixels(width, height)) =>
  encodePng({
    width,
    height,
    data: new Uint8Array(image.data.buffer),
    channels: 4,
    depth: 8,
  });

const jpg = (width: number, height: number) =>
  new Uint8Array(
    jpeg.encode({ width, height, data: new Uint8Array(pixels(width, height).data.buffer) }, 95)
      .data,
  );

/** A JPEG with an EXIF block saying how the camera was held. */
const withOrientation = (data: Uint8Array, value: number) => {
  // APP1 "Exif\0\0", big-endian TIFF, one IFD entry: 0x0112 (Orientation), SHORT, 1, value.
  const exif = [
    0xff,
    0xe1,
    0x00,
    0x22,
    0x45,
    0x78,
    0x69,
    0x66,
    0x00,
    0x00,
    0x4d,
    0x4d,
    0x00,
    0x2a,
    0x00,
    0x00,
    0x00,
    0x08,
    0x00,
    0x01,
    0x01,
    0x12,
    0x00,
    0x03,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    value,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
  ];
  const out = new Uint8Array(data.length + exif.length);
  out.set(data.subarray(0, 2));
  out.set(exif, 2);
  out.set(data.subarray(2), 2 + exif.length);
  return out;
};

describe('imageSize', () => {
  it('reads a PNG and a JPEG header without decoding, so a huge picture is refused first', () => {
    expect(imageSize(png(30, 20))).toEqual({ width: 30, height: 20 });
    expect(imageSize(jpg(40, 25))).toEqual({ width: 40, height: 25 });
  });

  it('reads the WebP it writes', async () => {
    const result = await optimizeImage(png(48, 32), 'image/png', { maxWidth: 99, maxHeight: 99 });
    expect(imageSize(result!.bytes)).toEqual({ width: 48, height: 32 });
  });

  it('gives up on bytes that are no picture, instead of guessing a size', () => {
    expect(imageSize(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe('fitInside', () => {
  it('keeps the proportions and never makes a picture bigger', () => {
    expect(fitInside(3200, 1280, 1600, 1600)).toEqual({ width: 1600, height: 640 });
    expect(fitInside(800, 2000, 512, 512)).toEqual({ width: 205, height: 512 });
    expect(fitInside(300, 200, 1600, 1600)).toEqual({ width: 300, height: 200 });
  });
});

describe('downscale', () => {
  it('averages the pixels it covers', () => {
    const image: Pixels = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([0, 0, 0, 255, 200, 100, 50, 255]),
    };
    expect([...downscale(image, 1, 1).data]).toEqual([100, 50, 25, 255]);
  });

  it("doesn't darken colour next to a transparent pixel", () => {
    const image: Pixels = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([0, 0, 0, 0, 200, 100, 50, 255]),
    };
    expect([...downscale(image, 1, 1).data]).toEqual([200, 100, 50, 128]);
  });
});

describe('orientation', () => {
  it('reads the EXIF orientation a phone writes', () => {
    expect(jpegOrientation(withOrientation(jpg(8, 4), 6))).toBe(6);
    expect(jpegOrientation(jpg(8, 4))).toBe(1);
  });

  it('turns a sideways photo upright, so it is not stored lying down', async () => {
    const decoded = await decodeImage(withOrientation(jpg(8, 4), 6), 'image/jpeg');
    expect([decoded.width, decoded.height]).toEqual([4, 8]);
  });

  it('puts each corner where orientation 6 (turn right) says', () => {
    const image: Pixels = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([1, 1, 1, 255, 2, 2, 2, 255]),
    };
    // Left pixel ends on top, right one below it.
    expect([...orient(image, 6).data]).toEqual([1, 1, 1, 255, 2, 2, 2, 255]);
    expect(orient(image, 6).width).toBe(1);
    // Orientation 8 (turn left) puts the right pixel on top.
    expect([...orient(image, 8).data]).toEqual([2, 2, 2, 255, 1, 1, 1, 255]);
  });
});

describe('optimizeImage', () => {
  it('turns a big PNG into a WebP that fits, much smaller than it was', async () => {
    const source = png(2400, 960, photo(2400, 960));
    const result = await optimizeImage(source, 'image/png', { maxWidth: 1600, maxHeight: 1600 });

    expect(result?.type).toBe('image/webp');
    expect(imageSize(result!.bytes)).toEqual({ width: 1600, height: 640 });
    expect(result!.bytes.length).toBeLessThan(source.length / 2);
  });

  it('turns a JPEG into a WebP', async () => {
    const result = await optimizeImage(jpg(900, 600), 'image/jpeg', {
      maxWidth: 512,
      maxHeight: 512,
    });
    expect(result?.type).toBe('image/webp');
    expect(imageSize(result!.bytes)).toEqual({ width: 512, height: 341 });
  });

  it('keeps a small WebP that already fits, rather than lose quality encoding it again', async () => {
    const webp = await optimizeImage(png(200, 100), 'image/png', { maxWidth: 999, maxHeight: 999 });
    expect(
      await optimizeImage(webp!.bytes, 'image/webp', { maxWidth: 999, maxHeight: 999 }),
    ).toBeNull();
  });

  it('shrinks a WebP that is bigger than its place', async () => {
    const webp = await optimizeImage(png(800, 400), 'image/png', { maxWidth: 999, maxHeight: 999 });
    const result = await optimizeImage(webp!.bytes, 'image/webp', {
      maxWidth: 400,
      maxHeight: 400,
    });
    expect(imageSize(result!.bytes)).toEqual({ width: 400, height: 200 });
  });
});

it('keeps a flat drawing small by switching to lossless WebP', async () => {
  // Two flat colours, like a logo: tiny as a PNG, bigger as lossy WebP.
  const image: Pixels = { width: 300, height: 300, data: new Uint8ClampedArray(300 * 300 * 4) };
  for (let i = 0; i < image.data.length; i += 4) {
    const left = (i / 4) % 300 < 150;
    image.data.set(left ? [20, 40, 200, 255] : [250, 250, 250, 255], i);
  }
  const source = png(300, 300, image);
  const result = await optimizeImage(source, 'image/png', { maxWidth: 512, maxHeight: 512 });
  expect(result?.type).toBe('image/webp');
  expect(result!.bytes.length).toBeLessThanOrEqual(source.length);
});

describe('optimizeOptionsFor', () => {
  it('keeps covers large and everything shown as a square small', () => {
    expect(optimizeOptionsFor('tables/a.png').maxWidth).toBe(1600);
    expect(optimizeOptionsFor('crowdfunding/a.png').maxWidth).toBe(1600);
    expect(optimizeOptionsFor('places/u/a.png').maxWidth).toBe(1600);
    expect(optimizeOptionsFor('u-1/banners/a.png').maxWidth).toBe(1600);
    expect(optimizeOptionsFor('u-1/a.png').maxWidth).toBe(512);
    expect(optimizeOptionsFor('systems/a.png').maxWidth).toBe(512);
    expect(optimizeOptionsFor('partners/u/a.png').maxWidth).toBe(512);
  });
});

describe('compressed', () => {
  it('stores what was sent when the picture cannot be decoded, and says why', async () => {
    const log = { warn: vi.fn() };
    const broken = {
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]),
      contentType: 'image/png' as const,
      path: 'tables/x.png',
    };
    expect(await compressed(broken, log)).toBe(broken);
    expect(log.warn).toHaveBeenCalledWith(
      'storage.image_compress_failed',
      expect.objectContaining({ code: 'image_compress_failed', imageType: 'image/png' }),
    );
  });
});

describe('storeImage', () => {
  it('uploads a PNG as a WebP under a .webp name, and answers that name', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const image = await prepareImage(new File([png(1800, 720) as BlobPart], 'capa.png'));

    const path = await storeImage({ upload }, image);

    expect(path).toBe(image.path.replace(/\.png$/, '.webp'));
    expect(upload).toHaveBeenCalledWith(path, expect.any(Uint8Array), {
      contentType: 'image/webp',
      upsert: false,
      cacheControl: '2592000',
    });
  });
});

describe('prepareImage', () => {
  it('refuses a picture with more pixels than a Worker can decode', async () => {
    // A PNG header claiming 10000 × 10000; the body never gets read.
    const head = png(1, 1).slice(0, 33);
    new DataView(head.buffer).setUint32(16, 10_000);
    new DataView(head.buffer).setUint32(20, 10_000);
    await expect(prepareImage(new File([head as BlobPart], 'big.png'))).rejects.toMatchObject({
      field: 'image',
      message: 'too_big',
    });
  });
});

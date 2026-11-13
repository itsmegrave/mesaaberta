import decodeWebp, { init as initWebpDecoder } from '@jsquash/webp/decode.js';
import encodeWebp, { init as initWebpEncoder } from '@jsquash/webp/encode.js';
import { convertIndexedToRgb, decode as decodePng } from 'fast-png';
import jpeg from 'jpeg-js';

/** Decoded pixels, four bytes (RGBA) a pixel. */
export type Pixels = { width: number; height: number; data: Uint8ClampedArray };

export type OptimizeOptions = {
  /** The largest width and height kept; a bigger picture is scaled down to fit both. */
  maxWidth: number;
  maxHeight: number;
  /** WebP quality, 0-100. */
  quality?: number;
};

/** More pixels than this is refused before decoding: a Worker has 128 MB for everything. */
export const MAX_PIXELS = 24_000_000;

const be16 = (b: Uint8Array, i: number) => (b[i]! << 8) | b[i + 1]!;
const be32 = (b: Uint8Array, i: number) =>
  ((b[i]! << 24) | (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!) >>> 0;
const le24 = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16);

/**
 * The picture's width and height from its header, without decoding it, so a huge one is refused
 * before it takes the memory. Null when the header can't be read.
 */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
  // PNG: IHDR is always the first chunk.
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes.length >= 24)
    return { width: be32(bytes, 16), height: be32(bytes, 20) };
  // JPEG: walk the markers to the first start-of-frame.
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) return null;
      const marker = bytes[i + 1]!;
      // Fill bytes and markers without a length.
      if (marker === 0xff) {
        i += 1;
        continue;
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      const isFrame =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isFrame) return { height: be16(bytes, i + 5), width: be16(bytes, i + 7) };
      i += 2 + be16(bytes, i + 2);
    }
    return null;
  }
  // WebP: RIFF....WEBP then a VP8, VP8L or VP8X chunk.
  if (bytes.length >= 30 && bytes[8] === 0x57) {
    const chunk = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);
    if (chunk === 'VP8 ')
      return {
        width: (bytes[26]! | (bytes[27]! << 8)) & 0x3fff,
        height: (bytes[28]! | (bytes[29]! << 8)) & 0x3fff,
      };
    if (chunk === 'VP8L')
      return {
        width: 1 + (((bytes[22]! & 0x3f) << 8) | bytes[21]!),
        height: 1 + (((bytes[24]! & 0x0f) << 10) | (bytes[23]! << 2) | ((bytes[22]! & 0xc0) >> 6)),
      };
    if (chunk === 'VP8X') return { width: 1 + le24(bytes, 24), height: 1 + le24(bytes, 27) };
  }
  return null;
}

/** The EXIF orientation of a JPEG (1-8; 1 is upright), so a phone photo isn't stored sideways. */
export function jpegOrientation(bytes: Uint8Array): number {
  let i = 2;
  while (i + 4 < bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1]!;
    const length = be16(bytes, i + 2);
    // APP1 with "Exif\0\0".
    if (marker === 0xe1 && bytes[i + 4] === 0x45 && bytes[i + 5] === 0x78) {
      const tiff = i + 10;
      const little = bytes[tiff] === 0x49;
      const u16 = (at: number) => (little ? bytes[at]! | (bytes[at + 1]! << 8) : be16(bytes, at));
      const u32 = (at: number) =>
        little
          ? (bytes[at]! |
              (bytes[at + 1]! << 8) |
              (bytes[at + 2]! << 16) |
              (bytes[at + 3]! << 24)) >>>
            0
          : be32(bytes, at);
      const ifd = tiff + u32(tiff + 4);
      const count = ifd + 2 <= bytes.length ? u16(ifd) : 0;
      for (let n = 0; n < count; n++) {
        const entry = ifd + 2 + n * 12;
        if (entry + 10 > bytes.length) break;
        if (u16(entry) === 0x0112) {
          const value = u16(entry + 8);
          return value >= 1 && value <= 8 ? value : 1;
        }
      }
      return 1;
    }
    // Start of scan: no EXIF after this point.
    if (marker === 0xda) return 1;
    i += 2 + length;
  }
  return 1;
}

/** Turns the pixels the way EXIF orientation `o` says the camera meant them. */
export function orient(image: Pixels, o: number): Pixels {
  if (o <= 1 || o > 8) return image;
  const { width: w, height: h, data } = image;
  const swap = o >= 5;
  const W = swap ? h : w;
  const H = swap ? w : h;
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let X: number;
      let Y: number;
      switch (o) {
        case 2: X = w - 1 - x; Y = y; break; // prettier-ignore
        case 3: X = w - 1 - x; Y = h - 1 - y; break; // prettier-ignore
        case 4: X = x; Y = h - 1 - y; break; // prettier-ignore
        case 5: X = y; Y = x; break; // prettier-ignore
        case 6: X = h - 1 - y; Y = x; break; // prettier-ignore
        case 7: X = h - 1 - y; Y = w - 1 - x; break; // prettier-ignore
        default:
          X = y;
          Y = w - 1 - x; // 8
      }
      const from = (y * w + x) * 4;
      const to = (Y * W + X) * 4;
      out[to] = data[from]!;
      out[to + 1] = data[from + 1]!;
      out[to + 2] = data[from + 2]!;
      out[to + 3] = data[from + 3]!;
    }
  }
  return { width: W, height: H, data: out };
}

/**
 * Scales the picture down to `width` × `height` by averaging every source pixel each target pixel
 * covers (a box filter: sharp enough for a downscale, and no WebAssembly). Colour is weighted by
 * alpha so transparent edges don't turn dark.
 */
export function downscale(image: Pixels, width: number, height: number): Pixels {
  if (width >= image.width && height >= image.height) return image;
  const { width: sw, height: sh, data } = image;
  const out = new Uint8ClampedArray(width * height * 4);
  const sx = sw / width;
  const sy = sh / height;
  for (let y = 0; y < height; y++) {
    const y0 = y * sy;
    const y1 = y0 + sy;
    for (let x = 0; x < width; x++) {
      const x0 = x * sx;
      const x1 = x0 + sx;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let area = 0;
      for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++) {
        const wy = Math.min(yy + 1, y1) - Math.max(yy, y0);
        for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
          const weight = (Math.min(xx + 1, x1) - Math.max(xx, x0)) * wy;
          const i = (yy * sw + xx) * 4;
          const alpha = data[i + 3]! * weight;
          r += data[i]! * alpha;
          g += data[i + 1]! * alpha;
          b += data[i + 2]! * alpha;
          a += alpha;
          area += weight;
        }
      }
      const o = (y * width + x) * 4;
      if (a > 0) {
        out[o] = r / a;
        out[o + 1] = g / a;
        out[o + 2] = b / a;
      }
      out[o + 3] = a / area;
    }
  }
  return { width, height, data: out };
}

/** The size that fits inside the limits with the same proportions (never bigger than it was). */
export function fitInside(width: number, height: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** A decoded PNG of any depth, palette or channel count, as 8-bit RGBA. */
function pngPixels(bytes: Uint8Array): Pixels {
  const png = decodePng(bytes);
  const { width, height } = png;
  const source: ArrayLike<number> = png.palette ? convertIndexedToRgb(png) : png.data;
  const shift = !png.palette && png.depth === 16 ? 8 : 0;
  const count = width * height;
  // A palette comes back as RGB or RGBA; otherwise grey, grey + alpha, RGB or RGBA.
  const perPixel = png.palette ? source.length / count : png.channels;
  const out = new Uint8ClampedArray(count * 4);
  for (let p = 0; p < count; p++) {
    const i = p * perPixel;
    const o = p * 4;
    if (perPixel >= 3) {
      out[o] = source[i]! >> shift;
      out[o + 1] = source[i + 1]! >> shift;
      out[o + 2] = source[i + 2]! >> shift;
      out[o + 3] = perPixel === 4 ? source[i + 3]! >> shift : 255;
    } else {
      const grey = source[i]! >> shift;
      out[o] = grey;
      out[o + 1] = grey;
      out[o + 2] = grey;
      out[o + 3] = perPixel === 2 ? source[i + 1]! >> shift : 255;
    }
  }
  return { width, height, data: out };
}

let webpReady: Promise<void> | undefined;

/**
 * A Worker can't compile WebAssembly at run time: the codecs must come in as modules Wrangler
 * bundled from `.wasm` imports. Node and Bun (the tests) can't import a `.wasm` file, and there the
 * codecs load their own.
 */
const loadWebp = async () => {
  if (globalThis.navigator?.userAgent !== 'Cloudflare-Workers') return;
  const [decoder, encoder]: { default: WebAssembly.Module }[] = await Promise.all([
    import('@jsquash/webp/codec/dec/webp_dec.wasm'),
    import('@jsquash/webp/codec/enc/webp_enc_simd.wasm'),
  ]);
  await Promise.all([initWebpDecoder(decoder!.default), initWebpEncoder(encoder!.default)]);
};

const webp = async () => {
  webpReady ??= loadWebp().catch((error: unknown) => {
    webpReady = undefined;
    throw error;
  });
  await webpReady;
};

/** Decodes a PNG, JPEG (turned upright) or WebP into RGBA pixels. */
export async function decodeImage(bytes: Uint8Array, type: string): Promise<Pixels> {
  if (type === 'image/png') return pngPixels(bytes);
  if (type === 'image/jpeg') {
    const image = jpeg.decode(bytes, {
      useTArray: true,
      formatAsRGBA: true,
      maxResolutionInMP: MAX_PIXELS / 1_000_000,
      maxMemoryUsageInMB: 100,
    });
    const pixels = {
      width: image.width,
      height: image.height,
      data: new Uint8ClampedArray(image.data.buffer, image.data.byteOffset, image.data.byteLength),
    };
    return orient(pixels, jpegOrientation(bytes));
  }
  await webp();
  const image = await decodeWebp(bytes.slice().buffer);
  return { width: image.width, height: image.height, data: image.data };
}

/** Encodes RGBA pixels as a lossy WebP (with alpha when there is any). */
export async function encodeImage(
  pixels: Pixels,
  quality: number,
  lossless = false,
): Promise<Uint8Array> {
  await webp();
  const encoded = await encodeWebp(pixels as unknown as ImageData, {
    quality,
    ...(lossless ? { lossless: 1 } : {}),
  });
  return new Uint8Array(encoded);
}

/**
 * The picture as a WebP no bigger than the limits. A WebP that already fits and is small is kept
 * as it is (the form's cropper already made it), and so is any result that came out bigger than
 * what was sent. Throws when the picture can't be decoded.
 */
export async function optimizeImage(
  bytes: Uint8Array,
  type: string,
  { maxWidth, maxHeight, quality = 80 }: OptimizeOptions,
): Promise<{ bytes: Uint8Array; type: 'image/webp' } | null> {
  const size = imageSize(bytes);
  const fits = size !== null && size.width <= maxWidth && size.height <= maxHeight;
  if (type === 'image/webp' && fits && bytes.length <= SMALL_WEBP_BYTES) return null;

  const decoded = await decodeImage(bytes, type);
  const target = fitInside(decoded.width, decoded.height, maxWidth, maxHeight);
  const scaled = downscale(decoded, target.width, target.height);
  let encoded = await encodeImage(scaled, quality);
  if (fits && encoded.length >= bytes.length) {
    if (type === 'image/webp') return null;
    // Flat drawings (logos, screenshots) can come out bigger lossy than as the PNG they were;
    // lossless WebP is smaller than the PNG and keeps every pixel.
    const lossless = await encodeImage(scaled, 100, true);
    if (lossless.length < encoded.length) encoded = lossless;
  }
  return { bytes: encoded, type: 'image/webp' };
}

/** A WebP this small that already fits isn't worth encoding again (and losing quality). */
const SMALL_WEBP_BYTES = 300 * 1024;

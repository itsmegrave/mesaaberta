/**
 * Picture files carry hidden data besides the pixels: EXIF (the camera, the time and often the GPS
 * position where the photo was taken), XMP, IPTC and text notes. None of it is shown on the site,
 * and a phone photo's position can be someone's home, so nothing is stored with it. A WebP made by
 * `optimizeImage` has none already; this is for a file stored as it came (the fallback when the
 * conversion fails). It keeps what draws the picture (colour profile, Adobe's colour transform) and
 * drops the rest. Anything it cannot parse comes back unchanged.
 */
export function withoutMetadata(bytes: Uint8Array, type: string): Uint8Array {
  try {
    if (type === 'image/jpeg') return jpegWithout(bytes);
    if (type === 'image/png') return pngWithout(bytes);
    if (type === 'image/webp') return webpWithout(bytes);
  } catch {
    // A file too broken to walk is stored as it is; the type check already passed.
  }
  return bytes;
}

const be16 = (b: Uint8Array, i: number) => (b[i]! << 8) | b[i + 1]!;
const be32 = (b: Uint8Array, i: number) =>
  ((b[i]! << 24) | (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!) >>> 0;
const le32 = (b: Uint8Array, i: number) =>
  (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0;

const concat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

// APP1 (EXIF, XMP), APP3-APP13 (vendor data, Photoshop/IPTC), APP15 and comments. APP0 (JFIF),
// APP2 (ICC colour profile) and APP14 (Adobe colour transform) change how the picture looks.
const JPEG_DROPPED = new Set([0xe1, ...Array.from({ length: 11 }, (_, n) => 0xe3 + n), 0xef, 0xfe]);

function jpegWithout(bytes: Uint8Array): Uint8Array {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) return bytes;
    const marker = bytes[i + 1]!;
    // Start of scan: the compressed picture follows, with no more headers to drop.
    if (marker === 0xda) {
      parts.push(bytes.subarray(i));
      return concat(parts);
    }
    const end = i + 2 + be16(bytes, i + 2);
    if (end > bytes.length) return bytes;
    if (!JPEG_DROPPED.has(marker)) parts.push(bytes.subarray(i, end));
    i = end;
  }
  return bytes;
}

const PNG_DROPPED = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);

function pngWithout(bytes: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= bytes.length) {
    const length = be32(bytes, i);
    const end = i + 12 + length;
    if (end > bytes.length) return bytes;
    const name = String.fromCharCode(...bytes.subarray(i + 4, i + 8));
    if (!PNG_DROPPED.has(name)) parts.push(bytes.subarray(i, end));
    i = end;
    if (name === 'IEND') return concat(parts);
  }
  return bytes;
}

function webpWithout(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 12) return bytes;
  const chunks: Uint8Array[] = [];
  let i = 12;
  let dropped = false;
  while (i + 8 <= bytes.length) {
    const name = String.fromCharCode(...bytes.subarray(i, i + 4));
    const size = le32(bytes, i + 4);
    const end = i + 8 + size + (size % 2);
    if (i + 8 + size > bytes.length) return bytes;
    if (name === 'EXIF' || name === 'XMP ') dropped = true;
    else chunks.push(bytes.slice(i, Math.min(end, bytes.length)));
    i = end;
  }
  if (!dropped) return bytes;
  // VP8X says which extra chunks follow: clear the EXIF (0x08) and XMP (0x04) bits.
  for (const chunk of chunks)
    if (String.fromCharCode(...chunk.subarray(0, 4)) === 'VP8X') chunk[8] = chunk[8]! & ~0x0c;
  const body = concat(chunks);
  const out = new Uint8Array(12 + body.length);
  out.set(bytes.subarray(0, 12));
  const riffSize = 4 + body.length;
  out[4] = riffSize & 255;
  out[5] = (riffSize >> 8) & 255;
  out[6] = (riffSize >> 16) & 255;
  out[7] = (riffSize >>> 24) & 255;
  out.set(body, 12);
  return out;
}

import { MAX_IMAGE_BYTES } from './files';

/** Prefer a small WebP; browsers without a WebP encoder get JPEG instead of a large PNG. */
export async function encodeImage(canvas: Pick<HTMLCanvasElement, 'toBlob'>): Promise<Blob | null> {
  const targetBytes = 256 * 1024;
  let smallest: Blob | null = null;
  for (const type of ['image/webp', 'image/jpeg']) {
    for (const quality of [0.82, 0.7, 0.55]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, type, quality),
      );
      // Unsupported formats may silently produce PNG. Try the next format instead.
      if (!blob || blob.type !== type) break;
      if (blob.size <= targetBytes) return blob;
      if (!smallest || blob.size < smallest.size) smallest = blob;
    }
    if (smallest) break;
  }
  return smallest && smallest.size <= MAX_IMAGE_BYTES ? smallest : null;
}

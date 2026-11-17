import { Invalid } from './errors';
import { imageSize, MAX_PIXELS, optimizeImage, type OptimizeOptions } from './image-optimize';
import type { Logger } from './logger';
import { withoutMetadata } from './image-metadata';

// One limit for the form's check and the server's.
export { MAX_IMAGE_BYTES } from '../forms/files';
import { MAX_IMAGE_BYTES } from '../forms/files';
/** The Supabase Storage bucket table images go in. Public read; see the README for its setup. */
export const IMAGE_BUCKET = 'table-images';
/** The bucket profile pictures go in, one folder per user id. See the README, "Profile pictures". */
export const AVATAR_BUCKET = 'profile-avatars';

const TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as const;
type ImageType = keyof typeof TYPES;

const startsWith = (data: Uint8Array, head: number[], offset = 0) =>
  head.every((byte, i) => data[offset + i] === byte);

/**
 * What the file really is, from its first bytes. The name and the type the browser sends are
 * ignored: they are whatever the uploader wrote. SVG and HTML can carry script, so only PNG, JPEG
 * and WebP are ever accepted.
 */
export function detectImageType(data: Uint8Array): ImageType | null {
  if (startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(data, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(data, [0x52, 0x49, 0x46, 0x46]) && startsWith(data, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'image/webp';
  }

  return null;
}

export type PreparedImage = { bytes: Uint8Array; contentType: ImageType; path: string };

/**
 * Checks an uploaded file and gives it a random name inside `folder`. Throws `Invalid` on the
 * `image` field.
 */
export async function prepareImage(file: File, folder = 'tables'): Promise<PreparedImage> {
  if (file.size === 0) throw new Invalid('image', 'empty');
  if (file.size > MAX_IMAGE_BYTES) throw new Invalid('image', 'too_big');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = detectImageType(bytes);
  if (!contentType) throw new Invalid('image', 'not_an_image');
  // Decoding takes about 4 bytes a pixel; a Worker has 128 MB for everything.
  const size = imageSize(bytes);
  if (size && size.width * size.height > MAX_PIXELS) throw new Invalid('image', 'too_big');

  return { bytes, contentType, path: `${folder}/${crypto.randomUUID()}.${TYPES[contentType]}` };
}

/** The part of a Supabase Storage bucket this needs, so tests can stand in for it. */
export type ImageStorage = {
  upload(
    path: string,
    body: Uint8Array,
    options: { contentType: string; upsert: boolean; cacheControl: string },
  ): PromiseLike<{ error: { message: string } | null }>;
};

/** Pictures shown as a small square (logos, avatars) don't need more than this. */
const SMALL: OptimizeOptions = { maxWidth: 512, maxHeight: 512, quality: 85 };
/** Covers and banners: 1200 px wide on the page, with room for sharper screens. */
const LARGE: OptimizeOptions = { maxWidth: 1600, maxHeight: 1600, quality: 80 };

/** How big a picture in `path` is kept: covers large, everything shown as a square small. */
export const optimizeOptionsFor = (path: string): OptimizeOptions =>
  /^(tables|crowdfunding|places)\//.test(path) || /^[^/]+\/banners\//.test(path) ? LARGE : SMALL;

/**
 * The picture as a WebP no bigger than its place needs, under the same name with a `.webp` end.
 * Compression must never cost someone their upload: when it fails, the picture is stored as sent,
 * minus its hidden data (EXIF, GPS position and the like; see `withoutMetadata`).
 */
export async function compressed(
  image: PreparedImage,
  log?: Pick<Logger, 'warn'>,
): Promise<PreparedImage> {
  try {
    const result = await optimizeImage(
      image.bytes,
      image.contentType,
      optimizeOptionsFor(image.path),
    );
    if (!result) return asSent(image);
    return {
      bytes: result.bytes,
      contentType: result.type,
      path: image.path.replace(/\.(png|jpe?g|webp)$/i, '') + '.webp',
    };
  } catch (error) {
    log?.warn('storage.image_compress_failed', {
      code: 'image_compress_failed',
      imageType: image.contentType,
      bytesBefore: image.bytes.length,
      error,
    });
    return asSent(image);
  }
}

/** The picture as it was sent, without the metadata it carried. */
const asSent = (image: PreparedImage): PreparedImage => ({
  ...image,
  bytes: withoutMetadata(image.bytes, image.contentType),
});

/**
 * How long browsers keep a stored picture. Replacements get a new UUID URL, so browsers can reuse
 * these bytes between visits. Avatars are shorter-lived because people can remove their picture.
 */
export const cacheControlFor = (path: string) =>
  path.startsWith('tables/') || path.startsWith('crowdfunding/') || path.startsWith('partners/')
    ? '2592000'
    : '86400';

/**
 * Uploads a prepared image and returns its path. Never overwrites an existing file. A refusal is
 * logged with Storage's own reason (a missing policy and a missing bucket look alike on the form).
 */
export async function storeImage(
  storage: ImageStorage,
  prepared: PreparedImage,
  log?: Pick<Logger, 'warn'>,
): Promise<string> {
  const image = await compressed(prepared, log);
  const { error } = await storage.upload(image.path, image.bytes, {
    contentType: image.contentType,
    upsert: false,
    cacheControl: cacheControlFor(image.path),
  });
  if (error) {
    log?.warn('storage.image_upload_refused', { reason: error.message });
    throw new Invalid('image', 'upload_failed');
  }

  return image.path;
}

/**
 * Where browsers fetch stored images, up to the bucket name: `STORAGE_PUBLIC_URL` when files live in
 * an S3-compatible store (`STORAGE_PROVIDER=s3`, served from its public domain), else Supabase's
 * public object path on the project URL, or on `SUPABASE_PUBLIC_URL` when the server reaches
 * Supabase at a private address the browser cannot (the Docker stack, where Caddy serves the public
 * bucket paths on the site's own origin). None of these is in the generated `Env` type until it is
 * configured.
 */
export const storageUrlOf = (env: unknown) => {
  const { STORAGE_PUBLIC_URL, SUPABASE_PUBLIC_URL, SUPABASE_URL } =
    (env as
      | { STORAGE_PUBLIC_URL?: string; SUPABASE_PUBLIC_URL?: string; SUPABASE_URL?: string }
      | undefined) ?? {};
  if (STORAGE_PUBLIC_URL) return STORAGE_PUBLIC_URL.replace(/\/+$/, '');
  const supabase = SUPABASE_PUBLIC_URL || SUPABASE_URL;
  return supabase ? `${supabase.replace(/\/+$/, '')}/storage/v1/object/public` : undefined;
};

/** The old name of `storageUrlOf`, kept so the reads need not change with it. */
export const supabaseUrlOf = storageUrlOf;

const objectUrl = (storageUrl: string | undefined, bucket: string, path: string | null) =>
  storageUrl && path ? `${storageUrl}/${bucket}/${path}` : null;

/** The public URL of a stored image, or null when there is none or storage is not configured. */
export const imageUrl = (storageUrl: string | undefined, path: string | null) =>
  objectUrl(storageUrl, IMAGE_BUCKET, path);

/** The public URL of a partner's logo, which lives in the avatar bucket under `partners/<id>/`. */
export const partnerLogoUrl = (storageUrl: string | undefined, path: string | null) =>
  objectUrl(storageUrl, AVATAR_BUCKET, path);

/**
 * A tool's logo: the seeded ones ship with the site (`/tools/<slug>.svg`, a path from the root) and a
 * suggested one lives in the avatar bucket under `tools/<submitter id>/`.
 */
export const toolLogoUrl = (storageUrl: string | undefined, path: string | null) =>
  path?.startsWith('/') ? path : objectUrl(storageUrl, AVATAR_BUCKET, path);

/** The public URL of a profile's cover, which lives in the avatar bucket under `<id>/banners/`. */
export const bannerUrl = (storageUrl: string | undefined, path: string | null) =>
  objectUrl(storageUrl, AVATAR_BUCKET, path);

/** The picture a profile shows: the uploaded one, else the sign-in provider's, else none. */
export const pictureOf = (
  storageUrl: string | undefined,
  profile: { avatarPath: string | null; avatarUrl: string | null },
) => objectUrl(storageUrl, AVATAR_BUCKET, profile.avatarPath) ?? profile.avatarUrl;

import { Invalid } from './errors';
import type { Logger } from './logger';

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

/**
 * Uploads a prepared image and returns its path. Never overwrites an existing file. A refusal is
 * logged with Storage's own reason (a missing policy and a missing bucket look alike on the form).
 */
export async function storeImage(
  storage: ImageStorage,
  image: PreparedImage,
  log?: Pick<Logger, 'warn'>,
): Promise<string> {
  const { error } = await storage.upload(image.path, image.bytes, {
    contentType: image.contentType,
    upsert: false,
    // Replacements get a new UUID URL, so browsers can reuse these bytes between visits.
    // Keep avatars shorter-lived because people can remove their profile picture.
    cacheControl:
      image.path.startsWith('tables/') ||
      image.path.startsWith('crowdfunding/') ||
      image.path.startsWith('partners/')
        ? '2592000'
        : '86400',
  });
  if (error) {
    log?.warn('image upload refused by Storage', { reason: error.message });
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

/** The public URL of a profile's cover, which lives in the avatar bucket under `<id>/banners/`. */
export const bannerUrl = (storageUrl: string | undefined, path: string | null) =>
  objectUrl(storageUrl, AVATAR_BUCKET, path);

/** The picture a profile shows: the uploaded one, else the sign-in provider's, else none. */
export const pictureOf = (
  storageUrl: string | undefined,
  profile: { avatarPath: string | null; avatarUrl: string | null },
) => objectUrl(storageUrl, AVATAR_BUCKET, profile.avatarPath) ?? profile.avatarUrl;

import { Invalid } from './errors';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
/** The Supabase Storage bucket table images go in. Public read; see the README for its setup. */
export const IMAGE_BUCKET = 'table-images';

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

/** Checks an uploaded file and gives it a random name. Throws `Invalid` on the `image` field. */
export async function prepareImage(file: File): Promise<PreparedImage> {
	if (file.size === 0) throw new Invalid('image', 'empty');
	if (file.size > MAX_IMAGE_BYTES) throw new Invalid('image', 'too_big');

	const bytes = new Uint8Array(await file.arrayBuffer());
	const contentType = detectImageType(bytes);
	if (!contentType) throw new Invalid('image', 'not_an_image');

	return { bytes, contentType, path: `tables/${crypto.randomUUID()}.${TYPES[contentType]}` };
}

/** The part of a Supabase Storage bucket this needs, so tests can stand in for it. */
export type ImageStorage = {
	upload(
		path: string,
		body: Uint8Array,
		options: { contentType: string; upsert: boolean }
	): PromiseLike<{ error: { message: string } | null }>;
};

/** Uploads a prepared image and returns its path. Never overwrites an existing file. */
export async function storeImage(storage: ImageStorage, image: PreparedImage): Promise<string> {
	const { error } = await storage.upload(image.path, image.bytes, {
		contentType: image.contentType,
		upsert: false
	});
	if (error) throw new Invalid('image', 'upload_failed');

	return image.path;
}

/** The project URL from the Worker settings. It is not in the generated `Env` type until it is configured. */
export const supabaseUrlOf = (env: unknown) =>
	(env as { SUPABASE_URL?: string } | undefined)?.SUPABASE_URL;

/** The public URL of a stored image, or null when there is none or Supabase is not configured. */
export const imageUrl = (supabaseUrl: string | undefined, path: string | null) =>
	supabaseUrl && path ? `${supabaseUrl}/storage/v1/object/public/${IMAGE_BUCKET}/${path}` : null;

import { Invalid } from './errors';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
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

/** The part of an R2 bucket that stores an image, so tests can stand in for it. */
export type ImageStorage = {
	put(
		key: string,
		body: Uint8Array,
		options: { httpMetadata: { contentType: string }; onlyIf: { etagDoesNotMatch: string } }
	): Promise<unknown>;
};

/** The part of an R2 bucket that reads an image back. */
export type ImageSource = {
	get(key: string): Promise<{
		body: ReadableStream;
		httpEtag: string;
		httpMetadata?: { contentType?: string };
	} | null>;
};

/** Stores a prepared image and returns its path. Never overwrites an existing file. */
export async function storeImage(storage: ImageStorage, image: PreparedImage): Promise<string> {
	try {
		// `onlyIf` makes R2 answer null, instead of replacing the file, when the name is taken.
		const stored = await storage.put(image.path, image.bytes, {
			httpMetadata: { contentType: image.contentType },
			onlyIf: { etagDoesNotMatch: '*' }
		});
		if (!stored) throw new Error('image already exists');
	} catch {
		throw new Invalid('image', 'upload_failed');
	}

	return image.path;
}

/** Where a stored image is served from: this site, by `/images/[...path]`. Null when there is none. */
export const imageUrl = (path: string | null) => (path ? `/images/${path}` : null);

// Only what `prepareImage` makes: nothing else in the bucket is ever served.
const SERVED_PATH = /^tables\/[0-9a-f-]{36}\.(png|jpg|webp)$/;

/** A stored image as a response, or null if the name is not one we make or nothing is stored under it. */
export async function serveImage(
	bucket: ImageSource | undefined,
	path: string
): Promise<Response | null> {
	if (!bucket || !SERVED_PATH.test(path)) return null;

	const stored = await bucket.get(path);
	if (!stored) return null;

	return new Response(stored.body, {
		headers: {
			'content-type': stored.httpMetadata?.contentType ?? 'application/octet-stream',
			etag: stored.httpEtag,
			// The name is random and a file is never overwritten, so a browser can keep it for good.
			'cache-control': 'public, max-age=31536000, immutable',
			'x-content-type-options': 'nosniff'
		}
	});
}

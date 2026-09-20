import { describe, expect, it, vi } from 'vitest';
import {
	detectImageType,
	imageUrl,
	MAX_IMAGE_BYTES,
	prepareImage,
	serveImage,
	storeImage
} from './images';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50];

const bytes = (head: number[], length = 64) => {
	const data = new Uint8Array(length);
	data.set(head);
	return data;
};
const file = (data: Uint8Array, name = 'capa.png', type = 'image/png') =>
	new File([data as BlobPart], name, { type });

describe('detectImageType', () => {
	it.each([
		['PNG', PNG, 'image/png'],
		['JPEG', JPEG, 'image/jpeg'],
		['WebP', WEBP, 'image/webp']
	])('recognises %s by its first bytes', (_name, head, type) => {
		expect(detectImageType(bytes(head))).toBe(type);
	});

	it.each([
		[
			'an SVG, which can carry script',
			new TextEncoder().encode(
				'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
			)
		],
		['an HTML page', new TextEncoder().encode('<!doctype html><script>alert(1)</script>')],
		['a GIF', new TextEncoder().encode('GIF89a......')],
		[
			'a RIFF file that is not WebP',
			bytes([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45])
		],
		['nothing', new Uint8Array()],
		['a few stray bytes', new Uint8Array([1, 2])]
	])('does not accept %s', (_name, data) => {
		expect(detectImageType(data)).toBeNull();
	});
});

describe('prepareImage', () => {
	it('accepts a real image and picks a random name with the right extension', async () => {
		const first = await prepareImage(file(bytes(PNG)));
		const second = await prepareImage(file(bytes(PNG)));

		expect(first).toMatchObject({ contentType: 'image/png' });
		expect(first.path).toMatch(/^tables\/[0-9a-f-]{36}\.png$/);
		expect(first.path).not.toBe(second.path);
	});

	it('goes by the bytes, not by the name or the type the browser claims', async () => {
		const jpegCalledPng = await prepareImage(file(bytes(JPEG), 'foto.png', 'image/png'));

		expect(jpegCalledPng.contentType).toBe('image/jpeg');
		expect(jpegCalledPng.path).toMatch(/\.jpg$/);
	});

	it('never keeps the uploaded file name, which could hold a path or markup', async () => {
		const { path } = await prepareImage(file(bytes(PNG), '../../<script>.png'));

		expect(path).not.toMatch(/script|\.\./);
	});

	it('refuses a script named like an image', async () => {
		await expect(
			prepareImage(file(new TextEncoder().encode('<script>alert(1)</script>'), 'x.png'))
		).rejects.toMatchObject({ name: 'Invalid', field: 'image', message: 'not_an_image' });
	});

	it('refuses an image over 2 MB, and accepts one exactly at the limit', async () => {
		await expect(prepareImage(file(bytes(PNG, MAX_IMAGE_BYTES + 1)))).rejects.toMatchObject({
			field: 'image',
			message: 'too_big'
		});
		await expect(prepareImage(file(bytes(PNG, MAX_IMAGE_BYTES)))).resolves.toBeTruthy();
	});

	it('refuses an empty file', async () => {
		await expect(prepareImage(file(new Uint8Array()))).rejects.toMatchObject({ field: 'image' });
	});
});

describe('storeImage', () => {
	it('puts the bytes with the detected type, without overwriting anything', async () => {
		const put = vi.fn().mockResolvedValue({ key: 'x' });
		const image = await prepareImage(file(bytes(PNG)));

		expect(await storeImage({ put }, image)).toBe(image.path);
		expect(put).toHaveBeenCalledWith(image.path, image.bytes, {
			httpMetadata: { contentType: 'image/png' },
			onlyIf: { etagDoesNotMatch: '*' }
		});
	});

	it('reports a file that already exists as an invalid image field, never as success', async () => {
		// R2 answers null, not an error, when `onlyIf` is not met.
		const put = vi.fn().mockResolvedValue(null);
		const image = await prepareImage(file(bytes(PNG)));

		await expect(storeImage({ put }, image)).rejects.toMatchObject({
			name: 'Invalid',
			field: 'image',
			message: 'upload_failed'
		});
	});

	it('reports a failed upload as an invalid image field, never as success', async () => {
		const put = vi.fn().mockRejectedValue(new Error('R2 is down'));
		const image = await prepareImage(file(bytes(PNG)));

		await expect(storeImage({ put }, image)).rejects.toMatchObject({
			name: 'Invalid',
			field: 'image',
			message: 'upload_failed'
		});
	});
});

describe('imageUrl', () => {
	it('is served by this site, from /images', () => {
		expect(imageUrl('tables/abc.png')).toBe('/images/tables/abc.png');
	});

	it('is null when the table has no image', () => {
		expect(imageUrl(null)).toBeNull();
	});
});

describe('serveImage', () => {
	const PATH = 'tables/123e4567-e89b-42d3-a456-426614174000.png';
	const stored = (over = {}) => ({
		body: new Response('png-bytes').body,
		httpEtag: '"abc"',
		httpMetadata: { contentType: 'image/png' },
		...over
	});

	it('answers with the stored file, typed by what was stored, and cached for good', async () => {
		const get = vi.fn().mockResolvedValue(stored());

		const response = await serveImage({ get }, PATH);

		expect(get).toHaveBeenCalledWith(PATH);
		expect(response?.status).toBe(200);
		expect(await response?.text()).toBe('png-bytes');
		expect(response?.headers.get('content-type')).toBe('image/png');
		expect(response?.headers.get('etag')).toBe('"abc"');
		// The name is random and a file is never overwritten, so the browser can keep it for good.
		expect(response?.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
		expect(response?.headers.get('x-content-type-options')).toBe('nosniff');
	});

	it('is null when nothing is stored under that name', async () => {
		const get = vi.fn().mockResolvedValue(null);

		expect(await serveImage({ get }, PATH)).toBeNull();
	});

	it.each([
		['a path outside tables/', '../secret.png'],
		['another folder', 'other/123e4567-e89b-42d3-a456-426614174000.png'],
		['a name that is not one we make', 'tables/logo.png'],
		['a type we never store', 'tables/123e4567-e89b-42d3-a456-426614174000.svg'],
		['a nested path', 'tables/a/123e4567-e89b-42d3-a456-426614174000.png']
	])('never reads the bucket for %s', async (_name, path) => {
		const get = vi.fn();

		expect(await serveImage({ get }, path)).toBeNull();
		expect(get).not.toHaveBeenCalled();
	});

	it('is null when there is no bucket bound (local without R2)', async () => {
		expect(await serveImage(undefined, PATH)).toBeNull();
	});
});

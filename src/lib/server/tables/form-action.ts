import { fail, redirect, type ActionFailure } from '@sveltejs/kit';
import { requireUser } from '../auth/guard';
import { Forbidden, Invalid, NotFound, RateLimited } from '../errors';
import { IMAGE_BUCKET, prepareImage, storeImage } from '../images';
import { parseTableForm, type TableInput } from '$lib/tables/schema';
import { NEW_TABLE_VALUES, type FormValues } from '$lib/tables/form-values';

/** What a failed submit gives back: the problem, and what was typed so nothing is lost. */
export type FormFailure = {
	values: FormValues;
	errors?: Record<string, string>;
	error?: string;
	retryAfter?: number;
};

type Event = {
	request: Request;
	locals: App.Locals;
	url: URL;
	setHeaders?: (headers: Record<string, string>) => void;
};

const valuesFrom = (data: FormData): FormValues =>
	Object.fromEntries(
		Object.keys(NEW_TABLE_VALUES).map((key) => [key, String(data.get(key) ?? '')])
	) as FormValues;

/**
 * What the create and the edit form actions share: check who is asking (a signed-in person with a username), validate the form, store
 * the image if there is one, then run `save`. Whatever `save` returns is where to go next.
 * `guard` runs once the form is valid and before the image is stored: it throws to refuse a request
 * (a rate limit) that should not cost an upload.
 *
 * Every failure answers with the values the person typed, so nothing is lost. The permission
 * itself is checked by `save` (through the policy), not here.
 */
export async function handleTableForm(
	{ request, locals, url, setHeaders }: Event,
	save: (input: TableInput, imagePath?: string) => Promise<{ slug: string }>,
	guard: () => Promise<void> = async () => {}
): Promise<ActionFailure<FormFailure>> {
	await requireUser(locals, url);

	const data = await request.formData();
	const values = valuesFrom(data);

	const parsed = parseTableForm(data);
	if (!parsed.ok) return fail(400, { errors: parsed.errors, values });

	let slug: string;
	try {
		await guard();
		const image = data.get('image');
		let imagePath: string | undefined;

		if (image instanceof File && image.size > 0) {
			const prepared = await prepareImage(image);
			const storage = locals.supabase?.storage.from(IMAGE_BUCKET);
			if (!storage) throw new Invalid('image', 'upload_failed');
			imagePath = await storeImage(storage, prepared);
		}

		({ slug } = await save(parsed.data, imagePath));
	} catch (error) {
		if (error instanceof Invalid) {
			return fail(400, { errors: { [error.field]: error.message }, values });
		}
		if (error instanceof Forbidden) return fail(403, { error: 'forbidden', values });
		if (error instanceof NotFound) return fail(404, { error: 'not_found', values });
		if (error instanceof RateLimited) {
			setHeaders?.({ 'Retry-After': String(error.retryAfterSeconds) });
			return fail(429, { error: 'rate_limited', retryAfter: error.retryAfterSeconds, values });
		}
		throw error;
	}

	redirect(303, `/tables/${slug}`);
}

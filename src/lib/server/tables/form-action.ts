import { redirect } from '@sveltejs/kit';
import { fail, message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { refuse } from '$lib/forms/server';
import { Forbidden, Invalid, NotFound, RateLimited } from '../errors';
import { IMAGE_BUCKET, prepareImage, storeImage } from '../images';
import { tableFormSchema, toTableInput, type TableInput } from '$lib/tables/schema';

type Event = {
	request: Request;
	locals: App.Locals;
	url: URL;
	setHeaders?: (headers: Record<string, string>) => void;
};

/**
 * What the create and the edit form actions share: check who is asking, validate the form, store
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
) {
	if (!(await locals.getUser())) {
		redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
	}
	if (!(await locals.getProfile())?.username) {
		redirect(303, `/onboarding?next=${encodeURIComponent(url.pathname + url.search)}`);
	}

	const data = await request.formData();
	const form = await superValidate(data, zod4(tableFormSchema));
	if (!form.valid) return fail(400, { form });

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

		({ slug } = await save(toTableInput(form.data), imagePath));
	} catch (error) {
		if (error instanceof Invalid) return refuse(form, 400, error.message, error.field);
		if (error instanceof Forbidden) return message(form, { code: 'forbidden' }, { status: 403 });
		if (error instanceof NotFound) return message(form, { code: 'not_found' }, { status: 404 });
		if (error instanceof RateLimited) {
			setHeaders?.({ 'Retry-After': String(error.retryAfterSeconds) });
			return message(
				form,
				{ code: 'rate_limited', retryAfter: error.retryAfterSeconds },
				{ status: 429 }
			);
		}
		throw error;
	}

	redirect(303, `/tables/${slug}`);
}

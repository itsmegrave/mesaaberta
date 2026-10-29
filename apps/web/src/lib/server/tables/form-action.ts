import { openTablesEnabled } from './open-enabled';
import { safeNext } from '@mesaaberta/core/server/auth/safe-next';
import { onboardingUrl } from '@mesaaberta/core/server/auth/onboarding';
import { redirect } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';
import { validateFormData } from '#lib/forms/contract.js';
import { formMessage, refuse, responseForm } from '#lib/forms/server.js';
import { NEW_TABLE_VALUES } from '#lib/tables/form-values.js';
import {
  Forbidden,
  Invalid,
  NotFound,
  RateLimited,
  TableConcluded,
} from '@mesaaberta/core/server/errors';
import { IMAGE_BUCKET, prepareImage, storeImage } from '@mesaaberta/core/server/images';
import { serverStorage } from '@mesaaberta/core/server/storage';
import { resolveTableLocation } from './api';
import { directoryEnabled } from '../directories/flags';
import { timezoneOf } from '../time';
import { tableFormSchema, toTableInput, type TableInput } from '@mesaaberta/core/tables/schema';

type Event = {
  request: Request;
  locals: App.Locals;
  url: URL;
  cookies: Pick<import('@sveltejs/kit').Cookies, 'get'>;
  /** Trusted server-selected zone when copying an existing table. */
  formTimezone?: string;
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
  { request, locals, url, cookies, setHeaders, formTimezone }: Event,
  save: (
    input: TableInput,
    imagePath: string | undefined,
    /** The GM pressed "save as draft" instead of the main button. */
    draft: boolean,
  ) => Promise<{ slug: string; draft?: boolean }>,
  guard: (draft: boolean, data: FormData) => Promise<void> = async () => {},
  /** Where a saved table leads: its page, unless said otherwise (the edit form: its manage page). */
  destination: (slug: string, draft: boolean) => string = (slug) => `/t/${slug}`,
) {
  if (!(await locals.getUser())) {
    redirect(303, `/login?next=${encodeURIComponent(safeNext(url.pathname + url.search))}`);
  }
  if (!(await locals.getProfile())?.username) {
    redirect(303, onboardingUrl(url.pathname + url.search));
  }

  const data = await request.formData();
  // The GM types the time in their own zone; whatever zone was sent, that is the one used.
  data.set('timezone', formTimezone ?? (await timezoneOf(locals, cookies)));
  // Files are allowed so the schema can check the image; every failure below strips them.
  const form = validateFormData(
    data,
    tableFormSchema,
    { ...NEW_TABLE_VALUES, image: undefined },
    { arrays: ['platforms', 'tags', 'safetyTools'], booleans: ['removeImage'], files: ['image'] },
  );
  if (!form.valid) return fail(400, { form: responseForm(form) });

  // The submit button that was pressed says which: only the draft one carries a value.
  const draft = data.get('intent') === 'draft';
  let slug: string;
  let asDraft: boolean;
  try {
    await guard(draft, data);
    // A westmarch while the kind is off: the form did not offer it.
    if (form.data.kind === 'open' && !(await openTablesEnabled(locals)))
      throw new Invalid('kind', 'invalid');
    const image = data.get('image');
    let imagePath: string | undefined;

    if (image instanceof File && image.size > 0) {
      const prepared = await prepareImage(image);
      const storage = serverStorage(locals.env, IMAGE_BUCKET);
      if (!storage) throw new Invalid('image', 'upload_failed');
      imagePath = await storeImage(storage, prepared, locals.log);
    }

    // An "Onde jogar" place, when one was picked and the places are on: it brings its CEP and area.
    // Otherwise the CEP the GM typed is looked up, as before there were places.
    const placeSlug =
      form.data.placeSlug && (await directoryEnabled(locals, 'places')) ? form.data.placeSlug : '';
    const user = await locals.getUser();
    if (!user) throw new Forbidden();
    const input = await resolveTableLocation(locals, user.id, toTableInput(form.data), placeSlug);
    const saved = await save(input, imagePath, draft);
    slug = saved.slug;
    // A table whose system is a suggestion is saved as a draft whatever button was pressed.
    asDraft = saved.draft ?? draft;
  } catch (error) {
    if (error instanceof Invalid) return refuse(form, 400, error.message, error.field);
    if (error instanceof TableConcluded)
      return formMessage(form, { code: 'table_concluded' }, { status: 403 });
    if (error instanceof Forbidden)
      return formMessage(form, { code: 'forbidden' }, { status: 403 });
    if (error instanceof NotFound) return formMessage(form, { code: 'not_found' }, { status: 404 });
    if (error instanceof RateLimited) {
      setHeaders?.({ 'Retry-After': String(error.retryAfterSeconds) });
      return formMessage(
        form,
        { code: 'rate_limited', retryAfter: error.retryAfterSeconds },
        { status: 429 },
      );
    }
    throw error;
  }

  redirect(303, destination(slug, asDraft));
}

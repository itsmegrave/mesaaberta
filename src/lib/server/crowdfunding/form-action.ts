import { fail, redirect } from '@sveltejs/kit';
import { crowdfundingFormSchema } from '$lib/crowdfunding/schema';
import { normalizeCampaignUrl } from '$lib/crowdfunding/url';
import { validateFormData } from '$lib/forms/contract';
import { formMessage, refuse, responseForm } from '$lib/forms/server';
import { Forbidden, Invalid, NotFound, RateLimited } from '../errors';
import { dispatchEvent } from '../events/dispatcher';
import { handlersFor } from '../events/handlers';
import { IMAGE_BUCKET } from '../images';
import { CROWDFUNDING_LIMIT, checkRateLimit } from '../rate-limit';
import { campaignImagePath } from './image';
import { readLinkPreview } from './link-preview';
import { addCrowdfunding, findListedByUrl } from './service';

export const NEW_CROWDFUNDING_VALUES = {
  url: '',
  name: '',
  owner: '',
  startsOn: '',
  endsOn: '',
  image: undefined,
};

type Event = {
  request: Request;
  locals: App.Locals;
  url: URL;
  platform?: App.Platform;
  setHeaders?: (headers: Record<string, string>) => void;
};

/**
 * "Adicionar financiamento": check who is asking, validate the form, store the picture (the file,
 * else the campaign page's own) and add the campaign. It is public at once, so a good result goes
 * back to the list. Every failure answers with what the person typed. The permission itself is the
 * policy's, inside `addCrowdfunding`.
 */
export async function handleCrowdfundingForm({
  request,
  locals,
  url,
  platform,
  setHeaders,
}: Event) {
  if (!(await locals.getUser())) {
    redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
  }
  if (!(await locals.getProfile())?.username) {
    redirect(303, `/onboarding?next=${encodeURIComponent(url.pathname + url.search)}`);
  }

  const data = await request.formData();
  // Files are allowed so the schema can check the image; every failure below strips them.
  const form = validateFormData(data, crowdfundingFormSchema, NEW_CROWDFUNDING_VALUES, {
    files: ['image'],
  });
  if (!form.valid) return fail(400, { form: responseForm(form) });
  if (!locals.db) return formMessage(form, { code: 'unavailable' }, { status: 503 });
  const db = locals.db;

  try {
    const actor = await locals.getProfile();
    // A limited person is told before anything is fetched or stored. `addCrowdfunding` checks again, under a lock.
    if (actor) await checkRateLimit(db, actor.id, CROWDFUNDING_LIMIT);

    const link = normalizeCampaignUrl(form.data.url);
    const existing = link ? await findListedByUrl(db, link) : null;
    if (existing) return refuse(form, 400, 'already_listed', 'url');

    const upload = form.data.image;
    const pageImageUrl = !upload && link ? (await readLinkPreview(link)).imageUrl : null;
    const imagePath = await campaignImagePath(locals.supabase?.storage.from(IMAGE_BUCKET), {
      upload,
      pageImageUrl,
      log: locals.log,
    });

    const { image: _image, ...input } = form.data;
    const added = await addCrowdfunding(db, actor, input, { imagePath });
    // After the commit and the response, so the visitor never waits for a handler.
    locals.afterResponse((db) =>
      dispatchEvent(db, handlersFor(platform?.env), added.eventId, new Date(), locals.log),
    );
  } catch (error) {
    if (error instanceof Invalid) return refuse(form, 400, error.message, error.field);
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

  redirect(303, '/crowdfunding');
}

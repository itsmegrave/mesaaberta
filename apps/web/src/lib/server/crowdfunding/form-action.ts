import { safeNext } from '@mesaaberta/core/server/auth/safe-next';
import { onboardingUrl } from '@mesaaberta/core/server/auth/onboarding';
import { fail, redirect } from '@sveltejs/kit';
import { crowdfundingFormSchema } from '@mesaaberta/core/crowdfunding/schema';
import { normalizeCampaignUrl } from '@mesaaberta/core/crowdfunding/url';
import { validateFormData } from '#lib/forms/contract.js';
import { formMessage, refuse, responseForm } from '#lib/forms/server.js';
import { Forbidden, Invalid, NotFound, RateLimited } from '@mesaaberta/core/server/errors';
import { IMAGE_BUCKET } from '@mesaaberta/core/server/images';
import { serverStorage } from '@mesaaberta/core/server/storage';
import { campaignImagePath } from '@mesaaberta/core/server/crowdfunding/image';
import { readLinkPreview } from '@mesaaberta/core/server/crowdfunding/link-preview';
import { readFromApi } from '../api-read';
import { writeViaApi } from '../api-write';
import { checkLimitViaApi } from '../tables/api';

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
  setHeaders?: (headers: Record<string, string>) => void;
};

/**
 * "Adicionar financiamento": check who is asking, validate the form, store the picture (the file,
 * else the campaign page's own) and add the campaign. It is public at once, so a good result goes
 * back to the list. Every failure answers with what the person typed. The permission itself is the
 * policy's, inside `addCrowdfunding`.
 */
export async function handleCrowdfundingForm({ request, locals, url, setHeaders }: Event) {
  if (!(await locals.getUser())) {
    redirect(303, `/login?next=${encodeURIComponent(safeNext(url.pathname + url.search))}`);
  }
  if (!(await locals.getProfile())?.username) {
    redirect(303, onboardingUrl(url.pathname + url.search));
  }

  const data = await request.formData();
  // Files are allowed so the schema can check the image; every failure below strips them.
  const form = validateFormData(data, crowdfundingFormSchema, NEW_CROWDFUNDING_VALUES, {
    files: ['image'],
  });
  if (!form.valid) return fail(400, { form: responseForm(form) });

  try {
    const actor = await locals.getProfile();
    // A limited person is told before anything is fetched or stored. `addCrowdfunding` checks again, under a lock.
    if (actor) await checkLimitViaApi(locals, actor.id, 'crowdfunding');

    const link = normalizeCampaignUrl(form.data.url);
    const listed =
      link && actor
        ? (
            await readFromApi<{ listed: boolean }>(
              locals,
              actor.id,
              `/v1/crowdfundings/listed?url=${encodeURIComponent(link)}`,
            )
          ).listed
        : false;
    if (listed) return refuse(form, 400, 'already_listed', 'url');

    const upload = form.data.image;
    // The page's own picture is only a convenience: a member past the link-read limit just gets none,
    // so the page is never fetched more often than the preview endpoint would allow.
    let pageImageUrl: string | null = null;
    if (!upload && link && actor) {
      try {
        await writeViaApi(locals, actor, '/v1/crowdfundings/link-read', {});
        pageImageUrl = (await readLinkPreview(link)).imageUrl;
      } catch (error) {
        if (!(error instanceof RateLimited)) throw error;
      }
    }
    const imagePath = await campaignImagePath(
      serverStorage(locals.env, IMAGE_BUCKET) ?? undefined,
      {
        upload,
        pageImageUrl,
        log: locals.log,
      },
    );

    const { image: _image, ...input } = form.data;
    if (!actor) throw new Forbidden();
    await writeViaApi(locals, actor, '/v1/submissions/crowdfundings', {
      input,
      imagePath,
    });
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

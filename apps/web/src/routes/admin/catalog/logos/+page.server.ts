import { fail } from '@sveltejs/kit';
import { pageNumber } from '@mesaaberta/core/admin/catalog';
import { Invalid } from '@mesaaberta/core/server/errors';
import { imageUrl, storageUrlOf } from '@mesaaberta/core/server/images';
import {
  emptySchema,
  logoDecisionSchema,
  logoStatusOf,
  logoUploadSchema,
  type LogoStatus,
} from '@mesaaberta/core/admin/system-logos';
import type { SystemLogoList } from '@mesaaberta/core/server/systems/logos/service';
import { validateFormData, validateStringForm } from '#lib/forms/contract.js';
import { refuse, responseForm } from '#lib/forms/server.js';
import { requireAdmin } from '#lib/server/admin-access.js';
import { decideLogo, uploadLogo } from '#lib/server/admin/system-logos.js';
import { readFromApi, revivedDates } from '#lib/server/api-read.js';
import { requireUser } from '#lib/server/auth/guard.js';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

// The review list for the status in the address (pending by default); a page past the last is 404.
export const load: PageServerLoad = async ({ locals, url }) => {
  const user = await requireUser(locals, url);
  await requireAdmin(locals);
  const status = logoStatusOf(url.searchParams.get('status'));
  const query = new URLSearchParams({
    status,
    page: String(pageNumber(url.searchParams.get('page'))),
  });
  const list = revivedDates(
    await readFromApi<SystemLogoList & { status: LogoStatus }>(
      locals,
      user.id,
      `/v1/admin/system-logos?${query}`,
    ),
  );
  const storage = storageUrlOf(locals.env);
  return {
    ...list,
    page: pageNumber(url.searchParams.get('page')),
    logos: list.logos.map((logo) => ({ ...logo, src: imageUrl(storage, logo.path) })),
  };
};

async function admin({ locals, url }: RequestEvent) {
  await requireUser(locals, new URL(url.pathname, url));
  return requireAdmin(locals);
}

/** One decision on one logo: the form is the system's id, the api makes it. */
const decision = (action: 'approve' | 'reject' | 'forget') => async (event: RequestEvent) => {
  const actor = await admin(event);
  const form = validateStringForm(await event.request.formData(), logoDecisionSchema, ['systemId']);
  if (!form.valid) return fail(400, { form });
  try {
    await decideLogo(event.locals, actor, action, form.data.systemId);
  } catch (error) {
    if (!(error instanceof Invalid)) throw error;
    form.valid = false;
    form.errors._errors = [error.message];
    return fail(400, { form });
  }
  return { form };
};

export const actions: Actions = {
  approveSure: async (event) => {
    const actor = await admin(event);
    const form = validateStringForm(await event.request.formData(), emptySchema, []);
    const { approved = 0 } = await decideLogo(event.locals, actor, 'approveSure');
    return { form, approved };
  },
  // Sends every system the search found nothing for back to the search (after it learns a source).
  forgetMissing: async (event) => {
    const actor = await admin(event);
    const form = validateStringForm(await event.request.formData(), emptySchema, []);
    const { forgotten = 0 } = await decideLogo(event.locals, actor, 'forgetMissing');
    return { form, forgotten };
  },
  // A logo the admin sends by hand for a system the search could not fill.
  upload: async (event) => {
    const actor = await admin(event);
    const form = validateFormData(
      await event.request.formData(),
      logoUploadSchema,
      { systemId: '', sourcePage: '', attribution: '', logo: undefined },
      { files: ['logo'] },
    );
    if (!form.valid) return fail(400, { form: responseForm(form) });
    try {
      await uploadLogo(event.locals, actor, form.data);
    } catch (error) {
      if (!(error instanceof Invalid)) throw error;
      return refuse(form, 400, error.message, error.field === 'image' ? 'logo' : error.field);
    }
    return { form: responseForm(form) };
  },
  approve: decision('approve'),
  reject: decision('reject'),
  forget: decision('forget'),
};

import { fail } from '@sveltejs/kit';
import { pageNumber } from '@mesaaberta/core/admin/catalog';
import { Invalid } from '@mesaaberta/core/server/errors';
import { imageUrl, storageUrlOf } from '@mesaaberta/core/server/images';
import {
  emptySchema,
  logoDecisionSchema,
  logoStatusOf,
  type LogoStatus,
} from '@mesaaberta/core/admin/system-logos';
import type { SystemLogoList } from '@mesaaberta/core/server/systems/logos/service';
import { validateStringForm } from '#lib/forms/contract.js';
import { requireAdmin } from '#lib/server/admin-access.js';
import { decideLogo, searchNextLogos } from '#lib/server/admin/system-logos.js';
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
  // One step of the search: the page repeats it while `more` is true.
  search: async (event) => {
    const actor = await admin(event);
    const form = validateStringForm(await event.request.formData(), emptySchema, []);
    return { form, ...(await searchNextLogos(event.locals, actor)) };
  },
  approveSure: async (event) => {
    const actor = await admin(event);
    const form = validateStringForm(await event.request.formData(), emptySchema, []);
    const { approved = 0 } = await decideLogo(event.locals, actor, 'approveSure');
    return { form, approved };
  },
  approve: decision('approve'),
  reject: decision('reject'),
  forget: decision('forget'),
};

import { error, fail, redirect } from '@sveltejs/kit';
import { safeNext } from '@mesaaberta/core/server/auth/safe-next';
import { Invalid } from '@mesaaberta/core/server/errors';
import type { WidgetPayload } from '@mesaaberta/core/server/extensions/contract';
import { widgets } from '#lib/extensions/panels.js';
import { readFromApi } from '#lib/server/api-read.js';
import type { Actions, PageServerLoad } from './$types';

const widgetPath = (params: { ext: string; id: string }) =>
  `/v1/widgets/${encodeURIComponent(params.ext)}/${encodeURIComponent(params.id)}`;

/** A widget on its own page, for anyone (a poll's public results). 404 when it has none. */
export const load: PageServerLoad = async ({ locals, params }) => {
  const { widget } = await readFromApi<{ widget: WidgetPayload }>(locals, null, widgetPath(params));
  if (!Object.hasOwn(widgets, widget.kind)) error(404);
  return { ext: params.ext, widget };
};

export const actions: Actions = {
  // An answer from a widget's form (a vote, "Agora não"). The rest of the form is the extension's
  // business. Sent with JavaScript it returns the widget as it now stands; without, it goes back.
  respond: async ({ locals, params, request }) => {
    const profile = await locals.getProfile();
    if (!profile) error(401, 'Sign in required');

    const form = await request.formData();
    const next = form.get('next');
    const fields = Object.fromEntries(
      [...form].flatMap(([key, value]) =>
        key !== 'next' && typeof value === 'string' ? [[key, value]] : [],
      ),
    );
    let widget: WidgetPayload | null;
    try {
      ({ widget } = await readFromApi<{ widget: WidgetPayload | null }>(
        locals,
        profile.id,
        widgetPath(params),
        { fields },
      ));
    } catch (cause) {
      if (cause instanceof Invalid) return fail(400, { invalid: true });
      throw cause;
    }
    if (!request.headers.has('x-sveltekit-action'))
      redirect(303, safeNext(typeof next === 'string' ? next : null, '/'));
    return { widget };
  },
};

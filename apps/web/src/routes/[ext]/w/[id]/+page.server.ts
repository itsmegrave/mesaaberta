import { error, fail, redirect } from '@sveltejs/kit';
import { safeNext } from '@mesaaberta/core/server/auth/safe-next';
import { extensionById } from '@mesaaberta/core/server/extensions/index';
import { widgets } from '#lib/extensions/panels.js';
import { widgetViewer } from '#lib/server/widgets.js';
import type { Actions, PageServerLoad } from './$types';

/** A widget on its own page, for anyone (a poll's public results). 404 when it has none. */
export const load: PageServerLoad = async ({ locals, params }) => {
  const surface = extensionById(params.ext)?.widgets;
  if (!surface?.page || !locals.db) error(404);
  const widget = await surface.page(locals.db, params.id, locals.flags);
  if (!widget || !Object.hasOwn(widgets, widget.kind)) error(404);
  return { ext: params.ext, widget };
};

export const actions: Actions = {
  // An answer from a widget's form (a vote, "Agora não"). The rest of the form is the extension's
  // business. Sent with JavaScript it returns the widget as it now stands; without, it goes back.
  respond: async ({ locals, params, request }) => {
    const surface = extensionById(params.ext)?.widgets;
    if (!surface || !locals.db) error(404);
    const viewer = await widgetViewer(locals);
    if (!viewer) error(401, 'Sign in required');

    const form = await request.formData();
    const next = form.get('next');
    const fields = Object.fromEntries(
      [...form].flatMap(([key, value]) =>
        key !== 'next' && typeof value === 'string' ? [[key, value]] : [],
      ),
    );
    const answer = await surface.respond(locals.db, viewer, params.id, fields, locals.flags);
    if (!answer) error(404);
    if ('invalid' in answer) return fail(400, { invalid: true });
    if (!request.headers.has('x-sveltekit-action'))
      redirect(303, safeNext(typeof next === 'string' ? next : null, '/'));
    return { widget: answer.widget };
  },
};

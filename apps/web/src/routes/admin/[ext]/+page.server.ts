import { error, fail } from '@sveltejs/kit';
import { can } from '@mesaaberta/core/server/auth/policy';
import { extensionById } from '@mesaaberta/core/server/extensions/index';
import { extensionViaApi } from '#lib/server/admin/extension-api.js';
import type { Actions, PageServerLoad } from './$types';

/** An extension's panel on the admin's connections page: its own data, and the flags OAuth leaves. */
export const load: PageServerLoad = async ({ locals, params, url }) => {
  if (!can(await locals.getProfile(), 'admin:access')) error(404);
  const admin = extensionById(params.ext)?.admin;
  if (!admin) error(404);
  if (!locals.db) error(503);
  return {
    ...(await admin.load(locals.db, locals.env)),
    connected: url.searchParams.get('connected') === '1',
    connectionError: url.searchParams.has('connection_error'),
  };
};

export const actions: Actions = {
  // An admin hand action of the extension, by the `action` field. The rest of the form is its data;
  // behind `api_admin_<id>` the api Worker runs it, otherwise this process does.
  run: async ({ locals, request, params }) => {
    const profile = await locals.getProfile();
    if (!can(profile, 'admin:access')) error(404);
    const extension = extensionById(params.ext);
    if (!locals.db) error(503);
    const form = await request.formData();
    const name = String(form.get('action') ?? '');
    const actions = extension?.adminActions;
    if (!actions || !Object.hasOwn(actions, name)) error(404);
    const fields = Object.fromEntries(
      [...form].flatMap(([key, value]) =>
        key !== 'action' && typeof value === 'string' ? [[key, value]] : [],
      ),
    );
    const action = actions[name];
    const parsed = action.schema.safeParse(fields);
    if (!parsed.success) return fail(400, { invalid: true });

    const remote = await extensionViaApi(locals, params.ext, profile!.id, name, fields);
    if (remote && 'invalid' in remote) return fail(400, { invalid: true });
    if (remote)
      return Object.fromEntries(Object.entries(remote).filter(([key]) => key !== 'eventIds'));
    return await action.apply(locals.db, locals.env as never, parsed.data as never);
  },
};

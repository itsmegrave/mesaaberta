import { error, fail } from '@sveltejs/kit';
import { can } from '@mesaaberta/core/server/auth/policy';
import { extensionById } from '@mesaaberta/core/server/extensions/index';
import { extensionAction } from '#lib/server/admin/extension-api.js';
import { readFromApi } from '#lib/server/api-read.js';
import { bytesToBase64 } from '@mesaaberta/core/server/base64';
import type { Actions, PageServerLoad } from './$types';

/** The largest file an extension's admin form may send (a short video for a social post). */
const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** An extension's panel on the admin's connections page: its own data, and the flags OAuth leaves. */
export const load: PageServerLoad = async ({ locals, params, url }) => {
  const profile = await locals.getProfile();
  if (!can(profile, 'admin:access')) error(404);
  const admin = extensionById(params.ext)?.admin;
  if (!admin) error(404);
  const { panel } = await readFromApi<{ panel: Record<string, unknown> }>(
    locals,
    profile!.id,
    `/v1/admin/${encodeURIComponent(params.ext)}/panel`,
  );
  return {
    ...panel,
    section: admin.section ?? null,
    connected: url.searchParams.get('connected') === '1',
    connectionError: url.searchParams.has('connection_error'),
  };
};

export const actions: Actions = {
  // An admin hand action of the extension, by the `action` field, run by the api Worker. The rest
  // of the form is its data.
  run: async ({ locals, request, params }) => {
    const profile = await locals.getProfile();
    if (!can(profile, 'admin:access')) error(404);
    const form = await request.formData();
    const name = String(form.get('action') ?? '');
    const actions = extensionById(params.ext)?.adminActions;
    if (!actions || !Object.hasOwn(actions, name)) error(404);
    // A file goes on as a `data:` URL, so the action's schema (and the api, which takes JSON) sees
    // a string like any other field. An empty file input is left out.
    const fields: Record<string, string> = {};
    for (const [key, value] of form) {
      if (key === 'action') continue;
      if (typeof value === 'string') fields[key] = value;
      else if (value.size > MAX_FILE_BYTES) return fail(413, { tooLarge: true });
      else if (value.size > 0)
        fields[key] = `data:${value.type || 'application/octet-stream'};base64,${bytesToBase64(
          new Uint8Array(await value.arrayBuffer()),
        )}`;
    }
    if (!actions[name].schema.safeParse(fields).success) return fail(400, { invalid: true });

    const answer = await extensionAction(locals, params.ext, profile!.id, name, fields);
    if ('invalid' in answer) return fail(400, { invalid: true });
    return answer;
  },
};

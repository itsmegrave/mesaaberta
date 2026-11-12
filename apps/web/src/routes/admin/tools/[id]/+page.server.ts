import { initialForm } from '#lib/forms/contract.js';
import { requireAdmin } from '#lib/server/admin-access.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { readFromApi } from '#lib/server/api-read.js';
import { handleToolForm } from '#lib/server/tools/form-action.js';
import { supabaseUrlOf, toolLogoUrl } from '@mesaaberta/core/server/images';
import type { findToolForAdmin } from '@mesaaberta/core/server/tools/service';
import type { Actions, PageServerLoad } from './$types';

// An admin's "Editar…" on a tool: the same form as a suggestion, saved at once. A tool that is not
// there (or was taken off) is the api's 404.
export const load: PageServerLoad = async ({ locals, url, params, setHeaders }) => {
  const user = await requireUser(locals, url);
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });

  const tool = await readFromApi<Awaited<ReturnType<typeof findToolForAdmin>>>(
    locals,
    user.id,
    `/v1/admin-reads/tools/${encodeURIComponent(params.id)}`,
  );
  return {
    id: tool.id,
    name: tool.name,
    logoUrl: toolLogoUrl(supabaseUrlOf(locals.env), tool.logoPath),
    form: initialForm({
      name: tool.name,
      siteUrl: tool.siteUrl,
      kinds: [...tool.kinds] as string[],
      description: tool.description,
      logo: undefined as File | undefined,
    }),
  };
};

export const actions: Actions = {
  save: async (event) => {
    await requireUser(event.locals, event.url);
    await requireAdmin(event.locals);
    return handleToolForm(event, { id: event.params.id, done: '/admin/tools' });
  },
};

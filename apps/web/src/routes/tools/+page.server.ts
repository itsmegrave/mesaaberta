import type { ToolList } from '@mesaaberta/core/server/tools/service';
import { supabaseUrlOf, toolLogoUrl } from '@mesaaberta/core/server/images';
import { readFromApi } from '#lib/server/api-read.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const profile = await locals.getProfile();
  const query = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
  // The api reads the page: the approved tools by kind, and the viewer's own suggestions waiting.
  const list = await readFromApi<ToolList>(
    locals,
    profile?.id ?? null,
    `/v1/tools${query ? `?${new URLSearchParams({ q: query })}` : ''}`,
  );

  const supabase = supabaseUrlOf(locals.env);
  const card = ({ logoPath, ...tool }: ToolList['pending'][number]) => ({
    ...tool,
    logoUrl: toolLogoUrl(supabase, logoPath),
  });
  return {
    query: list.query,
    pending: list.pending.map(card),
    groups: list.groups.map((group) => ({ kind: group.kind, tools: group.tools.map(card) })),
    signedIn: !!profile,
    sent: url.searchParams.get('enviado') === '1',
  };
};

import type { RequestEvent } from '@sveltejs/kit';
import { requireAdmin } from '../admin-access';
import type { listAdminTables } from '@mesaaberta/core/server/admin/tables';
import { imageUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { readFromApi } from '../api-read';
import { socialFor, type SocialEnv } from '@mesaaberta/core/server/social/index';
import { noSocial } from '@mesaaberta/core/server/social/none';
import { DRAWINGS } from '#lib/icons/drawings.generated.js';
import type { IconName } from '#lib/icons/names.js';
export async function read({ locals, setHeaders, url }: RequestEvent) {
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });
  // With when the site's social token runs out, for the post column.
  const { socialExpiresAt, ...remote } = await readFromApi<
    Awaited<ReturnType<typeof listAdminTables>> & { socialExpiresAt: string | null }
  >(locals, (await locals.getUser())!.id, `/v1/admin-reads/tables${url.search}`);
  // JSON turned the session date into a string; the page gets it as a date.
  const tables = {
    ...remote,
    rows: remote.rows.map((row) => ({ ...row, startsAt: new Date(row.startsAt) })),
  };
  const supabase = supabaseUrlOf(locals.env);
  const social = socialFor(locals.env as SocialEnv);
  return {
    tables: {
      ...tables,
      // The page gets the cover to draw, not the storage path.
      rows: tables.rows.map(({ imagePath, ...row }) => ({
        ...row,
        cover: imageUrl(supabase, imagePath),
      })),
    },
    // Whether a social connector is installed: without one the page has no post column or filter.
    socialInstalled: social !== noSocial,
    // Whether a post can go out now: credentials set and a token that hasn't run out.
    socialAvailable:
      social.configured(locals.env) &&
      socialExpiresAt !== null &&
      new Date(socialExpiresAt) > new Date(),
    // The connector as the page names and draws it; a network without its own icon gets the globe.
    social: {
      label: social.label ?? social.name.charAt(0).toUpperCase() + social.name.slice(1),
      icon: (Object.hasOwn(DRAWINGS, social.name) ? social.name : 'globe') as IconName,
    },
  };
}

export type AdminTablesView = Awaited<ReturnType<typeof read>>['tables'];

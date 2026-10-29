import { can } from '@mesaaberta/core/server/auth/policy';
import { pictureOf, supabaseUrlOf } from '@mesaaberta/core/server/images';
import type { gmDirectorySystems, listGmDirectory } from '@mesaaberta/core/server/gms/directory';
import { readFromApi, revivedDates } from '../api-read';
import { readGmDirectoryFilters } from '@mesaaberta/core/gms/directory-filters';
import type { RequestEvent } from '@sveltejs/kit';
import { directoryLinksEnabled, requireDirectory } from '../directories/flags';

/** The `/gamemasters` list (Quem mestra): one page of people who run games, for the address's filters. */
export const read = async ({ locals, url }: RequestEvent) => {
  await requireDirectory(locals, 'gms');
  const filters = readGmDirectoryFilters(url.searchParams);
  const profile = await locals.getProfile();
  const showBadges = await locals.flags.isEnabled(
    'use_badges',
    profile ? { id: profile.id, isAdmin: can(profile, 'admin:access') } : {},
  );
  // The api reads the page; one past the last is its 404, which becomes the page's.
  const query = new URLSearchParams(url.searchParams);
  if (showBadges) query.set('badges', '1');
  const { systems, ...list } = revivedDates(
    await readFromApi<
      NonNullable<Awaited<ReturnType<typeof listGmDirectory>>> & {
        systems: Awaited<ReturnType<typeof gmDirectorySystems>>;
      }
    >(locals, profile?.id ?? null, `/v1/reads/gamemasters?${query}`),
  );
  const supabase = supabaseUrlOf(locals.env);
  // The Parceiro pill, "Mestra em" and the place's chip (`use_directory_links`).
  const links = await directoryLinksEnabled(locals);
  return {
    filters,
    total: list.total,
    pages: list.pages,
    systems,
    place: links ? list.place : null,
    people: list.people.map(({ avatarPath, avatarUrl, partner, hostedAt, ...person }) => ({
      ...person,
      partner: links && partner,
      hostedAt: links ? hostedAt : [],
      avatarUrl: pictureOf(supabase, { avatarPath, avatarUrl }),
    })),
  };
};

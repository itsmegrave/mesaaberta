import { error } from '@sveltejs/kit';
import { can } from '@mesaaberta/core/server/auth/policy';
import type { FlagName } from '@mesaaberta/core/server/flags/registry';

/** The public directories and the flag that releases each. */
export const DIRECTORY_FLAGS = {
  systems: 'api_directory_systems',
  gms: 'api_directory_gms',
  places: 'api_directory_places',
} as const satisfies Record<string, FlagName>;
export type Directory = keyof typeof DIRECTORY_FLAGS;
export type DirectoryFlags = Record<Directory, boolean>;
/** Every directory off: the maintenance screen, and a layout that could not read the flags. */
export const NO_DIRECTORIES: DirectoryFlags = { systems: false, gms: false, places: false };

/** Whether a directory is on for the person reading (targeted by id), or for visitors. */
export async function directoryEnabled(
  locals: Pick<App.Locals, 'flags' | 'getProfile'>,
  directory: Directory,
): Promise<boolean> {
  const profile = await locals.getProfile();
  return locals.flags.isEnabled(
    DIRECTORY_FLAGS[directory],
    profile ? { id: profile.id, isAdmin: can(profile, 'admin:access') } : {},
  );
}

/** Every directory's switch, for the menus and the footer. */
export async function directoryFlags(
  locals: Pick<App.Locals, 'flags' | 'getProfile'>,
): Promise<DirectoryFlags> {
  const entries = await Promise.all(
    (Object.keys(DIRECTORY_FLAGS) as Directory[]).map(
      async (directory) => [directory, await directoryEnabled(locals, directory)] as const,
    ),
  );
  return Object.fromEntries(entries) as DirectoryFlags;
}

/** A directory's pages answer 404 while it is off for the person reading. */
export async function requireDirectory(
  locals: Pick<App.Locals, 'flags' | 'getProfile'>,
  directory: Directory,
) {
  if (!(await directoryEnabled(locals, directory))) error(404, 'Not found');
}

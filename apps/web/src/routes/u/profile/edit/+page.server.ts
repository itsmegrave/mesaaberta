import { error, fail } from '@sveltejs/kit';
import { Invalid } from '@mesaaberta/core/server/errors';
import type { SettingsCard } from '@mesaaberta/core/server/extensions/contract';
import { settings } from '#lib/extensions/panels.js';
import { initialForm } from '#lib/forms/contract.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { directoryEnabled, directoryLinksEnabled } from '#lib/server/directories/flags.js';
import { moderationAction } from '#lib/server/moderation/form-action.js';
import { readFromApi } from '#lib/server/api-read.js';
import { placeHostLeaveSchema } from '@mesaaberta/core/places/hosts';
import type { hostedPlacesOf } from '@mesaaberta/core/server/places/hosts';
import { removeImage, saveSection, uploadImage } from '#lib/server/profile/edit.js';
import { bannerSchema, photoSchema } from '#lib/profile/photo.js';
import { bannerUrl, pictureOf, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { readProfileForm } from '#lib/server/profile/api.js';
import type { Actions, PageServerLoad } from './$types';

// "Perfil público": the photo, the cover, the name, the bio, "Na mesa, você…" (while Quem mestra
// is on), the links, and the places where they are a house GM (`use_directory_links`), each with
// "Sair". Then the cards of installed extensions (a supporter's avatar frame), when the build has any.
export const load: PageServerLoad = async ({ locals, url }) => {
  const user = await requireUser(locals, url);

  const values = await readProfileForm(locals, user.id);
  const profile = await locals.getProfile();
  const supabaseUrl = supabaseUrlOf(locals.env);
  const [gmDirectory, links] = await Promise.all([
    directoryEnabled(locals, 'gms'),
    directoryLinksEnabled(locals),
  ]);
  type Hosted = NonNullable<ReturnType<Awaited<ReturnType<typeof hostedPlacesOf>>['get']>>;
  return {
    form: initialForm(values),
    gmDirectory,
    // The backfill listed them because they ran a table: say why, until they answer themselves.
    tableRoleInferred: gmDirectory && Boolean(profile?.tableRoleInferred),
    avatarUrl: profile ? pictureOf(supabaseUrl, profile) : null,
    hasUploadedPhoto: Boolean(profile?.avatarPath),
    bannerUrl: bannerUrl(supabaseUrl, profile?.bannerPath ?? null),
    hostedPlaces: links ? await readFromApi<Hosted>(locals, user.id, '/v1/places/hosted') : [],
    extensionCards: await extensionCards(locals, user.id),
  };
};

type ExtensionCard = { ext: string; card: SettingsCard };

/** The cards this build can draw, from the extensions' answer for this person. */
async function extensionCards(locals: App.Locals, profileId: string): Promise<ExtensionCard[]> {
  if (Object.keys(settings).length === 0) return [];
  const { cards } = await readFromApi<{ cards: ExtensionCard[] }>(
    locals,
    profileId,
    '/v1/settings',
  );
  return cards.filter(({ card }) => Object.hasOwn(settings, card.kind));
}

export const actions: Actions = {
  // While Quem mestra is off the field is not drawn, so the stored answer stays as it is.
  save: saveSection('public', {
    hidden: async (locals) => ((await directoryEnabled(locals, 'gms')) ? [] : ['tableRole']),
  }),
  photo: uploadImage('photo', photoSchema, 'foto=salva'),
  removePhoto: removeImage('photo', 'foto=removida'),
  banner: uploadImage('banner', bannerSchema, 'capa=salva'),
  removeBanner: removeImage('banner', 'capa=removida'),
  // "Sair" of a place where they are a house GM.
  leaveHouse: moderationAction(placeHostLeaveSchema, ['placeId'], {
    path: '/v1/places/hosts/leave',
    allow: ({ locals }) => directoryLinksEnabled(locals),
  }),
  // A save from an extension's card (`?/extension&ext=<id>`); its fields are the extension's.
  extension: async ({ locals, request, url }) => {
    const user = await requireUser(locals, url);
    const ext = url.searchParams.get('ext') ?? '';
    if (!ext) error(404);
    const fields = Object.fromEntries(
      [...(await request.formData())].flatMap(([key, value]) =>
        typeof value === 'string' ? [[key, value]] : [],
      ),
    );
    try {
      return await readFromApi<{ card: SettingsCard | null }>(
        locals,
        user.id,
        `/v1/settings/${encodeURIComponent(ext)}`,
        { fields },
      );
    } catch (cause) {
      if (cause instanceof Invalid) return fail(400, { invalid: true });
      throw cause;
    }
  },
};

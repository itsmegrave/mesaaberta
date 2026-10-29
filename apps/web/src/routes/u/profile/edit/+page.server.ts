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
// "Sair".
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
  };
};

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
};

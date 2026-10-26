import { error } from '@sveltejs/kit';
import { initialForm } from '#lib/forms/contract.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { directoryEnabled } from '#lib/server/directories/flags.js';
import { removeImage, saveSection, uploadImage } from '#lib/server/profile/edit.js';
import { bannerSchema, photoSchema } from '#lib/profile/photo.js';
import { bannerUrl, pictureOf, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { loadProfileForm } from '@mesaaberta/core/server/profile/service';
import type { Actions, PageServerLoad } from './$types';

// "Perfil público": the photo, the cover, the name, the bio, "Na mesa, você…" (while Quem mestra
// is on) and the links.
export const load: PageServerLoad = async ({ locals, url }) => {
  const user = await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');

  const values = (await loadProfileForm(locals.db, user.id))!;
  const profile = await locals.getProfile();
  const supabaseUrl = supabaseUrlOf(locals.env);
  const gmDirectory = await directoryEnabled(locals, 'gms');
  return {
    form: initialForm(values),
    gmDirectory,
    // The backfill listed them because they ran a table: say why, until they answer themselves.
    tableRoleInferred: gmDirectory && Boolean(profile?.tableRoleInferred),
    avatarUrl: profile ? pictureOf(supabaseUrl, profile) : null,
    hasUploadedPhoto: Boolean(profile?.avatarPath),
    bannerUrl: bannerUrl(supabaseUrl, profile?.bannerPath ?? null),
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
};

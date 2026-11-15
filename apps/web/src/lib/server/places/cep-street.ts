import { can } from '@mesaaberta/core/server/auth/policy';

/**
 * Whether the place form fills "Rua e número" from the CEP for the person reading
 * (`use_cep_street`). Off, only the neighbourhood, city and state come from the CEP.
 */
export async function cepStreetEnabled(
  locals: Pick<App.Locals, 'flags' | 'getProfile'>,
): Promise<boolean> {
  const profile = await locals.getProfile();
  return locals.flags.isEnabled(
    'use_cep_street',
    profile ? { id: profile.id, isAdmin: can(profile, 'admin:access') } : {},
  );
}

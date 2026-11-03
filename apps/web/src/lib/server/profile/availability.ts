import { error } from '@sveltejs/kit';

/** Whether "Quando posso jogar" is on for the person (`use_profile_availability`), by their id. */
export const availabilityEnabled = (locals: Pick<App.Locals, 'flags'>, profileId: string) =>
  locals.flags.isEnabled('use_profile_availability', { id: profileId });

/** The section and its action are a 404 while `use_profile_availability` is off for the person. */
export async function requireAvailability(locals: Pick<App.Locals, 'flags'>, profileId: string) {
  if (!(await availabilityEnabled(locals, profileId))) error(404, 'Not found');
}

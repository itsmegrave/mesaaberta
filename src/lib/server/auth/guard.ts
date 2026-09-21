import { redirect } from '@sveltejs/kit';
import type { User } from '@supabase/supabase-js';
import { needsOnboarding, onboardingUrl } from './onboarding';

/**
 * Call at the top of a `load` or action that needs a signed-in user. Anonymous visitors are sent
 * to the login page and brought back to where they were going. Someone whose profile has no
 * username yet is sent to finish it first (the onboarding step), and brought back the same way:
 * an incomplete profile reaches no authenticated route. Only the onboarding itself passes
 * `allowIncomplete`.
 */
export async function requireUser(
	locals: App.Locals,
	url: URL,
	{ allowIncomplete = false }: { allowIncomplete?: boolean } = {}
): Promise<User> {
	const here = url.pathname + url.search;

	const user = await locals.getUser();
	if (!user) redirect(303, `/login?next=${encodeURIComponent(here)}`);

	if (!allowIncomplete && needsOnboarding(await locals.getProfile())) {
		redirect(303, onboardingUrl(here));
	}

	return user;
}

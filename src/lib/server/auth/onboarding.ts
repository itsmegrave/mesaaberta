import { safeNext } from './safe-next';

/** Where a signed-in person without a username is sent to finish their profile, and back afterwards. */
export const onboardingUrl = (next: string) => `/onboarding?next=${encodeURIComponent(next)}`;

/**
 * True while a signed-in person has not picked their username: right after sign-up, and for every
 * profile that predates the username. A missing profile counts as not done, so the onboarding
 * step (which creates it) is where those people end up too.
 */
export const needsOnboarding = (profile: { username: string | null } | null): boolean =>
	!profile?.username;

/**
 * Where to send someone who has just signed in: where they were going (`next`, checked), or the
 * onboarding step first when their profile is not complete.
 */
export const afterSignIn = async (locals: App.Locals, next: string | null): Promise<string> => {
	const target = safeNext(next);

	return needsOnboarding(await locals.getProfile()) ? onboardingUrl(target) : target;
};

/** What is shown for someone who has not picked a username yet (a profile older than the onboarding step). */
export const NAMELESS = 'jogador';

/** How a person appears to others: `@username`, or the placeholder while they have none. */
export const atHandle = (username: string | null | undefined) =>
	username && username !== NAMELESS ? `@${username}` : NAMELESS;

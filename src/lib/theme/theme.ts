export type ThemeChoice = 'system' | 'light' | 'dark';
export type Mode = 'light' | 'dark';

/** The page background of each mode, for the browser's own chrome. Keep in step with src/app.html. */
export const MODE_COLOURS: Record<Mode, string> = {
	light: '#fcfcfc',
	dark: '#121212'
};

const KEY = 'theme';

/** The mode a choice means: a manual choice wins, "system" follows the browser. */
export function resolveMode(choice: ThemeChoice, systemPrefersDark: boolean): Mode {
	if (choice === 'system') return systemPrefersDark ? 'dark' : 'light';
	return choice;
}

/** What the reader chose and the browser remembered. Storage can be blocked, so this never throws. */
export function readChoice(): ThemeChoice {
	try {
		const stored = localStorage.getItem(KEY);
		return stored === 'light' || stored === 'dark' ? stored : 'system';
	} catch {
		return 'system';
	}
}

/**
 * Applies and remembers a choice. The page is always in one mode: `data-mode` on `<html>` is `light`
 * or `dark` (the stylesheet's `dark:` variant reads it). "system" forgets the choice and takes the
 * mode from `prefers-color-scheme`. The choice lives in localStorage, not a cookie, so it needs no
 * banner and never leaves the browser.
 */
export function applyChoice(choice: ThemeChoice): void {
	try {
		if (choice === 'system') localStorage.removeItem(KEY);
		else localStorage.setItem(KEY, choice);
	} catch {
		// Blocked storage: the choice still applies to this page, it just is not remembered.
	}

	const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
	const mode = resolveMode(choice, systemDark);
	document.documentElement.dataset.mode = mode;

	for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
		const scheme = meta.media.includes('dark') ? 'dark' : 'light';
		meta.content = MODE_COLOURS[choice === 'system' ? scheme : mode];
	}
}

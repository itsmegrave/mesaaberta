export type ThemeChoice = 'system' | 'light' | 'dark';

/** The page background of each theme, for the browser's own chrome. Keep in step with layout.css and app.html. */
export const THEME_COLOURS = { light: '#e3ebe5', dark: '#0e1b1e' } as const;

const KEY = 'theme';

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
 * Applies and remembers a choice. `light` and `dark` set `data-theme` on `<html>` (which the
 * stylesheet reads); `system` removes it, so the stylesheet follows `prefers-color-scheme`. The
 * choice lives in localStorage, not a cookie, so it needs no banner and never leaves the browser.
 */
export function applyChoice(choice: ThemeChoice) {
	const root = document.documentElement;

	try {
		if (choice === 'system') localStorage.removeItem(KEY);
		else localStorage.setItem(KEY, choice);
	} catch {
		// Blocked storage: the choice still applies to this page, it just is not remembered.
	}

	if (choice === 'system') delete root.dataset.theme;
	else root.dataset.theme = choice;

	for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
		const scheme = meta.media.includes('dark') ? 'dark' : 'light';
		meta.content = THEME_COLOURS[choice === 'system' ? scheme : choice];
	}
}

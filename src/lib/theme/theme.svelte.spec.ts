import { afterEach, describe, expect, it } from 'vitest';
import { MODE_COLOURS, applyChoice, readChoice } from './theme';

afterEach(() => {
	localStorage.clear();
	document.documentElement.removeAttribute('data-mode');
	for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.remove();
});

const mode = () => document.documentElement.dataset.mode;
const metas = () =>
	[...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((m) => m.content);

describe('applyChoice', () => {
	it('sets the mode on <html> and remembers a manual choice', () => {
		applyChoice('dark');

		expect(mode()).toBe('dark');
		expect(readChoice()).toBe('dark');
	});

	it('forgets the choice for "system" but still sets a mode from the system preference', () => {
		applyChoice('dark');
		applyChoice('system');

		expect(readChoice()).toBe('system');
		expect(localStorage.getItem('theme')).toBeNull();
		const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		expect(mode()).toBe(systemDark ? 'dark' : 'light');
	});

	it('paints the browser chrome in the chosen mode', () => {
		document.head.insertAdjacentHTML(
			'beforeend',
			'<meta name="theme-color" content="x" media="(prefers-color-scheme: light)"><meta name="theme-color" content="y" media="(prefers-color-scheme: dark)">'
		);
		applyChoice('dark');

		expect(metas().slice(-2)).toEqual([MODE_COLOURS.dark, MODE_COLOURS.dark]);
	});
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrast } from './contrast';

const css = readFileSync('src/routes/layout.css', 'utf8');
const appHtml = readFileSync('src/app.html', 'utf8');

/** `--color-x: #rrggbb;` declarations inside one block of the stylesheet. */
const tokens = (block: string) =>
	Object.fromEntries(
		[...block.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)].map(([, name, hex]) => [
			name,
			hex
		])
	);

const light = tokens(css.match(/@theme\s*{([^}]*)}/)![1]);
const darkByAttribute = tokens(css.match(/:root\[data-theme='dark'\]\s*{([^}]*)}/)![1]);
const darkBySystem = tokens(
	css.match(
		/@media \(prefers-color-scheme: dark\)\s*{\s*:root:not\(\[data-theme='light'\]\)\s*{([^}]*)}/
	)![1]
);
// The dark theme overrides some tokens; the rest (the player colours) carry over.
const dark = { ...light, ...darkByAttribute };

const TEXT = 4.5; // WCAG AA for normal text
const GRAPHIC = 3; // WCAG AA for the parts of a control you need to see (focus ring, outlines, link underline)

// Every text-on-background and outline-on-background pair the components use.
const pairs: [string, string, number, string][] = [
	['ink', 'celadon', TEXT, 'body text on the page'],
	['ink', 'surface', TEXT, 'text on a card, an input, a menu'],
	['lamp', 'celadon', TEXT, 'amber text on the page (seats left)'],
	['lamp', 'surface', TEXT, 'amber text on a card'],
	['on-petrol', 'petrol', TEXT, 'text on a button or a badge'],
	['on-lamp', 'lamp', TEXT, 'text on the amber "waiting" badge'],
	['danger', 'celadon', TEXT, 'an error on the page'],
	['danger', 'surface', TEXT, 'an error on a card'],
	['focus', 'celadon', GRAPHIC, 'the focus ring on the page'],
	['focus', 'surface', GRAPHIC, 'the focus ring on a card'],
	['lamp', 'celadon', GRAPHIC, 'the amber outline of the empty seat and the link underline'],
	['petrol', 'celadon', GRAPHIC, 'the table against the page']
];

describe('the theme tokens', () => {
	it('define every colour the components use', () => {
		for (const name of [
			'celadon',
			'ink',
			'petrol',
			'lamp',
			'surface',
			'on-petrol',
			'on-lamp',
			'danger',
			'focus'
		]) {
			expect(light, name).toHaveProperty(name);
			expect(dark, name).toHaveProperty(name);
		}
	});

	it('are the same in the dark block for a chosen theme and the one for the system setting', () => {
		expect(darkBySystem).toEqual(darkByAttribute);
	});

	it('give the dark theme its own value for every role that has to change', () => {
		for (const name of [
			'celadon',
			'ink',
			'petrol',
			'lamp',
			'surface',
			'on-petrol',
			'on-lamp',
			'danger',
			'focus'
		]) {
			expect(darkByAttribute[name], name).toBeDefined();
			expect(darkByAttribute[name], name).not.toBe(light[name]);
		}
	});
});

describe.each([
	['light', light],
	['dark', dark]
])('contrast in the %s theme (WCAG AA)', (_theme, colours) => {
	it.each(pairs)('%s on %s is at least %s:1: %s', (foreground, background, minimum) => {
		const ratio = contrast(colours[foreground], colours[background]);

		expect(
			ratio,
			`${foreground} ${colours[foreground]} on ${background} ${colours[background]}`
		).toBeGreaterThanOrEqual(minimum);
	});
});

describe('the dark theme keeps the concept', () => {
	it('is dark: the page is darker than the text, and the table is lighter than the page so it still reads as a shape', () => {
		expect(contrast(dark.celadon, '#000000')).toBeLessThan(contrast(dark.ink, '#000000'));
		expect(contrast(dark.petrol, dark.celadon)).toBeGreaterThan(1);
	});

	it('keeps the amber lamp the accent: a warm colour, brighter than the page', () => {
		const [r, , b] = [1, 3, 5].map((i) => parseInt(dark.lamp.slice(i, i + 2), 16));
		expect(r).toBeGreaterThan(b);
	});
});

describe('the pre-paint script and the browser chrome', () => {
	it('sets the theme in the head, before the stylesheet, with the CSP nonce', () => {
		const script = appHtml.indexOf('<script nonce="%sveltekit.nonce%">');

		expect(script).toBeGreaterThan(-1);
		expect(script).toBeLessThan(appHtml.indexOf('%sveltekit.head%'));
	});

	it('gives the browser a theme-color for each scheme, matching the page background', () => {
		expect(appHtml).toContain(`content="${light.celadon}" media="(prefers-color-scheme: light)"`);
		expect(appHtml).toContain(`content="${dark.celadon}" media="(prefers-color-scheme: dark)"`);
	});

	it('uses the same two colours in the script that applies a manual choice', () => {
		expect(appHtml).toContain(`light: '${light.celadon}'`);
		expect(appHtml).toContain(`dark: '${dark.celadon}'`);
	});

	it('colours the web manifest like the page', () => {
		const manifest = JSON.parse(readFileSync('static/site.webmanifest', 'utf8'));

		expect(manifest.theme_color).toBe(light.celadon);
		expect(manifest.background_color).toBe(light.celadon);
	});
});

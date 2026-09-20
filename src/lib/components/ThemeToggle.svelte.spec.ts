import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ThemeToggle from './ThemeToggle.svelte';

const root = document.documentElement;

beforeEach(() => {
	localStorage.clear();
	delete root.dataset.theme;
	document.head.insertAdjacentHTML(
		'beforeend',
		'<meta name="theme-color" content="#e3ebe5" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#0e1b1e" media="(prefers-color-scheme: dark)">'
	);
});
afterEach(() => {
	vi.restoreAllMocks();
	document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
});

const metas = () =>
	[...document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map(
		(m) => m.content
	);

describe('ThemeToggle', () => {
	it('is a labelled control with the three choices, on "system" until the reader picks', async () => {
		render(ThemeToggle);

		const select = page.getByRole('combobox', { name: 'Tema' });
		await expect.element(select).toHaveValue('system');
		for (const name of ['Automático', 'Claro', 'Escuro']) {
			await expect.element(page.getByRole('option', { name })).toBeInTheDocument();
		}
	});

	it('applies dark at once, and remembers it', async () => {
		render(ThemeToggle);

		await page.getByRole('combobox', { name: 'Tema' }).selectOptions('dark');

		expect(root.dataset.theme).toBe('dark');
		expect(localStorage.getItem('theme')).toBe('dark');
	});

	it('paints the browser chrome in the chosen theme, whatever the system is', async () => {
		render(ThemeToggle);

		await page.getByRole('combobox', { name: 'Tema' }).selectOptions('dark');
		expect(metas()).toEqual(['#0e1b1e', '#0e1b1e']);

		await page.getByRole('combobox', { name: 'Tema' }).selectOptions('light');
		expect(metas()).toEqual(['#e3ebe5', '#e3ebe5']);
	});

	it('goes back to following the system: no attribute, nothing stored, each scheme its own colour', async () => {
		render(ThemeToggle);
		const select = page.getByRole('combobox', { name: 'Tema' });
		await select.selectOptions('dark');

		await select.selectOptions('system');

		expect(root.dataset.theme).toBeUndefined();
		expect(localStorage.getItem('theme')).toBeNull();
		expect(metas()).toEqual(['#e3ebe5', '#0e1b1e']);
	});

	it('shows the remembered choice when it loads', async () => {
		localStorage.setItem('theme', 'dark');

		render(ThemeToggle);

		await expect.element(page.getByRole('combobox', { name: 'Tema' })).toHaveValue('dark');
	});

	it('ignores a stored value it does not know', async () => {
		localStorage.setItem('theme', 'sepia');

		render(ThemeToggle);

		await expect.element(page.getByRole('combobox', { name: 'Tema' })).toHaveValue('system');
	});

	it('still works for this page when storage is blocked', async () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		render(ThemeToggle);

		await page.getByRole('combobox', { name: 'Tema' }).selectOptions('dark');

		expect(root.dataset.theme).toBe('dark');
	});
});

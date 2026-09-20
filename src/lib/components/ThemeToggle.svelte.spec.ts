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
	it('is a labelled icon button toggle with fixed label "Tema escuro"', async () => {
		render(ThemeToggle);

		const button = page.getByRole('button', { name: 'Tema escuro' });
		await expect.element(button).toBeInTheDocument();
		await expect.element(button).toHaveAttribute('aria-pressed', 'false');
	});

	it('toggles to dark on first click and saves choice', async () => {
		render(ThemeToggle);

		const button = page.getByRole('button', { name: 'Tema escuro' });
		await button.click();

		await expect.element(button).toHaveAttribute('aria-pressed', 'true');
		expect(root.dataset.theme).toBe('dark');
		expect(localStorage.getItem('theme')).toBe('dark');
		expect(metas()).toEqual(['#0e1b1e', '#0e1b1e']);
	});

	it('toggles back to light on second click and saves choice', async () => {
		render(ThemeToggle);

		const button = page.getByRole('button', { name: 'Tema escuro' });
		await button.click();
		await button.click();

		await expect.element(button).toHaveAttribute('aria-pressed', 'false');
		expect(root.dataset.theme).toBe('light');
		expect(localStorage.getItem('theme')).toBe('light');
		expect(metas()).toEqual(['#e3ebe5', '#e3ebe5']);
	});

	it('shows the remembered choice when it loads', async () => {
		localStorage.setItem('theme', 'dark');

		render(ThemeToggle);

		const button = page.getByRole('button', { name: 'Tema escuro' });
		await expect.element(button).toHaveAttribute('aria-pressed', 'true');
	});

	it('still works for this page when storage is blocked', async () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		render(ThemeToggle);

		const button = page.getByRole('button', { name: 'Tema escuro' });
		await button.click();

		expect(root.dataset.theme).toBe('dark');
	});
});

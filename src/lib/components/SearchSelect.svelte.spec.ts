import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import SearchSelect from './SearchSelect.svelte';

const items = [
	{ name: 'Daggerheart', slug: 'daggerheart' },
	{ name: 'Savage Worlds', slug: 'savage-worlds' },
	{ name: 'Ordem Paranormal', slug: 'ordem-paranormal' },
	{ name: 'Lobisomem: O Apocalipse', slug: 'lobisomem' }
];
const base = { id: 'system', name: 'system', label: 'Sistema', items, placeholder: 'Buscar' };

const input = () => page.getByRole('combobox', { name: 'Sistema' });
const options = () => page.getByRole('option');
const hiddenValues = () =>
	[...document.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="system"]')].map(
		(field) => field.value
	);

describe('SearchSelect.svelte', () => {
	it('narrows the list to what was typed, ignoring case and accents', async () => {
		render(SearchSelect, base);

		await input().fill('ÓRDEM');

		await expect.element(options()).toHaveLength(1);
		await expect.element(page.getByRole('option', { name: 'Ordem Paranormal' })).toBeVisible();
	});

	it('says so when nothing matches', async () => {
		render(SearchSelect, base);

		await input().fill('gurps');

		await expect.element(page.getByText('Nada encontrado com esse nome.')).toBeVisible();
	});

	it('takes several picks, each a hidden input and a removable chip', async () => {
		const onchange = vi.fn();
		render(SearchSelect, { ...base, multiple: true, onchange });

		await input().fill('dagger');
		await page.getByRole('option', { name: 'Daggerheart' }).click();
		await input().fill('savage');
		await page.getByRole('option', { name: 'Savage Worlds' }).click();

		await vi.waitFor(() => expect(hiddenValues()).toEqual(['daggerheart', 'savage-worlds']));
		expect(onchange).toHaveBeenLastCalledWith(['daggerheart', 'savage-worlds']);

		// The list stays open for another pick until Escape.
		await userEvent.keyboard('{Escape}');
		await page.getByRole('button', { name: 'Remover Daggerheart' }).click();

		await vi.waitFor(() => expect(hiddenValues()).toEqual(['savage-worlds']));
		expect(onchange).toHaveBeenLastCalledWith(['savage-worlds']);
	});

	it('shows the one picked by name, and submits its slug', async () => {
		render(SearchSelect, { ...base, value: ['savage-worlds'] });

		await expect.element(input()).toHaveValue('Savage Worlds');
		expect(hiddenValues()).toEqual(['savage-worlds']);
	});
});

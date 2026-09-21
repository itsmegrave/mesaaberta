import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TableForm from './TableForm.svelte';
import { NEW_TABLE_VALUES } from '$lib/tables/form-values';
import { DEFAULT_WELCOME_MESSAGE } from '$lib/tables/welcome';

const systems = [
	{ name: 'Daggerheart', slug: 'daggerheart' },
	{ name: 'Tormenta 20 (T20)', slug: 'tormenta-20-t20' }
];

const props = { values: NEW_TABLE_VALUES, systems, submitLabel: 'Abrir mesa' };

describe('TableForm', () => {
	it('offers every system as a choice, and asks for one', async () => {
		render(TableForm, props);

		const select = page.getByLabelText('Sistema de RPG');
		await expect.element(select).toBeVisible();
		await expect
			.element(page.getByRole('option', { name: 'Tormenta 20 (T20)' }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('option', { name: 'Escolha um sistema' }))
			.toBeInTheDocument();
	});

	it('starts as a one-shot without the repeat fields, and shows them for a campaign', async () => {
		render(TableForm, props);

		await expect.element(page.getByLabelText('Repete')).not.toBeInTheDocument();

		await page.getByLabelText('Campanha (várias sessões)').click();

		await expect.element(page.getByLabelText('Repete')).toBeVisible();
		await expect.element(page.getByLabelText('Última sessão até')).toBeVisible();
	});

	it('posts as multipart to its action, so an image can travel with it', async () => {
		render(TableForm, { ...props, action: '?/save' });

		const form = page.getByRole('button', { name: 'Abrir mesa' }).element().closest('form');
		expect(form?.method).toBe('post');
		expect(form?.enctype).toBe('multipart/form-data');
		expect(form?.getAttribute('action')).toBe('?/save');
	});

	it('accepts only the image types the server accepts', async () => {
		render(TableForm, props);

		await expect
			.element(page.getByLabelText('Imagem'))
			.toHaveAttribute('accept', 'image/png,image/jpeg,image/webp');
	});

	it('keeps what was typed and marks each field that has a problem', async () => {
		render(TableForm, {
			...props,
			values: { ...NEW_TABLE_VALUES, title: 'ab' },
			errors: { title: 'too_small', capacity: 'invalid_type' }
		});

		await expect.element(page.getByLabelText('Título')).toHaveValue('ab');
		await expect.element(page.getByLabelText('Título')).toHaveAttribute('aria-invalid', 'true');
		await expect.element(page.getByText('Muito curto ou pequeno demais.')).toBeVisible();
		await expect.element(page.getByText('Corrija os campos marcados.')).toBeVisible();
	});

	it('shows the current image when editing', async () => {
		render(TableForm, { ...props, imageUrl: 'https://x.supabase.co/img.png' });

		await expect.element(page.getByText('Imagem atual. Envie outra para trocar.')).toBeVisible();
	});

	describe('welcome message', () => {
		const field = () => page.getByLabelText('Mensagem de boas-vindas');

		it('is pre-filled with the friendly default on a new table, and explains who reads it', async () => {
			render(TableForm, props);

			await expect.element(field()).toHaveValue(DEFAULT_WELCOME_MESSAGE);
			await expect.element(page.getByText(/enviada por e-mail a cada jogador/)).toBeVisible();
		});

		it('is limited to 1000 characters, like the server', async () => {
			render(TableForm, props);

			await expect.element(field()).toHaveAttribute('maxlength', '1000');
		});

		it('shows what the GM saved when editing, not the default', async () => {
			render(TableForm, {
				...props,
				values: { ...NEW_TABLE_VALUES, welcomeMessage: 'Chame no Discord.' }
			});

			await expect.element(field()).toHaveValue('Chame no Discord.');
		});

		it('stays empty when the GM cleared it, so clearing is possible', async () => {
			render(TableForm, { ...props, values: { ...NEW_TABLE_VALUES, welcomeMessage: '' } });

			await expect.element(field()).toHaveValue('');
		});

		it('keeps the typed text and marks the field when it is too long', async () => {
			render(TableForm, {
				...props,
				values: { ...NEW_TABLE_VALUES, welcomeMessage: 'texto longo' },
				errors: { welcomeMessage: 'too_big' }
			});

			await expect.element(field()).toHaveValue('texto longo');
			await expect.element(field()).toHaveAttribute('aria-invalid', 'true');
		});
	});

	it('has no problem message when there is nothing wrong', async () => {
		render(TableForm, props);

		await expect.element(page.getByText('Corrija os campos marcados.')).not.toBeInTheDocument();
	});
});

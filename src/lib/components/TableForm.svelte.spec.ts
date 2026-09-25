import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TableFormHarness from './TableFormHarness.svelte';

const systems = [
	{ name: 'Daggerheart', slug: 'daggerheart' },
	{ name: 'Tormenta 20 (T20)', slug: 'tormenta-20-t20' }
];

const props = { systems, submitLabel: 'Abrir mesa' };

describe('TableForm', () => {
	it('offers every system as a choice, and asks for one', async () => {
		render(TableFormHarness, props);

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
		render(TableFormHarness, props);

		await expect.element(page.getByLabelText('Repete')).not.toBeInTheDocument();

		await page.getByLabelText('Campanha (várias sessões)').click();

		await expect.element(page.getByLabelText('Repete')).toBeVisible();
		await expect.element(page.getByLabelText('Última sessão até')).toBeVisible();
	});

	it('groups the form into the four numbered steps and keeps the preview in sync', async () => {
		render(TableFormHarness, props);

		for (const heading of ['Sobre a mesa', 'Quando', 'Vagas e entrada', 'Imagem']) {
			await expect.element(page.getByRole('heading', { name: heading })).toBeVisible();
		}

		await page.getByLabelText('Título').fill('A Cripta do Rei Afogado');
		await page.getByLabelText('Sistema de RPG').selectOptions('daggerheart');
		await page.getByLabelText('Vagas').fill('4');

		await expect.element(page.getByText('A Cripta do Rei Afogado')).toBeVisible();
		await expect.element(page.getByRole('complementary').getByText('Daggerheart')).toBeVisible();
		await expect.element(page.getByText('One-shot · 4 vagas')).toBeVisible();
	});

	it('posts as multipart to its action, so an image can travel with it', async () => {
		render(TableFormHarness, { ...props, action: '?/save' });

		const form = page.getByRole('button', { name: 'Abrir mesa' }).element().closest('form');
		expect(form?.method).toBe('post');
		expect(form?.enctype).toBe('multipart/form-data');
		expect(form?.getAttribute('action')).toBe('?/save');
	});

	it('accepts only the image types the server accepts', async () => {
		render(TableFormHarness, props);

		await expect
			.element(page.getByRole('button', { name: 'Imagem' }))
			.toHaveAttribute('accept', 'image/png,image/jpeg,image/webp');
	});

	it('keeps what was typed and marks each field that has a problem', async () => {
		render(TableFormHarness, {
			...props,
			values: { title: 'ab' },
			errors: { title: ['too_small'], capacity: ['invalid_type'] }
		});

		await expect.element(page.getByLabelText('Título')).toHaveValue('ab');
		await expect.element(page.getByLabelText('Título')).toHaveAttribute('aria-invalid', 'true');
		await expect.element(page.getByText('Muito curto ou pequeno demais.')).toBeVisible();
		await expect.element(page.getByText('Corrija os campos marcados.')).toBeVisible();
	});

	it('shows the current image when editing', async () => {
		render(TableFormHarness, { ...props, imageUrl: 'https://x.supabase.co/img.png' });

		await expect.element(page.getByText('Imagem atual. Envie outra para trocar.')).toBeVisible();
	});

	it('has no problem message when there is nothing wrong', async () => {
		render(TableFormHarness, props);

		await expect.element(page.getByText('Corrija os campos marcados.')).not.toBeInTheDocument();
	});

	it('shows the image problem next to the image field, from the form message', async () => {
		render(TableFormHarness, { ...props, message: { code: 'not_an_image', field: 'image' } });

		await expect.element(page.getByText('Use uma imagem PNG, JPEG ou WebP.')).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Imagem' }))
			.toHaveAttribute('aria-invalid', 'true');
	});

	it('says a refused permission at the top of the form', async () => {
		render(TableFormHarness, { ...props, message: { code: 'forbidden' } });

		await expect.element(page.getByText('Você não tem permissão para fazer isso.')).toBeVisible();
	});

	it('says how long to wait when the person did this too often', async () => {
		render(TableFormHarness, { ...props, message: { code: 'rate_limited', retryAfter: 900 } });

		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('Você fez isso muitas vezes em pouco tempo. Tente de novo em 15 min.');
	});
});

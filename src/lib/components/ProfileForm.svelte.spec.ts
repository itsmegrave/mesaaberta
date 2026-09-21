import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import ProfileForm from './ProfileForm.svelte';
import { profileSchema, type ProfileInput } from '$lib/profile/schema';

// There is no SvelteKit app around a component test, so the step that hands a result to the router
// has nothing to talk to. What the form shows is the same either way.
vi.mock('$app/forms', async (original) => ({
	...(await original<typeof import('$app/forms')>()),
	applyAction: vi.fn()
}));

const empty: ProfileInput = {
	username: '',
	name: '',
	age: null,
	gender: '',
	city: '',
	linkNetwork: [],
	linkUrl: []
};

// `withErrors` is what the form gets back from a failed post: the values with the errors attached.
const setup = async (
	values: Partial<ProfileInput> = {},
	checkUsername = vi.fn(),
	{ withErrors = false } = {}
) => {
	const form = await superValidate({ ...empty, ...values }, zod4(profileSchema), {
		errors: withErrors
	});
	render(ProfileForm, { form, checkUsername });

	return { checkUsername };
};

const urlFields = () => page.getByLabelText(/^Endereço do link/);
const urls = () =>
	urlFields()
		.elements()
		.map((el) => (el as HTMLInputElement).value);

describe('ProfileForm', () => {
	it('is a plain POST form where every field has a label and only the username is required', async () => {
		await setup();

		const form = page
			.getByRole('button', { name: 'Salvar e continuar' })
			.element()
			.closest('form')!;
		expect(form.method).toBe('post');
		await expect.element(page.getByLabelText('Nome de usuário')).toBeRequired();
		for (const label of ['Nome', 'Idade', 'Gênero', 'Cidade']) {
			await expect.element(page.getByLabelText(label, { exact: true })).not.toBeRequired();
		}
		await expect.element(page.getByLabelText('Idade')).toHaveAttribute('type', 'number');
	});

	it('shows what it was given, such as a username suggested from the sign-in name', async () => {
		await setup({ username: 'ana-souza', name: 'Ana Souza' });

		await expect.element(page.getByLabelText('Nome de usuário')).toHaveValue('ana-souza');
		await expect.element(page.getByLabelText('Nome', { exact: true })).toHaveValue('Ana Souza');
	});

	it('does not post a form that is not valid', async () => {
		const post = vi.spyOn(window, 'fetch');
		await setup();

		await page.getByRole('button', { name: 'Salvar e continuar' }).click();
		await new Promise((resolve) => setTimeout(resolve, 300));

		expect(post).not.toHaveBeenCalled();
		post.mockRestore();
	});

	it('says what is wrong with the username next to the field, described by it', async () => {
		await setup({}, vi.fn(), { withErrors: true });

		const field = page.getByLabelText('Nome de usuário');
		await expect.element(field).toHaveAttribute('aria-invalid', 'true');
		await expect.element(page.getByText('Escolha um nome de usuário.')).toBeVisible();
		expect(field.element().getAttribute('aria-describedby')).toContain('username-error');
	});

	describe('the username check', () => {
		it('says the name is free once the server answers, and only asks once typing stops', async () => {
			const check = vi.fn().mockResolvedValue('free');
			await setup({}, check);

			await userEvent.type(page.getByLabelText('Nome de usuário'), 'Ana-Maria');

			await expect.element(page.getByText('Esse nome está livre.')).toBeVisible();
			expect(check).toHaveBeenCalledTimes(1);
			expect(check).toHaveBeenCalledWith('ana-maria', expect.any(AbortSignal));
		});

		it('says the name is taken, as an error tied to the field', async () => {
			await setup({}, vi.fn().mockResolvedValue('taken'));

			await userEvent.type(page.getByLabelText('Nome de usuário'), 'bruno');

			await expect
				.element(page.getByText('Esse nome já está em uso. Escolha outro.'))
				.toBeVisible();
			await expect
				.element(page.getByLabelText('Nome de usuário'))
				.toHaveAttribute('aria-invalid', 'true');
		});

		it('does not ask the server about a name that is wrong anyway', async () => {
			const check = vi.fn().mockResolvedValue('free');
			await setup({}, check);

			await userEvent.type(page.getByLabelText('Nome de usuário'), 'a');
			await new Promise((resolve) => setTimeout(resolve, 600));

			expect(check).not.toHaveBeenCalled();
		});

		it('lets the person go on when the check cannot be made', async () => {
			await setup({}, vi.fn().mockRejectedValue(new Error('offline')));

			await userEvent.type(page.getByLabelText('Nome de usuário'), 'ana');

			await expect
				.element(page.getByText('Não deu para verificar agora. Você ainda pode salvar.'))
				.toBeVisible();
			await expect.element(page.getByRole('button', { name: 'Salvar e continuar' })).toBeEnabled();
		});
	});

	describe('the links', () => {
		it('starts with the links it was given, each with a network and an address', async () => {
			await setup({
				username: 'ana',
				linkNetwork: ['instagram', 'website'],
				linkUrl: ['https://instagram.com/ana', 'https://ana.example']
			});

			expect(urls()).toEqual(['https://instagram.com/ana', 'https://ana.example']);
			await expect.element(page.getByLabelText('Rede do link 2')).toHaveValue('website');
		});

		it('adds a row, focused, and sends the links as parallel fields the server reads in order', async () => {
			await setup({ username: 'ana' });

			await page.getByRole('button', { name: 'Adicionar link' }).click();

			await expect.element(page.getByLabelText('Endereço do link 1')).toHaveFocus();
			await expect
				.element(page.getByLabelText('Endereço do link 1'))
				.toHaveAttribute('name', 'linkUrl');
			await expect
				.element(page.getByLabelText('Rede do link 1'))
				.toHaveAttribute('name', 'linkNetwork');
		});

		it('removes a row and keeps the others as they were typed', async () => {
			await setup({
				username: 'ana',
				linkNetwork: ['instagram', 'x', 'website'],
				linkUrl: ['https://instagram.com/a', 'https://x.com/a', 'https://a.example']
			});

			await page.getByRole('button', { name: 'Remover link 2' }).click();

			expect(urls()).toEqual(['https://instagram.com/a', 'https://a.example']);
			await expect.element(page.getByLabelText('Rede do link 2')).toHaveValue('website');
			await expect.element(page.getByText('Link removido.')).toBeInTheDocument();
		});

		it('moves a row up and down with buttons, keeping its network with its address', async () => {
			await setup({
				username: 'ana',
				linkNetwork: ['instagram', 'x'],
				linkUrl: ['https://instagram.com/a', 'https://x.com/a']
			});

			await page.getByRole('button', { name: 'Subir link 2' }).click();

			expect(urls()).toEqual(['https://x.com/a', 'https://instagram.com/a']);
			await expect.element(page.getByLabelText('Rede do link 1')).toHaveValue('x');
			await expect.element(page.getByLabelText('Rede do link 2')).toHaveValue('instagram');
			await expect.element(page.getByRole('button', { name: 'Subir link 1' })).toBeDisabled();
			await expect.element(page.getByRole('button', { name: 'Descer link 2' })).toBeDisabled();
		});

		it('stops adding at the limit', async () => {
			await setup({
				username: 'ana',
				linkNetwork: Array(10).fill('website'),
				linkUrl: Array.from({ length: 10 }, (_, i) => `https://a.example/${i}`)
			});

			await expect.element(page.getByRole('button', { name: 'Adicionar link' })).toBeDisabled();
		});

		it('flags the row with the bad address, not the others', async () => {
			await setup(
				{
					username: 'ana',
					linkNetwork: ['instagram', 'website'],
					linkUrl: ['https://instagram.com/a', 'javascript:alert(1)']
				},
				vi.fn(),
				{ withErrors: true }
			);

			await expect
				.element(page.getByLabelText('Endereço do link 2'))
				.toHaveAttribute('aria-invalid', 'true');
			await expect
				.element(page.getByLabelText('Endereço do link 1'))
				.not.toHaveAttribute('aria-invalid');
		});
	});
});

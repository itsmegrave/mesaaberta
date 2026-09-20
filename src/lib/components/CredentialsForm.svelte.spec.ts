import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CredentialsForm from './CredentialsForm.svelte';

const props = { next: '/tables/new' };

describe('CredentialsForm', () => {
	it('is a plain POST with an email and a password, and nothing else to fill in', async () => {
		render(CredentialsForm, { ...props, mode: 'login', action: '?/email' });

		const form = page.getByRole('button', { name: 'Entrar' }).element().closest('form')!;
		expect(form.method).toBe('post');
		expect(form.getAttribute('action')).toBe('?/email');
		await expect.element(page.getByLabelText('Email')).toHaveAttribute('type', 'email');
		await expect.element(page.getByLabelText('Senha')).toHaveAttribute('type', 'password');
	});

	it('carries where to go afterwards in a hidden field', async () => {
		render(CredentialsForm, { ...props, mode: 'login' });

		const form = page.getByRole('button', { name: 'Entrar' }).element().closest('form')!;
		expect(form.querySelector<HTMLInputElement>('input[name=next]')?.value).toBe('/tables/new');
	});

	it('tells a password manager which kind of form it is', async () => {
		render(CredentialsForm, { ...props, mode: 'login' });
		await expect
			.element(page.getByLabelText('Senha'))
			.toHaveAttribute('autocomplete', 'current-password');
	});

	it('for sign-up: says the password rules, offers a new password, and names the button "Criar conta"', async () => {
		render(CredentialsForm, { ...props, mode: 'signup' });

		await expect.element(page.getByText('De 8 a 72 caracteres.')).toBeVisible();
		await expect
			.element(page.getByLabelText('Senha'))
			.toHaveAttribute('autocomplete', 'new-password');
		await expect.element(page.getByRole('button', { name: 'Criar conta' })).toBeVisible();
	});

	it('enforces the same limits in the browser as on the server', async () => {
		render(CredentialsForm, { ...props, mode: 'signup' });

		const password = page.getByLabelText('Senha');
		await expect.element(password).toHaveAttribute('minlength', '8');
		await expect.element(password).toHaveAttribute('maxlength', '72');
		await expect.element(page.getByLabelText('Email')).toBeRequired();
	});

	it('gives back the email that was typed, but has no way to give back a password', async () => {
		render(CredentialsForm, { ...props, mode: 'login', email: 'ana@example.com' });

		await expect.element(page.getByLabelText('Email')).toHaveValue('ana@example.com');
		await expect.element(page.getByLabelText('Senha')).toHaveValue('');
	});

	it.each([
		['invalid', 'Email ou senha incorretos.'],
		['unconfirmed', 'Confirme seu email pelo link que enviamos e tente de novo.'],
		['weak_password', 'Escolha uma senha mais forte.'],
		['rate_limited', 'Muitas tentativas. Espere um pouco e tente de novo.'],
		['failed', 'Não foi possível agora. Tente de novo em instantes.']
	])('says what Supabase answered: %s', async (result, text) => {
		render(CredentialsForm, { ...props, mode: 'login', result });

		await expect.element(page.getByRole('alert')).toHaveTextContent(text);
	});

	it('marks the field that is wrong', async () => {
		render(CredentialsForm, {
			...props,
			mode: 'signup',
			errors: { email: 'invalid_format', password: 'too_small' }
		});

		await expect.element(page.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
		await expect.element(page.getByText('Confira o email.')).toBeVisible();
		await expect.element(page.getByLabelText('Senha')).toHaveAttribute('aria-invalid', 'true');
		await expect.element(page.getByText('A senha precisa ter de 8 a 72 caracteres.')).toBeVisible();
	});

	it('shows no error when there is none', async () => {
		render(CredentialsForm, { ...props, mode: 'login' });

		await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
	});
});

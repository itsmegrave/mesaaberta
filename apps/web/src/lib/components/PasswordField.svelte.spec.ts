import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AuthDivider from './AuthDivider.svelte';
import EmailField from './EmailField.svelte';
import PasswordField from './PasswordField.svelte';

const password = {
  id: 'password-new',
  name: 'password',
  label: 'Nova senha',
  autocomplete: 'new-password' as const,
};

describe('PasswordField', () => {
  it("asks for Supabase's 8 to 72 characters, in the browser too", async () => {
    render(PasswordField, password);

    const field = page.getByLabelText('Nova senha');
    await expect.element(field).toHaveAttribute('type', 'password');
    await expect.element(field).toHaveAttribute('name', 'password');
    await expect.element(field).toHaveAttribute('minlength', '8');
    await expect.element(field).toHaveAttribute('maxlength', '72');
    await expect.element(field).toHaveAttribute('autocomplete', 'new-password');
    await expect.element(field).toBeRequired();
  });

  it('reads the rules and the error with the field', async () => {
    render(PasswordField, { ...password, hint: 'De 8 a 72 caracteres.', error: 'Curta demais.' });

    const field = page.getByLabelText('Nova senha');
    await expect.element(field).toHaveAccessibleDescription('De 8 a 72 caracteres. Curta demais.');
    await expect.element(field).toHaveAttribute('aria-invalid', 'true');
  });

  it('is not marked invalid without an error', async () => {
    render(PasswordField, password);

    await expect.element(page.getByLabelText('Nova senha')).not.toHaveAttribute('aria-invalid');
  });
});

describe('EmailField', () => {
  it('is the email field a password manager knows, required', async () => {
    render(EmailField, { value: 'ana@example.com' });

    const field = page.getByLabelText('Email');
    await expect.element(field).toHaveAttribute('type', 'email');
    await expect.element(field).toHaveAttribute('name', 'email');
    await expect.element(field).toHaveAttribute('autocomplete', 'email');
    await expect.element(field).toHaveValue('ana@example.com');
    await expect.element(field).toBeRequired();
  });
});

describe('AuthDivider', () => {
  it('is drawn but not read', async () => {
    render(AuthDivider);

    expect(document.querySelector('[aria-hidden="true"]')?.textContent).toContain('ou');
  });
});

import '../../routes/layout.css';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import JoinRequestDialog from './JoinRequestDialog.svelte';

describe('JoinRequestDialog', () => {
  it('opens a dialog with an optional message for the GM', async () => {
    render(JoinRequestDialog, {});

    await page.getByRole('button', { name: 'Pedir vaga' }).click();

    await expect.element(page.getByRole('dialog')).toBeVisible();
    const message = page.getByRole('textbox', { name: /Mensagem para o mestre/ });
    await expect.element(message).toBeVisible();
    await expect.element(message).not.toBeRequired();
    await expect.element(page.getByText('(opcional)')).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Enviar pedido' })).toBeVisible();
  });

  it('counts the characters left as the player types, and stops at the limit', async () => {
    render(JoinRequestDialog, {});

    await page.getByRole('button', { name: 'Pedir vaga' }).click();
    const message = page.getByRole('textbox', { name: /Mensagem para o mestre/ });
    await expect.element(page.getByText('500 restantes')).toBeVisible();

    await message.fill('Oi, mestre!');
    await expect.element(page.getByText('489 restantes')).toBeVisible();
    await expect.element(message).toHaveAttribute('maxlength', '500');
  });

  it('closes without asking for anything when cancelled', async () => {
    render(JoinRequestDialog, {});

    await page.getByRole('button', { name: 'Pedir vaga' }).click();
    await page.getByRole('button', { name: 'Cancelar' }).click();

    expect(page.getByRole('dialog').elements()).toHaveLength(0);
  });
});

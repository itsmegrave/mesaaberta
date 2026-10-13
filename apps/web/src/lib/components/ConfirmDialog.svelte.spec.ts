import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ConfirmDialogHarness from './ConfirmDialogHarness.svelte';

describe('ConfirmDialog', () => {
  it('opens as an alert dialog that says what will happen, with focus on "Cancelar"', async () => {
    render(ConfirmDialogHarness);

    await page.getByRole('button', { name: 'Abrir' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Remover Bruno?' });
    await expect.element(dialog).toBeVisible();
    await expect.element(dialog.getByText('Ele perde a vaga.')).toBeVisible();
    await expect.element(dialog.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  it('closes on Escape without acting', async () => {
    render(ConfirmDialogHarness);

    await page.getByRole('button', { name: 'Abrir' }).click();
    await expect.element(page.getByRole('alertdialog')).toBeVisible();
    await userEvent.keyboard('{Escape}');

    await expect.element(page.getByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('posts only from the confirm button, which names the action', async () => {
    render(ConfirmDialogHarness);

    await page.getByRole('button', { name: 'Abrir' }).click();
    const confirm = page.getByRole('alertdialog').getByRole('button', { name: 'Remover da mesa' });

    expect(confirm.element().closest('form')?.getAttribute('action')).toBe('?/remove');
  });
});

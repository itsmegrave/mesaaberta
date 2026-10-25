import '../../../routes/layout.css';
import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DialogShellHarness from './DialogShellHarness.svelte';

const positioner = () => document.querySelector('[data-part="positioner"]');

describe('DialogShell', () => {
  it('draws no full-screen layer while closed, which would cover the page under the CSP', async () => {
    render(DialogShellHarness);

    await expect.element(page.getByRole('button', { name: 'Abrir' })).toBeVisible();
    expect(positioner()).toBeNull();
  });

  it('keeps the layer mounted when it is not lazy', async () => {
    render(DialogShellHarness, { lazy: false });

    await expect.element(page.getByRole('button', { name: 'Abrir' })).toBeVisible();
    expect(positioner()).not.toBeNull();
  });

  it('opens from its trigger, named by its title and described by its text', async () => {
    render(DialogShellHarness);

    await page.getByRole('button', { name: 'Abrir' }).click();

    const dialog = page.getByRole('dialog', { name: 'Remover Bruno?' });
    await expect.element(dialog).toBeVisible();
    await expect.element(dialog).toHaveAccessibleDescription('Ele perde a vaga.');
  });

  it('is an alert dialog when asked, with focus where the caller says', async () => {
    render(DialogShellHarness, { role: 'alertdialog', focusCancel: true });

    await page.getByRole('button', { name: 'Abrir' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Remover Bruno?' });
    await expect.element(dialog.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  it('closes on "Cancelar" and on Escape, and the caller hears it', async () => {
    render(DialogShellHarness);

    await page.getByRole('button', { name: 'Abrir' }).click();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
    await expect.element(page.getByTestId('state')).toHaveTextContent('closed');

    await page.getByRole('button', { name: 'Abrir' }).click();
    await expect.element(page.getByRole('dialog')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
  });

  it('answers only from the confirm button', async () => {
    const onconfirm = vi.fn();
    render(DialogShellHarness, { onconfirm });

    await page.getByRole('button', { name: 'Abrir' }).click();
    await page.getByRole('button', { name: 'Remover' }).click();

    expect(onconfirm).toHaveBeenCalledOnce();
    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
  });
});

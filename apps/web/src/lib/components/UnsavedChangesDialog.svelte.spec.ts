import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { confirmLeave } from '$lib/forms/leave-guard.svelte';
import UnsavedChangesDialog from './UnsavedChangesDialog.svelte';

describe('UnsavedChangesDialog', () => {
  it('stays closed until a form asks', async () => {
    render(UnsavedChangesDialog);

    await expect.element(page.getByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('asks before leaving, and staying keeps the edits', async () => {
    render(UnsavedChangesDialog);

    const answer = confirmLeave();
    await expect.element(page.getByRole('alertdialog')).toBeVisible();
    await expect.element(page.getByRole('alertdialog')).toHaveAccessibleName('Sair sem salvar?');
    await page.getByRole('button', { name: 'Continuar editando' }).click();

    expect(await answer).toBe(false);
    await expect.element(page.getByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('leaves when the person says so', async () => {
    render(UnsavedChangesDialog);

    const answer = confirmLeave();
    await page.getByRole('button', { name: 'Sair sem salvar' }).click();

    expect(await answer).toBe(true);
  });
});

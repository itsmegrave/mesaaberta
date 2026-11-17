import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { confirmLeave, reloadPage, trackDraft } from '#lib/forms/leave-guard.svelte.js';
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

  it('reloads at once when no draft holds unsaved changes', async () => {
    const reload = vi.fn();
    const untrack = trackDraft(() => false);

    expect(await reloadPage(reload)).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
    untrack();
  });

  it('asks before a reload that would lose a draft, and staying keeps it', async () => {
    render(UnsavedChangesDialog);
    const reload = vi.fn();
    const untrack = trackDraft(() => true);

    const staying = reloadPage(reload);
    await page.getByRole('button', { name: 'Continuar editando' }).click();
    expect(await staying).toBe(false);
    expect(reload).not.toHaveBeenCalled();

    const leaving = reloadPage(reload);
    await page.getByRole('button', { name: 'Sair sem salvar' }).click();
    expect(await leaving).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
    untrack();
  });
});

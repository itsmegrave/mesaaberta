import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import EditorFormHarness from './EditorFormHarness.svelte';

describe('EditorForm', () => {
  it('posts as multipart to its action, so an image can travel without JavaScript', async () => {
    render(EditorFormHarness);

    const form = page.getByRole('button', { name: 'Salvar' }).element().closest('form')!;
    expect(form.method).toBe('post');
    expect(form.enctype).toBe('multipart/form-data');
    expect(form.getAttribute('action')).toBe('?/save');
  });

  it('sends the submit to the controller', async () => {
    const submit = vi.fn((event: SubmitEvent) => event.preventDefault());
    render(EditorFormHarness, { submit });

    await page.getByRole('button', { name: 'Salvar' }).click();
    expect(submit).toHaveBeenCalledOnce();
  });

  it('names each section by its heading, with the step number out of the reading', async () => {
    render(EditorFormHarness);

    await expect.element(page.getByRole('region', { name: 'Primeira parte' })).toBeVisible();
    await expect.element(page.getByRole('region', { name: 'Segunda parte' })).toBeVisible();
    expect(document.getElementById('first-part')?.textContent).toBe('Primeira parte');
    const badge = page.getByText('1', { exact: true });
    await expect.element(badge).toHaveAttribute('aria-hidden', 'true');
    await expect.element(page.getByText('Para que serve.')).toBeVisible();
  });

  it('keeps the preview card out of the tab order, but not what is said under it', async () => {
    render(EditorFormHarness);

    const preview = page.getByRole('complementary', { name: 'Como vai aparecer na lista' });
    await expect.element(preview).toBeVisible();
    expect(page.getByText('O cartão').element().closest('[inert]')).not.toBeNull();
    expect(page.getByText('Detalhes do cartão').element().closest('[inert]')).toBeNull();
  });

  it('offers Cancelar and the note under the buttons', async () => {
    render(EditorFormHarness, { note: 'Um admin aprova antes.' });

    await expect
      .element(page.getByRole('link', { name: 'Cancelar' }))
      .toHaveAttribute('href', '/t');
    await expect.element(page.getByText('Um admin aprova antes.')).toBeVisible();
  });

  it('lists the problems at the top and says the whole-form one', async () => {
    render(EditorFormHarness, {
      problems: [{ id: 'name', label: 'Nome', message: 'Obrigatório.' }],
      banner: 'Não foi possível agora.',
    });

    await expect.element(page.getByRole('link', { name: 'Nome: Obrigatório.' })).toBeVisible();
    await expect.element(page.getByText('Não foi possível agora.')).toBeVisible();
  });
});

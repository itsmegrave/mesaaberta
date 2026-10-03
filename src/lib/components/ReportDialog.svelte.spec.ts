import '../../routes/layout.css';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ReportDialog from './ReportDialog.svelte';

const gm = { id: '00000000-0000-4000-8000-000000000001', username: 'ana' };
const player = { id: '00000000-0000-4000-8000-000000000002', username: 'bruno' };

describe('ReportDialog', () => {
  it('offers the table and the people the reporter shares it with', async () => {
    render(ReportDialog, { targets: { table: true, people: [gm, player] } });

    await page.getByRole('button', { name: 'Denunciar' }).click();

    const target = page.getByRole('combobox', { name: 'O que você quer denunciar' });
    await expect.element(target).toBeVisible();
    await page.getByRole('button', { name: 'Abrir a lista: O que você quer denunciar' }).click();
    await expect.element(page.getByRole('option', { name: '@ana' })).toBeInTheDocument();
    await expect.element(page.getByRole('option', { name: '@bruno' })).toBeInTheDocument();
  });

  it('asks nothing about the target when the table is all there is to report', async () => {
    render(ReportDialog, { targets: { table: true, people: [] } });

    await page.getByRole('button', { name: 'Denunciar' }).click();

    await expect.element(page.getByRole('combobox', { name: 'Motivo' })).toBeVisible();
    expect(
      page.getByRole('combobox', { name: 'O que você quer denunciar' }).elements(),
    ).toHaveLength(0);
  });

  it('refuses to send without a reason, before anything is posted', async () => {
    render(ReportDialog, { targets: { table: true, people: [] } });

    await page.getByRole('button', { name: 'Denunciar' }).click();
    // The browser's own check would stop the submit first; skip it to reach the schema.
    document.getElementById('report-reason')?.removeAttribute('required');
    await page.getByRole('button', { name: 'Enviar denúncia' }).click();

    await expect.element(page.getByText('Escolha um motivo.')).toBeVisible();
  });

  it('picks a reason from the list inside the dialog', async () => {
    render(ReportDialog, { targets: { table: true, people: [] } });

    await page.getByRole('button', { name: 'Denunciar' }).click();
    await page.getByRole('button', { name: 'Abrir a lista: Motivo' }).click();
    await page.getByRole('option').first().click();

    await expect
      .poll(() => document.querySelector<HTMLInputElement>('input[name="reason"]')?.value)
      .toBeTruthy();
  });
});

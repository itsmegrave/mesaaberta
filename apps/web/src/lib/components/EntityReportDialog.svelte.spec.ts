import '../../routes/layout.css';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import EntityReportDialog from './EntityReportDialog.svelte';

const entity = { id: '00000000-0000-4000-8000-000000000003', name: 'Loja do Dado' };

describe('EntityReportDialog', () => {
  it('names the listing it reports and posts its id to the report action', async () => {
    render(EntityReportDialog, { kind: 'partner', entity, open: true });

    await expect
      .element(page.getByRole('dialog', { name: 'Denunciar “Loja do Dado”' }))
      .toBeVisible();
    const id = document.querySelector<HTMLInputElement>('input[type="hidden"][name="id"]');
    expect(id?.value).toBe(entity.id);
    expect(id?.closest('form')?.getAttribute('action')).toBe('?/report');
  });

  it('keeps the ids of each kind, which the error lines and the e2e tests point at', async () => {
    render(EntityReportDialog, { kind: 'crowdfunding', entity, open: true });

    await expect.element(page.getByRole('combobox', { name: 'Motivo' })).toBeVisible();
    expect(document.getElementById('crowdfunding-report-reason')).not.toBeNull();
    expect(document.getElementById('crowdfunding-report-details')).not.toBeNull();
  });

  it("offers the partner's reasons, with spam worded as the repeated kind", async () => {
    render(EntityReportDialog, { kind: 'partner', entity, open: true });

    await page.getByRole('button', { name: 'Abrir a lista: Motivo' }).click();

    await expect
      .element(page.getByRole('option', { name: 'Não tem o link para a Mesa Aberta' }))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole('option', { name: 'Spam ou divulgação repetida' }))
      .toBeInTheDocument();
  });

  it("does not offer a partner's reasons for a campaign", async () => {
    render(EntityReportDialog, { kind: 'crowdfunding', entity, open: true });

    await page.getByRole('button', { name: 'Abrir a lista: Motivo' }).click();

    await expect
      .element(page.getByRole('option', { name: 'Link quebrado ou errado' }))
      .toBeInTheDocument();
    expect(
      page.getByRole('option', { name: 'Não tem o link para a Mesa Aberta' }).elements(),
    ).toHaveLength(0);
  });

  it('refuses to send without a reason, before anything is posted', async () => {
    render(EntityReportDialog, { kind: 'partner', entity, open: true });

    await expect.element(page.getByRole('combobox', { name: 'Motivo' })).toBeVisible();
    // The browser's own check would stop the submit first; skip it to reach the schema.
    document.getElementById('partner-report-reason')?.removeAttribute('required');
    await page.getByRole('button', { name: 'Enviar denúncia' }).click();

    const error = page.getByText('Escolha um motivo.');
    await expect.element(error).toBeVisible();
    expect(error.element().id).toBe('partner-report-reason-error');
  });
});

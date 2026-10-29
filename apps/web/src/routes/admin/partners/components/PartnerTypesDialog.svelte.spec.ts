import '../../../layout.css';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PartnerTypesDialog from './PartnerTypesDialog.svelte';

const partner = { id: 'p1', name: 'Loja X', types: ['shop' as const] };

describe('PartnerTypesDialog', () => {
  it('opens with the partner kinds picked and lets an admin change them', async () => {
    render(PartnerTypesDialog, { partner, open: true });

    const dialog = page.getByRole('dialog');
    await expect.element(dialog).toBeVisible();
    await expect.element(dialog.getByRole('checkbox', { name: 'Loja' })).toBeChecked();

    await dialog.getByText('Podcast').click();

    await expect.element(dialog.getByRole('checkbox', { name: 'Podcast' })).toBeChecked();
    expect(
      document.querySelector<HTMLInputElement>('input[type="hidden"][name="types"]')?.value,
    ).toBe('shop,podcast');
  });
});

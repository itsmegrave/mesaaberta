import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CheckboxPillsHarness from './CheckboxPillsHarness.svelte';

describe('CheckboxPills', () => {
  it('is a group of native checkboxes named by its legend, each pick sent with the form', async () => {
    render(CheckboxPillsHarness);

    await expect.element(page.getByRole('group', { name: 'Tipo' })).toBeVisible();
    await expect.element(page.getByRole('checkbox', { name: 'Loja' })).toBeChecked();
    await page.getByText('Podcast').click();
    expect(new FormData(document.querySelector('form')!).getAll('types')).toEqual([
      'shop',
      'podcast',
    ]);
    await expect.element(page.getByTestId('picked')).toHaveTextContent('shop,podcast');
  });

  it('toggles with the space bar', async () => {
    render(CheckboxPillsHarness);

    page.getByRole('checkbox', { name: 'Loja' }).element().focus();
    await userEvent.keyboard(' ');
    await expect.element(page.getByRole('checkbox', { name: 'Loja' })).not.toBeChecked();
    await expect.element(page.getByTestId('picked')).toHaveTextContent('');
  });

  it('says what is wrong under the pills, by `<name>-error`, and the group points at it', async () => {
    render(CheckboxPillsHarness, { error: 'Escolha até 3 tipos.' });

    await expect.element(page.getByRole('alert')).toHaveTextContent('Escolha até 3 tipos.');
    expect(document.querySelector('fieldset')!.getAttribute('aria-describedby')).toContain(
      'types-error',
    );
  });
});

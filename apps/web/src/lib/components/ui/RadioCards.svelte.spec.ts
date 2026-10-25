import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RadioCardsHarness from './RadioCardsHarness.svelte';

describe('RadioCards', () => {
  it('is a group of native radios named by its legend, sent with the form', async () => {
    render(RadioCardsHarness);

    await expect.element(page.getByRole('group', { name: 'Modalidade' })).toBeVisible();
    await expect.element(page.getByRole('radio', { name: 'Online' })).toBeChecked();
    expect(new FormData(document.querySelector('form')!).get('modality')).toBe('online');
  });

  it('picks by click and by the arrow keys, and binds the pick', async () => {
    render(RadioCardsHarness);

    await page.getByText('Presencial').click();
    await expect.element(page.getByTestId('picked')).toHaveTextContent('in_person');
    await userEvent.keyboard('{ArrowUp}');
    await expect.element(page.getByRole('radio', { name: 'Online' })).toBeChecked();
    await expect.element(page.getByTestId('picked')).toHaveTextContent('online');
  });

  it('says what is wrong under the cards, by `<name>-error`', async () => {
    render(RadioCardsHarness, { error: 'Escolha uma.' });

    await expect.element(page.getByRole('alert')).toHaveTextContent('Escolha uma.');
    expect(document.getElementById('modality-error')).not.toBeNull();
  });
});

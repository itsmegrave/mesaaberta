import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SessionConfirmation from './SessionConfirmation.svelte';

const players = [
  { playerId: '00000000-0000-4000-8000-000000000001', username: 'ana', avatarUrl: null },
  { playerId: '00000000-0000-4000-8000-000000000002', username: 'bia', avatarUrl: null },
];

describe('SessionConfirmation', () => {
  it('lists the confirmed players, all checked, inside the "it happened" form', async () => {
    render(SessionConfirmation, { next: '/t/mesa/manage', players });

    const ana = page.getByRole('checkbox', { name: 'ana' });
    const bia = page.getByRole('checkbox', { name: 'bia' });
    await expect.element(ana).toBeChecked();
    await expect.element(bia).toBeChecked();
    expect(ana.element().closest('form')?.getAttribute('action')).toBe('?/happened');
    // Without this marker the server cannot tell an empty list from a form that never asked.
    expect(ana.element().closest('form')?.querySelector('input[name="attendance"]')).not.toBeNull();
  });

  it('sends only the players left checked', async () => {
    render(SessionConfirmation, { next: '/t/mesa/manage', players });

    await page.getByRole('checkbox', { name: 'bia' }).click();

    const form = page.getByRole('checkbox', { name: 'ana' }).element().closest('form')!;
    expect(new FormData(form).getAll('present')).toEqual([players[0].playerId]);
  });

  it('does not ask who showed up when no one has a seat', async () => {
    render(SessionConfirmation, { next: '/t/mesa/manage', players: [] });

    await expect.element(page.getByRole('button', { name: 'Aconteceu' })).toBeVisible();
    await expect.element(page.getByRole('checkbox')).not.toBeInTheDocument();
  });
});

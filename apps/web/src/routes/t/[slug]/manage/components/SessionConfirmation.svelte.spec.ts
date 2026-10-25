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

  it('locks a player who already rated as present, and still sends them', async () => {
    render(SessionConfirmation, {
      next: '/t/mesa/manage',
      players: [players[0], { ...players[1], rated: true }],
      multi: true,
    });

    // The note is part of the label, so it is read with the name.
    const bia = page.getByRole('checkbox', { name: /^bia/ });
    await expect.element(bia).toBeChecked();
    await expect.element(bia).toBeDisabled();
    await expect
      .element(page.getByText('Já avaliou a mesa, então conta como presente.'))
      .toBeVisible();

    await page.getByRole('checkbox', { name: 'ana' }).click();
    const form = bia.element().closest('form')!;
    expect(new FormData(form).getAll('present')).toEqual([players[1].playerId]);
  });

  it('does not ask who showed up when no one has a seat', async () => {
    render(SessionConfirmation, { next: '/t/mesa/manage', players: [] });

    await expect.element(page.getByRole('button', { name: 'Aconteceu' })).toBeVisible();
    await expect.element(page.getByRole('checkbox')).not.toBeInTheDocument();
  });

  it('for a campaign, asks if more sessions come and posts to the session-held action', async () => {
    render(SessionConfirmation, { next: '/t/mesa/manage', players, multi: true });

    const form = page.getByRole('checkbox', { name: 'ana' }).element().closest('form')!;
    expect(form.getAttribute('action')).toBe('?/sessionHeld');
    await expect
      .element(page.getByRole('button', { name: 'Confirmar, a mesa continua' }))
      .toBeVisible();

    await page.getByRole('radio', { name: /Foi a última sessão/ }).click();

    expect(form.getAttribute('action')).toBe('?/happened');
    await expect
      .element(page.getByRole('button', { name: 'Confirmar e concluir a mesa' }))
      .toBeVisible();
  });

  it('asks the next date with the calendar picker, and no duration', async () => {
    render(SessionConfirmation, {
      next: '/t/mesa/manage',
      players: [],
      multi: true,
    });

    // The day comes from the calendar, the same picker as the table form; the field posts the date.
    const form = page
      .getByRole('radio', { name: /Vêm mais sessões/ })
      .element()
      .closest('form')!;
    expect(form.querySelector('input[name="nextStartsAtLocal"]')).not.toBeNull();
    expect(form.querySelector('input[name="durationHours"]')).toBeNull();
  });
});

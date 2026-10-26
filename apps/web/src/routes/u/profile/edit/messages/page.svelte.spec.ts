import '../../../../layout.css';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

const show = (enabled: boolean, blocks: { gmId: string; username: string }[] = []) =>
  render(Page, {
    data: {
      invitationPreferences: { enabled, blocks },
      messagesForm: { data: { enabled: true }, errors: {}, valid: true },
    } as never,
    form: null as never,
  });

describe('Mensagens e convites', () => {
  it('turns invitations on and off with a switch (a checkbox), not a button whose label flips', async () => {
    show(true);
    const receive = page.getByRole('checkbox', { name: 'Receber convites' });
    await expect.element(receive).toBeChecked();
    expect(page.getByRole('button', { name: /receber convites/i }).elements()).toHaveLength(0);
  });

  it('lists who is blocked, each with "Desbloquear"', async () => {
    show(false, [{ gmId: '00000000-0000-4000-8000-000000000002', username: 'rafa' }]);
    await expect
      .element(page.getByRole('checkbox', { name: 'Receber convites' }))
      .not.toBeChecked();
    await expect
      .element(page.getByRole('heading', { name: 'Pessoas bloqueadas para convites' }))
      .toBeVisible();
    await expect.element(page.getByText('@rafa')).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Desbloquear' })).toBeVisible();
  });
});

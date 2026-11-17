import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TableGoingOn from './TableGoingOn.svelte';

const player = (n: number, over = {}) => ({
  playerId: `00000000-0000-4000-8000-00000000000${n}`,
  username: ['ana', 'bia', 'caio'][n - 1],
  avatarUrl: null,
  attended: null,
  ratingOpenedAt: null,
  ...over,
});

describe('TableGoingOn', () => {
  beforeEach(async () => {
    await page.viewport(1024, 800);
  });

  it('offers rating only to who was marked present and not already let, and says who was let', async () => {
    render(TableGoingOn, {
      next: '/t/mesa/manage',
      tableManage: '/t/mesa/manage',
      players: [
        player(1, { attended: true }),
        // Never marked present: not offered, like someone marked absent.
        player(2),
        player(3, { attended: true, ratingOpenedAt: new Date() }),
      ],
    });

    await expect.element(page.getByRole('checkbox', { name: 'ana' })).not.toBeChecked();
    await expect.element(page.getByRole('checkbox', { name: 'bia' })).not.toBeInTheDocument();
    await expect.element(page.getByRole('checkbox', { name: 'caio' })).not.toBeInTheDocument();
    await expect.element(page.getByText(/^Avaliação liberada em /)).toBeVisible();
    await expect.element(page.getByText('caio')).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Liberar avaliação' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Encerrar mesa…' })).toBeVisible();
  });

  it('has nothing to send when nobody is left to let', async () => {
    render(TableGoingOn, { next: '/t/mesa/manage', tableManage: '/t/mesa/manage', players: [] });

    await expect.element(page.getByText('Ninguém para liberar agora.')).toBeVisible();
    await expect
      .element(page.getByRole('button', { name: 'Liberar avaliação' }))
      .not.toBeInTheDocument();
  });

  it('folds the list on a phone, saying how many are left to let', async () => {
    await page.viewport(390, 844);
    render(TableGoingOn, {
      next: '/t/mesa/manage',
      tableManage: '/t/mesa/manage',
      players: [player(1, { attended: true }), player(2, { attended: true })],
    });

    const toggle = page.getByRole('button', { name: /^Liberar avaliação/ }).first();
    await expect.element(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect.element(page.getByText('2 pessoas para liberar')).toBeVisible();
    // Hidden content is out of the accessibility tree.
    await expect.element(page.getByRole('checkbox', { name: 'ana' })).not.toBeInTheDocument();

    await toggle.click();
    await expect.element(page.getByRole('checkbox', { name: 'ana' })).toBeVisible();
  });
});

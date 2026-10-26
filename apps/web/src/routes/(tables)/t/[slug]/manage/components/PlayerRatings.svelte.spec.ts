import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PlayerRatings from './PlayerRatings.svelte';

const player = (n: number, over = {}) => ({
  playerId: `00000000-0000-4000-8000-00000000000${n}`,
  username: ['ana', 'bia', 'caio'][n - 1],
  avatarUrl: null,
  tablesPlayed: n - 1,
  markedPresent: true,
  playerRating: null,
  ...over,
});

describe('PlayerRatings', () => {
  it('lists only who was marked present, with stars to send or the score already sent', async () => {
    render(PlayerRatings, {
      next: '/t/mesa/manage',
      goingOn: false,
      players: [player(1), player(2, { markedPresent: false }), player(3, { playerRating: 4 })],
    });

    await expect.element(page.getByRole('heading', { name: 'Avalie quem jogou' })).toBeVisible();
    await expect.element(page.getByText('Nota para ana')).toBeInTheDocument();
    await expect.element(page.getByText('bia')).not.toBeInTheDocument();
    // "Enviar nota", or "Enviar" on a phone.
    expect(page.getByRole('button', { name: /^Enviar/ }).elements()).toHaveLength(1);
    await expect.element(page.getByText('Nota enviada')).toBeVisible();
    await expect.element(page.getByText('Primeira mesa')).toBeVisible();
    await expect.element(page.getByText('Jogou 2 mesas')).toBeVisible();
  });

  it('opens the comment only when asked, and says it stays with the GM', async () => {
    render(PlayerRatings, { next: '/t/mesa/manage', goingOn: true, players: [player(1)] });

    await expect.element(page.getByRole('heading', { name: 'Avalie quem joga' })).toBeVisible();
    await expect.element(page.getByRole('textbox')).not.toBeInTheDocument();
    await page.getByRole('button', { name: 'Adicionar comentário' }).click();
    await expect
      .element(page.getByRole('textbox', { name: 'Comentário (opcional, só você vê)' }))
      .toBeVisible();
  });

  it('shows nothing when nobody was marked present', async () => {
    render(PlayerRatings, {
      next: '/t/mesa/manage',
      goingOn: false,
      players: [player(1, { markedPresent: false })],
    });

    await expect.element(page.getByRole('heading')).not.toBeInTheDocument();
  });
});

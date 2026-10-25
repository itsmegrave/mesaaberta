import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import MinPlayersLine from './MinPlayersLine.svelte';

describe('MinPlayersLine.svelte', () => {
  it('says how many the table needs and how many are missing', async () => {
    render(MinPlayersLine, { minPlayers: 3, taken: 1 });

    await expect.element(page.getByText('Precisa de 3 para acontecer · faltam 2')).toBeVisible();
  });

  it('uses the singular for the last missing seat', async () => {
    render(MinPlayersLine, { minPlayers: 3, taken: 2 });

    await expect.element(page.getByText('Precisa de 3 para acontecer · falta 1')).toBeVisible();
  });

  it('says the minimum is met once enough people are in', async () => {
    render(MinPlayersLine, { minPlayers: 3, taken: 3 });

    await expect.element(page.getByText('Mínimo atingido')).toBeVisible();
  });
});

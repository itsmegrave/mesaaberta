import { createRawSnippet } from 'svelte';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RosterRow from './RosterRow.svelte';

describe('RosterRow', () => {
  it('names the person with a link to their profile and the line under it', async () => {
    await render(RosterRow, {
      username: 'bruno',
      avatarUrl: null,
      subline: 'Desde 12 de setembro',
    });

    await expect
      .element(page.getByRole('link', { name: '@bruno' }))
      .toHaveAttribute('href', '/u/bruno');
    await expect.element(page.getByText('Desde 12 de setembro')).toBeVisible();
  });

  it('puts the actions in the row and the rest on a line of its own when it wraps', async () => {
    const actions = createRawSnippet(() => ({
      render: () => '<button type="button">Aprovar</button>',
    }));
    const children = createRawSnippet(() => ({ render: () => '<p>Oi, mestre!</p>' }));
    await render(RosterRow, {
      username: 'lia',
      avatarUrl: null,
      subline: 'Pediu ontem',
      wrap: true,
      actions,
      children,
    });

    const row = document.querySelector('li')!;
    expect(row.classList.contains('flex-wrap')).toBe(true);
    await expect.element(page.getByRole('button', { name: 'Aprovar' })).toBeVisible();
    expect(row.lastElementChild?.textContent).toBe('Oi, mestre!');
  });
});

import '../../layout.css';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

describe('admin badges page', () => {
  it('lists each badge with how it is given, its holders and revocations', async () => {
    await page.viewport(1280, 900);
    render(Page, {
      data: {
        badges: [
          { badgeId: 'first-table', kind: 'rule', holders: 1234, revoked: 2 },
          { badgeId: 'pioneer', kind: 'backfill', holders: 40, revoked: 0 },
          { badgeId: 'community-helper', kind: 'manual', holders: 0, revoked: 0 },
          // No artwork yet: left out.
          { badgeId: 'not-drawn', kind: 'rule', holders: 3, revoked: 0 },
        ],
      } as never,
    });

    await expect.element(page.getByRole('heading', { name: 'Conquistas', level: 1 })).toBeVisible();
    const table = page.getByRole('table');
    await expect.element(table.getByText('Primeira mesa')).toBeVisible();
    await expect.element(table.getByText('Por regra')).toBeVisible();
    await expect.element(table.getByText('1.234')).toBeVisible();
    await expect.element(table.getByText('Só retroativa')).toBeVisible();
    await expect.element(table.getByText('Concedida pela equipe')).toBeVisible();
    expect(table.getByText('not-drawn').elements()).toHaveLength(0);
  });
});

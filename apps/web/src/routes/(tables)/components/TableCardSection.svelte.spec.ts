import '../../layout.css';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Harness from './TableCardSectionHarness.svelte';

describe('TableCardSection', () => {
  it('shows three cards and a card that shows the rest in place', async () => {
    render(Harness, { count: 5 });

    await expect.element(page.getByRole('heading', { name: /Começa já/ })).toBeInTheDocument();
    expect(document.querySelectorAll('article')).toHaveLength(3);
    const more = page.getByRole('button', { name: 'Ver mais 2 mesas' });
    await more.click();

    expect(document.querySelectorAll('article')).toHaveLength(5);
    await expect.element(more).not.toBeInTheDocument();
    await expect.element(page.getByRole('link', { name: 'Mesa 4' })).toHaveFocus();
  });

  it('has no more card when everything fits', async () => {
    render(Harness, { count: 3 });

    expect(document.querySelectorAll('article')).toHaveLength(3);
    await expect.element(page.getByRole('button', { name: /Ver mais/ })).not.toBeInTheDocument();
  });

  it('folds away under its heading', async () => {
    render(Harness, { count: 2 });

    await page.getByRole('button', { name: /Começa já/ }).click();
    await expect
      .poll(() => document.querySelector<HTMLElement>('article')?.checkVisibility() ?? false)
      .toBe(false);
  });
});

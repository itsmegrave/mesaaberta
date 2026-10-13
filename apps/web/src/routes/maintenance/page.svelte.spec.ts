import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

describe('the maintenance screen', () => {
  it('says the site is temporarily down, in one heading, with nothing technical', async () => {
    render(Page);

    await expect
      .element(page.getByRole('heading', { level: 1 }))
      .toHaveTextContent('Voltamos em breve');
    await expect
      .element(
        page.getByText('A Mesa Aberta está em manutenção no momento. Tente de novo mais tarde.'),
      )
      .toBeVisible();
    expect(page.getByRole('heading').elements()).toHaveLength(1);
    expect(document.body.textContent).not.toMatch(/503|erro|error/i);
  });
});

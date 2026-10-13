import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import UserLink from './UserLink.svelte';
import UserText from './UserText.svelte';

describe('public profile links', () => {
  it('links a handle to the public route', async () => {
    render(UserLink, { username: 'ana' });
    await expect
      .element(page.getByRole('link', { name: '@ana' }))
      .toHaveAttribute('href', '/u/ana');
  });

  it.each([null, undefined, '', 'sem nome'])(
    'keeps missing identity %s as plain text',
    async (username) => {
      render(UserLink, { username });
      await expect.element(page.getByText('sem nome')).toBeVisible();
      expect(document.querySelector('a')).toBeNull();
    },
  );

  it('preserves a translated sentence and escapes user content', async () => {
    render(UserText, { username: 'ana', text: 'por @ana: <img src=x>' });
    await expect
      .element(page.getByRole('link', { name: '@ana' }))
      .toHaveAttribute('href', '/u/ana');
    await expect.element(page.getByText('por @ana: <img src=x>')).toBeVisible();
    expect(document.querySelector('img')).toBeNull();
  });
});

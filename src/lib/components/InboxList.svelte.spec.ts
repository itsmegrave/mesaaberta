import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import InboxList, { type InboxItem } from './InboxList.svelte';

const direct: InboxItem = {
  id: 'chat-ana',
  kind: 'direct',
  title: 'ana',
  tableSlug: null,
  imageUrl: null,
  avatarUrl: null,
  lastMessageAt: new Date(),
  preview: { body: 'Olá!', own: false, sender: 'ana' },
  unread: 0,
  muted: false,
};

describe('inbox profile links', () => {
  it('opens the profile independently of selecting the conversation', async () => {
    const onselect = vi.fn();
    render(InboxList, { items: [direct], page: 1, pages: 1, onselect });
    const profile = page.getByRole('link', { name: '@ana', exact: true });
    await expect.element(profile).toHaveAttribute('href', '/ana');
    expect(document.querySelector('a a')).toBeNull();
    document
      .querySelector('a[href="/ana"]')!
      .addEventListener('click', (event) => event.preventDefault(), { once: true });
    await profile.click();
    expect(onselect).not.toHaveBeenCalled();
    await page.getByRole('link', { name: '@ana Olá!', exact: true }).click();
    expect(onselect).toHaveBeenCalledWith('chat-ana');
  });

  it('links the sender in a table preview', async () => {
    render(InboxList, {
      items: [{ ...direct, kind: 'table', title: 'Aventura' }],
      page: 1,
      pages: 1,
    });
    await expect
      .element(page.getByRole('link', { name: '@ana', exact: true }))
      .toHaveAttribute('href', '/ana');
    await expect
      .element(page.getByRole('link', { name: 'Aventura @ana: Olá!', exact: true }))
      .toHaveAttribute('href', '/messages/chat-ana');
  });
});

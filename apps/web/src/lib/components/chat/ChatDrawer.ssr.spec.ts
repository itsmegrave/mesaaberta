import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ChatDrawer from './ChatDrawer.svelte';

// Without JavaScript the page is what the server sent. The dialog's closed positioner is a
// full-screen layer kept click-through by an inline style, which the CSP blocks, so it must not be sent.
describe('the chat drawer on the server', () => {
  it('sends no full-screen layer that could cover the page and swallow its clicks', () => {
    const { body } = render(ChatDrawer, { props: { viewerId: 'viewer', unread: 0 } });

    expect(body).not.toContain('data-part="positioner"');
    expect(body).not.toContain('inset-0');
  });
});

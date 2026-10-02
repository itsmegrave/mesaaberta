import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import NotificationIcon from './NotificationIcon.svelte';

describe('NotificationIcon', () => {
  it.each(['user-plus', 'user-check', 'user-x', 'user-minus'] as const)(
    'draws a person (%s) as the meeple, so every person looks alike',
    async (icon) => {
      const { container } = await render(NotificationIcon, { icon });

      expect(container.querySelector('svg')?.getAttribute('data-icon')).toBe('game-icons:meeple');
    },
  );

  it('keeps the messaging notification as the scroll and quill', async () => {
    const { container } = await render(NotificationIcon, { icon: 'message' });

    expect(container.querySelector('svg')?.getAttribute('data-icon')).toBe(
      'game-icons:scroll-quill',
    );
  });
});

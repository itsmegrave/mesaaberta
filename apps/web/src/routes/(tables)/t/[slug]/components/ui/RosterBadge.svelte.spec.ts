import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RosterBadge from './RosterBadge.svelte';

describe('RosterBadge', () => {
  it('draws the medal with its name for screen readers and on hover', async () => {
    await render(RosterBadge, { badgeId: 'reliable-player' });

    await expect.element(page.getByText('Presença confiável')).toBeInTheDocument();
    expect(document.querySelector('[title="Presença confiável"]')).not.toBeNull();
  });

  it('draws nothing for a badge with no artwork yet', async () => {
    const { container } = await render(RosterBadge, { badgeId: 'no-such-badge' });

    expect(container.textContent?.trim()).toBe('');
  });
});

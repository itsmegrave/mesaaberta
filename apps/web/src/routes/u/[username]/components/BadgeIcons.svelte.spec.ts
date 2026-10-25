import '../../../layout.css';
import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import BadgeIcons from './BadgeIcons.svelte';

const held = (badgeId: string, over: Record<string, unknown> = {}) => ({
  badgeId,
  awardedAt: new Date('2026-10-01T12:00:00Z'),
  hidden: false,
  backfilled: false,
  ...over,
});

describe('BadgeIcons (under the user handle)', () => {
  it('shows only the icons, each named for a screen reader, and no details yet', async () => {
    render(BadgeIcons, { badges: [held('first-table'), held('partner')] });

    await expect.element(page.getByRole('button', { name: 'Primeira mesa' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Parceria' })).toBeVisible();
    expect(page.getByText('Jogou a primeira sessão.').elements()).toHaveLength(0);
  });

  it('opens the details on a tap and closes them on Esc', async () => {
    render(BadgeIcons, { badges: [held('first-table')] });

    await page.getByRole('button', { name: 'Primeira mesa' }).click();
    await expect.element(page.getByText('Jogou a primeira sessão.')).toBeVisible();
    await expect.element(page.getByText(/^Conquistada em .*2026/)).toBeVisible();

    await userEvent.keyboard('{Escape}');
    await expect.poll(() => page.getByText('Jogou a primeira sessão.').elements().length).toBe(0);
  });

  it('shows no icon for what the owner hid, a badge without artwork, or a lower rung', async () => {
    render(BadgeIcons, {
      badges: [
        held('partner', { hidden: true }),
        held('not-a-badge'),
        held('regular-player-1'),
        held('regular-player-2'),
      ],
    });

    await expect.element(page.getByRole('button', { name: 'Presença constante II' })).toBeVisible();
    expect(page.getByRole('button').elements()).toHaveLength(1);
  });

  it('draws nothing when there is nothing to show', async () => {
    render(BadgeIcons, { badges: [held('partner', { hidden: true })] });

    expect(page.getByRole('list').elements()).toHaveLength(0);
  });
});

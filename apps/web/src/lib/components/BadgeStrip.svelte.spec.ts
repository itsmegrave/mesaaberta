import '../../routes/layout.css';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import BadgeStrip from './BadgeStrip.svelte';

const held = (badgeId: string, over: Record<string, unknown> = {}) => ({
  badgeId,
  awardedAt: new Date('2026-10-01T12:00:00Z'),
  hidden: false,
  backfilled: false,
  ...over,
});

describe('BadgeStrip', () => {
  it('shows each badge with its name, what it says and when it was earned', async () => {
    render(BadgeStrip, { badges: [held('first-table')] });

    await expect.element(page.getByRole('heading', { name: 'Conquistas' })).toBeVisible();
    await expect.element(page.getByText('Primeira mesa')).toBeVisible();
    await expect.element(page.getByText('Concluiu a primeira mesa na Mesa Aberta.')).toBeVisible();
    await expect.element(page.getByText(/^Em .*2026/)).toBeVisible();
  });

  it('says a backfilled badge came before the release instead of giving a date', async () => {
    render(BadgeStrip, { badges: [held('pioneer', { backfilled: true })] });

    await expect.element(page.getByText('Antes da estreia das conquistas')).toBeVisible();
  });

  it('shows a visitor only the highest rung held of a ladder', async () => {
    render(BadgeStrip, { badges: [held('regular-player-1'), held('regular-player-2')] });

    await expect.element(page.getByText('Presença constante II')).toBeVisible();
    expect(page.getByText('Presença constante I', { exact: true }).elements()).toHaveLength(0);
  });

  const hiddenAndUnknown = [held('first-table', { hidden: true }), held('not-a-badge')];

  it('shows a visitor neither what the owner hid nor a badge without artwork', async () => {
    render(BadgeStrip, { badges: hiddenAndUnknown });

    expect(page.getByRole('heading', { name: 'Conquistas' }).elements()).toHaveLength(0);
    expect(page.getByText('Primeira mesa').elements()).toHaveLength(0);
  });

  it('shows the owner what they hid', async () => {
    render(BadgeStrip, { badges: hiddenAndUnknown, isOwner: true });

    await expect.element(page.getByText('Primeira mesa')).toBeVisible();
  });
});

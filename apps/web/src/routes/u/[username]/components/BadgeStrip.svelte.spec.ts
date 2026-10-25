import '../../../layout.css';
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

describe('BadgeStrip (the owner’s view)', () => {
  it('shows each earned badge with its name, what it says and since when', async () => {
    render(BadgeStrip, { badges: [held('first-table')] });

    await expect.element(page.getByRole('heading', { name: 'Conquistas' })).toBeVisible();
    await expect.element(page.getByText('Primeira mesa')).toBeVisible();
    await expect.element(page.getByText('Jogou a primeira sessão.')).toBeVisible();
    await expect.element(page.getByText(/^Conquistada em .*2026/)).toBeVisible();
  });

  it('says a backfilled badge came before the release instead of giving a date', async () => {
    render(BadgeStrip, { badges: [held('pioneer', { backfilled: true })] });

    await expect.element(page.getByText('Antes da estreia das conquistas')).toBeVisible();
  });

  it('gives an eye on each earned badge, and the way back for a hidden one', async () => {
    render(BadgeStrip, {
      badges: [held('first-table'), held('partner', { hidden: true })],
    });

    await expect
      .element(page.getByRole('button', { name: 'Esconder do perfil' }))
      .toHaveAttribute('aria-pressed', 'false');
    await expect
      .element(page.getByRole('button', { name: 'Mostrar no perfil' }))
      .toHaveAttribute('aria-pressed', 'true');
    await expect.element(page.getByText('Escondida do seu perfil')).toBeVisible();
  });

  it('shows what is left to earn, with progress, and the badges only the team gives', async () => {
    render(BadgeStrip, {
      badges: [held('first-table')],
      progress: [{ badgeId: 'regular-player-2', current: 14, goal: 25 }],
    });

    await expect.element(page.getByRole('heading', { name: 'A conquistar' })).toBeVisible();
    await expect.element(page.getByText('Jogar 25 sessões.')).toBeVisible();
    await expect.element(page.getByText('14 de 25 sessões')).toBeVisible();
    await expect.element(page.getByText('Concedida pela equipe.')).toBeVisible();
    await expect.element(page.getByText('0 de 1 concessão')).toBeVisible();
    await expect
      .element(page.getByRole('progressbar', { name: 'Presença constante II' }))
      .toHaveAttribute('value', '14');
  });

  it('skips a badge without artwork', async () => {
    render(BadgeStrip, { badges: [held('first-table'), held('not-a-badge')] });

    await expect.element(page.getByText('Primeira mesa')).toBeVisible();
    expect(page.getByText('not-a-badge').elements()).toHaveLength(0);
  });
});

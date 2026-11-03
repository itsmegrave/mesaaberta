import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { SessionItem } from '#lib/tables/sessions.js';
import TableSessions from './TableSessions.svelte';

const week = 7 * 24 * 3_600_000;
const first = new Date('2026-11-08T22:00:00Z');
const session = (n: number, over: Partial<SessionItem> = {}): SessionItem => ({
  id: `s${n}`,
  number: n,
  startsAt: new Date(+first + (n - 5) * week),
  durationMinutes: 180,
  status: n < 5 ? 'held' : 'scheduled',
  note: null,
  movedFrom: null,
  present: null,
  attended: null,
  ...over,
});
const sessions = [
  session(3, { status: 'cancelled' }),
  session(4, { attended: true }),
  session(5, { note: 'Tragam as fichas novas.' }),
  session(6),
  session(7),
  session(8),
];
const props = { sessions, timezone: 'America/Sao_Paulo', repeat: 'Toda semana' };

describe('TableSessions', () => {
  it('lists three next dates, then all of them on request', async () => {
    render(TableSessions, { ...props, seated: true });

    const upcoming = page.getByRole('list', { name: 'Próximas sessões' });
    await expect.element(upcoming.getByText('Sessão 5')).toBeVisible();
    await expect.element(upcoming.getByText('Tragam as fichas novas.')).toBeVisible();
    await expect.element(upcoming.getByText('Sessão 8')).not.toBeInTheDocument();
    await page.getByRole('button', { name: 'Ver todas as sessões' }).click();
    await expect.element(upcoming.getByText('Sessão 8')).toBeVisible();
  });

  it('shows a player the sessions played, with their own attendance', async () => {
    render(TableSessions, { ...props, seated: true });

    await page.getByRole('button', { name: 'Já jogadas (2)' }).click();
    const past = page.getByRole('list', { name: 'Sessões já jogadas' });
    await expect.element(past.getByText('Você esteve')).toBeVisible();
    await expect.element(past.getByText('Cancelada')).toBeVisible();
  });

  it('shows a visitor how many were played, not the list', async () => {
    render(TableSessions, { ...props, seated: false });

    await expect.element(page.getByText('1 sessão já jogada.')).toBeVisible();
    await expect
      .element(page.getByRole('list', { name: 'Sessões já jogadas' }))
      .not.toBeInTheDocument();
  });
});

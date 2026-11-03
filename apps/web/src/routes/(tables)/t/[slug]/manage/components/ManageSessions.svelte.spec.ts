import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { SessionItem } from '#lib/tables/sessions.js';
import ManageSessions from './ManageSessions.svelte';

const week = 7 * 24 * 3_600_000;
const first = new Date(Date.now() + week);
const session = (n: number, over: Partial<SessionItem> = {}): SessionItem => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
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
const props = {
  next: '/t/mesa/manage',
  timezone: 'America/Sao_Paulo',
  weekly: true,
  durationHours: 3,
  canSchedule: true,
};

describe('ManageSessions', () => {
  it('lists the sessions ahead with their menu, and the ones played with how many came', async () => {
    await page.viewport(1280, 800);
    render(ManageSessions, {
      ...props,
      sessions: [
        session(4, { present: { count: 4, of: 5 } }),
        session(5),
        session(6, { movedFrom: new Date(+first + 2 * week) }),
      ],
    });

    await expect.element(page.getByText('4 de 5 presentes')).toBeVisible();
    await expect.element(page.getByText(/Data movida de/)).toBeVisible();
    await page.getByRole('button', { name: /Ações da sessão 6/ }).click();
    await expect.element(page.getByRole('menuitem', { name: 'Mudar data' })).toBeVisible();
    await expect.element(page.getByRole('menuitem', { name: 'Cancelar sessão…' })).toBeVisible();
  });

  it('does not offer to cancel the only session ahead', async () => {
    await page.viewport(1280, 800);
    render(ManageSessions, { ...props, sessions: [session(5)] });

    await page.getByRole('button', { name: /Ações da sessão 5/ }).click();
    await expect.element(page.getByRole('menuitem', { name: 'Escrever nota' })).toBeVisible();
    await expect
      .element(page.getByRole('menuitem', { name: 'Cancelar sessão…' }))
      .not.toBeInTheDocument();
  });

  it('opens "Agendar sessão" with the day, time, length and a note', async () => {
    await page.viewport(1280, 800);
    render(ManageSessions, { ...props, sessions: [session(5)] });

    await page.getByRole('button', { name: 'Agendar sessão' }).click();
    const dialog = page.getByRole('dialog', { name: 'Agendar sessão' });
    await expect.element(dialog).toBeVisible();
    await expect.element(dialog.getByLabelText(/Nota para quem joga/)).toBeVisible();
  });
});

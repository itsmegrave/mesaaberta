import '../../../routes/layout.css';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AuditTimeline from './AuditTimeline.svelte';
import type { History, HistoryEntry } from '$lib/server/admin/history';

const entry = (over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: crypto.randomUUID(),
  type: 'TableUpdated',
  at: new Date('2026-10-01T15:30:00Z'),
  actor: { id: 'a', username: 'ana' },
  subject: null,
  table: 'Mesa A',
  removed: false,
  changes: null,
  ...over,
});
const show = (entries: HistoryEntry[], more = false, showTable = false) =>
  render(AuditTimeline, {
    history: { entries, more, retentionDays: 90 } satisfies History,
    zone: 'America/Recife',
    showTable,
  });

describe('AuditTimeline', () => {
  it('says there is nothing when there is nothing', async () => {
    show([]);
    await expect.element(page.getByText('Nada registrado ainda.')).toBeVisible();
  });

  it('shows who did it, what happened and when', async () => {
    show([entry({ type: 'TableCreated' })]);
    await expect.element(page.getByText('@ana')).toBeVisible();
    expect(document.body.textContent).toMatch(/@ana\s+criou a mesa/);
    expect(document.querySelector('time')?.getAttribute('datetime')).toBe(
      '2026-10-01T15:30:00.000Z',
    );
  });

  it('names the system when nobody did it', async () => {
    show([entry({ type: 'TableAwaitingConfirmation', actor: null })]);
    await expect.element(page.getByText('Sistema')).toBeVisible();
  });

  it('shows what an edit changed, from and to, and hides what is private', async () => {
    show([
      entry({
        changes: {
          title: { from: 'Antes', to: 'Depois' },
          joinDetails: { redacted: true },
        },
      }),
    ]);
    await expect.element(page.getByText('Título:')).toBeVisible();
    await expect.element(page.getByText(/Antes/)).toBeVisible();
    await expect.element(page.getByText(/Depois/)).toBeVisible();
    await expect.element(page.getByText('Como entrar:')).toBeVisible();
  });

  it('says so for an edit recorded before the log kept the changes', async () => {
    show([entry()]);
    await expect.element(page.getByText(/sem detalhes/i)).toBeVisible();
  });

  it('names the table when asked to, and the retention at the end', async () => {
    show([entry()], true, true);
    await expect.element(page.getByText(/Mesa A/)).toBeVisible();
    await expect.element(page.getByText(/90 dias/)).toBeVisible();
    await expect.element(page.getByText(/mais recentes/)).toBeVisible();
  });

  it('does not name the table by default', async () => {
    show([entry()]);
    await expect.element(page.getByText('@ana')).toBeVisible();
    expect(document.body.textContent).not.toContain('Mesa A');
  });
});
